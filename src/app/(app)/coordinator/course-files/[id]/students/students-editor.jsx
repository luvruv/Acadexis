"use client";

import { useActionState, useRef, useState } from "react";
import Papa from "papaparse";
import { saveStudentsAction } from "./actions";
import FormStatus from "@/components/form-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_STUDENTS = 1000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Accepted CSV column names (case and punctuation are ignored).
const HEADER_ALIASES = {
  enrollmentNo: [
    "enrollmentno", "enrollmentnumber", "enrolmentno", "enrolmentnumber",
    "enrollment", "enrolment", "enrollmentid", "regno",
    "registrationno", "registrationnumber",
  ],
  rollNo: ["rollno", "rollnumber", "roll"],
  name: ["name", "studentname", "fullname"],
  classGroup: ["classgroup", "class", "section", "group", "division"],
};

function normalizeHeader(header) {
  return String(header).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildHeaderMap(fields) {
  const map = {};
  for (const field of fields) {
    const normalized = normalizeHeader(field);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (!map[key] && aliases.includes(normalized)) map[key] = field;
    }
  }
  return map;
}

function isBlankRow(row) {
  return !row.enrollmentNo.trim() && !row.name.trim() && !row.rollNo.trim() && !row.classGroup.trim();
}

// The outer component keeps the action state (so "Saved" survives). The inner
// form is re-created with fresh data after each save, because the section
// version changes and is used as its key.
export default function StudentsEditor(props) {
  const [state, formAction, isPending] = useActionState(saveStudentsAction, {
    ok: null,
    message: "",
  });

  return (
    <StudentsForm
      key={props.sectionVersion}
      {...props}
      state={state}
      formAction={formAction}
      isPending={isPending}
    />
  );
}

function StudentsForm({
  courseFileId,
  sectionVersion,
  readOnly,
  students,
  state,
  formAction,
  isPending,
}) {
  const counter = useRef(0);
  const [rows, setRows] = useState(() =>
    students.map((student) => ({ key: student.id, ...student }))
  );
  const [importMessage, setImportMessage] = useState("");

  const filledCount = rows.filter((row) => !isBlankRow(row)).length;

  function newKey() {
    counter.current += 1;
    return `new-${counter.current}`;
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { key: newKey(), enrollmentNo: "", rollNo: "", name: "", classGroup: "" },
    ]);
  }

  function removeRow(key) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function updateRow(key, field, value) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  }

  async function handleImport(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    setImportMessage("");
    if (file.size > MAX_FILE_BYTES) {
      setImportMessage("File is too large (max 2 MB).");
      return;
    }

    const text = await file.text();
    const result = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
    const headerMap = buildHeaderMap(result.meta.fields ?? []);
    if (!headerMap.enrollmentNo || !headerMap.name) {
      setImportMessage(
        "The CSV needs at least an enrollment number column and a name column (for example: enrollment_no, name)."
      );
      return;
    }

    const known = new Set(
      rows.map((row) => row.enrollmentNo.trim().toLowerCase()).filter(Boolean)
    );
    const incoming = [];
    let skipped = 0;

    for (const record of result.data) {
      const enrollmentNo = String(record[headerMap.enrollmentNo] ?? "").trim();
      const name = String(record[headerMap.name] ?? "").trim();
      if (!enrollmentNo && !name) continue;

      const id = enrollmentNo.toLowerCase();
      if (enrollmentNo && known.has(id)) {
        skipped += 1;
        continue;
      }
      known.add(id);
      incoming.push({
        key: newKey(),
        enrollmentNo,
        name,
        rollNo: headerMap.rollNo ? String(record[headerMap.rollNo] ?? "").trim() : "",
        classGroup: headerMap.classGroup
          ? String(record[headerMap.classGroup] ?? "").trim()
          : "",
      });
    }

    const kept = rows.filter((row) => !isBlankRow(row));
    if (kept.length + incoming.length > MAX_STUDENTS) {
      setImportMessage(`Too many students. The limit is ${MAX_STUDENTS}.`);
      return;
    }

    setRows([...kept, ...incoming]);
    setImportMessage(
      `Imported ${incoming.length} students${
        skipped > 0 ? `, skipped ${skipped} already in the list` : ""
      }. Review them, then click Save.`
    );
  }

  const payload = JSON.stringify({
    courseFileId,
    sectionVersion,
    students: rows
      .filter((row) => !isBlankRow(row))
      .map(({ enrollmentNo, rollNo, name, classGroup }) => ({
        enrollmentNo,
        rollNo,
        name,
        classGroup,
      })),
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="payload" value={payload} />

      {readOnly && (
        <p className="rounded-md border bg-muted p-3 text-sm">
          This course file is locked. The student list can no longer be edited.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import from CSV</CardTitle>
          <p className="text-sm text-muted-foreground">
            Columns: enrollment_no, roll_no, name, class_group (roll_no and class_group
            are optional). New students are added; enrollment numbers already in the
            list are skipped.{" "}
            <a href="/student-list-template.csv" download className="underline">
              Download a sample CSV
            </a>
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={handleImport}
            disabled={readOnly}
            aria-label="Import student list from CSV"
          />
          {importMessage && <p className="text-sm">{importMessage}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Students ({filledCount})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No students yet. Import a CSV or add rows.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left">
                  <tr>
                    <th className="p-1">#</th>
                    <th className="p-1">Enrollment no.</th>
                    <th className="p-1">Roll no.</th>
                    <th className="p-1">Name</th>
                    <th className="p-1">Class group</th>
                    <th className="p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.key}>
                      <td className="p-1 text-muted-foreground">{index + 1}</td>
                      <td className="p-1">
                        <Input
                          value={row.enrollmentNo}
                          onChange={(e) => updateRow(row.key, "enrollmentNo", e.target.value)}
                          disabled={readOnly}
                          aria-label={`Enrollment number, row ${index + 1}`}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.rollNo}
                          onChange={(e) => updateRow(row.key, "rollNo", e.target.value)}
                          disabled={readOnly}
                          aria-label={`Roll number, row ${index + 1}`}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.name}
                          onChange={(e) => updateRow(row.key, "name", e.target.value)}
                          disabled={readOnly}
                          aria-label={`Name, row ${index + 1}`}
                        />
                      </td>
                      <td className="p-1">
                        <Input
                          value={row.classGroup}
                          onChange={(e) => updateRow(row.key, "classGroup", e.target.value)}
                          disabled={readOnly}
                          aria-label={`Class group, row ${index + 1}`}
                        />
                      </td>
                      <td className="p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeRow(row.key)}
                          disabled={readOnly}
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={addRow}
              disabled={readOnly || rows.length >= MAX_STUDENTS}
            >
              Add row
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows([])}
              disabled={readOnly || rows.length === 0}
            >
              Clear all
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <FormStatus state={state} />
        <Button type="submit" disabled={readOnly || isPending}>
          {isPending ? "Saving..." : "Save student list"}
        </Button>
      </div>
    </form>
  );
}