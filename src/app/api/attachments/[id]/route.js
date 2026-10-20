import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireRoleOrThrow,
  requireUserOrThrow,
  ROLES,
} from "@/lib/permissions";
import { HttpError, handleApiError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { EDITABLE_SECTION_STATUSES } from "@/lib/sections";
import { deleteStoredFile, readStoredFile } from "@/lib/storage";

// Download. Allowed for the assigned person and the course file's coordinator.
// Everyone else gets a 404 so the file's existence is not revealed.
export async function GET(_request, { params }) {
  try {
    const user = await requireUserOrThrow();
    const { id } = await params;

    const attachment = await prisma.attachment.findFirst({
      where: {
        id,
        section: {
          OR: [{ assigneeId: user.id }, { courseFile: { coordinatorId: user.id } }],
        },
      },
    });
    if (!attachment) throw new HttpError(404, "File not found.");

    let data;
    try {
      data = await readStoredFile(attachment.storagePath);
    } catch (error) {
      if (error.code === "ENOENT") throw new HttpError(404, "File not found.");
      throw error;
    }

    const asciiName = attachment.originalName
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\]/g, "_");

    return new Response(data, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Length": String(data.length),
        // Always download, never display inside the site.
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(
          attachment.originalName
        )}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Delete. Only the assigned person, and only while the section is editable.
export async function DELETE(_request, { params }) {
  try {
    const user = await requireRoleOrThrow(ROLES.CO_TEACHER, ROLES.COORDINATOR);
    const { id } = await params;

    const attachment = await prisma.attachment.findFirst({
      where: { id, section: { assigneeId: user.id } },
      include: {
        section: {
          select: {
            id: true,
            status: true,
            courseFile: { select: { id: true, status: true } },
          },
        },
      },
    });
    if (!attachment) throw new HttpError(404, "File not found.");

    const fileStatus = attachment.section.courseFile.status;
    if (fileStatus === "LOCKED" || fileStatus === "EXPORTED") {
      throw new HttpError(409, "The course file is locked.");
    }
    if (!EDITABLE_SECTION_STATUSES.includes(attachment.section.status)) {
      throw new HttpError(409, "This section can no longer be edited.");
    }

    await prisma.attachment.delete({ where: { id } });
    try {
      await deleteStoredFile(attachment.storagePath);
    } catch (error) {
      console.error("Could not delete stored file:", error.message);
    }

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.ATTACHMENT_DELETED,
      entityType: "Attachment",
      entityId: id,
      details: { sectionId: attachment.section.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}