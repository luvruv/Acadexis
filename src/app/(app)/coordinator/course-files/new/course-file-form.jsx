"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCourseFileAction } from "./actions";
import FormStatus from "@/components/form-status";
import NativeSelect from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CourseFileForm({ programs, templates }) {
  const [state, formAction, isPending] = useActionState(createCourseFileAction, {
    ok: null,
    message: "",
    values: null,
  });
  const values = state.values ?? {};

  if (programs.length === 0 || templates.length === 0) {
    return (
      <p className="text-muted-foreground">
        No program or template found. Ask an admin to run the seed script.
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">New course file</h1>
      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="courseCode">Course code</Label>
              <Input
                id="courseCode"
                name="courseCode"
                placeholder="e.g. CSE3005"
                defaultValue={values.courseCode ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Course title</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Software Engineering"
                defaultValue={values.title ?? ""}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="programId">Program</Label>
              <NativeSelect
                id="programId"
                name="programId"
                defaultValue={values.programId ?? programs[0].id}
              >
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="semester">Semester / term</Label>
              <Input
                id="semester"
                name="semester"
                placeholder="e.g. Semester 5"
                defaultValue={values.semester ?? ""}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic year</Label>
              <Input
                id="academicYear"
                name="academicYear"
                placeholder="e.g. 2026-27"
                defaultValue={values.academicYear ?? ""}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="batch">Batch (optional)</Label>
              <Input
                id="batch"
                name="batch"
                placeholder="e.g. 2024 batch"
                defaultValue={values.batch ?? ""}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="templateVersionId">Template</Label>
              <NativeSelect
                id="templateVersionId"
                name="templateVersionId"
                defaultValue={values.templateVersionId ?? templates[0].id}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-3 sm:col-span-2">
              <FormStatus state={state} />
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create course file"}
                </Button>
                <Link
                  href="/coordinator"
                  className="inline-flex h-9 items-center rounded-md border px-4 text-sm"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}