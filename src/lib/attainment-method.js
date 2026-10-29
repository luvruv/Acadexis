// The department's CO and PO attainment method, taken from the HCI (CSE2724)
// workbook. These are pure functions: no database, no framework.
//
// Per CO:
//   1. For every student: score = sum(weight x marks) / sum(weight x maxMarks)
//      over the components that feed this CO (weights are per CO).
//   2. Student level: 3 if score >= level3Min, 2 if score >= level2Min, else 1.
//   3. CO attainment (decimal) = average of the student levels.
//   4. Target level: share of students at Level 3 compared with the course-level
//      targets (3 if >= courseLevel3MinPercent, 2 if >= courseLevel2MinPercent, else 1).
// Overall course attainment = sum(target level x CO weight).
// PO attainment = sum(CO attainment x correlation) / sum(correlation).

export const DEFAULT_METHOD_SETTINGS = {
  studentLevel3Min: 0.5, // fraction (0.50 = 50 percent of the weighted maximum)
  studentLevel2Min: 0.45,
  courseLevel3MinPercent: 70, // percent of students at Level 3
  courseLevel2MinPercent: 65,
  absentAsZero: true,
};

const WEIGHT_TOLERANCE = 0.0001;

export function round2(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Guards against 0.4999999999 versus 0.5 caused by decimal fractions in binary.
function cleanFraction(value) {
  return Math.round(value * 1e10) / 1e10;
}

export function studentLevel(fraction, settings = DEFAULT_METHOD_SETTINGS) {
  const f = cleanFraction(fraction);
  if (f >= settings.studentLevel3Min) return 3;
  if (f >= settings.studentLevel2Min) return 2;
  return 1;
}

export function targetLevel(percentAtLevel3, settings = DEFAULT_METHOD_SETTINGS) {
  const p = Math.round(percentAtLevel3 * 1e6) / 1e6;
  if (p >= settings.courseLevel3MinPercent) return 3;
  if (p >= settings.courseLevel2MinPercent) return 2;
  return 1;
}

// Returns a list of plain-language problems with a set of weights (empty = fine).
export function checkWeights(weights, label) {
  const problems = [];
  if (!weights || weights.length === 0) {
    problems.push(`${label} has no assessment component with a weight.`);
    return problems;
  }
  let sum = 0;
  for (const w of weights) {
    if (typeof w.weight !== "number" || Number.isNaN(w.weight) || w.weight < 0) {
      problems.push(`${label} has a component with a missing or negative weight.`);
      return problems;
    }
    sum += w.weight;
  }
  if (Math.abs(sum - 1) > WEIGHT_TOLERANCE) {
    problems.push(`${label}: component weights add up to ${round2(sum * 100)}%, not 100%.`);
  }
  return problems;
}

// weights: [{ componentId, maxMarks, weight }]  (weights of one CO)
// students: [{ id, marks: { [componentId]: { value: number|null, absent: boolean } } }]
export function computeCoAttainment({ weights, students, settings = DEFAULT_METHOD_SETTINGS }) {
  const levels = [];
  let notAssessed = 0;

  for (const student of students) {
    let weightedMarks = 0;
    let weightedMax = 0;
    let skip = false;

    for (const w of weights) {
      const mark = student.marks?.[w.componentId];
      const hasValue = mark && !mark.absent && typeof mark.value === "number";
      if (!hasValue && !settings.absentAsZero) {
        skip = true; // absent or missing, and the course says to leave such students out
        break;
      }
      weightedMarks += w.weight * (hasValue ? mark.value : 0);
      weightedMax += w.weight * w.maxMarks;
    }

    if (skip || weightedMax <= 0) {
      notAssessed += 1;
      continue;
    }
    const fraction = weightedMarks / weightedMax;
    levels.push({ studentId: student.id, fraction, level: studentLevel(fraction, settings) });
  }

  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const l of levels) counts[l.level] += 1;
  const assessed = levels.length;

  if (assessed === 0) {
    return {
      assessed: 0, notAssessed, counts, averageLevel: null, percentAtLevel3: null,
      targetLevel: null, studentLevels: levels,
    };
  }
  const averageLevel = (counts[1] + 2 * counts[2] + 3 * counts[3]) / assessed;
  const percentAtLevel3 = (counts[3] / assessed) * 100;
  return {
    assessed,
    notAssessed,
    counts,
    averageLevel,
    percentAtLevel3,
    targetLevel: targetLevel(percentAtLevel3, settings),
    studentLevels: levels,
  };
}

// results: [{ coId, targetLevel, weight }]. Weights should add up to 1.
export function computeOverall(results) {
  const problems = [];
  if (results.length === 0) return { value: null, problems: ["There are no course outcomes."] };
  let sum = 0;
  let total = 0;
  for (const r of results) {
    if (r.targetLevel === null || r.targetLevel === undefined) {
      problems.push("A course outcome has no assessed students.");
      return { value: null, problems };
    }
    if (typeof r.weight !== "number" || r.weight < 0) {
      problems.push("A course outcome has no overall weight.");
      return { value: null, problems };
    }
    sum += r.weight;
    total += r.weight * r.targetLevel;
  }
  if (Math.abs(sum - 1) > WEIGHT_TOLERANCE) {
    problems.push(`Course outcome weights add up to ${round2(sum * 100)}%, not 100%.`);
    return { value: null, problems };
  }
  return { value: total, problems };
}

// coAverages: { [coId]: number | null }  (the decimal CO attainment)
// matrix: [{ code, levels: { [coId]: 0|1|2|3 } }]   (CO-PO correlation levels)
// A PO with no mapped CO gets value null (the workbook leaves it blank).
export function computePoAttainment(coAverages, matrix) {
  return matrix.map((row) => {
    let weighted = 0;
    let sum = 0;
    for (const [coId, level] of Object.entries(row.levels)) {
      const average = coAverages[coId];
      if (!level || level <= 0 || average === null || average === undefined) continue;
      weighted += average * level;
      sum += level;
    }
    return { code: row.code, value: sum > 0 ? weighted / sum : null };
  });
}
