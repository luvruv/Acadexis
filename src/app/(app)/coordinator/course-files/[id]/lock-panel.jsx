"use client";

import Link from "next/link";
import { useActionState } from "react";
import { lockCourseFileAction } from "./lock-actions";
import FormStatus from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LockPanel({ courseFileId, status, lockedOn, lockedBy, blockers }) {
  const [state, formAction, isPending] = useActionState(lockCourseFileAction, {
    ok: null,
    message: "",
  });

  if (status === "LOCKED" || status === "EXPORTED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Locked</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          Locked{lockedOn ? ` on ${lockedOn}` : ""}
          {lockedBy ? ` by ${lockedBy}` : ""}. No further edits, uploads or
          assignments are possible.
        </CardContent>
      </Card>
    );
  }

  const ready = blockers.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lock the course file</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {ready ? (
          <p>All required sections are approved. You can lock the course file.</p>
        ) : (
          <>
            <p>
              Not ready to lock. {blockers.length} section(s) still need attention:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {blockers.map((blocker) => (
                <li key={blocker.id}>
                  <Link href={`/sections/${blocker.id}`} className="underline">
                    {blocker.number}. {blocker.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">({blocker.reason})</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <form
          action={formAction}
          onSubmit={(event) => {
            if (
              !window.confirm(
                "Lock this course file? Nothing can be edited afterwards."
              )
            ) {
              event.preventDefault();
            }
          }}
          className="space-y-2"
        >
          <input type="hidden" name="courseFileId" value={courseFileId} />
          <FormStatus state={state} />
          <Button type="submit" disabled={!ready || isPending}>
            {isPending ? "Locking..." : "Lock course file"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}