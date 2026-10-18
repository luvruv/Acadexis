import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/http";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";

export const ROLES = {
  ADMIN: "ADMIN",
  COORDINATOR: "COORDINATOR",
  CO_TEACHER: "CO_TEACHER",
};

export const ROLE_LABELS = {
  ADMIN: "Admin",
  COORDINATOR: "Coordinator",
  CO_TEACHER: "Co-Teacher",
};

export const ROLE_HOME = {
  ADMIN: "/admin",
  COORDINATOR: "/coordinator",
  CO_TEACHER: "/teacher",
};

// Re-reads the user from the database on every request (once per request).
// passwordHash is never selected.
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) return null;
  return user;
});

export function hasRole(user, allowedRoles) {
  return Boolean(user) && allowedRoles.includes(user.role);
}

async function logDenied(user, allowedRoles) {
  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.ACCESS_DENIED,
    entityType: "Permission",
    details: { requiredRoles: allowedRoles, userRole: user.role },
  });
}

// ----- For pages: redirect when access is not allowed -----

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...allowedRoles) {
  const user = await requireUser();
  if (!hasRole(user, allowedRoles)) {
    await logDenied(user, allowedRoles);
    redirect("/forbidden");
  }
  return user;
}

// ----- For API routes and server actions: throw HTTP errors -----

export async function requireUserOrThrow() {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Authentication required.");
  return user;
}

export async function requireRoleOrThrow(...allowedRoles) {
  const user = await requireUserOrThrow();
  if (!hasRole(user, allowedRoles)) {
    await logDenied(user, allowedRoles);
    throw new HttpError(403, "You do not have permission to do this.");
  }
  return user;
}