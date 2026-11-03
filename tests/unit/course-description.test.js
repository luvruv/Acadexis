import { describe, expect, it } from "vitest";
import { buildContentSchema, extractRawContent, getFormDefinition } from "@/section-forms/registry";
import { buildSectionBody } from "@/lib/docx/section-body";
import { assertWellFormed } from "./helpers.js";

const definition = getFormDefinition("course-description");
const formDataOf = (values) => ({ get: (name) => (name in values ? values[name] : null) });
const check = (values, submit) =>
  buildContentSchema(definition, { submit }).safeParse(extractRawContent(definition, formDataOf(values)));

describe("course description form", () => {
  it("keeps description and objectives required and the details optional", () => {
    expect(check({ description: "A", objectives: "B" }, true).success).toBe(true);
    const missing = check({ description: "A", credits: "2 (1-0-2)" }, true);
    expect(missing.success).toBe(false);
    expect(missing.error.issues[0].message).toBe("Course objectives is required.");
  });

  it("trims the details and keeps them", () => {
    const result = check(
      { description: "A", objectives: "B", credits: "  2 (1-0-2) ", office: " 07, IV Floor, E2 Building " },
      false
    );
    expect(result.data).toMatchObject({ credits: "2 (1-0-2)", office: "07, IV Floor, E2 Building" });
  });
});

function section(values, headerRows) {
  const fields = definition.fields.map((field) => ({
    type: "text",
    name: field.name,
    label: field.label,
    value: values[field.name] ?? "",
  }));
  return {
    number: 5,
    title: "Course Description and its objectives",
    formKey: "course-description",
    kind: "form",
    data: { fields, headerRows, hasAttachments: false, attachments: [] },
  };
}

describe("course description in the document", () => {
  const headerRows = [
    ["Course Code", "CSE2724"],
    ["Course Name", "Human Computer Interaction"],
    ["Academic Year", "2025-26"],
  ];

  it("starts with a details table, then the aim, then the overview", () => {
    const xml = buildSectionBody(
      section(
        {
          credits: "2 (1-0-2)",
          contactHours: "1 hour Theory & 2 hours lab per week",
          faculty: "Dr. Shilpa Mahajan\nMr. Gautam Gupta",
          objectives: "How can we design human-centred systems?",
          description: "Product design affects us.",
        },
        headerRows
      )
    );
    assertWellFormed(xml);
    expect(xml.indexOf("<w:tbl>")).toBeLessThan(xml.indexOf("Aim of the course"));
    expect(xml.indexOf("Aim of the course")).toBeLessThan(xml.indexOf("Course Overview and Context"));
    for (const text of ["CSE2724", "Human Computer Interaction", "2025-26", "Credits", "2 (1-0-2)", "Contact Hours", "Course Faculty", "Mr. Gautam Gupta"]) {
      expect(xml).toContain(text);
    }
    expect(xml).not.toContain("Office"); // empty details are left out
  });

  it("escapes hostile text", () => {
    const xml = buildSectionBody(
      section({ credits: "<b>&</b>", objectives: "x < y & z", description: "d" }, headerRows)
    );
    assertWellFormed(xml);
    expect(xml).toContain("&lt;b&gt;&amp;&lt;/b&gt;");
  });

  it("still works for a file saved before the details existed", () => {
    const xml = buildSectionBody(section({ objectives: "B", description: "A" }, undefined));
    assertWellFormed(xml);
    expect(xml).toContain("Aim of the course");
    expect(xml).not.toContain("<w:tbl>");
  });
});
