import { prisma } from "@/lib/prisma";
import { requireRoleOrThrow, ROLES } from "@/lib/permissions";
import { HttpError, handleApiError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { loadCourseFileDocument } from "@/lib/course-file-data";
import { renderCourseFileDocx } from "@/lib/docx/render";
import { loadAttachmentAssets } from "@/lib/docx/attachments";
import { appendAnnexures } from "@/lib/docx/annexures";
import { convertDocxToPdf, PdfUnavailableError } from "@/lib/docx/pdf";

function safeName(text) {
  return String(text).replace(/[^A-Za-z0-9._-]+/g, "_");
}

// Draft PDF for the owning coordinator. It has no Document ID and is marked
// as a draft. Official, stored copies are added in a later step.
export async function GET(_request, { params }) {
  try {
    const user = await requireRoleOrThrow(ROLES.COORDINATOR);
    const { id } = await params;

    const owned = await prisma.courseFile.findFirst({
      where: { id, coordinatorId: user.id },
      select: { id: true },
    });
    if (!owned) throw new HttpError(404, "Course file not found.");

    const doc = await loadCourseFileDocument(prisma, id);
    if (!doc) throw new HttpError(404, "Course file not found.");

    const assets = await loadAttachmentAssets(doc);
    const docxBuffer = renderCourseFileDocx(doc, { documentId: null, assets });

    let pdf;
    try {
      pdf = await convertDocxToPdf(docxBuffer);
    } catch (error) {
      if (error instanceof PdfUnavailableError) throw new HttpError(503, error.message);
      throw error;
    }
    pdf = await appendAnnexures(pdf, assets.annexures);

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.DRAFT_EXPORTED,
      entityType: "CourseFile",
      entityId: id,
      details: { format: "pdf", annexures: assets.annexures.length },
    });

    const { courseCode, academicYear, semester } = doc.header;
    const fileName = `${safeName(courseCode)}_${safeName(academicYear)}_${safeName(semester)}_DRAFT.pdf`;

    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}