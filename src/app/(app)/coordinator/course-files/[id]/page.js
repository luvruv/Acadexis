import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  COURSE_FILE_STATUS_LABELS,
  SECTION_SOURCE_LABELS,
  SECTION_STATUS_LABELS,
} from "@/lib/labels";
import StatusBadge from "@/components/status-badge";

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
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">Section</th>
              <th className="p-3">Filled by</th>
              <th className="p-3">Status</th>
              <th className="p-3">Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {courseFile.sections.map((section) => (
              <tr key={section.id} className="border-t align-top">
                <td className="p-3">{section.number}</td>
                <td className="p-3">
                  {section.title}
                  {!section.isRequired && (
                    <span className="ml-2 text-xs text-muted-foreground">(optional)</span>
                  )}
                </td>
                <td className="p-3">{SECTION_SOURCE_LABELS[section.source]}</td>
                <td className="p-3">
                  <StatusBadge status={section.status} labels={SECTION_STATUS_LABELS} />
                </td>
                <td className="p-3">{section.assignee?.name ?? "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}