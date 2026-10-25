import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatDateTime, formatSize } from "@/lib/format";
import { AUDIT_ACTION_LABELS } from "@/lib/audit-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Document | Acadexis" };

export default async function RepositoryDocumentPage({ params }) {
  const user = await requireRole(ROLES.ADMIN, ROLES.COORDINATOR);
  const { documentId } = await params;

  // Admins can open any document. A coordinator only their own. Anyone else
  // gets a 404, so the document's existence is not revealed.
  const document = await prisma.generatedDocument.findFirst({
    where: {
      documentId,
      ...(user.role === ROLES.ADMIN ? {} : { courseFile: { coordinatorId: user.id } }),
    },
    include: {
      generatedBy: { select: { name: true } },
      courseFile: {
        include: {
          course: { include: { program: { include: { school: { select: { name: true } } } } } },
          coordinator: { select: { name: true } },
          templateVersion: { select: { name: true } },
        },
      },
    },
  });
  if (!document) notFound();

  const { courseFile } = document;

  // Every revision of this course file that has been issued.
  const versions = await prisma.generatedDocument.findMany({
    where: { courseFileId: courseFile.id },
    orderBy: { revision: "desc" },
    select: { id: true, documentId: true, revision: true, generatedAt: true },
  });

  // History of the course file: its own events, its sections, its files and
  // its documents.
  const events = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "CourseFile", entityId: courseFile.id },
        { entityType: "CourseFileSection", details: { path: ["courseFileId"], equals: courseFile.id } },
        { entityType: "Attachment", details: { path: ["courseFileId"], equals: courseFile.id } },
        { entityType: "GeneratedDocument", entityId: { in: versions.map((version) => version.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { user: { select: { name: true } } },
  });
  const history = events.filter((event) => AUDIT_ACTION_LABELS[event.action]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/repository" className="text-sm underline">
          Back to repository
        </Link>
        <h1 className="mt-2 font-mono text-2xl font-bold tracking-tight">
          {document.documentId}
        </h1>
        <p className="text-muted-foreground">
          {courseFile.course.code}: {courseFile.course.title}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["Program", courseFile.course.program.name],
            ["School", courseFile.course.program.school.name],
            ["Semester", courseFile.semester],
            ["Academic year", courseFile.academicYear],
            ["Batch", courseFile.batch ?? "-"],
            ["Revision", String(document.revision)],
            ["Template", courseFile.templateVersion.name],
            ["Coordinator", courseFile.coordinator.name],
            ["Issued", `${formatDateTime(document.generatedAt)} by ${document.generatedBy.name}`],
            ["Annexures", String(document.annexureCount)],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="w-32 text-muted-foreground">{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <a
              href={`/api/documents/${document.documentId}?format=pdf`}
              className="font-medium underline"
            >
              Download PDF
            </a>{" "}
            ({formatSize(document.pdfBytes)})
            <div className="font-mono text-xs text-muted-foreground">
              SHA-256: {document.pdfSha256.slice(0, 24)}...
            </div>
          </div>
          <div>
            <a
              href={`/api/documents/${document.documentId}?format=docx`}
              className="font-medium underline"
            >
              Download DOCX
            </a>{" "}
            ({formatSize(document.docxBytes)})
            <div className="font-mono text-xs text-muted-foreground">
              SHA-256: {document.docxSha256.slice(0, 24)}...
            </div>
          </div>
        </CardContent>
      </Card>

      {versions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>All revisions of this course file</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {versions.map((version) => (
                <li key={version.id}>
                  <Link
                    href={`/repository/${version.documentId}`}
                    className={`font-mono underline ${
                      version.id === document.id ? "font-bold" : ""
                    }`}
                  >
                    {version.documentId}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    revision {version.revision}, issued {formatDateTime(version.generatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded events.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">When</th>
                    <th className="p-2">Event</th>
                    <th className="p-2">By</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((event) => {
                    const sectionNumber =
                      event.details && typeof event.details === "object"
                        ? event.details.sectionNumber
                        : null;
                    return (
                      <tr key={event.id} className="border-t">
                        <td className="whitespace-nowrap p-2">
                          {formatDateTime(event.createdAt)}
                        </td>
                        <td className="p-2">
                          {AUDIT_ACTION_LABELS[event.action]}
                          {sectionNumber ? ` (section ${sectionNumber})` : ""}
                        </td>
                        <td className="p-2">{event.user?.name ?? "System"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}