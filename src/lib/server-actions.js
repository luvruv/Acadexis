import { requireRoleOrThrow } from "@/lib/permissions";
import { HttpError } from "@/lib/http";

// Wrapper for server actions: checks the role on the server first, then runs
// the work and converts errors into a { ok, message } result for the form.
// Do not call redirect() inside "work": it throws and would be caught here.
export async function runAction(allowedRoles, work) {
  try {
    const user = await requireRoleOrThrow(...allowedRoles);
    return await work(user);
  } catch (error) {
    if (error instanceof HttpError) {
      return { ok: false, message: error.message };
    }
    console.error("Server action failed:", error);
    return { ok: false, message: "Could not save. Please try again." };
  }
}