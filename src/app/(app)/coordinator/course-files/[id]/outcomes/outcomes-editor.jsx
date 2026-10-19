"use client";

import { useActionState, useRef, useState } from "react";
import { saveCourseOutcomesAction } from "./actions";
import FormStatus from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_OUTCOMES = 10;

// The outer component keeps the action state (so "Saved." survives). The inner
// form is re-created with fresh data after every save, because the section
// version changes and is used as its key.
export default function OutcomesEditor(props) {
  const [state, formAction, isPending] = useActionState(saveCourseOutcomesAction, {
    ok: null,
    message: "",
  });

  return (
    <OutcomesForm
      key={props.sectionVersion}
      {...props}
      state={state}
      formAction={formAction}
      isPending={isPending}
    />
  );
}

function OutcomesForm({
  courseFileId,
  sectionVersion,
  readOnly,
  columns,
  outcomes,
  state,
  formAction,
  isPending,
}) {
  const counter = useRef(1);
  const [rows, setRows] = useState(() =>
    outcomes.length > 0
      ? outcomes.map((outcome) => ({ key: outcome.id, ...outcome }))
      : [{ key: "new-0", id: null, description: "", levels: {} }]
  );

  function addRow() {
    setRows((current) => [
      ...current,
      { key: `new-${counter.current++}`, id: null, description: "", levels: {} },
    ]);
  }

  function removeRow(key) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function setDescription(key, description) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, description } : row))
    );
  }

  function setLevel(key, programOutcomeId, value) {
    setRows((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const levels = { ...row.levels };
        if (value === "") delete levels[programOutcomeId];
        else levels[programOutcomeId] = Number(value);
        return { ...row, levels };
      })
    );
  }

  const payload = JSON.stringify({
    courseFileId,
    sectionVersion,
    outcomes: rows.map((row) => ({
      id: row.id ?? null,
      description: row.description,
      levels: row.levels,
    })),
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />

      {readOnly && (
        <p className="rounded-md border bg-muted p-3 text-sm">
          This course file is locked. Course outcomes can no longer be edited.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Course outcomes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.map((row, index) => (
            <div key={row.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`co-${row.key}`}>CO{index + 1}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(row.key)}
                  disabled={readOnly || rows.length === 1}
                >
                  Remove
                </Button>
              </div>
              <Textarea
                id={`co-${row.key}`}
                rows={2}
                value={row.description}
                onChange={(event) => setDescription(row.key, event.target.value)}
                disabled={readOnly}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={addRow}
            disabled={readOnly || rows.length >= MAX_OUTCOMES}
          >
            Add course outcome
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CO-PO / CO-PSO mapping</CardTitle>
          <p className="text-sm text-muted-foreground">
            1 = low, 2 = moderate, 3 = substantial. Leave blank for no mapping.
          </p>
        </CardHeader>
        <CardContent>
          {columns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              This program has no POs or PSOs yet. An admin must add them first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="p-2 text-left">CO</th>
                    {columns.map((column) => (
                      <th
                        key={column.id}
                        className="p-2 text-center font-medium"
                        title={column.description}
                      >
                        {column.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.key} className="border-t">
                      <td className="p-2 font-medium">CO{index + 1}</td>
                      {columns.map((column) => (
                        <td key={column.id} className="p-1 text-center">
                          <select
                            value={row.levels[column.id] ?? ""}
                            onChange={(event) =>
                              setLevel(row.key, column.id, event.target.value)
                            }
                            disabled={readOnly}
                            aria-label={`CO${index + 1} to ${column.code}`}
                            className="h-8 w-14 rounded-md border border-input bg-transparent px-1 text-center text-sm disabled:opacity-50"
                          >
                            <option value="">-</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <FormStatus state={state} />
        <Button type="submit" disabled={readOnly || isPending}>
          {isPending ? "Saving..." : "Save course outcomes and mapping"}
        </Button>
      </div>
    </form>
  );
}