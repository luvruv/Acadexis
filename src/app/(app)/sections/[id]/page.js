import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, ROLE_HOME } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  COURSE_FILE_STATUS_LABELS,
  SECTION_SOURCE_LABELS,
  SECTION_STATUS_LABELS,
} from "@/lib/labels";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Section | Acadexis" };

export default async function SectionPage({ params }) {
  const user = await requireUser();
  const { id } = await params;

  // Only the assigned person or the course file's coordinator can see a section.
  // Anyone else gets a 404, so we do not reveal that the section exists.
  const section = await prisma.courseFileSection.findFirst({
    where: {
      id,
      OR: [{ assigneeId: user.id }, { courseFile: { coordinatorId: user.id } }],
    },
    include: {
      assignee: { select: { name: true } },
      courseFile: {
        include: {
          course: { select: { code: true, title: true } },
          coordinator: { select: { name: true } },
        },
      },
    },
  });
  if (!section) notFound();

  const isAssignee = section.assigneeId === user.id;
  const locked =
    section.courseFile.status === "LOCKED" || section.courseFile.status === "EXPORTED";

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href={ROLE_HOME[user.role]} className="text-sm underline">
          Back
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Section {section.number}: {section.title}
        </h1>
        <p className="text-muted-foreground">
          {section.courseFile.course.code}: {section.courseFile.course.title}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-32 text-muted-foreground">Section status</span>
            <StatusBadge status={section.status} labels={SECTION_STATUS_LABELS} />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-32 text-muted-foreground">Course file</span>
            <StatusBadge
              status={section.courseFile.status}
              labels={COURSE_FILE_STATUS_LABELS}
            />
          </div>
          <div className="flex gap-2">
            <span className="w-32 text-muted-foreground">Filled by</span>
            {SECTION_SOURCE_LABELS[section.source]}
          </div>
          <div className="flex gap-2">
            <span className="w-32 text-muted-foreground">Assigned to</span>
            {section.assignee?.name ?? "Unassigned"}
          </div>
          <div className="flex gap-2">
            <span className="w-32 text-muted-foreground">Coordinator</span>
            {section.courseFile.coordinator.name}
          </div>
          <div className="flex gap-2">
            <span className="w-32 text-muted-foreground">Your access</span>
            {isAssignee
              ? locked
                ? "Assigned to you (the course file is locked, so view only)"
                : "Assigned to you"
              : "Viewing as the coordinator"}
          </div>
        </CardContent>
      </Card>

      <p className="rounded-md border bg-muted p-3 text-sm">
        The data entry form for this section is added in the next step.
      </p>
    </div>
  );
}