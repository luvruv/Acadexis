"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validation/auth";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { isLoginLocked, LOCKOUT_MINUTES } from "@/lib/login-throttle";

async function getClientIp() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function loginAction(previousState, formData) {
  const email = String(formData.get("email") ?? "");

  const parsed = loginSchema.safeParse({
    email,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email };
  }

  const normalizedEmail = parsed.data.email;
  const ip = await getClientIp();

  if (await isLoginLocked(normalizedEmail)) {
    await logAudit({
      action: AUDIT_ACTIONS.LOGIN_BLOCKED,
      entityType: "LoginAttempt",
      entityId: normalizedEmail,
      details: { ip },
    });
    return {
      error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
      email,
    };
  }

  try {
    await signIn("credentials", {
      email: normalizedEmail,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      await logAudit({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        entityType: "LoginAttempt",
        entityId: normalizedEmail,
        details: { ip },
      });
      return { error: "Invalid email or password.", email };
    }
    throw error;
  }
}