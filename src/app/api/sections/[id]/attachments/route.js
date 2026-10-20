import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrThrow, ROLES } from "@/lib/permissions";
import { HttpError, handleApiError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { EDITABLE_SECTION_STATUSES } from "@/lib/sections";
import { getFormDefinition } from "@/section-forms/registry";
import { deleteStoredFile, saveFile } from "@/lib/storage";
import {
  MAX_FILE_BYTES,
  MAX_FILES_PER_SECTION,
  sanitizeFileName,
  validateUpload,
} from "@/lib/uploads";

export async function POST(request, { params }) {
  try {
    const user = await requireRoleOrThrow(ROLES.CO_TEACHER, ROLES.COORDINATOR);
    const { id: sectionId } = await params;

    // Only the person the section is assigned to can upload.
    const section = await prisma.courseFileSection.findFirst({
      where: { id: sectionId, assigneeId: user.id },
      include: { courseFile: { select: { id: true, status: true } } },
    });
    if (!section) throw new HttpError(404, "Section not found.");
    if (section.courseFile.status === "LOCKED" || section.courseFile.status === "EXPORTED") {
      throw new HttpError(409, "The course file is locked.");
    }
    if (!EDITABLE_SECTION_STATUSES.includes(section.status)) {
      throw new HttpError(409, "This section can no longer be edited.");
    }
    if (!getFormDefinition(section.formKey)?.attachments) {
      throw new HttpError(400, "This section does not accept file uploads.");
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      throw new HttpError(400, "Invalid upload.");
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw new HttpError(400, "Choose a file to upload.");
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new HttpError(413, `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB).`);
    }

    const existingCount = await prisma.attachment.count({ where: { sectionId } });
    if (existingCount >= MAX_FILES_PER_SECTION) {
      throw new HttpError(409, `At most ${MAX_FILES_PER_SECTION} files per section.`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const check = validateUpload(file.name, buffer);
    if (!check.ok) throw new HttpError(400, check.error);

    // The stored name is a random id. The uploaded name is only kept for display.
    const attachmentId = randomUUID();
    const storagePath = `${section.courseFile.id}/${attachmentId}`;
    const originalName = sanitizeFileName(file.name);

    await saveFile(storagePath, buffer);
    let attachment;
    try {
      attachment = await prisma.attachment.create({
        data: {
          id: attachmentId,
          sectionId,
          uploadedById: user.id,
          originalName,
          storagePath,
          mimeType: check.mimeType,
          sizeBytes: buffer.length,
        },
      });
    } catch (error) {
      await deleteStoredFile(storagePath); // do not leave an orphan file
      throw error;
    }

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.ATTACHMENT_UPLOADED,
      entityType: "Attachment",
      entityId: attachment.id,
      details: { sectionId, courseFileId: section.courseFile.id, sizeBytes: buffer.length },
    });

    return NextResponse.json(
      { attachment: { id: attachment.id, name: originalName, sizeBytes: buffer.length } },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}