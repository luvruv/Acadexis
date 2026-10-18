"use client";

import { useActionState } from "react";
import {
  addOutcomeAction,
  deleteOutcomeAction,
  saveOutcomesAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_STATE = { ok: null, message: "" };

const TYPE_TITLES = {
  PEO: "Program Educational Objectives (PEOs)",
  PO: "Program Outcomes (POs)",
  PSO: "Program Specific Outcomes (PSOs)",
};

function Status({ state }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={state.ok ? "text-sm text-green-700" : "text-sm text-red-600"}
    >
      {state.message}
    </p>
  );
}

// The textarea belongs to the Save form through the "form" attribute, while
// the Delete button lives in its own separate form (forms cannot be nested).
function OutcomeRow({ outcome, saveFormId, deleteAction, busy }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label htmlFor={`description-${outcome.id}`}>{outcome.code}</Label>
        <form action={deleteAction}>
          <input type="hidden" name="outcomeId" value={outcome.id} />
          <Button type="submit" variant="ghost" size="sm" disabled={busy}>
            Delete
          </Button>
        </form>
      </div>
      <Textarea
        id={`description-${outcome.id}`}
        name={`description:${outcome.id}`}
        form={saveFormId}
        rows={3}
        defaultValue={outcome.description}
        required
      />
    </div>
  );
}

function OutcomeGroup({ programId, type, outcomes }) {
  const [saveState, saveAction, saving] = useActionState(saveOutcomesAction, INITIAL_STATE);
  const [deleteState, deleteAction, deleting] = useActionState(deleteOutcomeAction, INITIAL_STATE);
  const [addState, addAction, adding] = useActionState(addOutcomeAction, INITIAL_STATE);
  const busy = saving || deleting || adding;
  const saveFormId = `save-${programId}-${type}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TYPE_TITLES[type]}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {outcomes.length === 0 && (
            <p className="text-sm text-muted-foreground">None yet.</p>
          )}

          {outcomes.map((outcome) => (
            <OutcomeRow
              key={`${outcome.id}:${outcome.description}`}
              outcome={outcome}
              saveFormId={saveFormId}
              deleteAction={deleteAction}
              busy={busy}
            />
          ))}

          <form id={saveFormId} action={saveAction} className="space-y-4">
            <input type="hidden" name="programId" value={programId} />
            <input type="hidden" name="type" value={type} />
            <Status state={saveState} />
            <Status state={deleteState} />
            <Button type="submit" disabled={busy || outcomes.length === 0}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </div>

        <form action={addAction} className="space-y-2 border-t pt-4">
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="type" value={type} />
          <Label htmlFor={`new-${programId}-${type}`}>Add a new {type}</Label>
          <Textarea
            id={`new-${programId}-${type}`}
            name="description"
            rows={3}
            required
          />
          <Status state={addState} />
          <Button type="submit" variant="secondary" disabled={busy}>
            {adding ? "Adding..." : `Add ${type}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function OutcomeForms({ programs }) {
  if (programs.length === 0) {
    return (
      <p className="text-muted-foreground">
        No program found. Run <code>npm run db:seed</code> first.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Program outcomes</h1>
        <p className="text-muted-foreground">
          PEOs, POs and PSOs are reused automatically in every course file.
        </p>
      </div>

      {programs.map((program) => (
        <section key={program.id} className="space-y-6">
          <h2 className="text-xl font-semibold">
            {program.name}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({program.schoolName})
            </span>
          </h2>
          {["PEO", "PO", "PSO"].map((type) => (
            <OutcomeGroup
              key={type}
              programId={program.id}
              type={type}
              outcomes={program.outcomes.filter((outcome) => outcome.type === type)}
            />
          ))}
        </section>
      ))}
    </div>
  );
}