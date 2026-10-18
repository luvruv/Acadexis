import { NextResponse } from "next/server";
import { requireRoleOrThrow, ROLES } from "@/lib/permissions";
import { handleApiError } from "@/lib/http";

// Temporary route used only to test that API role checks work.
export async function GET() {
  try {
    await requireRoleOrThrow(ROLES.ADMIN);
    return NextResponse.json({ ok: true, message: "Admin access confirmed." });
  } catch (error) {
    return handleApiError(error);
  }
}