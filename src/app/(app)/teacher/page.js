import Link from "next/link";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COURSE_FILE_STATUS_LABELS, SECTION_STATUS_LABELS } from "@/lib/labels";
import StatusBadge from "@/components/status-badge";

export const metadata = { title: "My assignments | Acadexis" };

// Work that needs the teacher's attention comes first.
const STATUS_ORDER = { CHANGES_REQUESTED: 0, PENDING: 1, SUBMITTED: 2, APPROVED: 3 };

export default async function TeacherHomePage() {
  const user = await requireRole(ROLES.CO_TEACHER);

  const assigned = await prisma.courseFileSection.findMany({
    where: { assigneeId: user.id },
    include: {
      courseFile: {
        select: {
          status: true,
          semester: true,
          academicYear: true,
          course: { select: { code: true, title: true } },
          coordinator: { select: { name: true } },
        },
      },
    },
  });

  const sections = assigned.sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      a.courseFile.course.code.localeCompare(b.courseFile.course.code) ||
      a.number - b.number
  );

  const todo = sections.filter(
    (s) => s.status === "PENDING" || s.status === "CHANGES_REQUESTED"
  ).length;
  const submitted = sections.filter((s) => s.status === "SUBMITTED").length;
  const approved = sections.filter((s) => s.status === "APPROVED").length;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My assignments</h1>
        <p className="text-muted-foreground">
          {todo} to do · {submitted} submitted · {approved} approved
        </p>
      </div>

      {sections.length === 0 ? (
        <p className="text-muted-foreground">
          No sections have been assigned to you yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Course</th>
                <th className="p-3">Section</th>
                <th className="p-3">Status</th>
                <th className="p-3">Coordinator</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) => (
                <tr key={section.id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-medium">{section.courseFile.course.code}</div>
                    <div className="text-muted-foreground">
                      {section.courseFile.semester} · {section.courseFile.academicYear}
                    </div>
                    {(section.courseFile.status === "LOCKED" ||
                      section.courseFile.status === "EXPORTED") && (
                      <div className="mt-1">
                        <StatusBadge
                          status={section.courseFile.status}
                          labels={COURSE_FILE_STATUS_LABELS}
                        />
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {section.number}. {section.title}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={section.status} labels={SECTION_STATUS_LABELS} />
                  </td>
                  <td className="p-3">{section.courseFile.coordinator.name}</td>
                  <td className="p-3">
                    <Link href={`/sections/${section.id}`} className="underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}