"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import {
  addOutcomeSchema,
  deleteOutcomeSchema,
  saveOutcomesSchema,
} from "@/lib/validation/outcomes";

const PAGE = "/admin/outcomes";

export async function saveOutcomesAction(previousState, formData) {
  return runAction([ROLES.ADMIN], async (user) => {
    const descriptions = {};
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("description:")) {
        descriptions[key.slice("description:".length)] = value;
      }
    }

    const parsed = saveOutcomesSchema.safeParse({
      programId: formData.get("programId"),
      type: formData.get("type"),
      descriptions,
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

    const { programId, type, descriptions: items } = parsed.data;
    const ids = Object.keys(items);

    // Every id must belong to this program and type (stops forged form data).
    const existing = await prisma.programOutcome.findMany({
      where: { id: { in: ids }, programId, type },
      select: { id: true },
    });
    if (existing.length !== ids.length) {
      return { ok: false, message: "Some outcomes were not found. Refresh and try again." };
    }

    await prisma.$transaction(
      ids.map((id) =>
        prisma.programOutcome.update({
          where: { id },
          data: { description: items[id] },
        })
      )
    );
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PROGRAM_DATA_UPDATED,
      entityType: "ProgramOutcome",
      entityId: programId,
      details: { type, count: ids.length, operation: "update" },
    });

    revalidatePath(PAGE);
    return { ok: true, message: "Saved." };
  });
}

export async function addOutcomeAction(previousState, formData) {
  return runAction([ROLES.ADMIN], async (user) => {
    const parsed = addOutcomeSchema.safeParse({
      programId: formData.get("programId"),
      type: formData.get("type"),
      description: formData.get("description"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

    const { programId, type, description } = parsed.data;
    const program = await prisma.program.findUnique({
      where: { id: programId },
      select: { id: true },
    });
    if (!program) return { ok: false, message: "Program not found." };

    const last = await prisma.programOutcome.aggregate({
      where: { programId, type },
      _max: { position: true },
    });
    const position = (last._max.position ?? 0) + 1;
    const code = `${type}${position}`;

    await prisma.programOutcome.create({
      data: { programId, type, code, description, position },
    });
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PROGRAM_DATA_UPDATED,
      entityType: "ProgramOutcome",
      entityId: programId,
      details: { type, code, operation: "add" },
    });

    revalidatePath(PAGE);
    return { ok: true, message: `${code} added.` };
  });
}

export async function deleteOutcomeAction(previousState, formData) {
  return runAction([ROLES.ADMIN], async (user) => {
    const parsed = deleteOutcomeSchema.safeParse({
      outcomeId: formData.get("outcomeId"),
    });
    if (!parsed.success) {
      return { ok: false, message: "Invalid request." };
    }

    const outcome = await prisma.programOutcome.findUnique({
      where: { id: parsed.data.outcomeId },
      select: { id: true, code: true, programId: true, type: true },
    });
    if (!outcome) return { ok: false, message: "Outcome not found." };

    const mappingCount = await prisma.coPoMapping.count({
      where: { programOutcomeId: outcome.id },
    });
    if (mappingCount > 0) {
      return {
        ok: false,
        message: `${outcome.code} is used in ${mappingCount} CO-PO mapping(s) and cannot be deleted.`,
      };
    }

    await prisma.programOutcome.delete({ where: { id: outcome.id } });
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.PROGRAM_DATA_UPDATED,
      entityType: "ProgramOutcome",
      entityId: outcome.programId,
      details: { type: outcome.type, code: outcome.code, operation: "delete" },
    });

    revalidatePath(PAGE);
    return { ok: true, message: `${outcome.code} deleted.` };
  });
}