import { parseMarkValue } from "@/lib/validation/marks";

// Reads the marks export from the university ERP ("Maitri"), as used in the
// department's attainment workbook:
//   a few lines such as "Course Name : ..."
//   a heading row:   Sr. No. | Roll No | Student Name | <component> | <component> ...
//   a maximum row:   (empty) | (empty) | (empty) | Out of(30.0) | Out of(30.0) | ...
//   one row per student
// The input is a list of rows (each a list of cell texts), for example the
// result of Papa.parse(text, { header: false }).data.

const ROLL_HEADINGS = ["rollno", "rollnumber", "enrollmentno", "enrollmentnumber"];
const NAME_HEADINGS = ["studentname", "name"];

const norm = (text) => String(text ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const cell = (row, index) => String(row?.[index] ?? "").trim();

// Text copied from Excel is tab separated; a saved CSV is comma separated.
export function detectDelimiter(text) {
  return String(text).includes("\t") ? "\t" : ",";
}

export function parseMaitriRows(rows) {
  const headerIndex = rows.findIndex((row) => {
    const cells = row.map(norm);
    return (
      cells.some((value) => ROLL_HEADINGS.includes(value)) &&
      cells.some((value) => NAME_HEADINGS.includes(value))
    );
  });
  if (headerIndex === -1) {
    return {
      ok: false,
      error: "Could not find the heading row. It must contain the columns Roll No and Student Name.",
    };
  }

  const header = rows[headerIndex];
  const headerCells = header.map(norm);
  const rollIndex = headerCells.findIndex((value) => ROLL_HEADINGS.includes(value));
  const nameIndex = headerCells.findIndex((value) => NAME_HEADINGS.includes(value));

  const columns = [];
  for (let index = Math.max(rollIndex, nameIndex) + 1; index < header.length; index += 1) {
    const name = cell(header, index);
    if (name !== "") columns.push({ index, name, maxMarks: null });
  }
  if (columns.length === 0) {
    return { ok: false, error: "No assessment columns were found after Student Name." };
  }

  // The row under the headings usually says "Out of(30.0)" for every component.
  let dataStart = headerIndex + 1;
  const maxRow = rows[dataStart];
  if (maxRow && columns.some((column) => /out\s*of/i.test(cell(maxRow, column.index)))) {
    for (const column of columns) {
      const found = /out\s*of\s*\(?\s*([\d.]+)/i.exec(cell(maxRow, column.index));
      if (found) column.maxMarks = Number(found[1]);
    }
    dataStart += 1;
  }

  // Lines above the headings look like "Course Name : Human Computer Interaction".
  const meta = {};
  for (let index = 0; index < headerIndex; index += 1) {
    const text = cell(rows[index], 0);
    const at = text.indexOf(":");
    if (at > 0) meta[text.slice(0, at).trim()] = text.slice(at + 1).trim();
  }

  const students = [];
  for (let index = dataStart; index < rows.length; index += 1) {
    const row = rows[index];
    const roll = cell(row, rollIndex);
    if (roll === "") continue; // blank or footer rows
    students.push({
      roll,
      name: cell(row, nameIndex),
      values: columns.map((column) => cell(row, column.index)),
    });
  }
  if (students.length === 0) {
    return { ok: false, error: "No student rows were found under the headings." };
  }

  return { ok: true, meta, columns, students };
}

// Suggests which assessment component each file column belongs to.
export function autoMapping(columns, components) {
  const used = new Set();
  const mapping = {};
  for (const column of columns) {
    const columnName = norm(column.name);
    let match = components.find((c) => !used.has(c.id) && norm(c.name) === columnName);
    if (!match && columnName.length >= 3) {
      match = components.find(
        (c) =>
          !used.has(c.id) &&
          norm(c.name).length >= 3 &&
          (norm(c.name).includes(columnName) || columnName.includes(norm(c.name)))
      );
    }
    if (match) {
      used.add(match.id);
      mapping[column.index] = match.id;
    } else {
      mapping[column.index] = "";
    }
  }
  return mapping;
}

// parsed:     result of parseMaitriRows (ok: true)
// mapping:    { [columnIndex]: componentId or "" }
// students:   [{ id, enrollmentNo, rollNo, name }]   (the course file's student list)
// components: [{ id, name, maxMarks }]
// Returns the cells to put into the marks table, plus a report.
export function buildImport({ parsed, mapping, students, components }) {
  const componentById = new Map(components.map((component) => [component.id, component]));
  const columnErrors = [];
  const chosen = [];
  const usedComponents = new Set();

  for (const column of parsed.columns) {
    const componentId = mapping[column.index];
    if (!componentId) continue;
    const component = componentById.get(componentId);
    if (!component) continue;
    if (usedComponents.has(componentId)) {
      columnErrors.push(`"${component.name}" is chosen for more than one column.`);
      continue;
    }
    usedComponents.add(componentId);
    if (column.maxMarks !== null && column.maxMarks !== component.maxMarks) {
      columnErrors.push(
        `"${column.name}" is out of ${column.maxMarks} in the file, but "${component.name}" has a maximum of ${component.maxMarks}. Fix the component's maximum or do not import this column.`
      );
      continue;
    }
    chosen.push({ column, component });
  }

  const empty = {
    entries: {},
    cells: 0,
    matched: 0,
    unmatched: [],
    notInFile: 0,
    duplicates: 0,
    problems: [],
    problemCount: 0,
    columnErrors,
    mappedColumns: chosen.length,
  };
  if (columnErrors.length > 0 || chosen.length === 0) return empty;

  const byEnrollment = new Map(students.map((s) => [norm(s.enrollmentNo), s]));
  const byRoll = new Map(
    students.filter((s) => s.rollNo).map((s) => [norm(s.rollNo), s])
  );

  const entries = {};
  const matchedIds = new Set();
  const unmatched = [];
  const problems = [];
  let problemCount = 0;
  let duplicates = 0;
  const seenRolls = new Set();

  for (const row of parsed.students) {
    const key = norm(row.roll);
    if (seenRolls.has(key)) duplicates += 1;
    seenRolls.add(key);

    const student = byEnrollment.get(key) ?? byRoll.get(key);
    if (!student) {
      unmatched.push(row.roll);
      continue;
    }
    matchedIds.add(student.id);

    for (const { column, component } of chosen) {
      const position = parsed.columns.indexOf(column);
      const raw = row.values[position];
      if (raw === "") continue; // a blank cell never overwrites existing marks
      const check = parseMarkValue(raw, component.maxMarks);
      if (check.error) {
        problemCount += 1;
        if (problems.length < 3) problems.push(`${row.roll}, ${component.name}: ${check.error}`);
        continue;
      }
      entries[`${student.id}:${component.id}`] = check.kind === "absent" ? "AB" : String(check.value);
    }
  }

  return {
    ...empty,
    entries,
    cells: Object.keys(entries).length,
    matched: matchedIds.size,
    unmatched,
    notInFile: students.filter((s) => !matchedIds.has(s.id)).length,
    duplicates,
    problems,
    problemCount,
  };
}
