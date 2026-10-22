"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { attainmentSettingsSchema } from "@/lib/validation/attainment";

function toNumber(formData, name) {
  const raw = String(formData.get(name) ?? "").trim();
  return raw === "" ? Number.NaN : Number(raw);
}

export async function saveAttainmentSettingsAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    const parsed = attainmentSettingsSchema.safeParse({
      courseFileId: String(formData.get("courseFileId") ?? ""),
      thresholdPercent: toNumber(formData, "thresholdPercent"),
      level1MinPercent: toNumber(formData, "level1MinPercent"),
      level2MinPercent: toNumber(formData, "level2MinPercent"),
      level3MinPercent: toNumber(formData, "level3MinPercent"),
      absentAsZero: formData.get("absentPolicy") !== "exclude",
      confirmed: formData.get("confirmed") === "on",
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }
    const { courseFileId, ...settings } = parsed.data;

    // Only the owning coordinator, and only while the file is not locked.
    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      select: { status: true },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is locked and cannot be changed." };
    }

    await prisma.attainmentSetting.upsert({
      where: { courseFileId },
      create: { courseFileId, ...settings },
      update: settings,
    });
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.ATTAINMENT_SETTINGS_SAVED,
      entityType: "CourseFile",
      entityId: courseFileId,
      details: settings,
    });

    revalidatePath(`/coordinator/course-files/${courseFileId}/attainment`);
    return { ok: true, message: "Settings saved." };
  });
}