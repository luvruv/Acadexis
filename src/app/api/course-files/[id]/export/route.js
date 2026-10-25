import { NextResponse } from "next/server";
import { requireRoleOrThrow, ROLES } from "@/lib/permissions";
import { handleApiError } from "@/lib/http";
import { issueOfficialDocument } from "@/lib/export-service";

// Issues the official document (or returns the existing one).
export async function POST(_request, { params }) {
  try {
    const user = await requireRoleOrThrow(ROLES.COORDINATOR);
    const { id } = await params;
    const { document, created } = await issueOfficialDocument(id, user);
    return NextResponse.json({ documentId: document.documentId, created });
  } catch (error) {
    return handleApiError(error);
  }
}