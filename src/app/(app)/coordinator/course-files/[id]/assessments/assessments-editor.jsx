"use client";

import { useActionState, useRef, useState } from "react";
import { saveAssessmentsAction } from "./actions";
import FormStatus from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_COMPONENTS = 15;

export default function AssessmentsEditor(props) {
  const [state, formAction, isPending] = useActionState(saveAssessmentsAction, {
    ok: null,
    message: "",
  });

  return (
    <AssessmentsForm {...props} state={state} formAction={formAction} isPending={isPending} />
  );
}

function AssessmentsForm({
  courseFileId,
  readOnly,
  outcomes,
  components,
  state,
  formAction,
  isPending,
}) {
  const counter = useRef(0);
  const makeRow = (values) => {
    counter.current += 1;
    return { key: `row-${counter.current}`, markCount: 0, ...values };
  };

  const [rows, setRows] = useState(() =>
    components.length > 0
      ? components.map((component) => makeRow(component))
      : [makeRow({ id: null, name: "", maxMarks: "", courseOutcomeIds: [] })]
  );

  function addRow() {
    setRows((current) => [
      ...current,
      makeRow({ id: null, name: "", maxMarks: "", courseOutcomeIds: [] }),
    ]);
  }

  function removeRow(row) {
    if (
      row.markCount > 0 &&
      !window.confirm(
        `"${row.name}" has ${row.markCount} marks entered. Removing it deletes them. Continue?`
      )
    ) {
      return;
    }
    setRows((current) => current.filter((item) => item.key !== row.key));
  }

  function update(key, changes) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  function toggleOutcome(row, outcomeId) {
    const selected = row.courseOutcomeIds.includes(outcomeId)
      ? row.courseOutcomeIds.filter((id) => id !== outcomeId)
      : [...row.courseOutcomeIds, outcomeId];
    update(row.key, { courseOutcomeIds: selected });
  }

  const payload = JSON.stringify({
    courseFileId,
    components: rows.map((row) => ({
      id: row.id ?? null,
      name: row.name,
      maxMarks: row.maxMarks === "" ? null : Number(row.maxMarks),
      courseOutcomeIds: row.courseOutcomeIds,
    })),
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      {readOnly && (
        <p className="rounded-md border bg-muted p-3 text-sm">
          This course file is locked. Components can no longer be edited.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
          <p className="text-sm text-muted-foreground">
            Tick the Course Outcomes each component assesses. A component with no
            Course Outcome will not count towards attainment.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, index) => (
            <div key={row.key} className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`name-${row.key}`}>Component {index + 1}</Label>
                  <Input
                    id={`name-${row.key}`}
                    value={row.name}
                    onChange={(event) => update(row.key, { name: event.target.value })}
                    placeholder="e.g. Quiz 1"
                    disabled={readOnly}
                    className="w-56"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`max-${row.key}`}>Maximum marks</Label>
                  <Input
                    id={`max-${row.key}`}
                    type="number"
                    min="0"
                    step="any"
                    value={row.maxMarks}
                    onChange={(event) => update(row.key, { maxMarks: event.target.value })}
                    disabled={readOnly}
                    className="w-32"
                  />
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(row)}
                    disabled={rows.length === 1}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                {outcomes.map((outcome) => (
                  <label key={outcome.id} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={row.courseOutcomeIds.includes(outcome.id)}
                      onChange={() => toggleOutcome(row, outcome.id)}
                      disabled={readOnly}
                    />
                    {outcome.code}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {!readOnly && (
            <Button
              type="button"
              variant="secondary"
              onClick={addRow}
              disabled={rows.length >= MAX_COMPONENTS}
            >
              Add component
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <FormStatus state={state} />
        <Button type="submit" disabled={readOnly || isPending}>
          {isPending ? "Saving..." : "Save components"}
        </Button>
      </div>
    </form>
  );
}