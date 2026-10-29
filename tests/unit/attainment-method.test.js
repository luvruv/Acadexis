import { describe, expect, it } from "vitest";
import {
  DEFAULT_METHOD_SETTINGS,
  checkWeights,
  computeCoAttainment,
  computeOverall,
  computePoAttainment,
  round2,
  studentLevel,
  targetLevel,
} from "@/lib/attainment-method";

// HCI workbook, CO1: Lab-1 and Lab-II out of 30, End Term out of 40,
// with CO1 weights 0.4, 0.4 and 0.2 (weighted maximum = 32).
const CO1_WEIGHTS = [
  { componentId: "lab1", maxMarks: 30, weight: 0.4 },
  { componentId: "lab2", maxMarks: 30, weight: 0.4 },
  { componentId: "end", maxMarks: 40, weight: 0.2 },
];

function student(id, lab1, lab2, end) {
  const mark = (value) =>
    value === "AB" ? { value: null, absent: true } : { value, absent: false };
  return { id, marks: { lab1: mark(lab1), lab2: mark(lab2), end: mark(end) } };
}

describe("studentLevel", () => {
  it("uses 0.50 for Level 3 and 0.45 for Level 2 by default", () => {
    expect(studentLevel(0.5)).toBe(3);
    expect(studentLevel(0.9)).toBe(3);
    expect(studentLevel(0.4999)).toBe(2);
    expect(studentLevel(0.45)).toBe(2);
    expect(studentLevel(0.4499)).toBe(1);
    expect(studentLevel(0)).toBe(1);
  });

  it("follows custom thresholds", () => {
    const settings = { ...DEFAULT_METHOD_SETTINGS, studentLevel3Min: 0.6, studentLevel2Min: 0.5 };
    expect(studentLevel(0.55, settings)).toBe(2);
    expect(studentLevel(0.6, settings)).toBe(3);
  });
});

describe("targetLevel", () => {
  it("uses 70 percent for Level 3 and 65 percent for Level 2", () => {
    expect(targetLevel(100)).toBe(3);
    expect(targetLevel(70)).toBe(3);
    expect(targetLevel(69.99)).toBe(2);
    expect(targetLevel(65)).toBe(2);
    expect(targetLevel(64.99)).toBe(1);
    expect(targetLevel(0)).toBe(1);
  });
});

describe("checkWeights", () => {
  it("accepts weights that add up to 100 percent", () => {
    expect(checkWeights([{ weight: 0.4 }, { weight: 0.4 }, { weight: 0.2 }], "CO1")).toEqual([]);
  });

  it("reports weights that do not add up to 100 percent", () => {
    expect(checkWeights([{ weight: 0.5 }, { weight: 0.4 }], "CO2")).toEqual([
      "CO2: component weights add up to 90%, not 100%.",
    ]);
  });

  it("reports missing, negative or no weights", () => {
    expect(checkWeights([], "CO3")).toEqual(["CO3 has no assessment component with a weight."]);
    expect(checkWeights([{ weight: null }], "CO3")).toHaveLength(1);
    expect(checkWeights([{ weight: -0.1 }, { weight: 1.1 }], "CO3")).toHaveLength(1);
  });
});

describe("computeCoAttainment", () => {
  const students = [
    student("a", 22, 22, 25), // 22.6 / 32 = 0.70625 -> Level 3
    student("b", 15, 15, 20), // 16 / 32 = 0.5 exactly -> Level 3
    student("c", 14, 14, 18), // 14.8 / 32 = 0.4625 -> Level 2
    student("d", 12, 12, 10), // 11.6 / 32 = 0.3625 -> Level 1
  ];

  it("gives each student a level, the average, and the target level", () => {
    const result = computeCoAttainment({ weights: CO1_WEIGHTS, students });
    expect(result.studentLevels.map((s) => s.level)).toEqual([3, 3, 2, 1]);
    expect(result.counts).toEqual({ 1: 1, 2: 1, 3: 2 });
    expect(result.assessed).toBe(4);
    expect(result.averageLevel).toBeCloseTo(2.25, 10);
    expect(result.percentAtLevel3).toBe(50);
    expect(result.targetLevel).toBe(1);
  });

  it("counts an absent student as zero by default", () => {
    const result = computeCoAttainment({
      weights: CO1_WEIGHTS,
      students: [student("a", 22, 22, 25), student("x", "AB", "AB", "AB")],
    });
    expect(result.assessed).toBe(2);
    expect(result.studentLevels[1]).toMatchObject({ fraction: 0, level: 1 });
    expect(result.averageLevel).toBe(2);
  });

  it("leaves absent students out when the course says so", () => {
    const result = computeCoAttainment({
      weights: CO1_WEIGHTS,
      students: [student("a", 22, 22, 25), student("x", "AB", 20, 20)],
      settings: { ...DEFAULT_METHOD_SETTINGS, absentAsZero: false },
    });
    expect(result.assessed).toBe(1);
    expect(result.notAssessed).toBe(1);
    expect(result.averageLevel).toBe(3);
  });

  it("returns empty results when nobody can be assessed", () => {
    const result = computeCoAttainment({ weights: CO1_WEIGHTS, students: [] });
    expect(result.assessed).toBe(0);
    expect(result.averageLevel).toBeNull();
    expect(result.targetLevel).toBeNull();
  });

  it("only uses the components that feed this CO", () => {
    const onlyEnd = [{ componentId: "end", maxMarks: 40, weight: 1 }];
    const result = computeCoAttainment({
      weights: onlyEnd,
      students: [student("a", 0, 0, 20), student("b", 30, 30, 10)], // 0.5 and 0.25
    });
    expect(result.studentLevels.map((s) => s.level)).toEqual([3, 1]);
  });
});

describe("computeOverall", () => {
  it("is the sum of target level times CO weight", () => {
    const { value, problems } = computeOverall([
      { coId: "1", targetLevel: 3, weight: 0.35 },
      { coId: "2", targetLevel: 2, weight: 0.4 },
      { coId: "3", targetLevel: 1, weight: 0.25 },
    ]);
    expect(problems).toEqual([]);
    expect(value).toBeCloseTo(2.1, 10);
  });

  it("refuses weights that do not add up to 100 percent", () => {
    const { value, problems } = computeOverall([
      { coId: "1", targetLevel: 3, weight: 0.5 },
      { coId: "2", targetLevel: 2, weight: 0.4 },
    ]);
    expect(value).toBeNull();
    expect(problems).toEqual(["Course outcome weights add up to 90%, not 100%."]);
  });

  it("refuses a CO without a target level or a weight", () => {
    expect(computeOverall([{ coId: "1", targetLevel: null, weight: 1 }]).value).toBeNull();
    expect(computeOverall([{ coId: "1", targetLevel: 3, weight: null }]).value).toBeNull();
    expect(computeOverall([]).value).toBeNull();
  });
});

describe("computePoAttainment", () => {
  it("is the correlation-weighted average of the CO attainments", () => {
    const result = computePoAttainment(
      { co1: 3, co2: 2 },
      [
        { code: "PO1", levels: { co1: 3, co2: 1 } }, // (3x3 + 2x1) / 4 = 2.75
        { code: "PO2", levels: { co1: 0, co2: 2 } }, // 2
        { code: "PO3", levels: { co1: 0, co2: 0 } }, // not mapped
      ]
    );
    expect(result[0]).toEqual({ code: "PO1", value: 2.75 });
    expect(result[1]).toEqual({ code: "PO2", value: 2 });
    expect(result[2]).toEqual({ code: "PO3", value: null });
  });

  it("ignores COs that have no attainment", () => {
    const result = computePoAttainment(
      { co1: 3, co2: null },
      [{ code: "PO1", levels: { co1: 2, co2: 3 } }]
    );
    expect(result[0].value).toBe(3);
  });
});

describe("round2", () => {
  it("rounds to two decimals and keeps null", () => {
    expect(round2(2.9769)).toBe(2.98);
    expect(round2(2.944)).toBe(2.94);
    expect(round2(null)).toBeNull();
  });
});
