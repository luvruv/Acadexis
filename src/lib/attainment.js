// PROVISIONAL defaults. They are a working assumption, NOT a confirmed BMU rule.
// Replace them when the department provides the official values.
export const DEFAULT_ATTAINMENT_SETTINGS = {
  thresholdPercent: 40,
  level1MinPercent: 50,
  level2MinPercent: 60,
  level3MinPercent: 70,
  absentAsZero: true,
  confirmed: false,
};

const round2 = (value) => Math.round(value * 100) / 100;
const EPSILON = 1e-9;

// Level from the percentage of students who attained the CO. 0 means below Level 1.
export function levelFor(percentageOfStudents, settings) {
  const value = percentageOfStudents + EPSILON;
  if (value >= settings.level3MinPercent) return 3;
  if (value >= settings.level2MinPercent) return 2;
  if (value >= settings.level1MinPercent) return 1;
  return 0;
}

// outcomes:   [{ id, code }]
// components: [{ id, name, maxMarks (number), outcomeIds: [id] }]
// students:   [{ id, enrollmentNo, name }]
// marks:      Map of "studentId:componentId" -> { value: number | null, absent: boolean }
// settings:   see DEFAULT_ATTAINMENT_SETTINGS
export function computeAttainment({ outcomes, components, students, marks, settings }) {
  const problems = [];
  if (outcomes.length === 0) problems.push("Define the course outcomes first.");
  if (components.length === 0) problems.push("Define the assessment components first.");
  if (students.length === 0) problems.push("The student list is empty.");
  if (problems.length > 0) {
    return { ready: false, problems, rows: [], students: [], settings };
  }

  // Only components mapped to at least one CO take part.
  const usedComponents = components.filter((component) => component.outcomeIds.length > 0);
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

  const rows = outcomes.map((outcome) => {
    const mapped = components.filter((component) => component.outcomeIds.includes(outcome.id));
    const base = {
      outcomeId: outcome.id,
      code: outcome.code,
      componentNames: mapped.map((component) => component.name),
      assessed: 0,
      attained: 0,
      percentage: null,
      level: null,
    };

    if (mapped.length === 0) {
      problems.push(`${outcome.code} has no assessment component mapped to it.`);
      return base;
    }

    let assessed = 0;
    let attained = 0;
    students.forEach((student, index) => {
      let obtained = 0;
      let maximum = 0;
      for (const component of mapped) {
        const cell = marks.get(`${student.id}:${component.id}`);
        if (!cell) continue;
        if (cell.absent) {
          if (settings.absentAsZero) maximum += component.maxMarks;
          continue;
        }
        obtained += cell.value;
        maximum += component.maxMarks;
      }

      if (maximum === 0) {
        perStudent[index].perCo[outcome.id] = { percent: null, attained: null };
        return;
      }

      const percent = (obtained / maximum) * 100;
      const met = percent + EPSILON >= settings.thresholdPercent;
      assessed += 1;
      if (met) attained += 1;
      perStudent[index].perCo[outcome.id] = { percent: round2(percent), attained: met };
    });

    if (assessed === 0) {
      problems.push(`${outcome.code}: no student has marks for its components.`);
      return base;
    }

    const rawPercentage = (attained / assessed) * 100;
    return {
      ...base,
      assessed,
      attained,
      percentage: round2(rawPercentage),
      level: levelFor(rawPercentage, settings),
    };
  });

  return { ready: problems.length === 0, problems, rows, students: perStudent, settings };
}