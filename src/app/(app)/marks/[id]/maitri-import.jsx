"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { autoMapping, buildImport, detectDelimiter, parseMaitriRows } from "@/lib/maitri";
import NativeSelect from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Reads a Maitri (ERP) marks export and puts the marks into the table below.
// Nothing is saved until the person clicks Save on the marks table.
export default function MaitriImport({ students, components, onApply }) {
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [pasted, setPasted] = useState("");
  const [message, setMessage] = useState("");
  const [applied, setApplied] = useState("");

  function load(text) {
    setApplied("");
    const rows = Papa.parse(text, {
      delimiter: detectDelimiter(text),
      skipEmptyLines: false,
    }).data;
    const result = parseMaitriRows(rows);
    if (!result.ok) {
      setParsed(null);
      setMessage(result.error);
      return;
    }
    setMessage("");
    setParsed(result);
    setMapping(autoMapping(result.columns, components));
  }

  async function handleFile(event) {
    const input = event.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (/\.xlsx?$/i.test(file.name)) {
      setParsed(null);
      setMessage(
        "Excel files cannot be read directly. In Excel use File > Save As > CSV, or copy the cells and paste them into the box below."
      );
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setParsed(null);
      setMessage("File is too large (max 5 MB).");
      return;
    }
    load(await file.text());
  }

  const report = useMemo(
    () => (parsed ? buildImport({ parsed, mapping, students, components }) : null),
    [parsed, mapping, students, components]
  );

  function apply() {
    if (!report || report.cells === 0) return;
    onApply(report.entries);
    setApplied(
      `Put ${report.cells} value(s) for ${report.matched} student(s) into the table below. Review them, then click Save.`
    );
    setParsed(null);
    setPasted("");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import from Maitri (ERP) export</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload the export as a CSV file, or copy the cells from Excel and paste them below.
          Students are matched by Roll No (against the enrollment number or roll number in your
          student list). Blank cells keep the existing marks.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            onChange={handleFile}
            className="max-w-sm"
            aria-label="Import Maitri export file"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maitri-paste">Or paste the copied cells here</Label>
          <textarea
            id="maitri-paste"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={4}
            className="w-full rounded-md border bg-background p-2 font-mono text-xs"
            placeholder="Roll No, Student Name, and the marks columns..."
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pasted.trim() === ""}
            onClick={() => load(pasted)}
          >
            Read pasted data
          </Button>
        </div>

        {message && <p className="text-sm text-red-600">{message}</p>}
        {applied && <p className="text-sm">{applied}</p>}

        {parsed && report && (
          <div className="space-y-3 rounded-md border p-3 text-sm">
            <p>
              Found {parsed.students.length} student(s) and {parsed.columns.length} column(s)
              {parsed.meta["Course Name"] ? ` for ${parsed.meta["Course Name"]}` : ""}
              {parsed.meta.CourseCode ? ` (${parsed.meta.CourseCode})` : ""}. Choose where each
              column goes:
            </p>

            <div className="space-y-2">
              {parsed.columns.map((column) => (
                <div key={column.index} className="flex flex-wrap items-center gap-2">
                  <span className="w-56">
                    {column.name}
                    {column.maxMarks !== null && (
                      <span className="text-muted-foreground"> (out of {column.maxMarks})</span>
                    )}
                  </span>
                  <NativeSelect
                    aria-label={`Component for ${column.name}`}
                    value={mapping[column.index] ?? ""}
                    onChange={(event) =>
                      setMapping((current) => ({ ...current, [column.index]: event.target.value }))
                    }
                    className="w-64"
                  >
                    <option value="">Do not import</option>
                    {components.map((component) => (
                      <option key={component.id} value={component.id}>
                        {component.name} (max {component.maxMarks})
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ))}
            </div>

            {report.columnErrors.length > 0 && (
              <ul className="list-disc pl-5 text-red-600">
                {report.columnErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}

            {report.columnErrors.length === 0 && report.mappedColumns > 0 && (
              <div className="space-y-1">
                <p>
                  Ready: {report.cells} value(s) for {report.matched} matched student(s).
                </p>
                {report.unmatched.length > 0 && (
                  <p className="text-amber-700">
                    {report.unmatched.length} Roll No(s) in the file are not in your student list
                    and will be skipped, for example: {report.unmatched.slice(0, 5).join(", ")}.
                  </p>
                )}
                {report.notInFile > 0 && (
                  <p className="text-amber-700">
                    {report.notInFile} student(s) in your list are not in the file. Their marks are
                    unchanged.
                  </p>
                )}
                {report.duplicates > 0 && (
                  <p className="text-amber-700">
                    {report.duplicates} Roll No(s) appear more than once in the file. The last row
                    is used.
                  </p>
                )}
                {report.problemCount > 0 && (
                  <p className="text-amber-700">
                    {report.problemCount} invalid value(s) will be skipped, for example:{" "}
                    {report.problems.join("; ")}.
                  </p>
                )}
              </div>
            )}

            <Button
              type="button"
              onClick={apply}
              disabled={report.columnErrors.length > 0 || report.cells === 0}
            >
              Put these marks into the table
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
