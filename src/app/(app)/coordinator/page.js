import Link from "next/link";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COURSE_FILE_STATUS_LABELS } from "@/lib/labels";
import StatusBadge from "@/components/status-badge";

export const metadata = { title: "My course files | Acadexis" };

export default async function CoordinatorHomePage() {
  const user = await requireRole(ROLES.COORDINATOR);

  const courseFiles = await prisma.courseFile.findMany({
    where: { coordinatorId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, title: true } },
      sections: { select: { status: true } },
    },
  });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My course files</h1>
        <Link
          href="/coordinator/course-files/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          New course file
        </Link>
      </div>

      {courseFiles.length === 0 ? (
        <p className="text-muted-foreground">
          You have no course files yet. Create your first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Course</th>
                <th className="p-3">Semester</th>
                <th className="p-3">Year</th>
                <th className="p-3">Status</th>
                <th className="p-3">Approved sections</th>
              </tr>
            </thead>
            <tbody>
              {courseFiles.map((file) => {
                const approved = file.sections.filter(
                  (section) => section.status === "APPROVED"
                ).length;
                return (
                  <tr key={file.id} className="border-t">
                    <td className="p-3">
                      <Link
                        href={`/coordinator/course-files/${file.id}`}
                        className="font-medium underline"
                      >
                        {file.course.code}
                      </Link>
                      <div className="text-muted-foreground">{file.course.title}</div>
                    </td>
                    <td className="p-3">{file.semester}</td>
                    <td className="p-3">{file.academicYear}</td>
                    <td className="p-3">
                      <StatusBadge
                        status={file.status}
                        labels={COURSE_FILE_STATUS_LABELS}
                      />
                    </td>
                    <td className="p-3">
                      {approved} / {file.sections.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}