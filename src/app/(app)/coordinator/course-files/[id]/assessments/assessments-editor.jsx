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

const emptyRow = () => ({ id: null, name: "", maxMarks: "", courseOutcomeIds: [], outcomeWeights: {} });

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
    return { key: `row-${counter.current}`, markCount: 0, outcomeWeights: {}, ...values };
  };

  const [rows, setRows] = useState(() =>
    components.length > 0
      ? components.map((component) => makeRow(component))
      : [makeRow(emptyRow())]
  );

  function addRow() {
    setRows((current) => [...current, makeRow(emptyRow())]);
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
    const selected = row.courseOutcomeIds.includes(outcomeId);
    const courseOutcomeIds = selected
      ? row.courseOutcomeIds.filter((id) => id !== outcomeId)
      : [...row.courseOutcomeIds, outcomeId];
    const outcomeWeights = { ...row.outcomeWeights };
    if (selected) delete outcomeWeights[outcomeId];
    update(row.key, { courseOutcomeIds, outcomeWeights });
  }

  function setWeight(row, outcomeId, value) {
    update(row.key, { outcomeWeights: { ...row.outcomeWeights, [outcomeId]: value } });
  }

  // Total weight per CO across all components, to show whether it reaches 100%.
  const totals = outcomes.map((outcome) => {
    let sum = 0;
    let count = 0;
    let missing = false;
    for (const row of rows) {
      if (!row.courseOutcomeIds.includes(outcome.id)) continue;
      count += 1;
      const raw = row.outcomeWeights[outcome.id];
      if (raw === undefined || raw === "") missing = true;
      else sum += Number(raw);
    }
    return { outcome, count, sum: Math.round(sum * 100) / 100, missing };
  });

  const payload = JSON.stringify({
    courseFileId,
    components: rows.map((row) => ({
      id: row.id ?? null,
      name: row.name,
      maxMarks: row.maxMarks === "" ? null : Number(row.maxMarks),
      courseOutcomeIds: row.courseOutcomeIds,
      outcomeWeights: Object.fromEntries(
        row.courseOutcomeIds.map((outcomeId) => {
          const raw = row.outcomeWeights[outcomeId];
          return [outcomeId, raw === undefined || raw === "" ? null : Number(raw)];
        })
      ),
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
            Tick the Course Outcomes each component assesses and enter its weight (in %) for each
            of them. For every Course Outcome, the weights of its components must add up to 100%. A
            component with no Course Outcome will not count towards attainment.
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
                {outcomes.map((outcome) => {
                  const ticked = row.courseOutcomeIds.includes(outcome.id);
                  return (
                    <div key={outcome.id} className="flex items-center gap-2">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={ticked}
                          onChange={() => toggleOutcome(row, outcome.id)}
                          disabled={readOnly}
                        />
                        {outcome.code}
                      </label>
                      {ticked && (
                        <span className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            aria-label={`${outcome.code} weight of component ${index + 1} (%)`}
                            value={row.outcomeWeights[outcome.id] ?? ""}
                            onChange={(event) => setWeight(row, outcome.id, event.target.value)}
                            disabled={readOnly}
                            className="h-8 w-20"
                          />
                          %
                        </span>
                      )}
                    </div>
                  );
                })}
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

      <Card>
        <CardHeader>
          <CardTitle>Weight check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {totals.map(({ outcome, count, sum, missing }) => {
            let text;
            if (count === 0) text = "no component yet";
            else if (missing) text = "some weights are still empty";
            else if (Math.abs(sum - 100) <= 0.01) text = `${sum}% (complete)`;
            else text = `${sum}% (must be 100%)`;
            return (
              <p key={outcome.id}>
                <strong>{outcome.code}:</strong> {text}
              </p>
            );
          })}
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
