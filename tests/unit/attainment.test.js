import { describe, expect, it } from "vitest";
import {
  computeAttainment,
  DEFAULT_ATTAINMENT_SETTINGS,
  levelFor,
} from "@/lib/attainment";

const settings = { ...DEFAULT_ATTAINMENT_SETTINGS };

function marks(entries) {
  const map = new Map();
  for (const [studentId, componentId, value] of entries) {
    map.set(
      `${studentId}:${componentId}`,
      value === "AB" ? { value: null, absent: true } : { value, absent: false }
    );
  }
  return map;
}

const outcomes = [{ id: "co1", code: "CO1" }];
const students = ["s1", "s2", "s3", "s4"].map((id, i) => ({
  id,
  enrollmentNo: `ENR${i + 1}`,
  name: `Student ${i + 1}`,
}));
const quiz = { id: "q", name: "Quiz 1", maxMarks: 10, outcomeIds: ["co1"] };

describe("levelFor", () => {
  it("uses the provisional minimums 50, 60 and 70", () => {
    expect(levelFor(49.99, settings)).toBe(0);
    expect(levelFor(50, settings)).toBe(1);
    expect(levelFor(59.99, settings)).toBe(1);
    expect(levelFor(60, settings)).toBe(2);
    expect(levelFor(70, settings)).toBe(3);
    expect(levelFor(100, settings)).toBe(3);
  });

  it("respects changed settings", () => {
    const custom = { ...settings, level1MinPercent: 30, level2MinPercent: 40, level3MinPercent: 80 };
    expect(levelFor(35, custom)).toBe(1);
    expect(levelFor(79, custom)).toBe(2);
    expect(levelFor(80, custom)).toBe(3);
  });
});

describe("computeAttainment: the hand-checked example", () => {
  const input = {
    outcomes,
    components: [quiz],
    students,
    marks: marks([["s1", "q", 5], ["s2", "q", 3], ["s3", "q", 8], ["s4", "q", "AB"]]),
  };

  it("counts an absent student as 0 by default: 2 of 4, 50%, Level 1", () => {
    const result = computeAttainment({ ...input, settings });
    expect(result.ready).toBe(true);
    expect(result.rows[0]).toMatchObject({ attained: 2, assessed: 4, percentage: 50, level: 1 });
    expect(result.students.map((s) => s.perCo.co1.percent)).toEqual([50, 30, 80, 0]);
    expect(result.students.map((s) => s.perCo.co1.attained)).toEqual([true, false, true, false]);
  });

  it("can leave absent students out: 2 of 3, 66.67%, Level 2", () => {
    const result = computeAttainment({ ...input, settings: { ...settings, absentAsZero: false } });
    expect(result.rows[0]).toMatchObject({ attained: 2, assessed: 3, percentage: 66.67, level: 2 });
    expect(result.students[3].perCo.co1).toEqual({ percent: null, attained: null });
  });

  it("changes with the threshold: 60% leaves 1 of 3, 33.33%, Level 0", () => {
    const result = computeAttainment({
      ...input,
      settings: { ...settings, absentAsZero: false, thresholdPercent: 60 },
    });
    expect(result.rows[0]).toMatchObject({ attained: 1, assessed: 3, percentage: 33.33, level: 0 });
  });

  it("treats a score exactly on the threshold as attained", () => {
    const result = computeAttainment({
      outcomes,
      components: [quiz],
      students: [students[0]],
      marks: marks([["s1", "q", 4]]), // 40% with a 40% threshold
      settings,
    });
    expect(result.rows[0].attained).toBe(1);
  });
});

describe("computeAttainment: several components", () => {
  it("weights components by their maximum marks (internal 60 + external 40)", () => {
    const components = [
      { id: "mid", name: "Midterm", maxMarks: 60, outcomeIds: ["co1"] },
      { id: "end", name: "End Term", maxMarks: 40, outcomeIds: ["co1"] },
    ];
    // 30/60 + 10/40 = 40/100 = 40%: exactly the pass mark
    const result = computeAttainment({
      outcomes,
      components,
      students: [students[0], students[1]],
      marks: marks([["s1", "mid", 30], ["s1", "end", 10], ["s2", "mid", 30], ["s2", "end", 9]]),
      settings,
    });
    expect(result.students[0].perCo.co1).toEqual({ percent: 40, attained: true });
    expect(result.students[1].perCo.co1).toEqual({ percent: 39, attained: false });
  });

  it("only uses the components mapped to each CO", () => {
    const result = computeAttainment({
      outcomes: [{ id: "co1", code: "CO1" }, { id: "co2", code: "CO2" }],
      components: [
        { id: "a", name: "A", maxMarks: 10, outcomeIds: ["co1"] },
        { id: "b", name: "B", maxMarks: 10, outcomeIds: ["co2"] },
      ],
      students: [students[0]],
      marks: marks([["s1", "a", 10], ["s1", "b", 0]]),
      settings,
    });
    expect(result.rows[0].level).toBe(3);
    expect(result.rows[1].level).toBe(0);
  });
});

describe("computeAttainment: problems", () => {
  it("reports missing setup", () => {
    const result = computeAttainment({ outcomes: [], components: [], students: [], marks: new Map(), settings });
    expect(result.ready).toBe(false);
    expect(result.problems).toHaveLength(3);
  });

  it("reports missing marks and a CO without a component", () => {
    const result = computeAttainment({
      outcomes: [{ id: "co1", code: "CO1" }, { id: "co2", code: "CO2" }],
      components: [quiz],
      students,
      marks: marks([["s1", "q", 5]]),
      settings,
    });
    expect(result.ready).toBe(false);
    expect(result.problems).toContain("3 mark(s) are not entered yet.");
    expect(result.problems).toContain("CO2 has no assessment component mapped to it.");
    expect(result.rows[1]).toMatchObject({ percentage: null, level: null });
  });

  it("does not require marks for components mapped to no CO", () => {
    const result = computeAttainment({
      outcomes,
      components: [quiz, { id: "x", name: "Unused", maxMarks: 5, outcomeIds: [] }],
      students: [students[0]],
      marks: marks([["s1", "q", 9]]),
      settings,
    });
    expect(result.ready).toBe(true);
  });
});