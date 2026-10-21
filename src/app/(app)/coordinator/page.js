import Link from "next/link";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COURSE_FILE_STATUS_LABELS } from "@/lib/labels";
import { summarizeSections } from "@/lib/progress";
import StatusBadge from "@/components/status-badge";
import ProgressBar from "@/components/progress-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "My course files | Acadexis" };

function formatDate(date) {
  if (!date) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SummaryCard({ label, value }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default async function CoordinatorHomePage() {
  const user = await requireRole(ROLES.COORDINATOR);

  const courseFiles = await prisma.courseFile.findMany({
    where: { coordinatorId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { code: true, title: true } },
      sections: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          number: true,
          title: true,
          formKey: true,
          source: true,
          isRequired: true,
          status: true,
          assigneeId: true,
          submittedAt: true,
          assignee: { select: { name: true } },
        },
      },
    },
  });

  const rows = courseFiles.map((file) => ({
    file,
    summary: summarizeSections(file.sections),
  }));

  const awaitingReview = courseFiles
    .flatMap((file) =>
      file.sections
        .filter((section) => section.status === "SUBMITTED")
        .map((section) => ({
          ...section,
          fileId: file.id,
          courseCode: file.course.code,
        }))
    )
    .sort(
      (a, b) => (a.submittedAt?.getTime() ?? 0) - (b.submittedAt?.getTime() ?? 0)
    );

  const totals = {
    files: courseFiles.length,
    awaiting: awaitingReview.length,
    changes: rows.reduce(
      (sum, row) => sum + row.summary.countByStatus.CHANGES_REQUESTED,
      0
    ),
    unassigned: rows.reduce((sum, row) => sum + row.summary.unassigned, 0),
  };

  // Workload per contributor across all of this coordinator's course files.
  const workloadMap = new Map();
  for (const file of courseFiles) {
    for (const section of file.sections) {
      if (!section.assigneeId) continue;
      const entry = workloadMap.get(section.assigneeId) ?? {
        name: section.assignee?.name ?? "Unknown",
        open: 0,
        submitted: 0,
        approved: 0,
      };
      if (section.status === "SUBMITTED") entry.submitted += 1;
      else if (section.status === "APPROVED") entry.approved += 1;
      else entry.open += 1;
      workloadMap.set(section.assigneeId, entry);
    }
  }
  const workload = [...workloadMap.values()].sort((a, b) => b.open - a.open);

  return (
    <div className="max-w-6xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My course files</h1>
        <Link
          href="/coordinator/course-files/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          New course file
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Course files" value={totals.files} />
        <SummaryCard label="Awaiting your review" value={totals.awaiting} />
        <SummaryCard label="Changes requested" value={totals.changes} />
        <SummaryCard label="Unassigned sections" value={totals.unassigned} />
      </div>

      {courseFiles.length === 0 ? (
        <p className="text-muted-foreground">
          You have no course files yet. Create your first one.
        </p>
      ) : (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Course files</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Course</th>
                  <th className="p-3">Semester</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Progress (required sections)</th>
                  <th className="p-3">To review</th>
                  <th className="p-3">Unassigned</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ file, summary }) => (
                  <tr key={file.id} className="border-t align-top">
                    <td className="p-3">
                      <Link
                        href={`/coordinator/course-files/${file.id}`}
                        className="font-medium underline"
                      >
                        {file.course.code}
                      </Link>
                      <div className="text-muted-foreground">{file.course.title}</div>
                    </td>
                    <td className="p-3">
                      {file.semester}
                      <div className="text-muted-foreground">{file.academicYear}</div>
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        status={file.status}
                        labels={COURSE_FILE_STATUS_LABELS}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <ProgressBar percent={summary.percent} />
                        <span className="whitespace-nowrap">
                          {summary.approvedRequired} / {summary.requiredTotal} (
                          {summary.percent}%)
                        </span>
                      </div>
                    </td>
                    <td className="p-3">{summary.countByStatus.SUBMITTED}</td>
                    <td className="p-3">{summary.unassigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Awaiting your review</h2>
        {awaitingReview.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing is waiting for review.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Course</th>
                  <th className="p-3">Section</th>
                  <th className="p-3">Submitted by</th>
                  <th className="p-3">Submitted on</th>
                </tr>
              </thead>
              <tbody>
                {awaitingReview.map((section) => (
                  <tr key={section.id} className="border-t">
                    <td className="p-3">
                      <Link
                                          href={`/sections/${section.id}`}
                        className="underline"
                      >
                        {section.courseCode}
                      </Link>
                    </td>
                    <td className="p-3">
                      {section.number}. {section.title}
                    </td>
                    <td className="p-3">{section.assignee?.name ?? "Coordinator"}</td>
                    <td className="p-3">{formatDate(section.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contributor workload</h2>
        {workload.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sections are assigned yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Contributor</th>
                  <th className="p-3">Open (pending or changes requested)</th>
                  <th className="p-3">Submitted</th>
                  <th className="p-3">Approved</th>
                </tr>
              </thead>
              <tbody>
                {workload.map((entry) => (
                  <tr key={entry.name} className="border-t">
                    <td className="p-3 font-medium">{entry.name}</td>
                    <td className="p-3">{entry.open}</td>
                    <td className="p-3">{entry.submitted}</td>
                    <td className="p-3">{entry.approved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}