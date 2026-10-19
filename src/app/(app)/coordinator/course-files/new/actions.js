"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { createCourseFileSchema } from "@/lib/validation/course-files";

export async function createCourseFileAction(previousState, formData) {
  const values = {
    courseCode: String(formData.get("courseCode") ?? ""),
    title: String(formData.get("title") ?? ""),
    programId: String(formData.get("programId") ?? ""),
    semester: String(formData.get("semester") ?? ""),
    academicYear: String(formData.get("academicYear") ?? ""),
    batch: String(formData.get("batch") ?? ""),
    templateVersionId: String(formData.get("templateVersionId") ?? ""),
  };

  const result = await runAction([ROLES.COORDINATOR], async (user) => {
    const parsed = createCourseFileSchema.safeParse(values);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }
    const data = parsed.data;

    const [program, template] = await Promise.all([
      prisma.program.findUnique({ where: { id: data.programId }, select: { id: true } }),
      prisma.templateVersion.findFirst({
        where: { id: data.templateVersionId, isActive: true },
        include: { sections: { orderBy: { number: "asc" } } },
      }),
    ]);
    if (!program) return { ok: false, message: "Program not found." };
    if (!template || template.sections.length === 0) {
      return { ok: false, message: "Template not found." };
    }

    const existingCourse = await prisma.course.findUnique({
      where: { programId_code: { programId: program.id, code: data.courseCode } },
    });
    if (
      existingCourse &&
      existingCourse.title.trim().toLowerCase() !== data.title.toLowerCase()
    ) {
      return {
        ok: false,
        message: `Course ${data.courseCode} already exists with the title "${existingCourse.title}". Use that title.`,
      };
    }

    try {
      const now = new Date();
      const courseFile = await prisma.$transaction(async (tx) => {
        const course =
          existingCourse ??
          (await tx.course.create({
            data: { programId: program.id, code: data.courseCode, title: data.title },
          }));

        const created = await tx.courseFile.create({
          data: {
            courseId: course.id,
            templateVersionId: template.id,
            coordinatorId: user.id,
            semester: data.semester,
            academicYear: data.academicYear,
            batch: data.batch,
          },
        });

        // Copy the template's sections into this course file. Program-level
        // sections are filled by the system, so they start as Approved.
        await tx.courseFileSection.createMany({
          data: template.sections.map((section) => {
            const automatic = section.source === "PROGRAM_DATA";
            return {
              courseFileId: created.id,
              templateSectionId: section.id,
              number: section.number,
              title: section.title,
              formKey: section.formKey,
              source: section.source,
              isRequired: section.isRequired,
              status: automatic ? "APPROVED" : "PENDING",
              approvedAt: automatic ? now : null,
            };
          }),
        });

        return created;
      });

      await logAudit({
        userId: user.id,
        action: AUDIT_ACTIONS.COURSE_FILE_CREATED,
        entityType: "CourseFile",
        entityId: courseFile.id,
        details: { courseCode: data.courseCode, template: template.name },
      });

      revalidatePath("/coordinator");
      return { ok: true, courseFileId: courseFile.id };
    } catch (error) {
      if (error?.code === "P2002") {
        return {
          ok: false,
          message:
            "A course file for this course, semester and academic year already exists.",
        };
      }
      throw error;
    }
  });

  // redirect() works by throwing, so it must run outside runAction.
  if (result.ok && result.courseFileId) {
    redirect(`/coordinator/course-files/${result.courseFileId}`);
  }
  return { ...result, values };
}