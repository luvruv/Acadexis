import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, ROLE_HOME } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  COURSE_FILE_STATUS_LABELS,
  SECTION_SOURCE_LABELS,
  SECTION_STATUS_LABELS,
} from "@/lib/labels";
import {
  EDITABLE_SECTION_STATUSES,
  isReviewable,
  SECTION_PAGE_SEGMENTS,
} from "@/lib/sections";
import { getFormDefinition } from "@/section-forms/registry";
import StatusBadge from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SectionForm from "./section-form";
import AttachmentsPanel from "./attachments-panel";
import ReviewPanel from "./review-panel";

export const metadata = { title: "Section | Acadexis" };

function formatDateTime(date) {
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

  const definition = getFormDefinition(section.formKey);
  const content =
    section.content && typeof section.content === "object" ? section.content : {};
  const isAssignee = section.assigneeId === user.id;
  const isCoordinator = section.courseFile.coordinatorId === user.id;
  const fileLocked =
    section.courseFile.status === "LOCKED" || section.courseFile.status === "EXPORTED";
  const canEdit =
    isAssignee && !fileLocked && EDITABLE_SECTION_STATUSES.includes(section.status);
  const canReview =
    isCoordinator &&
    !fileLocked &&
    isReviewable(section) &&
    ["SUBMITTED", "APPROVED"].includes(section.status);
  const ownPageSegment = SECTION_PAGE_SEGMENTS[section.formKey];

  let readOnlyReason = null;
  if (!isAssignee) {
    readOnlyReason =
      "You are viewing this section as the coordinator. Only the assigned person can edit it.";
  } else if (fileLocked) {
    readOnlyReason = "The course file is locked, so this section is view only.";
  } else if (section.status === "SUBMITTED") {
    readOnlyReason = "Submitted. It is waiting for the coordinator's review.";
  } else if (section.status === "APPROVED") {
    readOnlyReason = "Approved. It can no longer be edited.";
  }

  const comments = await prisma.reviewComment.findMany({
    where: { sectionId: section.id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });

  const attachments = definition?.attachments
    ? (
        await prisma.attachment.findMany({
          where: { sectionId: section.id },
          orderBy: { createdAt: "asc" },
          include: { uploadedBy: { select: { name: true } } },
        })
      ).map((attachment) => ({
        id: attachment.id,
        name: attachment.originalName,
        sizeBytes: attachment.sizeBytes,
        uploadedBy: attachment.uploadedBy.name,
        uploadedOn: attachment.createdAt.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      }))
    : [];

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
        </CardContent>
      </Card>

      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review comments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-md border p-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                  <span className="font-medium text-foreground">{comment.author.name}</span>
                  <span>{formatDateTime(comment.createdAt)}</span>
                  {comment.requestsChanges && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      Changes requested
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{comment.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {canReview && (
        <ReviewPanel
          sectionId={section.id}
          version={section.version}
          status={section.status}
        />
      )}

      {definition ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Section content</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionForm
                sectionId={section.id}
                version={section.version}
                definition={definition}
                content={content}
                readOnlyReason={readOnlyReason}
              />
            </CardContent>
          </Card>

          {definition.attachments && (
            <AttachmentsPanel
              sectionId={section.id}
              attachments={attachments}
              editable={canEdit}
              min={definition.attachments.min}
            />
          )}
        </>
      ) : section.formKey === "co-attainment" ? (
        <p className="rounded-md border bg-muted p-3 text-sm">
          This section is calculated by the system from the marks.{" "}
          {isCoordinator && (
            <Link
              href={`/coordinator/course-files/${section.courseFile.id}/attainment`}
              className="underline"
            >
              Open CO attainment
            </Link>
          )}
        </p>
      ) : section.formKey === "marks-all-components" ? (
        <p className="rounded-md border bg-muted p-3 text-sm">
          Marks are entered on their own page.{" "}
          <Link href={`/marks/${section.courseFile.id}`} className="underline">
            Open marks entry
          </Link>
        </p>
      ) : ownPageSegment && isCoordinator ? (
        <p className="rounded-md border bg-muted p-3 text-sm">
          The coordinator edits this section on its own page.{" "}
          <Link
            href={`/coordinator/course-files/${section.courseFile.id}/${ownPageSegment}`}
            className="underline"
          >
            Open it
          </Link>{" "}
          to check the content, then approve here.
        </p>
      ) : (
        <p className="rounded-md border bg-muted p-3 text-sm">
          The form for this section type is added in a later step.
        </p>
      )}
    </div>
  );
}