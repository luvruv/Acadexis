"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { saveStudentsSchema } from "@/lib/validation/students";
import { refreshCourseFileStatus } from "@/lib/course-file-status";

class ConflictError extends Error {}

export async function saveStudentsAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    let payload;
    try {
      payload = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "Invalid request." };
    }

    const parsed = saveStudentsSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const prefix =
        issue.path[0] === "students" && typeof issue.path[1] === "number"
          ? `Student ${issue.path[1] + 1}: `
          : "";
      return { ok: false, message: prefix + issue.message };
    }
    const { courseFileId, sectionVersion, students } = parsed.data;

    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      select: { id: true, status: true },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is locked and cannot be edited." };
    }

    const section = await prisma.courseFileSection.findFirst({
      where: { courseFileId, formKey: "student-list" },
      select: { id: true },
    });
    if (!section) {
      return { ok: false, message: "This course file has no student list section." };
    }

    const existing = await prisma.student.findMany({
      where: { courseFileId },
      select: { id: true, enrollmentNo: true, rollNo: true, name: true, classGroup: true },
    });
    const existingByEnrollment = new Map(existing.map((s) => [s.enrollmentNo, s]));
    const incomingEnrollments = new Set(students.map((s) => s.enrollmentNo));

    const idsToDelete = existing
      .filter((s) => !incomingEnrollments.has(s.enrollmentNo))
      .map((s) => s.id);
    const toCreate = students.filter((s) => !existingByEnrollment.has(s.enrollmentNo));
    const toUpdate = students.filter((s) => {
      const current = existingByEnrollment.get(s.enrollmentNo);
      return (
        current &&
        (current.name !== s.name ||
          current.rollNo !== s.rollNo ||
          current.classGroup !== s.classGroup)
      );
    });

    try {
      await prisma.$transaction(
        async (tx) => {
          // Optimistic lock: fails if someone saved since this page was loaded.
          const bumped = await tx.courseFileSection.updateMany({
            where: { id: section.id, version: sectionVersion },
            data: {
              status: "SUBMITTED",
              submittedAt: new Date(),
              approvedAt: null,
              version: { increment: 1 },
            },
          });
          if (bumped.count === 0) throw new ConflictError();

          if (idsToDelete.length > 0) {
            await tx.student.deleteMany({ where: { id: { in: idsToDelete } } });
          }
          if (toCreate.length > 0) {
            await tx.student.createMany({
              data: toCreate.map((s) => ({ courseFileId, ...s })),
            });
          }
          for (const student of toUpdate) {
            await tx.student.update({
              where: {
                courseFileId_enrollmentNo: {
                  courseFileId,
                  enrollmentNo: student.enrollmentNo,
                },
              },
              data: {
                name: student.name,
                rollNo: student.rollNo,
                classGroup: student.classGroup,
              },
            });
          }
        },
        { timeout: 30000 }
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        return {
          ok: false,
          message:
            "This section was changed in another tab or window. Refresh the page and try again.",
        };
      }
      throw error;
    }

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.STUDENTS_SAVED,
      entityType: "CourseFile",
      entityId: courseFileId,
      details: {
        total: students.length,
        added: toCreate.length,
        updated: toUpdate.length,
        removed: idsToDelete.length,
      },
    });

        await refreshCourseFileStatus(courseFileId);
    revalidatePath(`/coordinator/course-files/${courseFileId}/students`);
    revalidatePath(`/coordinator/course-files/${courseFileId}`);
    return { ok: true, message: `Saved ${students.length} students.` };
  });
}