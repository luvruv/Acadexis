"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validation/auth";

export async function loginAction(previousState, formData) {
  const email = String(formData.get("email") ?? "");

  const parsed = loginSchema.safeParse({
    email,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, email };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Same message for unknown email, wrong password and disabled account.
      return { error: "Invalid email or password.", email };
    }
    // A successful sign-in works by throwing a redirect. Let it through.
    throw error;
  }
}