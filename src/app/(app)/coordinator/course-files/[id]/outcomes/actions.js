"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { saveCourseOutcomesSchema } from "@/lib/validation/course-outcomes";
import { refreshCourseFileStatus } from "@/lib/course-file-status";

class ConflictError extends Error {}

export async function saveCourseOutcomesAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    let payload;
    try {
      payload = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "Invalid request." };
    }

    const parsed = saveCourseOutcomesSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }
    const { courseFileId, sectionVersion, outcomes } = parsed.data;

    // Only the owning coordinator can edit, and only while not locked.
    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      include: {
        course: { select: { programId: true } },
        outcomes: { select: { id: true } },
      },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is locked and cannot be edited." };
    }

    const section = await prisma.courseFileSection.findFirst({
      where: { courseFileId, formKey: "course-outcomes" },
      select: { id: true },
    });
    if (!section) {
      return { ok: false, message: "This course file has no Course Outcomes section." };
    }

    // Every existing id must belong to this course file.
    const existingIds = new Set(courseFile.outcomes.map((outcome) => outcome.id));
    const keptIds = outcomes.map((outcome) => outcome.id).filter(Boolean);
    if (
      new Set(keptIds).size !== keptIds.length ||
      keptIds.some((id) => !existingIds.has(id))
    ) {
      return { ok: false, message: "Some outcomes were not found. Refresh and try again." };
    }

    // Every mapped column must be a PO or PSO of this course's program.
    const programOutcomes = await prisma.programOutcome.findMany({
      where: { programId: courseFile.course.programId, type: { in: ["PO", "PSO"] } },
      select: { id: true },
    });
    const validProgramOutcomeIds = new Set(programOutcomes.map((item) => item.id));
    for (const outcome of outcomes) {
      for (const programOutcomeId of Object.keys(outcome.levels)) {
        if (!validProgramOutcomeIds.has(programOutcomeId)) {
          return { ok: false, message: "Invalid mapping. Refresh and try again." };
        }
      }
    }

    try {
      await prisma.$transaction(async (tx) => {
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

        await tx.courseOutcome.deleteMany({
          where: { courseFileId, id: { notIn: keptIds } },
        });

        // Park kept rows on temporary codes so renumbering cannot collide.
        for (const id of keptIds) {
          await tx.courseOutcome.update({ where: { id }, data: { code: `TMP-${id}` } });
        }

        const savedIds = [];
        for (const [index, outcome] of outcomes.entries()) {
          const data = {
            code: `CO${index + 1}`,
            description: outcome.description,
            position: index + 1,
          };
          const saved = outcome.id
            ? await tx.courseOutcome.update({ where: { id: outcome.id }, data })
            : await tx.courseOutcome.create({ data: { courseFileId, ...data } });
          savedIds.push(saved.id);
        }

        await tx.coPoMapping.deleteMany({
          where: { courseOutcomeId: { in: savedIds } },
        });
        const mappings = outcomes.flatMap((outcome, index) =>
          Object.entries(outcome.levels).map(([programOutcomeId, level]) => ({
            courseOutcomeId: savedIds[index],
            programOutcomeId,
            level,
          }))
        );
        if (mappings.length > 0) {
          await tx.coPoMapping.createMany({ data: mappings });
        }
      });
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
      action: AUDIT_ACTIONS.COURSE_OUTCOMES_SAVED,
      entityType: "CourseFile",
      entityId: courseFileId,
      details: { outcomeCount: outcomes.length },
    });

        await refreshCourseFileStatus(courseFileId);
    revalidatePath(`/coordinator/course-files/${courseFileId}/outcomes`);
    revalidatePath(`/coordinator/course-files/${courseFileId}`);
    return { ok: true, message: "Saved." };
  });
}