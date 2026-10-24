// Small helpers that write WordprocessingML for the BODY of a section.
// Everything that is not a section body (cover page, index, headings, header,
// footer, fonts, margins) lives in the Word template file.

const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

// Text width of an A4 page with 1 inch margins, in twips (1/20 of a point).
export const TEXT_WIDTH = 9026;

export function esc(value) {
  return String(value ?? "")
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// size is in half-points (22 = 11 pt).
export function run(text, { bold, italic, color, size } = {}) {
  const props = [
    bold ? "<w:b/>" : "",
    italic ? "<w:i/>" : "",
    color ? `<w:color w:val="${color}"/>` : "",
    size ? `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` : "",
  ].join("");
  return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ""}<w:t xml:space="preserve">${esc(
    text
  )}</w:t></w:r>`;
}

export function paragraph(
  runs,
  { before = 0, after = 100, keepNext = false, indent = 0, hanging = 0, justify = false, center = false, line = 0 } = {}
) {
  const props = [
    keepNext ? "<w:keepNext/>" : "",
    `<w:spacing w:before="${before}" w:after="${after}"${line ? ` w:line="${line}" w:lineRule="auto"` : ""}/>`,
    indent || hanging
      ? `<w:ind w:left="${indent}"${hanging ? ` w:hanging="${hanging}"` : ""}/>`
      : "",
    justify ? '<w:jc w:val="both"/>' : center ? '<w:jc w:val="center"/>' : "",
  ].join("");
  return `<w:p><w:pPr>${props}</w:pPr>${runs}</w:p>`;
}

// One paragraph per line of text, so line breaks typed in the forms are kept.
// Body text is justified with a little extra line spacing, like the sample.
export function textParagraphs(text, options = {}) {
  const lines = String(text ?? "").split(/\r?\n/);
  return lines
    .map((line) =>
      paragraph(run(line, options.run), {
        justify: true,
        line: 300,
        after: 120,
        ...options.paragraph,
      })
    )
    .join("");
}

export function heading(text, { center = false } = {}) {
  return paragraph(run(text, { bold: true }), { before: 160, after: 80, keepNext: true, center });
}

// A bullet or numbered item with a hanging indent.
export function listItem(label, runsAfterLabel) {
  return paragraph(run(label) + "<w:r><w:tab/></w:r>" + runsAfterLabel, {
    indent: 540,
    hanging: 360,
    after: 80,
    justify: true,
    line: 280,
  });
}

export function note(text) {
  return paragraph(run(text, { italic: true, color: "595959" }), { after: 100 });
}

export function emptyParagraph() {
  return paragraph("", { after: 0 });
}

function columnWidths(columns, rows, total) {
  const weights = columns.map((column, index) => {
    let longest = String(column).length;
    for (const row of rows) {
      for (const line of String(row[index] ?? "").split(/\r?\n/)) {
        longest = Math.max(longest, line.length);
      }
    }
    return Math.min(Math.max(longest + 2, 6), 40);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((weight) => Math.floor((weight / sum) * total));
  widths[widths.length - 1] += total - widths.reduce((a, b) => a + b, 0);
  return widths;
}

const BORDER =
  '<w:top w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="808080"/>';

function cell(text, width, { bold = false, fill = null, size = 20, center = false } = {}) {
  const lines = String(text ?? "").split(/\r?\n/);
  const paragraphs = lines
    .map(
      (line) =>
        `<w:p><w:pPr><w:spacing w:before="20" w:after="20"/>${
          center ? '<w:jc w:val="center"/>' : ""
        }</w:pPr>${run(line, { bold, size })}</w:p>`
    )
    .join("");
  const shading = fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : "";
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}</w:tcPr>${paragraphs}</w:tc>`;
}

// columns: array of header labels. rows: array of arrays of strings.
// Returns a table followed by a small empty paragraph.
export function table({ columns, rows, size = 20, centerFrom = null, headerRow = true }) {
  const widths = columnWidths(columns, rows, TEXT_WIDTH);
  const grid = widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("");

  const headerXml = headerRow
    ? `<w:tr><w:trPr><w:cantSplit/><w:tblHeader/></w:trPr>${columns
        .map((label, i) =>
          cell(label, widths[i], {
            bold: true,
            fill: "E7E6E6",
            size,
            center: true,
          })
        )
        .join("")}</w:tr>`
    : "";

  const bodyXml = rows
    .map(
      (row) =>
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${columns
          .map((_, i) =>
            cell(row[i], widths[i], {
              size,
              center: centerFrom !== null && i >= centerFrom,
            })
          )
          .join("")}</w:tr>`
    )
    .join("");

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${TEXT_WIDTH}" w:type="dxa"/>` +
    `<w:tblBorders>${BORDER}</w:tblBorders><w:tblLayout w:type="fixed"/>` +
    `<w:tblCellMar><w:left w:w="${size <= 16 ? 40 : 80}" w:type="dxa"/><w:right w:w="${
      size <= 16 ? 40 : 80
    }" w:type="dxa"/></w:tblCellMar>` +
    `</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${headerXml}${bodyXml}</w:tbl>` +
    emptyParagraph()
  );
}

// An inline picture. relId points at an image part that render.js adds to the
// package. cx and cy are the size in EMU (914400 per inch).
export function imageParagraph({ relId, cx, cy, id, name }) {
  const safeName = esc(name);
  return (
    `<w:p><w:pPr><w:keepLines/><w:spacing w:before="60" w:after="160"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>` +
    `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${id}" name="Picture ${id}" descr="${safeName}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${safeName}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    `</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  );
}