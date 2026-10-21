"use client";

import { useActionState } from "react";
import { reviewSectionAction } from "./review-actions";
import FormStatus from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// The outer component keeps the action state (so the result message survives).
// The inner form is re-created after every review, because the section version
// changes and is used as its key.
export default function ReviewPanel(props) {
  const [state, formAction, isPending] = useActionState(reviewSectionAction, {
    ok: null,
    message: "",
  });

  return (
    <ReviewPanelInner
      key={`${props.version}-${props.status}`}
      {...props}
      state={state}
      formAction={formAction}
      isPending={isPending}
    />
  );
}

function ReviewPanelInner({ sectionId, version, status, state, formAction, isPending }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Review</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="sectionId" value={sectionId} />
          <input type="hidden" name="sectionVersion" value={version} />

          <div className="space-y-2">
            <Label htmlFor="review-comment">
              Comment (required when requesting changes)
            </Label>
            <Textarea id="review-comment" name="comment" rows={4} />
          </div>

          <FormStatus state={state} />

          <div className="flex flex-wrap gap-2">
            {status === "SUBMITTED" && (
              <Button type="submit" name="intent" value="approve" disabled={isPending}>
                Approve
              </Button>
            )}
            <Button
              type="submit"
              name="intent"
              value="changes"
              variant="outline"
              disabled={isPending}
            >
              Request changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}