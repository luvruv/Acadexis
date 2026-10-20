"use client";

import { useActionState } from "react";
import { saveSectionAction } from "./actions";
import FormStatus from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// The outer component keeps the action state (so "Draft saved." survives). The
// inner form is re-created after each save, because the version changes and is
// used as its key.
export default function SectionForm(props) {
  const [state, formAction, isPending] = useActionState(saveSectionAction, {
    ok: null,
    message: "",
  });

  return (
    <SectionFormInner
      key={props.version}
      {...props}
      state={state}
      formAction={formAction}
      isPending={isPending}
    />
  );
}

function SectionFormInner({
  sectionId,
  version,
  definition,
  content,
  readOnlyReason,
  state,
  formAction,
  isPending,
}) {
  const readOnly = Boolean(readOnlyReason);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="sectionVersion" value={version} />

      {readOnlyReason && (
        <p className="rounded-md border bg-muted p-3 text-sm">{readOnlyReason}</p>
      )}

      {definition.fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={`field-${field.name}`}>
            {field.label}
            {field.required && !readOnly ? " *" : ""}
          </Label>
          <Textarea
            id={`field-${field.name}`}
            name={field.name}
            rows={field.rows ?? 5}
            defaultValue={content[field.name] ?? ""}
            disabled={readOnly}
          />
        </div>
      ))}

      <FormStatus state={state} />

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            name="intent"
            value="draft"
            variant="outline"
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save draft"}
          </Button>
          <Button type="submit" name="intent" value="submit" disabled={isPending}>
            Submit for review
          </Button>
        </div>
      )}
    </form>
  );
}