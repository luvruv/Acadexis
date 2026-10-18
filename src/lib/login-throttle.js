import { prisma } from "@/lib/prisma";
import { AUDIT_ACTIONS } from "@/lib/audit";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

// Counts recent failed logins for this email (whether or not the account exists).
export async function isLoginLocked(email) {
  const since = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);
  const failures = await prisma.auditLog.count({
    where: {
      action: AUDIT_ACTIONS.LOGIN_FAILED,
      entityType: "LoginAttempt",
      entityId: email,
      createdAt: { gte: since },
    },
  });
  return failures >= MAX_FAILED_LOGINS;
}