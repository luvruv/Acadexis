import { prisma } from "@/lib/prisma";

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGIN_BLOCKED: "LOGIN_BLOCKED",
  ACCESS_DENIED: "ACCESS_DENIED",
  PROGRAM_DATA_UPDATED: "PROGRAM_DATA_UPDATED",
  USER_CREATED: "USER_CREATED",
  USER_ROLE_CHANGED: "USER_ROLE_CHANGED",
  USER_STATUS_CHANGED: "USER_STATUS_CHANGED",
  USER_PASSWORD_RESET: "USER_PASSWORD_RESET",
};

// Never throws: a failed audit write must not break the user's request.
// Never put passwords, tokens or secrets in "details".
export async function logAudit({
  userId = null,
  action,
  entityType,
  entityId = null,
  details = null,
}) {
  try {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, details: details ?? undefined },
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}