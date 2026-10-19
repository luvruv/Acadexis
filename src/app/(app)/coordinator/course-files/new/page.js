import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import CourseFileForm from "./course-file-form";

export const metadata = { title: "New course file | Acadexis" };

export default async function NewCourseFilePage() {
  await requireRole(ROLES.COORDINATOR);

  const [programs, templates] = await Promise.all([
    prisma.program.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, school: { select: { name: true } } },
    }),
    prisma.templateVersion.findMany({
      where: { isActive: true },
      orderBy: { name: "desc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <CourseFileForm
      programs={programs.map((program) => ({
        id: program.id,
        label: `${program.name} (${program.school.name})`,
      }))}
      templates={templates}
    />
  );
}