import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { renderCourseFileDocx } from "@/lib/docx/render";
import { buildSectionBody } from "@/lib/docx/section-body";
import { esc, paragraph, run, table, textParagraphs } from "@/lib/docx/xml";
import { assertWellFormed, fakePng } from "./helpers.js";

const NASTY = `<script>alert("x")</script> & "quotes" 'single' \u0000\u0008`;

describe("xml helpers", () => {
  it("escapes markup and drops control characters", () => {
    expect(esc(`<a href="x">&</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
    expect(esc("a\u0000b\u0008c")).toBe("abc");
    expect(esc(null)).toBe("");
  });

  it("builds well-formed runs, paragraphs and tables from hostile text", () => {
    assertWellFormed(run(NASTY, { bold: true, color: "FF0000", size: 20 }));
    assertWellFormed(paragraph(run(NASTY), { justify: true, line: 300, indent: 360, hanging: 360 }));
    assertWellFormed(textParagraphs(`${NASTY}\nsecond line\r\nthird`));
    assertWellFormed(table({ columns: [NASTY, "B"], rows: [[NASTY, "x\ny"], ["", null]] }));
  });

  it("writes one paragraph per line of text", () => {
    expect(textParagraphs("a\nb\r\nc").match(/<w:p>/g)).toHaveLength(3);
  });

  it("widths of a table add up to the page width", () => {
    const xml = table({ columns: ["A", "BB", "CCC"], rows: [["1", "22", "333"]] });
    const widths = [...xml.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => Number(m[1]));
    expect(widths.reduce((a, b) => a + b, 0)).toBe(9026);
  });
});

const formSection = (extra = {}) => ({
  number: 8,
  title: "Course Syllabus",
  formKey: "course-syllabus",
  kind: "form",
  data: {
    fields: [
      {
        type: "table",
        label: "Topics of the course",
        totalColumn: "sessions",
        columns: [
          { key: "topic", label: "Topics", required: true },
          { key: "sessions", label: "Sessions (hours)", required: true },
          { key: "readings", label: "Readings", required: false },
        ],
        rows: [
          { topic: NASTY, sessions: "2", readings: "" },
          { topic: "UML", sessions: "3.5", readings: "" },
        ],
      },
      { type: "text", label: "Textbook(s)", value: NASTY },
    ],
    hasAttachments: true,
    attachments: [{ id: "f1", name: `${NASTY}.pdf`, sizeBytes: 2048 }],
  },
  ...extra,
});

describe("buildSectionBody", () => {
  it("produces well-formed XML for every kind of section, even with hostile text", () => {
    const sections = [
      { kind: "details", formKey: "course-details", data: { rows: [["Title", NASTY]] } },
      { kind: "vision-mission", formKey: "university-vision-mission", data: { vision: NASTY, mission: "" } },
      { kind: "list", formKey: "graduate-attributes", data: { items: [NASTY, "b"] } },
      {
        kind: "program-outcomes", formKey: "program-outcomes",
        data: { programName: NASTY, peos: [{ code: "PEO1", description: NASTY }], pos: [], psos: [] },
      },
      {
        kind: "co-po", formKey: "course-outcomes",
        data: {
          outcomes: [{ code: "CO1", description: NASTY }],
          columns: ["PO1", "PSO1"],
          matrix: { CO1: { PO1: 3 } },
        },
      },
      { kind: "students", formKey: "student-list", data: { students: [{ enrollmentNo: NASTY, rollNo: "", name: "n", classGroup: "" }] } },
      {
        kind: "marks", formKey: "marks-all-components",
        data: { components: [{ name: "Quiz", maxMarks: 10 }], rows: [{ enrollmentNo: "E1", name: NASTY, values: ["AB"] }] },
      },
      {
        kind: "co-attainment", formKey: "co-attainment",
        data: {
          settings: { thresholdPercent: 40, level1MinPercent: 50, level2MinPercent: 60, level3MinPercent: 70, confirmed: false },
          rows: [{ code: "CO1", attained: 1, assessed: 2, percentage: 50, level: 1 }, { code: "CO2", percentage: null, level: null }],
        },
      },
      formSection(),
      { kind: "empty", formKey: "additional-info", data: { message: NASTY } },
    ];
    for (const section of sections) assertWellFormed(buildSectionBody(section));
  });

  it("escapes the hostile text instead of passing it through", () => {
    const xml = buildSectionBody(formSection());
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&lt;script&gt;");
  });

  it("adds a total line to tables that define one", () => {
    expect(buildSectionBody(formSection())).toContain("Total Sessions (hours): 5.5");
  });

  it("leaves out optional columns nobody filled in", () => {
    const xml = buildSectionBody(formSection());
    expect(xml).not.toContain("Readings");
  });

  it("writes the session plan as Week lines instead of a table", () => {
    const xml = buildSectionBody({
      number: 9, title: "Session plan", formKey: "session-plan", kind: "form",
      data: {
        fields: [{ type: "table", label: "Session plan", columns: [], rows: [{ week: "Week 1-3", topics: "Intro", cos: "CO1" }] }],
        hasAttachments: false, attachments: [],
      },
    });
    expect(xml).toContain("Week 1-3: ");
    expect(xml).not.toContain("<w:tbl>");
  });

  it("points PDF attachments to their annexure and embeds images", () => {
    const assets = {
      byId: new Map([
        ["f1", { kind: "pdf", annexureNumber: 2 }],
        ["f2", { kind: "image", relId: "rIdAcadexisImg1", cx: 1000, cy: 500, drawingId: 1001 }],
      ]),
    };
    const section = formSection();
    section.data.attachments = [
      { id: "f1", name: "paper.pdf", sizeBytes: 100 },
      { id: "f2", name: "scan.png", sizeBytes: 100 },
    ];
    const xml = buildSectionBody(section, assets);
    assertWellFormed(xml);
    expect(xml).toContain("Annexure 2 (appended in the PDF copy)");
    expect(xml).toContain('r:embed="rIdAcadexisImg1"');
  });
});

const header = {
  universityName: "BML Munjal University",
  schoolName: "School of Engineering & Technology",
  programName: "B.Tech (CSE)",
  courseCode: "CSE3005",
  courseTitle: `Software Engineering <&> "Design"`,
  semester: "Semester 5",
  academicYear: "2026-27",
  batch: null,
  coordinatorName: "Demo Coordinator",
  status: "LOCKED",
};
const doc = {
  header,
  sections: [
    { number: 2, title: "Vision, Mission of the University", formKey: "university-vision-mission", kind: "vision-mission", data: { vision: "V", mission: "M" } },
    { number: 8, title: "Course Syllabus", formKey: "course-syllabus", kind: "form", data: formSection().data },
  ],
};

function readParts(buffer) {
  const zip = new PizZip(buffer);
  return {
    zip,
    document: zip.file("word/document.xml").asText(),
    all: Object.keys(zip.files)
      .filter((name) => name.startsWith("word/") && name.endsWith(".xml"))
      .map((name) => zip.file(name).asText())
      .join("\n"),
  };
}

describe("renderCourseFileDocx", () => {
  it("fills the template with the Document ID, the cover details and every section", () => {
    const { document, all } = readParts(renderCourseFileDocx(doc, { documentId: "ACX-TEST-R1-ABCD" }));
    assertWellFormed(document, { wrap: false });
    expect(all).toContain("ACX-TEST-R1-ABCD");
    expect(document).toContain("BML Munjal University");
    expect(document).toContain("B.Tech (CSE)");
    expect(document).toContain("Course Syllabus");
    expect(document).toContain("Vision, Mission of the University");
    expect(document).not.toContain("DRAFT: not an official copy");
    expect(document).not.toMatch(/\{[#/@]?\w+\}/); // no unreplaced template tags
  });

  it("marks drafts clearly", () => {
    const { document, all } = readParts(renderCourseFileDocx(doc, { documentId: null }));
    expect(document).toContain("DRAFT: not an official copy");
    expect(all).toContain("DRAFT (not issued)");
  });

  it("escapes hostile text from the data", () => {
    const { document } = readParts(renderCourseFileDocx(doc, { documentId: null }));
    assertWellFormed(document, { wrap: false });
    expect(document).not.toContain("<script>");
  });

  it("repeats the index row and heading once per section", () => {
    const { document } = readParts(renderCourseFileDocx(doc, { documentId: null }));
    expect(document.match(/Course Syllabus/g)).toHaveLength(2); // index + heading
  });

  it("adds embedded pictures to the package", () => {
    const png = fakePng(10, 10);
    const assets = {
      byId: new Map(),
      media: [{ kind: "image", relId: "rIdAcadexisImg1", mediaName: "acadexis-image-1.png", buffer: png, cx: 1, cy: 1, drawingId: 1001 }],
      annexures: [],
    };
    const { zip } = readParts(renderCourseFileDocx(doc, { documentId: "X", assets }));
    expect(zip.file("word/media/acadexis-image-1.png")).toBeTruthy();
    expect(zip.file("word/_rels/document.xml.rels").asText()).toContain('Id="rIdAcadexisImg1"');
    expect(zip.file("[Content_Types].xml").asText()).toMatch(/Extension="png"/i);
  });
});