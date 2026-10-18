"use client";

import { useActionState } from "react";
import {
  updateGraduateAttributesAction,
  updateSchoolAction,
  updateUniversityAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const INITIAL_STATE = { ok: null, message: "" };

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

function VisionMissionForm({ title, entity, action }) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={entity.id} />
          <div className="space-y-2">
            <Label htmlFor={`vision-${entity.id}`}>Vision</Label>
            <Textarea
              id={`vision-${entity.id}`}
              name="vision"
              rows={5}
              defaultValue={entity.vision}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`mission-${entity.id}`}>Mission</Label>
            <Textarea
              id={`mission-${entity.id}`}
              name="mission"
              rows={6}
              defaultValue={entity.mission}
              required
            />
          </div>
          <Status state={state} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function GraduateAttributesForm({ universityId, attributes }) {
  const [state, formAction, isPending] = useActionState(
    updateGraduateAttributesAction,
    INITIAL_STATE
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Graduate attributes</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="universityId" value={universityId} />
          <div className="space-y-2">
            <Label htmlFor="attributes">One attribute per line</Label>
            <Textarea
              id="attributes"
              name="attributes"
              rows={10}
              defaultValue={attributes.join("\n")}
              required
            />
          </div>
          <Status state={state} />
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ProgramForms({ data }) {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Program setup</h1>
        <p className="text-muted-foreground">
          This information is reused automatically in every course file.
        </p>
      </div>

      <VisionMissionForm
        key={`university-${data.university.updatedAt}`}
        title={`University: ${data.university.name}`}
        entity={data.university}
        action={updateUniversityAction}
      />

      <GraduateAttributesForm
        key={`attributes-${data.attributes.join("|")}`}
        universityId={data.university.id}
        attributes={data.attributes}
      />

      {data.schools.map((school) => (
        <VisionMissionForm
          key={`${school.id}-${school.updatedAt}`}
          title={`School: ${school.name}`}
          entity={school}
          action={updateSchoolAction}
        />
      ))}
    </div>
  );
}