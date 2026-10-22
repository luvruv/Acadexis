"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { EDITABLE_SECTION_STATUSES } from "@/lib/sections";
import { parseMarkValue } from "@/lib/validation/marks";
import { syncMarksSection } from "@/lib/marks";
import { refreshCourseFileStatus } from "@/lib/course-file-status";

const payloadSchema = z.object({
  courseFileId: z.string().min(1),
  changes: z
    .array(
      z.object({
        studentId: z.string().min(1),
        componentId: z.string().min(1),
        value: z.string().max(12),
      })
    )
    .min(1, "Nothing to save.")
    .max(20000, "Too many changes at once."),
});

export async function saveMarksAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR, ROLES.CO_TEACHER], async (user) => {
    let payload;
    try {
      payload = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "Invalid request." };
    }
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }
    const { courseFileId, changes } = parsed.data;

    // The coordinator, or the person the marks section is assigned to.
    const courseFile = await prisma.courseFile.findFirst({
      where: {
        id: courseFileId,
        OR: [
          { coordinatorId: user.id },
          { sections: { some: { formKey: "marks-all-components", assigneeId: user.id } } },
        ],
      },
      include: {
        students: { select: { id: true, enrollmentNo: true } },
        assessmentComponents: { select: { id: true, name: true, maxMarks: true } },
        sections: {
          where: { formKey: "marks-all-components" },
          select: { status: true, assigneeId: true },
        },
      },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "The course file is locked and cannot be edited." };
    }

    if (courseFile.coordinatorId !== user.id) {
      const marksSection = courseFile.sections[0];
      if (
        !marksSection ||
        marksSection.assigneeId !== user.id ||
        !EDITABLE_SECTION_STATUSES.includes(marksSection.status)
      ) {
        return { ok: false, message: "You cannot edit the marks right now." };
      }
    }

    const students = new Map(courseFile.students.map((student) => [student.id, student]));
    const components = new Map(
      courseFile.assessmentComponents.map((component) => [
        component.id,
        { ...component, max: Number(component.maxMarks) },
      ])
    );

    const toClear = [];
    const toSet = [];
    const seen = new Set();
    for (const change of changes) {
      const student = students.get(change.studentId);
      const component = components.get(change.componentId);
      if (!student || !component) {
        return {
          ok: false,
          message: "Some students or components were not found. Refresh and try again.",
        };
      }

      const key = `${change.studentId}:${change.componentId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const result = parseMarkValue(change.value, component.max);
      if (result.error) {
        return {
          ok: false,
          message: `${student.enrollmentNo}, ${component.name}: ${result.error}.`,
        };
      }

      const cell = { studentId: change.studentId, componentId: change.componentId };
      toClear.push(cell); // remove the old row, then re-create it if a value exists
      if (result.kind === "absent") toSet.push({ ...cell, marks: null, absent: true });
      if (result.kind === "number") toSet.push({ ...cell, marks: result.value, absent: false });
    }

    await prisma.$transaction(
      async (tx) => {
        for (let i = 0; i < toClear.length; i += 500) {
          await tx.mark.deleteMany({ where: { OR: toClear.slice(i, i + 500) } });
        }
        for (let i = 0; i < toSet.length; i += 1000) {
          await tx.mark.createMany({ data: toSet.slice(i, i + 1000) });
        }
        await syncMarksSection(tx, courseFileId);
      },
      { timeout: 60000 }
    );

    await refreshCourseFileStatus(courseFileId);
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.MARKS_SAVED,
      entityType: "CourseFile",
      entityId: courseFileId,
      details: { cellsChanged: seen.size },
    });

    revalidatePath(`/marks/${courseFileId}`);
    revalidatePath(`/coordinator/course-files/${courseFileId}`);
    revalidatePath("/coordinator");
    revalidatePath("/teacher");
    return { ok: true, message: `Saved ${seen.size} change(s).` };
  });
}