import { NextResponse } from "next/server";
import { requireUserOrThrow } from "@/lib/permissions";
import { handleApiError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUserOrThrow();
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}