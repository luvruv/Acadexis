"use client";

import { useActionState } from "react";
import { saveAttainmentSettingsAction } from "./actions";
import FormStatus from "@/components/form-status";
import NativeSelect from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const NUMBER_FIELDS = [
  ["studentLevel3MinPercent", "Student Level 3: score at least this % of the weighted maximum"],
  ["studentLevel2MinPercent", "Student Level 2: score at least this % (below it is Level 1)"],
  ["courseLevel3MinPercent", "Course Level 3: at least this % of students are at Level 3"],
  ["courseLevel2MinPercent", "Course Level 2: at least this % of students are at Level 3"],
];

// settings: percent values for the form. outcomes: [{ id, code, weightPercent }]
export default function SettingsForm({ courseFileId, settings, outcomes, readOnly }) {
  const [state, formAction, isPending] = useActionState(saveAttainmentSettingsAction, {
    ok: null,
    message: "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="courseFileId" value={courseFileId} />

          {NUMBER_FIELDS.map(([name, label]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={name}>{label}</Label>
              <Input
                id={name}
                name={name}
                type="number"
                min="0"
                max="100"
                step="any"
                defaultValue={settings[name]}
                disabled={readOnly}
                required
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="absentPolicy">Absent students (AB)</Label>
            <NativeSelect
              id="absentPolicy"
              name="absentPolicy"
              defaultValue={settings.absentAsZero ? "zero" : "exclude"}
              disabled={readOnly}
            >
              <option value="zero">Count as 0 marks</option>
              <option value="exclude">Leave out of the calculation</option>
            </NativeSelect>
          </div>

          <label className="flex items-center gap-2 self-end text-sm">
            <input
              type="checkbox"
              name="confirmed"
              defaultChecked={settings.confirmed}
              disabled={readOnly}
            />
            Confirmed by the department
          </label>

          {outcomes.length > 0 && (
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm font-medium">
                Overall weight of each Course Outcome (must add up to 100%)
              </p>
              <div className="flex flex-wrap gap-4">
                {outcomes.map((outcome) => (
                  <div key={outcome.id} className="space-y-1">
                    <Label htmlFor={`coWeight-${outcome.id}`}>{outcome.code} (%)</Label>
                    <Input
                      id={`coWeight-${outcome.id}`}
                      name={`coWeight:${outcome.id}`}
                      type="number"
                      min="0"
                      max="100"
                      step="any"
                      defaultValue={outcome.weightPercent}
                      disabled={readOnly}
                      required
                      className="w-28"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 sm:col-span-2">
            <FormStatus state={state} />
            {!readOnly && (
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save settings"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
