"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { isAssignable } from "@/lib/sections";
import { refreshCourseFileStatus } from "@/lib/course-file-status";

export async function assignSectionsAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    const courseFileId = String(formData.get("courseFileId") ?? "");
    if (!courseFileId) return { ok: false, message: "Invalid request." };

    // Form fields look like: assignee:<sectionId> = <userId or empty>
    const requested = new Map();
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("assignee:")) {
        requested.set(key.slice("assignee:".length), String(value) || null);
      }
    }
    if (requested.size === 0) return { ok: false, message: "Nothing to save." };

    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      include: {
        sections: {
          select: {
            id: true, number: true, formKey: true, source: true,
            status: true, assigneeId: true,
          },
        },
      },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is locked and cannot be changed." };
    }

    // Assignees must be active co-teachers, or the coordinator themselves.
    const assigneeIds = [...new Set([...requested.values()].filter(Boolean))];
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
    const changes = [];
    for (const [sectionId, assigneeId] of requested) {
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
      changes.push({ sectionId, number: section.number, assigneeId });
    }

    if (changes.length === 0) return { ok: true, message: "No changes." };

    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.courseFileSection.update({
          where: { id: change.sectionId },
          data: { assigneeId: change.assigneeId },
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
        changes: changes.map((c) => ({ section: c.number, assigneeId: c.assigneeId })),
      },
    });

    revalidatePath(`/coordinator/course-files/${courseFileId}`);
    revalidatePath("/coordinator");
        await refreshCourseFileStatus(courseFileId);
    return { ok: true, message: `Saved ${changes.length} change(s).` };
  });
}