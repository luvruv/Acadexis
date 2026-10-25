import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AUDIT_ACTIONS, logAudit } from "@/lib/audit";
import { createDueReminders } from "@/lib/reminders";

// Returns null when no secret is configured, otherwise true or false.
function checkSecret(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return null;

  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called by a scheduler: POST /api/cron/reminders
// with the header  Authorization: Bearer <CRON_SECRET>
export async function POST(request) {
  const authorized = checkSecret(request);
  if (authorized === null) {
    return NextResponse.json({ error: "Reminders are not configured." }, { status: 503 });
  }
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const created = await createDueReminders();
    if (created > 0) {
      await logAudit({
        action: AUDIT_ACTIONS.REMINDERS_GENERATED,
        entityType: "System",
        details: { created },
      });
    }
    return NextResponse.json({ created });
  } catch (error) {
    console.error("Reminder job failed:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}