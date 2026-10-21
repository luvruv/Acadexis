"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { isReviewable } from "@/lib/sections";
import { refreshCourseFileStatus } from "@/lib/course-file-status";

class ConflictError extends Error {}

export async function reviewSectionAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    const sectionId = String(formData.get("sectionId") ?? "");
    const version = Number(formData.get("sectionVersion"));
    const intent = String(formData.get("intent") ?? "");
    const comment = String(formData.get("comment") ?? "").trim();

    if (
      !sectionId ||
      !Number.isInteger(version) ||
      version < 1 ||
      !["approve", "changes"].includes(intent)
    ) {
      return { ok: false, message: "Invalid request." };
    }
    if (comment.length > 2000) {
      return { ok: false, message: "The comment is too long (max 2000 characters)." };
    }
    if (intent === "changes" && comment.length < 5) {
      return {
        ok: false,
        message: "Write a comment (at least 5 characters) explaining what to change.",
      };
    }

    // Only the owning coordinator can review.
    const section = await prisma.courseFileSection.findFirst({
      where: { id: sectionId, courseFile: { coordinatorId: user.id } },
      include: { courseFile: { select: { id: true, status: true } } },
    });
    if (!section) return { ok: false, message: "Section not found." };
    if (section.courseFile.status === "LOCKED" || section.courseFile.status === "EXPORTED") {
      return { ok: false, message: "The course file is locked." };
    }
    if (!isReviewable(section)) {
      return { ok: false, message: "This section is completed by the system and is not reviewed." };
    }

    const allowedFrom = intent === "approve" ? ["SUBMITTED"] : ["SUBMITTED", "APPROVED"];
    if (!allowedFrom.includes(section.status)) {
      return {
        ok: false,
        message:
          intent === "approve"
            ? "Only submitted sections can be approved."
            : "Only submitted or approved sections can be sent back.",
      };
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Optimistic lock: fails if the section changed since the page loaded.
        const updated = await tx.courseFileSection.updateMany({
          where: {
            id: section.id,
            version,
            status: section.status,
            courseFile: { status: { notIn: ["LOCKED", "EXPORTED"] } },
          },
          data:
            intent === "approve"
              ? { status: "APPROVED", approvedAt: new Date(), version: { increment: 1 } }
              : { status: "CHANGES_REQUESTED", approvedAt: null, version: { increment: 1 } },
        });
        if (updated.count === 0) throw new ConflictError();

        if (comment) {
          await tx.reviewComment.create({
            data: {
              sectionId: section.id,
              authorId: user.id,
              body: comment,
              requestsChanges: intent === "changes",
            },
          });
        }
      });
    } catch (error) {
      if (error instanceof ConflictError) {
        return {
          ok: false,
          message: "This section changed in the meantime. Refresh the page and review again.",
        };
      }
      throw error;
    }

    await refreshCourseFileStatus(section.courseFile.id);
    await logAudit({
      userId: user.id,
      action:
        intent === "approve"
          ? AUDIT_ACTIONS.SECTION_APPROVED
          : AUDIT_ACTIONS.SECTION_CHANGES_REQUESTED,
      entityType: "CourseFileSection",
      entityId: section.id,
      details: { courseFileId: section.courseFile.id, sectionNumber: section.number },
    });

    revalidatePath(`/sections/${section.id}`);
    revalidatePath(`/coordinator/course-files/${section.courseFile.id}`);
    revalidatePath("/coordinator");
    revalidatePath("/teacher");
    return {
      ok: true,
      message:
        intent === "approve"
          ? "Section approved."
          : "Changes requested. The assignee can now edit and resubmit.",
    };
  });
}