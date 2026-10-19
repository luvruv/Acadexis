import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COURSE_FILE_STATUS_LABELS } from "@/lib/labels";
import { isAssignable, SECTION_PAGE_SEGMENTS } from "@/lib/sections";
import StatusBadge from "@/components/status-badge";
import AssignmentsTable from "./assignments-table";

export const metadata = { title: "Course file | Acadexis" };

export default async function CourseFileDetailPage({ params }) {
  const user = await requireRole(ROLES.COORDINATOR);
  const { id } = await params;

  // A coordinator can only open their own course files.
  const courseFile = await prisma.courseFile.findFirst({
    where: { id, coordinatorId: user.id },
    include: {
      course: { include: { program: { select: { name: true } } } },
      templateVersion: { select: { name: true } },
      sections: {
        orderBy: { number: "asc" },
        include: { assignee: { select: { name: true } } },
      },
    },
  });
  if (!courseFile) notFound();

  const candidateUsers = await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: "CO_TEACHER" }, { id: user.id }] },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const candidates = candidateUsers.map((candidate) => ({
    id: candidate.id,
    label: candidate.id === user.id ? `${candidate.name} (me)` : candidate.name,
  }));

  const sections = courseFile.sections.map((section) => {
    const segment = SECTION_PAGE_SEGMENTS[section.formKey];
    return {
      id: section.id,
      number: section.number,
      title: section.title,
      isRequired: section.isRequired,
      source: section.source,
      status: section.status,
      assigneeId: section.assigneeId,
      assignable: isAssignable(section),
      fixedLabel: section.source === "COURSE_SETUP" ? "Coordinator" : "System",
      openHref: segment ? `/coordinator/course-files/${id}/${segment}` : null,
    };
  });

  const assignableCount = sections.filter((section) => section.assignable).length;
  const assignedCount = sections.filter(
    (section) => section.assignable && section.assigneeId
  ).length;
  const readOnly = courseFile.status === "LOCKED" || courseFile.status === "EXPORTED";

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/coordinator" className="text-sm underline">
          Back to my course files
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {courseFile.course.code}: {courseFile.course.title}
          </h1>
          <StatusBadge
            status={courseFile.status}
            labels={COURSE_FILE_STATUS_LABELS}
          />
        </div>
        <p className="text-muted-foreground">
          {courseFile.course.program.name} · {courseFile.semester} ·{" "}
          {courseFile.academicYear}
          {courseFile.batch ? ` · ${courseFile.batch}` : ""} ·{" "}
          {courseFile.templateVersion.name}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {assignedCount} of {assignableCount} assignable sections have an owner.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/coordinator/course-files/${courseFile.id}/outcomes`}
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Course outcomes and CO-PO mapping
        </Link>
        <Link
          href={`/coordinator/course-files/${courseFile.id}/students`}
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Student list
        </Link>
      </div>

      <AssignmentsTable
        courseFileId={courseFile.id}
        sections={sections}
        candidates={candidates}
        readOnly={readOnly}
      />
    </div>
  );
}