"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { attainmentSettingsSchema } from "@/lib/validation/attainment";

function toNumber(raw) {
  const text = String(raw ?? "").trim();
  return text === "" ? Number.NaN : Number(text);
}

const fraction = (percent, places) => Number((percent / 100).toFixed(places));

export async function saveAttainmentSettingsAction(previousState, formData) {
  return runAction([ROLES.COORDINATOR], async (user) => {
    const coWeights = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("coWeight:")) {
        coWeights.push({ courseOutcomeId: key.slice("coWeight:".length), weightPercent: toNumber(value) });
      }
    }

    const parsed = attainmentSettingsSchema.safeParse({
      courseFileId: String(formData.get("courseFileId") ?? ""),
      studentLevel3MinPercent: toNumber(formData.get("studentLevel3MinPercent")),
      studentLevel2MinPercent: toNumber(formData.get("studentLevel2MinPercent")),
      courseLevel3MinPercent: toNumber(formData.get("courseLevel3MinPercent")),
      courseLevel2MinPercent: toNumber(formData.get("courseLevel2MinPercent")),
      absentAsZero: formData.get("absentPolicy") !== "exclude",
      confirmed: formData.get("confirmed") === "on",
      coWeights,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }
    const { courseFileId, coWeights: weights, ...rest } = parsed.data;

    // Only the owning coordinator, and only while the file is not locked.
    const courseFile = await prisma.courseFile.findFirst({
      where: { id: courseFileId, coordinatorId: user.id },
      select: { status: true },
    });
    if (!courseFile) return { ok: false, message: "Course file not found." };
    if (courseFile.status === "LOCKED" || courseFile.status === "EXPORTED") {
      return { ok: false, message: "This course file is locked and cannot be changed." };
    }

    const outcomes = await prisma.courseOutcome.findMany({
      where: { courseFileId },
      select: { id: true },
    });
    const outcomeIds = new Set(outcomes.map((outcome) => outcome.id));
    if (
      weights.length !== outcomes.length ||
      weights.some((item) => !outcomeIds.has(item.courseOutcomeId))
    ) {
      return { ok: false, message: "The course outcomes changed. Refresh the page and try again." };
    }

    const settings = {
      studentLevel3Min: fraction(rest.studentLevel3MinPercent, 4),
      studentLevel2Min: fraction(rest.studentLevel2MinPercent, 4),
      courseLevel3MinPercent: rest.courseLevel3MinPercent,
      courseLevel2MinPercent: rest.courseLevel2MinPercent,
      absentAsZero: rest.absentAsZero,
      confirmed: rest.confirmed,
    };

    await prisma.$transaction(async (tx) => {
      await tx.attainmentSetting.upsert({
        where: { courseFileId },
        create: { courseFileId, ...settings },
        update: settings,
      });
      for (const item of weights) {
        await tx.courseOutcome.update({
          where: { id: item.courseOutcomeId },
          data: { attainmentWeight: fraction(item.weightPercent, 4) },
        });
      }
    });

    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.ATTAINMENT_SETTINGS_SAVED,
      entityType: "CourseFile",
      entityId: courseFileId,
      details: { ...settings, coWeights: weights },
    });

    revalidatePath(`/coordinator/course-files/${courseFileId}/attainment`);
    return { ok: true, message: "Settings saved." };
  });
}
