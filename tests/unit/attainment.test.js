import { describe, expect, it } from "vitest";
import {
  DEFAULT_ATTAINMENT_SETTINGS,
  computeAttainment,
  suggestedCoWeightPercents,
} from "@/lib/attainment";

const settings = { ...DEFAULT_ATTAINMENT_SETTINGS };

// HCI-style components: Lab-1 and Lab-II out of 30, End Term out of 40.
const components = (links1, links2, links3) => [
  { id: "lab1", name: "Lab-1", maxMarks: 30, links: links1 },
  { id: "lab2", name: "Lab-II", maxMarks: 30, links: links2 },
  { id: "end", name: "End Term", maxMarks: 40, links: links3 },
];
const link = (outcomeId, weight) => ({ outcomeId, weight });

const students = ["a", "b", "c", "d"].map((id) => ({ id, enrollmentNo: `E-${id}`, name: id }));

function marksFor(rows) {
  const map = new Map();
  for (const [studentId, lab1, lab2, end] of rows) {
    map.set(`${studentId}:lab1`, { value: lab1, absent: lab1 === null });
    map.set(`${studentId}:lab2`, { value: lab2, absent: lab2 === null });
    map.set(`${studentId}:end`, { value: end, absent: end === null });
  }
  return map;
}

// CO1 weights 0.4, 0.4, 0.2 (weighted maximum 32): fractions 0.70625, 0.5, 0.4625, 0.3625
const defaultMarks = marksFor([
  ["a", 22, 22, 25],
  ["b", 15, 15, 20],
  ["c", 14, 14, 18],
  ["d", 12, 12, 10],
]);

function run(overrides = {}) {
  return computeAttainment({
    outcomes: [{ id: "co1", code: "CO1", weight: 1 }],
    components: components([link("co1", 0.4)], [link("co1", 0.4)], [link("co1", 0.2)]),
    students,
    marks: defaultMarks,
    settings,
    ...overrides,
  });
}

describe("computeAttainment", () => {
  it("calculates student levels, the average, the target level and the overall value", () => {
    const result = run();
    expect(result.problems).toEqual([]);
    expect(result.ready).toBe(true);
    const row = result.rows[0];
    expect(row.counts).toEqual({ 1: 1, 2: 1, 3: 2 });
    expect(row.attained).toBe(2);
    expect(row.assessed).toBe(4);
    expect(row.percentage).toBe(50);
    expect(row.level).toBe(1); // 50% of students at Level 3 is below the 65% target
    expect(row.average).toBe(2.25);
    expect(result.overall).toBe(1);
    expect(result.students[2].perCo.co1).toEqual({ percent: 46.25, level: 2 });
  });

  it("gives Level 3 when at least 70 percent of students are at Level 3", () => {
    const result = run({
      marks: marksFor([
        ["a", 22, 22, 25],
        ["b", 22, 22, 25],
        ["c", 22, 22, 25],
        ["d", 12, 12, 10],
      ]),
    });
    expect(result.rows[0].percentage).toBe(75);
    expect(result.rows[0].level).toBe(3);
    expect(result.overall).toBe(3);
  });

  it("uses the thresholds of the course file", () => {
    const strict = { ...settings, studentLevel3Min: 0.75, studentLevel2Min: 0.5 };
    const result = run({ settings: strict });
    // fractions 0.70625, 0.5, 0.4625, 0.3625 -> levels 2, 2, 1, 1
    expect(result.rows[0].counts).toEqual({ 1: 2, 2: 2, 3: 0 });
    expect(result.rows[0].average).toBe(1.5);
  });

  it("combines the overall weights of several outcomes", () => {
    const result = computeAttainment({
      outcomes: [
        { id: "co1", code: "CO1", weight: 0.6 },
        { id: "co2", code: "CO2", weight: 0.4 },
      ],
      components: components(
        [link("co1", 0.5), link("co2", 1)],
        [link("co1", 0.5)],
        []
      ),
      students: students.slice(0, 2),
      marks: marksFor([
        ["a", 30, 30, 0],
        ["b", 30, 30, 0],
        ["c", 0, 0, 0],
        ["d", 0, 0, 0],
      ]),
      settings,
    });
    expect(result.problems).toEqual([]);
    expect(result.rows.map((row) => row.level)).toEqual([3, 3]);
    expect(result.overall).toBe(3);
  });

  it("treats a missing or absent mark as zero by default", () => {
    const marks = new Map(defaultMarks);
    marks.set("d:lab1", { value: null, absent: true });
    const result = run({ marks });
    expect(result.rows[0].assessed).toBe(4);
  });

  it("can leave absent students out", () => {
    const marks = new Map(defaultMarks);
    marks.set("d:lab1", { value: null, absent: true });
    const result = run({ marks, settings: { ...settings, absentAsZero: false } });
    expect(result.rows[0].assessed).toBe(3);
    expect(result.rows[0].counts).toEqual({ 1: 0, 2: 1, 3: 2 });
  });
});

describe("computeAttainment: problems", () => {
  it("asks for outcomes, components and students first", () => {
    const result = computeAttainment({
      outcomes: [], components: [], students: [], marks: new Map(), settings,
    });
    expect(result.ready).toBe(false);
    expect(result.problems).toEqual([
      "Define the course outcomes first.",
      "Define the assessment components first.",
      "The student list is empty.",
    ]);
  });

  it("reports marks that are not entered", () => {
    const marks = new Map(defaultMarks);
    marks.delete("a:end");
    expect(run({ marks }).problems).toContain("1 mark(s) are not entered yet.");
  });

  it("reports an outcome without a component", () => {
    const result = run({
      outcomes: [
        { id: "co1", code: "CO1", weight: 0.5 },
        { id: "co2", code: "CO2", weight: 0.5 },
      ],
    });
    expect(result.ready).toBe(false);
    expect(result.problems).toContain("CO2 has no assessment component mapped to it.");
  });

  it("reports weights that do not add up to 100 percent", () => {
    const result = run({
      components: components([link("co1", 0.4)], [link("co1", 0.4)], [link("co1", 0.1)]),
    });
    expect(result.ready).toBe(false);
    expect(result.problems).toContain("CO1: component weights add up to 90%, not 100%.");
    expect(result.rows[0].level).toBeNull();
  });

  it("reports a missing component weight", () => {
    const result = run({
      components: components([link("co1", null)], [link("co1", 0.5)], [link("co1", 0.5)]),
    });
    expect(result.problems).toContain("CO1 has a component with a missing or negative weight.");
  });

  it("asks for the overall CO weights", () => {
    const result = run({ outcomes: [{ id: "co1", code: "CO1", weight: null }] });
    expect(result.ready).toBe(false);
    expect(result.problems).toContain(
      "Enter the overall weight of every course outcome on the CO attainment page."
    );
    expect(result.overall).toBeNull();
  });

  it("refuses CO weights that do not add up to 100 percent", () => {
    const result = run({ outcomes: [{ id: "co1", code: "CO1", weight: 0.5 }] });
    expect(result.ready).toBe(false);
    expect(result.problems).toContain("Course outcome weights add up to 50%, not 100%.");
  });
});

describe("suggestedCoWeightPercents", () => {
  it("uses 35, 40 and 25 for three outcomes, as in the HCI workbook", () => {
    expect(suggestedCoWeightPercents(3)).toEqual([35, 40, 25]);
  });

  it("splits equally for other numbers and always adds up to 100", () => {
    for (const count of [1, 2, 4, 5, 6, 7]) {
      const list = suggestedCoWeightPercents(count);
      expect(list).toHaveLength(count);
      expect(Math.round(list.reduce((a, b) => a + b, 0) * 100) / 100).toBe(100);
    }
    expect(suggestedCoWeightPercents(0)).toEqual([]);
  });
});
