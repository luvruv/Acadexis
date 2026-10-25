import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, ROLES } from "@/lib/permissions";
import { HttpError, handleApiError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { readGeneratedFile } from "@/lib/storage";
import { sha256 } from "@/lib/export-service";

// Download an official document: /api/documents/<Document ID>?format=pdf|docx
// Allowed for the course file's coordinator and for admins. Anyone else gets
// a 404, so the document's existence is not revealed.
export async function GET(request, { params }) {
  try {
    const user = await requireUserOrThrow();
    const { documentId } = await params;
    const isPdf = new URL(request.url).searchParams.get("format") !== "docx";

    const record = await prisma.generatedDocument.findFirst({
      where: {
        documentId,
        ...(user.role === ROLES.ADMIN ? {} : { courseFile: { coordinatorId: user.id } }),
      },
    });
    if (!record) throw new HttpError(404, "Document not found.");

    let data;
    try {
      data = await readGeneratedFile(isPdf ? record.pdfPath : record.docxPath);
    } catch (error) {
      if (error.code === "ENOENT") throw new HttpError(404, "The stored file is missing.");
      throw error;
    }

    // The checksum saved at export time must still match.
    const expected = isPdf ? record.pdfSha256 : record.docxSha256;
    if (sha256(data) !== expected) {
      console.error("Integrity check failed for", record.documentId);
      throw new HttpError(500, "The stored file failed its integrity check.");
    }

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOADED,
      entityType: "GeneratedDocument",
      entityId: record.id,
      details: { documentId: record.documentId, format: isPdf ? "pdf" : "docx" },
    });

    const mime = isPdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    return new Response(data, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="${record.documentId}.${isPdf ? "pdf" : "docx"}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}