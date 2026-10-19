import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import OutcomesEditor from "./outcomes-editor";

export const metadata = { title: "Course outcomes | Acadexis" };

export default async function CourseOutcomesPage({ params }) {
  const user = await requireRole(ROLES.COORDINATOR);
  const { id } = await params;

  const courseFile = await prisma.courseFile.findFirst({
    where: { id, coordinatorId: user.id },
    include: {
      course: { select: { code: true, title: true, programId: true } },
      outcomes: { orderBy: { position: "asc" }, include: { poMappings: true } },
      sections: {
        where: { formKey: "course-outcomes" },
        select: { version: true },
      },
    },
  });
  if (!courseFile || courseFile.sections.length === 0) notFound();

  const programOutcomes = await prisma.programOutcome.findMany({
    where: { programId: courseFile.course.programId, type: { in: ["PO", "PSO"] } },
    orderBy: [{ type: "asc" }, { position: "asc" }],
    select: { id: true, code: true, description: true },
  });

  const outcomes = courseFile.outcomes.map((outcome) => ({
    id: outcome.id,
    description: outcome.description,
    levels: Object.fromEntries(
      outcome.poMappings.map((mapping) => [mapping.programOutcomeId, mapping.level])
    ),
  }));

  const readOnly = courseFile.status === "LOCKED" || courseFile.status === "EXPORTED";

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <Link href={`/coordinator/course-files/${id}`} className="text-sm underline">
          Back to course file
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Course outcomes: {courseFile.course.code}
        </h1>
        <p className="text-muted-foreground">{courseFile.course.title}</p>
      </div>

      <OutcomesEditor
        courseFileId={id}
        sectionVersion={courseFile.sections[0].version}
        readOnly={readOnly}
        columns={programOutcomes}
        outcomes={outcomes}
      />
    </div>
  );
}