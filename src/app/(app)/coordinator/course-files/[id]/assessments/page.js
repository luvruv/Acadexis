import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import AssessmentsEditor from "./assessments-editor";

export const metadata = { title: "Assessment components | Acadexis" };

export default async function AssessmentsPage({ params }) {
  const user = await requireRole(ROLES.COORDINATOR);
  const { id } = await params;

  const courseFile = await prisma.courseFile.findFirst({
    where: { id, coordinatorId: user.id },
    include: {
      course: { select: { code: true, title: true } },
      outcomes: { orderBy: { position: "asc" }, select: { id: true, code: true } },
      assessmentComponents: {
        orderBy: { position: "asc" },
        include: {
          courseOutcomes: { select: { courseOutcomeId: true } },
          _count: { select: { marks: true } },
        },
      },
    },
  });
  if (!courseFile) notFound();

  const components = courseFile.assessmentComponents.map((component) => ({
    id: component.id,
    name: component.name,
    maxMarks: String(Number(component.maxMarks)),
    courseOutcomeIds: component.courseOutcomes.map((link) => link.courseOutcomeId),
    markCount: component._count.marks,
  }));
  const readOnly = courseFile.status === "LOCKED" || courseFile.status === "EXPORTED";

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href={`/coordinator/course-files/${id}`} className="text-sm underline">
          Back to course file
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Assessment components: {courseFile.course.code}
        </h1>
        <p className="text-muted-foreground">{courseFile.course.title}</p>
      </div>

      {courseFile.outcomes.length === 0 ? (
        <p className="rounded-md border bg-muted p-3 text-sm">
          Define the course outcomes first.{" "}
          <Link href={`/coordinator/course-files/${id}/outcomes`} className="underline">
            Open course outcomes
          </Link>
        </p>
      ) : (
        <AssessmentsEditor
          key={JSON.stringify(components)}
          courseFileId={id}
          readOnly={readOnly}
          outcomes={courseFile.outcomes}
          components={components}
        />
      )}
    </div>
  );
}