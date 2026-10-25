"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { isAssignable } from "@/lib/sections";
import { refreshCourseFileStatus } from "@/lib/course-file-status";
import { parseDateInput, toDateString } from "@/lib/dates";
import { buildReminderMessage } from "@/lib/reminder-message";

const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Saves assignees and due dates from the assignments table in one go.
export async function assignSectionsAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    const courseFileId = String(formData.get("courseFileId") ?? "");
    if (!courseFileId) return { ok: false, message: "Invalid request." };

    // Form fields look like: assignee:<sectionId> and due:<sectionId>
    const assigneeRequests = new Map();
    const dueRequests = new Map();
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("assignee:")) {
        assigneeRequests.set(key.slice("assignee:".length), String(value) || null);
      } else if (key.startsWith("due:")) {
        const text = String(value).trim();
        if (text === "") {
          dueRequests.set(key.slice("due:".length), null);
        } else {
          const parsed = parseDateInput(text);
          if (!parsed) return { ok: false, message: "Enter due dates as valid dates." };
          dueRequests.set(key.slice("due:".length), parsed);
        }
      }
    }
    if (assigneeRequests.size + dueRequests.size === 0) {
      return { ok: false, message: "Nothing to save." };
    }

    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      include: {
        sections: {
          select: {
            id: true, number: true, formKey: true, source: true,
            status: true, assigneeId: true, dueDate: true,
          },
        },
      },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is locked and cannot be changed." };
    }

    // Assignees must be active co-teachers, or the coordinator themselves.
    const assigneeIds = [...new Set([...assigneeRequests.values()].filter(Boolean))];
    if (assigneeIds.length > 0) {
      const validUsers = await prisma.user.findMany({
        where: {
          id: { in: assigneeIds },
          isActive: true,
          OR: [{ role: "CO_TEACHER" }, { id: user.id }],
        },
        select: { id: true },
      });
      if (validUsers.length !== assigneeIds.length) {
        return { ok: false, message: "Choose only active co-teachers. Refresh and try again." };
      }
    }

    const sectionsById = new Map(courseFile.sections.map((s) => [s.id, s]));

    const assigneeChanges = [];
    for (const [sectionId, assigneeId] of assigneeRequests) {
      const section = sectionsById.get(sectionId);
      if (!section) return { ok: false, message: "Some sections were not found. Refresh and try again." };
      if (!isAssignable(section)) {
        return { ok: false, message: `Section ${section.number} cannot be assigned.` };
      }
      if ((section.assigneeId ?? null) === assigneeId) continue;
      if (section.status === "APPROVED") {
        return {
          ok: false,
          message: `Section ${section.number} is approved and cannot be reassigned.`,
        };
      }
      assigneeChanges.push({ sectionId, number: section.number, assigneeId });
    }

    const dueChanges = [];
    for (const [sectionId, dueDate] of dueRequests) {
      const section = sectionsById.get(sectionId);
      if (!section) return { ok: false, message: "Some sections were not found. Refresh and try again." };
      if (!isAssignable(section)) {
        return { ok: false, message: `Section ${section.number} cannot have a due date.` };
      }
      const current = section.dueDate ? toDateString(section.dueDate) : null;
      const next = dueDate ? toDateString(dueDate) : null;
      if (current === next) continue;
      dueChanges.push({ sectionId, number: section.number, dueDate });
    }

    if (assigneeChanges.length + dueChanges.length === 0) {
      return { ok: true, message: "No changes." };
    }

    await prisma.$transaction(async (tx) => {
      for (const change of assigneeChanges) {
        await tx.courseFileSection.update({
          where: { id: change.sectionId },
          data: { assigneeId: change.assigneeId, lastReminderAt: null },
        });
        if (change.assigneeId) {
          await tx.sectionAssignment.create({
            data: {
              sectionId: change.sectionId,
              assigneeId: change.assigneeId,
              assignedById: user.id,
            },
          });
        }
      }

      // A new deadline starts a fresh reminder cycle.
      for (const change of dueChanges) {
        await tx.courseFileSection.update({
          where: { id: change.sectionId },
          data: { dueDate: change.dueDate, lastReminderAt: null },
        });
      }

      // Created -> In progress once any section is assigned.
      if (courseFile.status === "CREATED") {
        const assignedCount = await tx.courseFileSection.count({
          where: { courseFileId, assigneeId: { not: null } },
        });
        if (assignedCount > 0) {
          await tx.courseFile.update({
            where: { id: courseFileId },
            data: { status: "IN_PROGRESS" },
          });
        }
      }
    });

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.SECTIONS_ASSIGNED,
      entityType: "CourseFile",
      entityId: courseFileId,
      details: {
        assignments: assigneeChanges.map((c) => ({ section: c.number, assigneeId: c.assigneeId })),
        dueDates: dueChanges.map((c) => ({
          section: c.number,
          dueDate: c.dueDate ? toDateString(c.dueDate) : null,
        })),
      },
    });

    revalidatePath(`/coordinator/course-files/${courseFileId}`);
    revalidatePath("/coordinator");
    await refreshCourseFileStatus(courseFileId);
    return { ok: true, message: `Saved ${assigneeChanges.length + dueChanges.length} change(s).` };
  });
}

// Sends the assignee an in-app reminder. At most once every 24 hours per section.
export async function remindSectionAction(sectionId) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    if (typeof sectionId !== "string" || !sectionId) {
      return { ok: false, message: "Invalid request." };
    }

    const section = await prisma.courseFileSection.findFirst({
      where: { id: sectionId, courseFile: { coordinatorId: user.id } },
      include: {
        courseFile: { select: { id: true, status: true, course: { select: { code: true } } } },
      },
    });
    if (!section) return { ok: false, message: "Section not found." };
    if (section.courseFile.status === "LOCKED" || section.courseFile.status === "EXPORTED") {
      return { ok: false, message: "The course file is locked." };
    }
    if (!section.assigneeId) return { ok: false, message: "Assign the section first." };
    if (!["PENDING", "CHANGES_REQUESTED"].includes(section.status)) {
      return { ok: false, message: "This section is already submitted or approved." };
    }

    const now = new Date();
    if (
      section.lastReminderAt &&
      now.getTime() - section.lastReminderAt.getTime() < REMINDER_COOLDOWN_MS
    ) {
      return { ok: false, message: "A reminder was already sent in the last 24 hours." };
    }

    await prisma.$transaction([
      prisma.notification.create({
        data: {
          userId: section.assigneeId,
          sectionId: section.id,
          message: buildReminderMessage(
            {
              number: section.number,
              title: section.title,
              courseCode: section.courseFile.course.code,
              dueDate: section.dueDate,
            },
            now
          ),
        },
      }),
      prisma.courseFileSection.update({
        where: { id: section.id },
        data: { lastReminderAt: now },
      }),
    ]);

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.REMINDER_SENT,
      entityType: "CourseFileSection",
      entityId: section.id,
      details: { courseFileId: section.courseFile.id, sectionNumber: section.number },
    });

    return { ok: true, message: "Reminder sent." };
  });
}