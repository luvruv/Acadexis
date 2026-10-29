import {
  DEFAULT_METHOD_SETTINGS,
  checkWeights,
  computeCoAttainment,
  computeOverall,
  round2,
} from "@/lib/attainment-method";

// Defaults come from the department's HCI (CSE2724) workbook. They can be
// changed per course file; "confirmed" records that the department agreed.
export const DEFAULT_ATTAINMENT_SETTINGS = { ...DEFAULT_METHOD_SETTINGS, confirmed: false };

// Suggested overall CO weights in percent. The HCI workbook uses 35, 40 and 25
// for three COs; for any other number the weights are split equally.
export function suggestedCoWeightPercents(count) {
  if (count <= 0) return [];
  if (count === 3) return [35, 40, 25];
  const base = Math.floor(10000 / count) / 100;
  const list = Array.from({ length: count }, () => base);
  list[count - 1] = round2(100 - base * (count - 1));
  return list;
}

// outcomes:   [{ id, code, weight (fraction 0..1 or null) }]
// components: [{ id, name, maxMarks (number), links: [{ outcomeId, weight (fraction or null) }] }]
// students:   [{ id, enrollmentNo, name }]
// marks:      Map of "studentId:componentId" -> { value: number | null, absent: boolean }
// settings:   see DEFAULT_ATTAINMENT_SETTINGS
export function computeAttainment({ outcomes, components, students, marks, settings }) {
  const problems = [];
  if (outcomes.length === 0) problems.push("Define the course outcomes first.");
  if (components.length === 0) problems.push("Define the assessment components first.");
  if (students.length === 0) problems.push("The student list is empty.");
  if (problems.length > 0) {
    return { ready: false, problems, rows: [], students: [], settings, overall: null };
  }

  // Only components mapped to at least one CO take part.
  const usedComponents = components.filter((component) => component.links.length > 0);
  let missingCells = 0;
  for (const student of students) {
    for (const component of usedComponents) {
      if (!marks.has(`${student.id}:${component.id}`)) missingCells += 1;
    }
  }
  if (missingCells > 0) problems.push(`${missingCells} mark(s) are not entered yet.`);

  const perStudent = students.map((student) => ({
    id: student.id,
    enrollmentNo: student.enrollmentNo,
    name: student.name,
    perCo: {},
  }));
  const studentIndex = new Map(students.map((student, index) => [student.id, index]));

  const rows = [];
  for (const outcome of outcomes) {
    const mapped = [];
    for (const component of components) {
      const link = component.links.find((item) => item.outcomeId === outcome.id);
      if (link) mapped.push({ component, weight: link.weight });
    }

    const base = {
      outcomeId: outcome.id,
      code: outcome.code,
      weight: outcome.weight ?? null,
      componentNames: mapped.map((item) => item.component.name),
      componentWeights: mapped.map((item) => ({
        name: item.component.name,
        weightPercent: item.weight === null ? null : round2(item.weight * 100),
      })),
      assessed: 0,
      counts: null,
      attained: 0, // students at Level 3
      percentage: null, // percent of students at Level 3
      level: null, // target level (1 to 3)
      average: null, // average of the student levels
    };

    if (mapped.length === 0) {
      problems.push(`${outcome.code} has no assessment component mapped to it.`);
      rows.push(base);
      continue;
    }

    const weightProblems = checkWeights(
      mapped.map((item) => ({ weight: item.weight })),
      outcome.code
    );
    if (weightProblems.length > 0) {
      problems.push(...weightProblems);
      rows.push(base);
      continue;
    }

    const result = computeCoAttainment({
      weights: mapped.map((item) => ({
        componentId: item.component.id,
        maxMarks: item.component.maxMarks,
        weight: item.weight,
      })),
      students: students.map((student) => ({
        id: student.id,
        marks: Object.fromEntries(
          mapped.map((item) => [
            item.component.id,
            marks.get(`${student.id}:${item.component.id}`) ?? null,
          ])
        ),
      })),
      settings,
    });

    for (const entry of result.studentLevels) {
      perStudent[studentIndex.get(entry.studentId)].perCo[outcome.id] = {
        percent: round2(entry.fraction * 100),
        level: entry.level,
      };
    }

    if (result.assessed === 0) {
      problems.push(`${outcome.code}: no student has marks for its components.`);
      rows.push(base);
      continue;
    }

    rows.push({
      ...base,
      assessed: result.assessed,
      counts: result.counts,
      attained: result.counts[3],
      percentage: round2(result.percentAtLevel3),
      level: result.targetLevel,
      average: round2(result.averageLevel),
    });
  }

  let overall = null;
  if (rows.some((row) => row.weight === null)) {
    problems.push("Enter the overall weight of every course outcome on the CO attainment page.");
  } else if (rows.every((row) => row.level !== null)) {
    const total = computeOverall(
      rows.map((row) => ({ coId: row.outcomeId, targetLevel: row.level, weight: row.weight }))
    );
    problems.push(...total.problems);
    overall = total.value === null ? null : round2(total.value);
  }

  return { ready: problems.length === 0, problems, rows, students: perStudent, settings, overall };
}
