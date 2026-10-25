import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { getLockBlockers } from "@/lib/lock";
import { loadCourseFileDocument } from "@/lib/course-file-data";
import { renderCourseFileDocx } from "@/lib/docx/render";
import { loadAttachmentAssets } from "@/lib/docx/attachments";
import { appendAnnexures } from "@/lib/docx/annexures";
import { convertDocxToPdf, PdfUnavailableError } from "@/lib/docx/pdf";
import { buildDocumentId } from "@/lib/document-id";
import { deleteGeneratedFile, saveGeneratedFile } from "@/lib/storage";

export const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

async function pickUnusedDocumentId(parts) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const documentId = buildDocumentId(parts);
    const taken = await prisma.generatedDocument.findUnique({
      where: { documentId },
      select: { id: true },
    });
    if (!taken) return documentId;
  }
  throw new Error("Could not find an unused Document ID.");
}

// Issues the official document for a locked course file, or returns the one
// already issued for this revision. Returns { document, created }.
export async function issueOfficialDocument(courseFileId, user) {
  // Only the owning coordinator can export.
  const courseFile = await prisma.courseFile.findFirst({
    where: { id: courseFileId, coordinatorId: user.id },
    select: {
      id: true,
      status: true,
      revision: true,
      semester: true,
      academicYear: true,
      course: { select: { code: true } },
    },
  });
  if (!courseFile) throw new HttpError(404, "Course file not found.");
  if (courseFile.status !== "LOCKED" && courseFile.status !== "EXPORTED") {
    throw new HttpError(409, "Lock the course file before exporting it.");
  }

  const revisionKey = { courseFileId, revision: courseFile.revision };
  const existing = await prisma.generatedDocument.findUnique({
    where: { courseFileId_revision: revisionKey },
  });
  if (existing) return { document: existing, created: false };

  const doc = await loadCourseFileDocument(prisma, courseFileId);
  if (!doc) throw new HttpError(404, "Course file not found.");

  // Sequence diagram step 2: confirm every required section is complete.
  if (getLockBlockers(doc.sections).length > 0) {
    throw new HttpError(409, "Some required sections are not approved.");
  }

  const documentId = await pickUnusedDocumentId({
    courseCode: courseFile.course.code,
    academicYear: courseFile.academicYear,
    semester: courseFile.semester,
    revision: courseFile.revision,
  });

  const assets = await loadAttachmentAssets(doc);
  const docxBuffer = renderCourseFileDocx(doc, { documentId, assets });

  let pdfBuffer;
  try {
    pdfBuffer = await convertDocxToPdf(docxBuffer);
  } catch (error) {
    if (error instanceof PdfUnavailableError) throw new HttpError(503, error.message);
    throw error;
  }
  pdfBuffer = await appendAnnexures(pdfBuffer, assets.annexures);

  const docxPath = `${courseFileId}/${documentId}.docx`;
  const pdfPath = `${courseFileId}/${documentId}.pdf`;
  await saveGeneratedFile(docxPath, docxBuffer);
  await saveGeneratedFile(pdfPath, pdfBuffer);

  try {
    const document = await prisma.$transaction(async (tx) => {
      const created = await tx.generatedDocument.create({
        data: {
          documentId,
          courseFileId,
          revision: courseFile.revision,
          generatedById: user.id,
          docxPath,
          docxBytes: docxBuffer.length,
          docxSha256: sha256(docxBuffer),
          pdfPath,
          pdfBytes: pdfBuffer.length,
          pdfSha256: sha256(pdfBuffer),
          annexureCount: assets.annexures.length,
        },
      });
      // Locked -> Exported (state diagram).
      await tx.courseFile.updateMany({
        where: { id: courseFileId, status: { in: ["LOCKED", "EXPORTED"] } },
        data: { status: "EXPORTED" },
      });
      return created;
    });

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.DOCUMENT_ISSUED,
      entityType: "GeneratedDocument",
      entityId: document.id,
      details: { documentId, courseFileId, revision: courseFile.revision },
    });
    return { document, created: true };
  } catch (error) {
    // Do not leave orphan files behind.
    await deleteGeneratedFile(docxPath);
    await deleteGeneratedFile(pdfPath);

    // Two exports at the same moment: the other one won, so return its result.
    if (error?.code === "P2002") {
      const winner = await prisma.generatedDocument.findUnique({
        where: { courseFileId_revision: revisionKey },
      });
      if (winner) return { document: winner, created: false };
    }
    throw error;
  }
}