import { describe, expect, it } from "vitest";
import { buildContentSchema, extractRawContent, getFormDefinition } from "@/section-forms/registry";

function formDataOf(values) {
  return { get: (name) => (name in values ? values[name] : null) };
}

function check(formKey, content, submit) {
  const definition = getFormDefinition(formKey);
  const raw = extractRawContent(definition, formDataOf(content));
  return buildContentSchema(definition, { submit }).safeParse(raw);
}

const firstMessage = (result) => result.error.issues[0].message;

describe("text sections", () => {
  it("lets a draft be saved with missing required fields", () => {
    expect(check("course-description", { description: "Only this" }, false).success).toBe(true);
  });

  it("requires the required fields to submit", () => {
    const result = check("course-description", { description: "Only this" }, true);
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe("Course objectives is required.");
  });

  it("accepts a complete submission and trims it", () => {
    const result = check("course-description", { description: "  A  ", objectives: " B " }, true);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ description: "A", objectives: "B" });
  });

  it("rejects text that is too long", () => {
    const result = check("course-description", { description: "x".repeat(10001), objectives: "y" }, false);
    expect(result.success).toBe(false);
  });

  it("needs at least one field in the faculty review", () => {
    expect(check("faculty-review", {}, true).success).toBe(false);
    expect(check("faculty-review", { technology: "Used GitHub" }, true).success).toBe(true);
    expect(check("faculty-review", {}, false).success).toBe(true);
  });
});

describe("table sections", () => {
  const row = (extra = {}) => ({
    day: "Monday", startTime: "10:00", endTime: "11:00", type: "Lecture", room: "", classGroup: "", ...extra,
  });
  const timetable = (rows) => ({ slots: JSON.stringify(rows) });

  it("drops completely blank rows", () => {
    const definition = getFormDefinition("weekly-timetable");
    const raw = extractRawContent(definition, formDataOf(timetable([row(), { day: "", startTime: "" }])));
    expect(raw.slots).toHaveLength(1);
  });

  it("ignores broken or unexpected table data", () => {
    const definition = getFormDefinition("weekly-timetable");
    expect(extractRawContent(definition, formDataOf({ slots: "{not json" })).slots).toEqual([]);
    expect(extractRawContent(definition, formDataOf({ slots: '{"a":1}' })).slots).toEqual([]);
    expect(extractRawContent(definition, formDataOf({ slots: '[null, 5, "x"]' })).slots).toEqual([]);
  });

  it("keeps only the known columns", () => {
    const definition = getFormDefinition("weekly-timetable");
    const raw = extractRawContent(definition, formDataOf(timetable([{ ...row(), evil: "<script>" }])));
    expect(raw.slots[0]).not.toHaveProperty("evil");
  });

  it("requires a row to submit but not to save a draft", () => {
    expect(check("weekly-timetable", timetable([]), false).success).toBe(true);
    const result = check("weekly-timetable", timetable([]), true);
    expect(firstMessage(result)).toBe("Weekly timetable: add at least 1 row(s).");
  });

  it("names the row and column when something is missing", () => {
    const result = check("weekly-timetable", timetable([row(), row({ day: "" })]), true);
    expect(firstMessage(result)).toBe("Weekly timetable, row 2: Day is required.");
  });

  it("checks that the end time is after the start time", () => {
    const result = check("weekly-timetable", timetable([row({ startTime: "11:00", endTime: "10:00" })]), false);
    expect(firstMessage(result)).toMatch(/end time must be after the start time/);
  });

  it("checks times, days and numbers", () => {
    expect(check("weekly-timetable", timetable([row({ startTime: "25:00" })]), false).success).toBe(false);
    expect(check("weekly-timetable", timetable([row({ day: "Funday" })]), false).success).toBe(false);

    const assessments = (weightage) => ({
      pattern: "p",
      components: JSON.stringify([{ component: "Quiz", weightage, schedule: "Oct" }]),
    });
    expect(check("internal-assessments", assessments("40"), true).success).toBe(true);
    expect(check("internal-assessments", assessments("150"), true).success).toBe(false);
    expect(check("internal-assessments", assessments("abc"), true).success).toBe(false);
    expect(check("internal-assessments", assessments("-5"), true).success).toBe(false);
  });
});

describe("registry", () => {
  it("knows the attachment rules", () => {
    expect(getFormDefinition("midsem-papers").attachments.min).toBe(1);
    expect(getFormDefinition("attendance").attachments.min).toBe(1);
    expect(getFormDefinition("direct-feedback").attachments).toBeUndefined();
  });

  it("returns null for unknown or page-based sections", () => {
    expect(getFormDefinition("co-attainment")).toBeNull();
    expect(getFormDefinition("student-list")).toBeNull();
    expect(getFormDefinition("nope")).toBeNull();
  });
});