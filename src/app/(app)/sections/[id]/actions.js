"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { EDITABLE_SECTION_STATUSES } from "@/lib/sections";
import { buildContentSchema, getFormDefinition } from "@/section-forms/registry";

export async function saveSectionAction(previousState, formData) {
  return runAction([ROLES.CO_TEACHER, ROLES.COORDINATOR], async (user) => {
    const sectionId = String(formData.get("sectionId") ?? "");
    const version = Number(formData.get("sectionVersion"));
    const submitting = formData.get("intent") === "submit";
    if (!sectionId || !Number.isInteger(version) || version < 1) {
      return { ok: false, message: "Invalid request." };
    }

    // Only the person the section is assigned to can edit it.
    const section = await prisma.courseFileSection.findFirst({
      where: { id: sectionId, assigneeId: user.id },
      include: { courseFile: { select: { id: true, status: true } } },
    });
    if (!section) {
      return { ok: false, message: "You are not allowed to edit this section." };
    }
    if (section.courseFile.status === "LOCKED" || section.courseFile.status === "EXPORTED") {
      return { ok: false, message: "The course file is locked and cannot be edited." };
    }
    if (!EDITABLE_SECTION_STATUSES.includes(section.status)) {
      return { ok: false, message: "This section can no longer be edited." };
    }

    const definition = getFormDefinition(section.formKey);
    if (!definition) {
      return { ok: false, message: "This section has no form yet." };
    }

    const raw = {};
    for (const field of definition.fields) {
      raw[field.name] = String(formData.get(field.name) ?? "");
    }
    const parsed = buildContentSchema(definition, { submit: submitting }).safeParse(raw);
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

        if (submitting && definition.attachments?.min > 0) {
      const attachmentCount = await prisma.attachment.count({
        where: { sectionId: section.id },
      });
      if (attachmentCount < definition.attachments.min) {
        return {
          ok: false,
          message: `Upload at least ${definition.attachments.min} file(s) before submitting.`,
        };
      }
    }

    // Optimistic lock plus a re-check of assignee, status and lock state,
    // all in one atomic update.
    const result = await prisma.courseFileSection.updateMany({
      where: {
        id: section.id,
        version,
        assigneeId: user.id,
        status: { in: EDITABLE_SECTION_STATUSES },
        courseFile: { status: { notIn: ["LOCKED", "EXPORTED"] } },
      },
      data: {
        content: parsed.data,
        version: { increment: 1 },
        ...(submitting
          ? { status: "SUBMITTED", submittedAt: new Date(), approvedAt: null }
          : {}),
      },
    });
    if (result.count === 0) {
      return {
        ok: false,
        message:
          "This section was changed in another tab or by the coordinator. Refresh the page and try again.",
      };
    }

    await logAudit({
      userId: user.id,
      action: submitting ? AUDIT_ACTIONS.SECTION_SUBMITTED : AUDIT_ACTIONS.SECTION_DRAFT_SAVED,
      entityType: "CourseFileSection",
      entityId: section.id,
      details: { courseFileId: section.courseFile.id, sectionNumber: section.number },
    });

    revalidatePath(`/sections/${section.id}`);
    revalidatePath("/teacher");
    revalidatePath("/coordinator");
    return {
      ok: true,
      message: submitting ? "Submitted for review." : "Draft saved.",
    };
  });
}