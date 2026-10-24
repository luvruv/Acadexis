// Creates templates/bmu-course-file.docx, the Word template the export fills in.
// Run it once (node scripts/build-template.mjs) and commit the result. After
// that, open the .docx in Word to change fonts, margins, the cover page or the
// header and footer. Keep the {tags}: they are replaced with real data.
//
//   {courseCode} {courseTitle} {universityName} {schoolName} {programName}
//   {programLine} {subjectLine} {semester} {academicYear} {batch}
//   {coordinatorName} {documentId} {generatedOn} {draftNotice}
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

const THIN = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const thinBorders = { top: THIN, bottom: THIN, left: THIN, right: THIN };
const DOUBLE = { style: BorderStyle.DOUBLE, size: 6, color: "000000" };
const boxBorders = { top: DOUBLE, bottom: DOUBLE, left: DOUBLE, right: DOUBLE };

// A centered bold line in the cover box: a fixed label followed by a tag.
function boxLine(label, tag) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [text(label, { bold: true }), text(tag, { bold: true })],
  });
}

// Cover page, laid out like the HCI sample course file. To add the BMU logo,
// open the template in Word and insert it above the university name.
const cover = [
  line("{universityName}", { bold: true, size: 40 }, { alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 120 } }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 360 },
    children: [text("{schoolName}", { bold: true, size: 28, allCaps: true })],
  }),
  line("COURSE FILE", { bold: true, size: 36 }, { alignment: AlignmentType.CENTER, spacing: { after: 720 } }),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [9026],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 9026, type: WidthType.DXA },
            borders: boxBorders,
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: [
              boxLine("Program: ", "{programLine}"),
              boxLine("Subject Code & Name: ", "{subjectLine}"),
              boxLine("Faculty: ", "{coordinatorName}"),
              boxLine("Module/Semester: ", "{semester}"),
              boxLine("Session: ", "{academicYear}"),
            ],
          }),
        ],
      }),
    ],
  }),
  line("Document ID: {documentId}", { bold: true }, { alignment: AlignmentType.CENTER, spacing: { before: 480, after: 60 } }),
  line("Generated on: {generatedOn}", {}, { alignment: AlignmentType.CENTER }),
  line("{draftNotice}", { bold: true, color: "C00000", size: 24 }, { alignment: AlignmentType.CENTER, spacing: { before: 300 } }),
];

function indexCell(value, width, { center = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: thinBorders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
        children: [text(value, { bold: true })],
      }),
    ],
  });
}

// The index is one table row that repeats for every section: the loop starts
// in the first cell and ends in the last cell.
const index = [
  new Paragraph({
    pageBreakBefore: true,
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [text("Index", { bold: true, size: 28, underline: {} })],
  }),
  new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [900, 8126],
    rows: [
      new TableRow({
        children: [
          indexCell("{#sections}{number}.", 900, { center: true }),
          indexCell("{title}{/sections}", 8126),
        ],
      }),
    ],
  }),
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
        titlePage: true, // the cover page has no header or footer, as in the sample
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        first: new Header({ children: [new Paragraph({})] }),
        default: new Header({
          children: [
            line("{courseCode}: {courseTitle}", { size: 18, color: "595959" }, { alignment: AlignmentType.RIGHT }),
          ],
        }),
      },
      footers: {
        first: new Footer({ children: [new Paragraph({})] }),
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