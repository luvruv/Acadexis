"use client";

import { useActionState, useMemo, useState } from "react";
import Papa from "papaparse";
import { saveMarksAction } from "./actions";
import { parseMarkValue } from "@/lib/validation/marks";
import FormStatus from "@/components/form-status";
import MaitriImport from "./maitri-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ENROLLMENT_ALIASES = [
  "enrollmentno", "enrollmentnumber", "enrolmentno", "enrolmentnumber",
  "enrollment", "enrolment", "enrollmentid", "regno", "registrationno",
  "registrationnumber",
];

function normalize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}

// The outer component keeps the action state. The inner form is re-created
// after each save (revision changes), so it starts from the saved data.
export default function MarksEditor(props) {
  const [state, formAction, isPending] = useActionState(saveMarksAction, {
    ok: null,
    message: "",
  });

  return (
    <MarksForm
      key={props.revision}
      {...props}
      state={state}
      formAction={formAction}
      isPending={isPending}
    />
  );
}

function MarksForm({
  courseFileId,
  readOnlyReason,
  students,
  components,
  initialValues,
  state,
  formAction,
  isPending,
}) {
  const [values, setValues] = useState(initialValues);
  const [importMessage, setImportMessage] = useState("");
  const readOnly = Boolean(readOnlyReason);

  const changes = useMemo(() => {
    const result = [];
    const keys = new Set([...Object.keys(initialValues), ...Object.keys(values)]);
    for (const key of keys) {
      const now = (values[key] ?? "").trim();
      const before = initialValues[key] ?? "";
      if (now !== before) {
        const [studentId, componentId] = key.split(":");
        result.push({ studentId, componentId, value: now });
      }
    }
    return result;
  }, [values, initialValues]);

  const total = students.length * components.length;
  const entered = Object.values(values).filter((value) => value.trim() !== "").length;

  function setCell(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function downloadTemplate() {
    const header = ["enrollment_no", ...components.map((component) => component.name)];
    const rows = students.map((student) => [
      student.enrollmentNo,
      ...components.map(() => ""),
    ]);
    const csv = Papa.unparse([header, ...rows]);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "marks-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setImportMessage("File is too large (max 2 MB).");
      return;
    }

    const result = Papa.parse(await file.text(), { header: true, skipEmptyLines: "greedy" });
    const fields = result.meta.fields ?? [];
    const enrollmentField = fields.find((field) => ENROLLMENT_ALIASES.includes(normalize(field)));
    if (!enrollmentField) {
      setImportMessage("The CSV needs an enrollment number column (for example: enrollment_no).");
      return;
    }

    const componentByColumn = new Map();
    const ignoredColumns = [];
    for (const field of fields) {
      if (field === enrollmentField) continue;
      const match = components.find((c) => normalize(c.name) === normalize(field));
      if (match) componentByColumn.set(field, match);
      else ignoredColumns.push(field);
    }
    if (componentByColumn.size === 0) {
      setImportMessage("No column matches a component name. Download the template to see the exact names.");
      return;
    }

    const studentByEnrollment = new Map(
      students.map((student) => [student.enrollmentNo.toLowerCase(), student])
    );
    const next = { ...values };
    let cells = 0;
    let unknownStudents = 0;
    const problems = [];
    const touchedStudents = new Set();

    for (const record of result.data) {
      const enrollment = String(record[enrollmentField] ?? "").trim().toLowerCase();
      const student = studentByEnrollment.get(enrollment);
      if (!student) {
        unknownStudents += 1;
        continue;
      }
      for (const [column, component] of componentByColumn) {
        const raw = String(record[column] ?? "").trim();
        if (raw === "") continue; // an empty CSV cell never overwrites existing data
        const check = parseMarkValue(raw, component.maxMarks);
        if (check.error) {
          if (problems.length < 3) {
            problems.push(`${student.enrollmentNo}, ${component.name}: ${check.error}`);
          }
          continue;
        }
        next[`${student.id}:${component.id}`] = check.kind === "absent" ? "AB" : raw;
        touchedStudents.add(student.id);
        cells += 1;
      }
    }

    setValues(next);
    const parts = [
      `Imported ${cells} value(s) for ${touchedStudents.size} student(s). Review them, then click Save.`,
    ];
    if (unknownStudents > 0) parts.push(`${unknownStudents} row(s) had an unknown enrollment number.`);
    if (ignoredColumns.length > 0) parts.push(`Ignored columns: ${ignoredColumns.join(", ")}.`);
    if (problems.length > 0) parts.push(`Skipped invalid values, for example: ${problems.join("; ")}.`);
    setImportMessage(parts.join(" "));
  }

  return (
    <form action={formAction} className="space-y-4">
      <input
        type="hidden"
        name="payload"
        value={JSON.stringify({ courseFileId, changes })}
      />

      {readOnlyReason && (
        <p className="rounded-md border bg-muted p-3 text-sm">{readOnlyReason}</p>
      )}

      {!readOnly && (
        <MaitriImport
          students={students}
          components={components}
          onApply={(entries) => setValues((current) => ({ ...current, ...entries }))}
        />
      )}

      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle>Import from CSV</CardTitle>
            <p className="text-sm text-muted-foreground">
              One column for the enrollment number and one per component, named exactly as
              the component. Use a number, AB for absent, or leave blank. Blank cells keep
              the existing value.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImport}
                className="max-w-sm"
                aria-label="Import marks from CSV"
              />
              <Button type="button" variant="outline" size="sm" onClick={downloadTemplate}>
                Download template
              </Button>
            </div>
            {importMessage && <p className="text-sm">{importMessage}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Marks</CardTitle>
          <p className="text-sm text-muted-foreground">
            {entered} of {total} cells entered. Type a number, or AB for absent. When every
            cell is filled, the marks section goes to the coordinator for review.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-2">Enrollment no.</th>
                  <th className="p-2">Name</th>
                  {components.map((component) => (
                    <th key={component.id} className="p-2 text-center">
                      {component.name}
                      <div className="text-xs font-normal text-muted-foreground">
                        max {component.maxMarks}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-t">
                    <td className="whitespace-nowrap p-2">{student.enrollmentNo}</td>
                    <td className="whitespace-nowrap p-2">{student.name}</td>
                    {components.map((component) => {
                      const key = `${student.id}:${component.id}`;
                      const value = values[key] ?? "";
                      const invalid = Boolean(parseMarkValue(value, component.maxMarks).error);
                      return (
                        <td key={component.id} className="p-1">
                          <Input
                            value={value}
                            onChange={(event) => setCell(key, event.target.value)}
                            disabled={readOnly}
                            inputMode="decimal"
                            aria-label={`${student.enrollmentNo}, ${component.name}`}
                            aria-invalid={invalid}
                            className={`h-8 w-20 px-2 text-center ${
                              invalid ? "border-red-500" : ""
                            }`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <FormStatus state={state} />
        {!readOnly && (
          <Button type="submit" disabled={isPending || changes.length === 0}>
            {isPending ? "Saving..." : `Save marks (${changes.length} change(s))`}
          </Button>
        )}
      </div>
    </form>
  );
}