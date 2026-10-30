import { describe, expect, it } from "vitest";
import { autoMapping, buildImport, detectDelimiter, parseMaitriRows } from "@/lib/maitri";

// The layout of the export, as in the department's workbook (CSE2724).
const RAW = [
  [],
  [],
  ["Programme Name : School Of Engineering and Technology- B.Tech. (CSE)"],
  ["Term : Sem V"],
  ["Course Name : Human Computer Interaction (Pattern - 2023)"],
  ["CourseCode : CSE2724"],
  [],
  ["Sr. No.", "Roll No", "Student Name", "Lab Assessment", "Project", "End term examination"],
  ["", "", "", "Out of(30.0)", "Out of(30.0)", "Out of(40.0)"],
  ["1", "230C2030010", "Agrimm Singh Rathore", "22", "22", "25"],
  ["1", "230C2030011", "Aadi Rao", "20", "20", "11.5"],
  ["1", "230C2030084", "Aman Yadav", "AB", "25", ""],
  ["1", "999X0000000", "Not In The List", "10", "10", "10"],
  ["", "", "", "", "", ""],
];

const students = [
  { id: "s1", enrollmentNo: "230C2030010", rollNo: null, name: "Agrimm" },
  { id: "s2", enrollmentNo: "ENR-2", rollNo: "230C2030011", name: "Aadi" },
  { id: "s3", enrollmentNo: "230c2030084", rollNo: null, name: "Aman" },
  { id: "s4", enrollmentNo: "230C2030099", rollNo: null, name: "Absent from file" },
];
const components = [
  { id: "lab", name: "Lab-1", maxMarks: 30 },
  { id: "proj", name: "Lab-II", maxMarks: 30 },
  { id: "end", name: "End Term", maxMarks: 40 },
];

describe("detectDelimiter", () => {
  it("uses tab for text copied from Excel and comma otherwise", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter("a,b,c")).toBe(",");
  });
});

describe("parseMaitriRows", () => {
  it("reads the details, the columns with their maximum marks, and the students", () => {
    const parsed = parseMaitriRows(RAW);
    expect(parsed.ok).toBe(true);
    expect(parsed.meta["Course Name"]).toBe("Human Computer Interaction (Pattern - 2023)");
    expect(parsed.meta.CourseCode).toBe("CSE2724");
    expect(parsed.columns).toEqual([
      { index: 3, name: "Lab Assessment", maxMarks: 30 },
      { index: 4, name: "Project", maxMarks: 30 },
      { index: 5, name: "End term examination", maxMarks: 40 },
    ]);
    expect(parsed.students).toHaveLength(4); // the empty last row is skipped
    expect(parsed.students[0]).toEqual({
      roll: "230C2030010",
      name: "Agrimm Singh Rathore",
      values: ["22", "22", "25"],
    });
  });

  it("works without the maximum-marks row", () => {
    const rows = RAW.filter((row) => row[3] !== "Out of(30.0)");
    const parsed = parseMaitriRows(rows);
    expect(parsed.ok).toBe(true);
    expect(parsed.columns.map((column) => column.maxMarks)).toEqual([null, null, null]);
    expect(parsed.students).toHaveLength(4);
  });

  it("explains what is wrong with an unrecognised file", () => {
    expect(parseMaitriRows([["a", "b"], ["1", "2"]])).toEqual({
      ok: false,
      error: "Could not find the heading row. It must contain the columns Roll No and Student Name.",
    });
    expect(parseMaitriRows([["Roll No", "Student Name"], ["1", "A"]]).error).toBe(
      "No assessment columns were found after Student Name."
    );
    expect(parseMaitriRows([["Roll No", "Student Name", "Quiz"]]).error).toBe(
      "No student rows were found under the headings."
    );
  });
});

describe("autoMapping", () => {
  it("matches equal names and leaves unknown columns unmapped", () => {
    const columns = [
      { index: 3, name: "End Term", maxMarks: 40 },
      { index: 4, name: "Project", maxMarks: 30 },
    ];
    expect(autoMapping(columns, components)).toEqual({ 3: "end", 4: "" });
  });

  it("does not use one component twice", () => {
    const columns = [
      { index: 3, name: "Lab-1", maxMarks: 30 },
      { index: 4, name: "Lab 1", maxMarks: 30 },
    ];
    expect(autoMapping(columns, components)).toEqual({ 3: "lab", 4: "" });
  });
});

describe("buildImport", () => {
  const parsed = parseMaitriRows(RAW);
  const mapping = { 3: "lab", 4: "proj", 5: "end" };

  it("fills the marks of matching students, by enrollment number or roll number", () => {
    const result = buildImport({ parsed, mapping, students, components });
    expect(result.columnErrors).toEqual([]);
    expect(result.matched).toBe(3);
    expect(result.entries).toEqual({
      "s1:lab": "22", "s1:proj": "22", "s1:end": "25",
      "s2:lab": "20", "s2:proj": "20", "s2:end": "11.5",
      "s3:lab": "AB", "s3:proj": "25", // s3 has no End Term mark: a blank cell is left alone
    });
    expect(result.cells).toBe(8);
    expect(result.unmatched).toEqual(["999X0000000"]);
    expect(result.notInFile).toBe(1);
  });

  it("only imports the columns that are mapped", () => {
    const result = buildImport({ parsed, mapping: { 3: "lab", 4: "", 5: "" }, students, components });
    expect(Object.keys(result.entries).every((key) => key.endsWith(":lab"))).toBe(true);
    expect(result.mappedColumns).toBe(1);
  });

  it("stops when the maximum marks do not agree", () => {
    const result = buildImport({
      parsed,
      mapping: { 3: "lab", 4: "proj", 5: "lab" },
      students,
      components,
    });
    expect(result.cells).toBe(0);
    expect(result.columnErrors).toEqual([
      '"Lab-1" is chosen for more than one column.',
    ]);

    const mismatch = buildImport({
      parsed,
      mapping: { 3: "end" }, // file says out of 30, "End Term" has a maximum of 40
      students,
      components,
    });
    expect(mismatch.cells).toBe(0);
    expect(mismatch.columnErrors[0]).toMatch(/is out of 30 in the file, but "End Term" has a maximum of 40/);
  });

  it("skips invalid values and reports them", () => {
    const rows = RAW.map((row) => [...row]);
    rows[9][3] = "31"; // above the maximum of 30
    rows[10][4] = "abc";
    const result = buildImport({ parsed: parseMaitriRows(rows), mapping, students, components });
    expect(result.problemCount).toBe(2);
    expect(result.problems[0]).toBe("230C2030010, Lab-1: cannot be more than 30");
    expect(result.entries["s1:lab"]).toBeUndefined();
    expect(result.entries["s1:proj"]).toBe("22");
  });

  it("counts roll numbers that appear twice in the file", () => {
    const rows = [...RAW, ["1", "230C2030010", "Agrimm again", "5", "5", "5"]];
    const result = buildImport({ parsed: parseMaitriRows(rows), mapping, students, components });
    expect(result.duplicates).toBe(1);
    expect(result.entries["s1:lab"]).toBe("5"); // the last row wins
  });

  it("does nothing when no column is mapped", () => {
    const result = buildImport({ parsed, mapping: { 3: "", 4: "", 5: "" }, students, components });
    expect(result.cells).toBe(0);
    expect(result.mappedColumns).toBe(0);
  });
});
