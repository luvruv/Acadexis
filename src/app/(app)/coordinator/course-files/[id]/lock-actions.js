"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { getLockBlockers } from "@/lib/lock";
import { computeAttainment } from "@/lib/attainment";
import { loadAttainmentInputs } from "@/lib/attainment-data";

class BlockedError extends Error {
  constructor(count) {
    super("blocked");
    this.count = count;
  }
}
class AttainmentError extends Error {
  constructor(problems) {
    super("attainment");
    this.problems = problems;
  }
}
class ConflictError extends Error {}

// A frozen copy of the program data, keyed by the section form that shows it.
function buildSnapshots(program) {
  const { school } = program;
  const { university } = school;
  const outcomesOfType = (type) =>
    program.outcomes
      .filter((outcome) => outcome.type === type)
      .map(({ code, description }) => ({ code, description }));

  return {
    "university-vision-mission": {
      universityName: university.name,
      vision: university.vision,
      mission: university.mission,
    },
    "graduate-attributes": {
      attributes: university.graduateAttributes.map((attribute) => attribute.text),
    },
    "school-vision-mission": {
      schoolName: school.name,
      vision: school.vision,
      mission: school.mission,
    },
    "program-outcomes": {
      programName: program.name,
      peos: outcomesOfType("PEO"),
      pos: outcomesOfType("PO"),
      psos: outcomesOfType("PSO"),
    },
  };
}

export async function lockCourseFileAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    const courseFileId = String(formData.get("courseFileId") ?? "");
    if (!courseFileId) return { ok: false, message: "Invalid request." };

    // Only the owning coordinator can lock.
    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      select: { id: true, status: true, course: { select: { programId: true } } },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is already locked." };
    }

    const program = await prisma.program.findUnique({
      where: { id: courseFile.course.programId },
      include: {
        outcomes: { orderBy: [{ type: "asc" }, { position: "asc" }] },
        school: {
          include: {
            university: {
              include: { graduateAttributes: { orderBy: { position: "asc" } } },
            },
          },
        },
      },
    });
    if (!program) return { ok: false, message: "Program not found." };
    const snapshots = buildSnapshots(program);

    try {
      // Serializable: the checks and the lock behave as one atomic step, even
      // if a teacher submits something at the same moment.
      await prisma.$transaction(
        async (tx) => {
          const sections = await tx.courseFileSection.findMany({
            where: { courseFileId },
            select: {
              id: true, number: true, title: true, formKey: true,
              source: true, status: true, isRequired: true,
            },
          });

          const blockers = getLockBlockers(sections);
          if (blockers.length > 0) throw new BlockedError(blockers.length);

          // CO attainment must be calculable from the final marks.
          const attainment = computeAttainment(await loadAttainmentInputs(tx, courseFileId));
          if (!attainment.ready) throw new AttainmentError(attainment.problems);

          const locked = await tx.courseFile.updateMany({
            where: {
              id: courseFileId,
              coordinatorId: user.id,
              status: { notIn: ["LOCKED", "EXPORTED"] },
            },
            data: { status: "LOCKED", lockedAt: new Date(), lockedById: user.id },
          });
          if (locked.count === 0) throw new ConflictError();

          for (const section of sections) {
            // The calculated section stores the frozen result and the settings used.
            if (section.formKey === "co-attainment") {
              await tx.courseFileSection.update({
                where: { id: section.id },
                data: {
                  content: {
                    calculatedAt: new Date().toISOString(),
                    settings: attainment.settings,
                    rows: attainment.rows,
                    overall: attainment.overall,
                  },
                  status: "APPROVED",
                  approvedAt: new Date(),
                  version: { increment: 1 },
                },
              });
              continue;
            }

            const snapshot = snapshots[section.formKey];
            if (section.source !== "PROGRAM_DATA" || !snapshot) continue;
            await tx.courseFileSection.update({
              where: { id: section.id },
              data: { content: snapshot, version: { increment: 1 } },
            });
          }
        },
        { isolationLevel: "Serializable", timeout: 30000 }
      );
    } catch (error) {
      if (error instanceof BlockedError) {
        return {
          ok: false,
          message: `${error.count} section(s) are not ready. Refresh the page to see them.`,
        };
      }
      if (error instanceof AttainmentError) {
        return {
          ok: false,
          message: `CO attainment cannot be calculated yet. ${error.problems
            .slice(0, 3)
            .join(" ")}`,
        };
      }
      if (error instanceof ConflictError || error?.code === "P2034") {
        return {
          ok: false,
          message: "The course file changed at the same moment. Refresh and try again.",
        };
      }
      throw error;
    }

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.COURSE_FILE_LOCKED,
      entityType: "CourseFile",
      entityId: courseFileId,
    });

    revalidatePath(`/coordinator/course-files/${courseFileId}`);
    revalidatePath("/coordinator");
    revalidatePath("/teacher");
    return { ok: true, message: "Course file locked." };
  });
}