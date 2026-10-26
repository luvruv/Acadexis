import { describe, expect, it } from "vitest";
import { buildDocumentId } from "@/lib/document-id";

const base = { courseCode: "CSE3005", academicYear: "2026-27", semester: "Semester 5", revision: 1 };

describe("buildDocumentId", () => {
  it("has the documented shape", () => {
    expect(buildDocumentId(base)).toMatch(/^ACX-CSE3005-2026-27-S5-R1-[A-HJKMNP-Z2-9]{4}$/);
  });

  it("never uses look-alike characters in the random part", () => {
    for (let i = 0; i < 300; i += 1) {
      const suffix = buildDocumentId(base).split("-").pop();
      expect(suffix).not.toMatch(/[01OIL]/);
    }
  });

  it("cleans odd input", () => {
    expect(buildDocumentId({ ...base, courseCode: "cse 3005-A", semester: "5th", revision: 2 })).toMatch(
      /^ACX-CSE3005A-2026-27-S5-R2-/
    );
  });

  it("falls back to safe placeholders", () => {
    expect(buildDocumentId({ courseCode: "!!", academicYear: "", semester: "Monsoon", revision: 1 })).toMatch(
      /^ACX-COURSE-YEAR-MON-R1-/
    );
  });

  it("always produces only letters, digits and hyphens", () => {
    const id = buildDocumentId({ courseCode: "a/b\\c", academicYear: "20<26>", semester: "x y", revision: 3 });
    expect(id).toMatch(/^ACX-[A-Z0-9-]+$/);
  });

  it("changes with the revision", () => {
    expect(buildDocumentId({ ...base, revision: 1 })).toContain("-R1-");
    expect(buildDocumentId({ ...base, revision: 2 })).toContain("-R2-");
  });
});