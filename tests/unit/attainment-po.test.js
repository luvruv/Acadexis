import { describe, expect, it } from "vitest";
import { DEFAULT_ATTAINMENT_SETTINGS, computeAttainment } from "@/lib/attainment";

const students = ["a", "b"].map((id) => ({ id, enrollmentNo: `E-${id}`, name: id }));

// One component (max 10) feeding CO1 and CO2 with weight 1 each.
// Student a: 10/10 (Level 3), student b: 4/10 (Level 1).  CO attainment = 2.00 for both.
function run(overrides = {}) {
  return computeAttainment({
    outcomes: [
      { id: "co1", code: "CO1", weight: 0.5 },
      { id: "co2", code: "CO2", weight: 0.5 },
    ],
    components: [
      {
        id: "q",
        name: "Quiz",
        maxMarks: 10,
        links: [
          { outcomeId: "co1", weight: 1 },
          { outcomeId: "co2", weight: 1 },
        ],
      },
    ],
    students,
    marks: new Map([
      ["a:q", { value: 10, absent: false }],
      ["b:q", { value: 4, absent: false }],
    ]),
    settings: { ...DEFAULT_ATTAINMENT_SETTINGS },
    poMatrix: [
      { code: "PO1", levels: { co1: 3, co2: 1 } },
      { code: "PO2", levels: { co1: 0, co2: 2 } },
      { code: "PSO1", levels: { co1: 0, co2: 0 } },
    ],
    ...overrides,
  });
}

describe("computeAttainment: PO and PSO attainment", () => {
  it("calculates each PO from the CO attainments and the CO-PO levels", () => {
    const result = run();
    expect(result.ready).toBe(true);
    expect(result.rows.map((row) => row.average)).toEqual([2, 2]);
    // PO1 = (2x3 + 2x1) / 4 = 2, PO2 = 2, PSO1 has no mapped CO
    expect(result.po).toEqual([
      { code: "PO1", value: 2 },
      { code: "PO2", value: 2 },
      { code: "PSO1", value: null },
    ]);
  });

  it("weights the COs by their correlation level", () => {
    // CO1 average 3 (Quiz 10/10), CO2 average 1 (Viva 4/10): PO1 = (3x3 + 1x1) / 4 = 2.5
    const result = run({
      components: [
        { id: "q", name: "Quiz", maxMarks: 10, links: [{ outcomeId: "co1", weight: 1 }] },
        { id: "r", name: "Viva", maxMarks: 10, links: [{ outcomeId: "co2", weight: 1 }] },
      ],
      marks: new Map([
        ["a:q", { value: 10, absent: false }],
        ["b:q", { value: 10, absent: false }],
        ["a:r", { value: 4, absent: false }],
        ["b:r", { value: 4, absent: false }],
      ]),
    });
    expect(result.ready).toBe(true);
    expect(result.rows.map((row) => row.average)).toEqual([3, 1]);
    expect(result.po[0]).toEqual({ code: "PO1", value: 2.5 });
    expect(result.po[1]).toEqual({ code: "PO2", value: 1 });
  });

  it("gives no PO values while the CO attainment is incomplete", () => {
    const result = run({ outcomes: [{ id: "co1", code: "CO1", weight: null }, { id: "co2", code: "CO2", weight: null }] });
    expect(result.ready).toBe(false);
    expect(result.po).toEqual([]);
  });

  it("gives an empty list when no CO-PO matrix is supplied", () => {
    expect(run({ poMatrix: undefined }).po).toEqual([]);
  });
});
