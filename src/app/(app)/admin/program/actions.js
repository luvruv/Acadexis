"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRoleOrThrow, ROLES } from "@/lib/permissions";
import { HttpError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import {
  graduateAttributesFormSchema,
  visionMissionFormSchema,
} from "@/lib/validation/program";

// Every action: check the admin role on the server first, then do the work.
async function runAdminAction(work) {
  try {
    const user = await requireRoleOrThrow(ROLES.ADMIN);
    return await work(user);
  } catch (error) {
    if (error instanceof HttpError) {
      return { ok: false, message: error.message };
    }
    console.error("Program setup action failed:", error);
    return { ok: false, message: "Could not save. Please try again." };
  }
}

export async function updateUniversityAction(previousState, formData) {
  return runAdminAction(async (user) => {
    const parsed = visionMissionFormSchema.safeParse({
      id: formData.get("id"),
      vision: formData.get("vision"),
      mission: formData.get("mission"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

    const { id, vision, mission } = parsed.data;
    await prisma.university.update({ where: { id }, data: { vision, mission } });
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PROGRAM_DATA_UPDATED,
      entityType: "University",
      entityId: id,
    });

    revalidatePath("/admin/program");
    return { ok: true, message: "Saved." };
  });
}

export async function updateSchoolAction(previousState, formData) {
  return runAdminAction(async (user) => {
    const parsed = visionMissionFormSchema.safeParse({
      id: formData.get("id"),
      vision: formData.get("vision"),
      mission: formData.get("mission"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

    const { id, vision, mission } = parsed.data;
    await prisma.school.update({ where: { id }, data: { vision, mission } });
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PROGRAM_DATA_UPDATED,
      entityType: "School",
      entityId: id,
    });

    revalidatePath("/admin/program");
    return { ok: true, message: "Saved." };
  });
}

export async function updateGraduateAttributesAction(previousState, formData) {
  return runAdminAction(async (user) => {
    const parsed = graduateAttributesFormSchema.safeParse({
      universityId: formData.get("universityId"),
      attributes: formData.get("attributes"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

    const { universityId, attributes } = parsed.data;
    await prisma.$transaction([
      prisma.graduateAttribute.deleteMany({ where: { universityId } }),
      prisma.graduateAttribute.createMany({
        data: attributes.map((text, index) => ({
          universityId,
          position: index + 1,
          text,
        })),
      }),
    ]);
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PROGRAM_DATA_UPDATED,
      entityType: "GraduateAttributes",
      entityId: universityId,
      details: { count: attributes.length },
    });

    revalidatePath("/admin/program");
    return { ok: true, message: "Saved." };
  });
}