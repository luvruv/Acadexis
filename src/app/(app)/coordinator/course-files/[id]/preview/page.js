import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { COURSE_FILE_STATUS_LABELS } from "@/lib/labels";
import { loadCourseFileDocument } from "@/lib/course-file-data";
import StatusBadge from "@/components/status-badge";
import CourseFileView from "@/components/course-file-view";

export const metadata = { title: "Preview | Acadexis" };

export default async function PreviewPage({ params }) {
  const user = await requireRole(ROLES.COORDINATOR);
  const { id } = await params;

  // A coordinator can only preview their own course files.
  const owned = await prisma.courseFile.findFirst({
    where: { id, coordinatorId: user.id },
    select: { id: true },
  });
  if (!owned) notFound();

  const doc = await loadCourseFileDocument(prisma, id);
  if (!doc) notFound();
  const { header } = doc;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href={`/coordinator/course-files/${id}`} className="text-sm underline">
          Back to course file
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {header.courseCode}: {header.courseTitle}
          </h1>
          <StatusBadge status={header.status} labels={COURSE_FILE_STATUS_LABELS} />
        </div>
        <p className="text-muted-foreground">
          {header.programName} · {header.semester} · {header.academicYear}
          {header.batch ? ` · ${header.batch}` : ""} · {header.templateName}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a read-only preview of the course file content. The DOCX and PDF
          export comes in a later step.
        </p>
      </div>

      <div>
        <a
          href={`/api/course-files/${id}/export/docx`}
          className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Download draft (DOCX)
        </a>
        <a
          href={`/api/course-files/${id}/export/pdf`}
          className="ml-2 inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
        >
          Download draft (PDF)
        </a>
      </div>

      <CourseFileView doc={doc} />
    </div>
  );
}