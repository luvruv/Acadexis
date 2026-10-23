// Creates templates/bmu-course-file.docx, the Word template the export fills in.
// Run it once (node scripts/build-template.mjs) and commit the result. After
// that, open the .docx in Word to change fonts, margins, the cover page or the
// header and footer. Keep the {tags}: they are replaced with real data.
//
//   {courseCode} {courseTitle} {universityName} {schoolName} {programName}
//   {semester} {academicYear} {batch} {coordinatorName} {documentId}
//   {generatedOn} {draftNotice}
//   {#sections} ... {number} {title} ... {@body} ... {/sections}
//
// {@body} is replaced with the content of each section.

import fs from "node:fs";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

const FONT = "Times New Roman";

const text = (value, options = {}) => new TextRun({ text: value, font: FONT, ...options });
const line = (value, options = {}, paragraph = {}) =>
  new Paragraph({ children: [text(value, options)], ...paragraph });

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "808080" };
const borders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function factRow(label, tag) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 3000, type: WidthType.DXA },
        borders,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [line(label, { bold: true })],
      }),
      new TableCell({
        width: { size: 6026, type: WidthType.DXA },
        borders,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        children: [line(tag)],
      }),
    ],
  });
}

const cover = [
  line("{universityName}", { bold: true, size: 40 }, { alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 120 } }),
  line("{schoolName}", { size: 28 }, { alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
  line("COURSE FILE", { bold: true, size: 48 }, { alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [3000, 6026],
    rows: [
      factRow("Program", "{programName}"),
      factRow("Course code", "{courseCode}"),
      factRow("Course title", "{courseTitle}"),
      factRow("Semester / term", "{semester}"),
      factRow("Academic year", "{academicYear}"),
      factRow("Batch", "{batch}"),
      factRow("Course coordinator", "{coordinatorName}"),
      factRow("Document ID", "{documentId}"),
      factRow("Generated on", "{generatedOn}"),
    ],
  }),
  line("{draftNotice}", { bold: true, color: "C00000", size: 24 }, { alignment: AlignmentType.CENTER, spacing: { before: 400 } }),
];

const index = [
  new Paragraph({
    pageBreakBefore: true,
    spacing: { after: 240 },
    children: [text("Index", { bold: true, size: 32 })],
  }),
  line("{#sections}"),
  line("{number}. {title}", {}, { spacing: { after: 80 } }),
  line("{/sections}"),
];

const sections = [
  line("{#sections}"),
  new Paragraph({
    style: "Heading1",
    children: [text("{number}. {title}")],
  }),
  line("{@body}"),
  line("{/sections}"),
];

const document = new Document({
  creator: "Acadexis",
  title: "Course File",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: FONT, bold: true, size: 28 },
        paragraph: {
          pageBreakBefore: true,
          keepNext: true,
          spacing: { before: 0, after: 240 },
        },
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [
            line("{courseCode}: {courseTitle}", { size: 18, color: "595959" }, { alignment: AlignmentType.RIGHT }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                text("Document ID: {documentId}   |   Page ", { size: 18, color: "595959" }),
                new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "595959" }),
                text(" of ", { size: 18, color: "595959" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "595959" }),
              ],
            }),
          ],
        }),
      },
      children: [...cover, ...index, ...sections],
    },
  ],
});

const output = path.join(process.cwd(), "templates", "bmu-course-file.docx");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, await Packer.toBuffer(document));
console.log("Template written to", output);