"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/permissions";
import { runAction } from "@/lib/server-actions";
import { hashPassword } from "@/lib/password";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import {
  changeRoleSchema,
  createUserSchema,
  resetPasswordSchema,
  setActiveSchema,
} from "@/lib/validation/users";

const PAGE = "/admin/users";
const EMPTY_VALUES = { name: "", email: "", role: "CO_TEACHER" };

export async function createUserAction(previousState, formData) {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: String(formData.get("role") ?? "CO_TEACHER"),
  };

  const result = await runAction([ROLES.ADMIN], async (admin) => {
    const parsed = createUserSchema.safeParse({
      ...values,
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

    const { name, email, role, password } = parsed.data;

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, message: "A user with this email already exists." };
    }

    const user = await prisma.user.create({
      data: { name, email, role, passwordHash: await hashPassword(password) },
      select: { id: true },
    });
    await logAudit({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      entityType: "User",
      entityId: user.id,
      details: { email, role },
    });

    revalidatePath(PAGE);
    return { ok: true, message: `User ${email} created.` };
  });

  // Keep what the admin typed (except the password) when something failed.
  return { ...result, values: result.ok ? EMPTY_VALUES : values };
}

export async function changeRoleAction(previousState, formData) {
  return runAction([ROLES.ADMIN], async (admin) => {
    const parsed = changeRoleSchema.safeParse({
      userId: formData.get("userId"),
      role: formData.get("role"),
    });
    if (!parsed.success) return { ok: false, message: "Invalid request." };

    const { userId, role } = parsed.data;
    if (userId === admin.id) {
      return { ok: false, message: "You cannot change your own role." };
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });
    if (!target) return { ok: false, message: "User not found." };
    if (target.role === role) return { ok: true, message: "No change." };

    await prisma.user.update({ where: { id: userId }, data: { role } });
    await logAudit({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
      entityType: "User",
      entityId: userId,
      details: { from: target.role, to: role },
    });

    revalidatePath(PAGE);
    return { ok: true, message: "Role updated." };
  });
}

export async function setActiveAction(previousState, formData) {
  return runAction([ROLES.ADMIN], async (admin) => {
    const parsed = setActiveSchema.safeParse({
      userId: formData.get("userId"),
      isActive: formData.get("isActive"),
    });
    if (!parsed.success) return { ok: false, message: "Invalid request." };

    const { userId, isActive } = parsed.data;
    if (userId === admin.id) {
      return { ok: false, message: "You cannot deactivate your own account." };
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) return { ok: false, message: "User not found." };

    await prisma.user.update({ where: { id: userId }, data: { isActive } });
    await logAudit({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
      entityType: "User",
      entityId: userId,
      details: { isActive },
    });

    revalidatePath(PAGE);
    return { ok: true, message: isActive ? "User activated." : "User deactivated." };
  });
}

export async function resetPasswordAction(previousState, formData) {
  return runAction([ROLES.ADMIN], async (admin) => {
    const parsed = resetPasswordSchema.safeParse({
      userId: formData.get("userId"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0].message };
    }

    const { userId, password } = parsed.data;
    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) return { ok: false, message: "User not found." };

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password) },
    });
    // The password itself is never logged.
    await logAudit({
      userId: admin.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      entityType: "User",
      entityId: userId,
    });

    revalidatePath(PAGE);
    return { ok: true, message: "Password reset." };
  });
}