"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { saveAssessmentsSchema } from "@/lib/validation/assessments";
import { syncMarksSection } from "@/lib/marks";
import { refreshCourseFileStatus } from "@/lib/course-file-status";

export async function saveAssessmentsAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    let payload;
    try {
      payload = JSON.parse(String(formData.get("payload") ?? ""));
    } catch {
      return { ok: false, message: "Invalid request." };
    }

    const parsed = saveAssessmentsSchema.safeParse(payload);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }
    const { courseFileId, components } = parsed.data;

    // Only the owning coordinator, and only while the file is not locked.
    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      include: {
        outcomes: { select: { id: true } },
        assessmentComponents: { select: { id: true } },
      },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is locked and cannot be edited." };
    }

    const validOutcomeIds = new Set(courseFile.outcomes.map((outcome) => outcome.id));
    for (const component of components) {
      if (component.courseOutcomeIds.some((id) => !validOutcomeIds.has(id))) {
        return { ok: false, message: "Invalid Course Outcome. Refresh and try again." };
      }
    }

    const existingIds = new Set(courseFile.assessmentComponents.map((c) => c.id));
    const keptIds = components.map((component) => component.id).filter(Boolean);
    if (
      new Set(keptIds).size !== keptIds.length ||
      keptIds.some((id) => !existingIds.has(id))
    ) {
      return { ok: false, message: "Some components were not found. Refresh and try again." };
    }

    let removedMarks = 0;
    await prisma.$transaction(
      async (tx) => {
        // Removed components take their marks with them (cascade).
        await tx.assessmentComponent.deleteMany({
          where: { courseFileId, id: { notIn: keptIds } },
        });

        // Park kept components on temporary names so renaming cannot collide.
        for (const id of keptIds) {
          await tx.assessmentComponent.update({
            where: { id },
            data: { name: `TMP-${id}` },
          });
        }

        const savedIds = [];
        for (const [index, component] of components.entries()) {
          const data = {
            name: component.name,
            maxMarks: component.maxMarks,
            position: index + 1,
          };
          const saved = component.id
            ? await tx.assessmentComponent.update({ where: { id: component.id }, data })
            : await tx.assessmentComponent.create({ data: { courseFileId, ...data } });
          savedIds.push(saved.id);

          // Marks above a lowered maximum would be invalid, so they are removed.
          const removed = await tx.mark.deleteMany({
            where: { componentId: saved.id, marks: { gt: component.maxMarks } },
          });
          removedMarks += removed.count;
        }

        await tx.componentCourseOutcome.deleteMany({
          where: { componentId: { in: savedIds } },
        });
        const links = components.flatMap((component, index) =>
          [...new Set(component.courseOutcomeIds)].map((courseOutcomeId) => ({
            componentId: savedIds[index],
            courseOutcomeId,
          }))
        );
        if (links.length > 0) {
          await tx.componentCourseOutcome.createMany({ data: links });
        }

        await syncMarksSection(tx, courseFileId);
      },
      { timeout: 30000 }
    );

    await refreshCourseFileStatus(courseFileId);
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.ASSESSMENTS_SAVED,
      entityType: "CourseFile",
      entityId: courseFileId,
      details: { componentCount: components.length, removedMarks },
    });

    revalidatePath(`/coordinator/course-files/${courseFileId}/assessments`);
    revalidatePath(`/coordinator/course-files/${courseFileId}`);
    revalidatePath(`/marks/${courseFileId}`);
    return {
      ok: true,
      message:
        removedMarks > 0
          ? `Saved. ${removedMarks} mark(s) above the new maximum were removed.`
          : "Saved.",
    };
  });
}