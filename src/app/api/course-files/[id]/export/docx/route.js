import { prisma } from "@/lib/prisma";
import { requireRoleOrThrow, ROLES } from "@/lib/permissions";
import { HttpError, handleApiError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { loadCourseFileDocument } from "@/lib/course-file-data";
import { renderCourseFileDocx } from "@/lib/docx/render";
import { loadAttachmentAssets } from "@/lib/docx/attachments";

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function safeName(text) {
  return String(text).replace(/[^A-Za-z0-9._-]+/g, "_");
}

// Draft export for the owning coordinator. It has no Document ID and is marked
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

    if (doc.header.status === "LOCKED" || doc.header.status === "EXPORTED") {
      throw new HttpError(
        409,
        "This course file is locked. Use the official export on the course file page."
      );
    }

    const assets = await loadAttachmentAssets(doc);
    const buffer = renderCourseFileDocx(doc, { documentId: null, assets });

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.DRAFT_EXPORTED,
      entityType: "CourseFile",
      entityId: id,
      details: { format: "docx" },
    });

    const { courseCode, academicYear, semester } = doc.header;
    const fileName = `${safeName(courseCode)}_${safeName(academicYear)}_${safeName(semester)}_DRAFT.docx`;

    return new Response(buffer, {
      headers: {
        "Content-Type": DOCX_MIME,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}