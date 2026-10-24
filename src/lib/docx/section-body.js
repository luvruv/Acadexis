import {
  emptyParagraph,
  heading,
  imageParagraph,
  note,
  paragraph,
  run,
  table,
  textParagraphs,
} from "./xml.js";

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function notProvided() {
  return note("Not provided.");
}

function outcomeLines(items) {
  if (items.length === 0) return note("None.");
  return items
    .map((item) =>
      paragraph(run(`${item.code}: `, { bold: true }) + run(item.description), { after: 60 })
    )
    .join("");
}

function textOrNote(value) {
  return value ? textParagraphs(value) : notProvided();
}

// One uploaded file: images are embedded, PDFs point to their annexure,
// everything else is listed by name.
function attachmentXml(file, assets) {
  const asset = assets?.byId.get(file.id);
  const label = `${file.name} (${formatSize(file.sizeBytes)})`;
  const line = (text, extra = {}) => paragraph(run(text), { after: 60, indent: 360, ...extra });

  if (asset?.kind === "image") {
    return (
      line(label, { keepNext: true }) +
      imageParagraph({
        relId: asset.relId,
        cx: asset.cx,
        cy: asset.cy,
        id: asset.drawingId,
        name: file.name,
      })
    );
  }
  if (asset?.kind === "pdf") {
    return line(`${label}: Annexure ${asset.annexureNumber} (appended in the PDF copy)`);
  }
  if (asset?.kind === "missing") return line(`${label}: the stored file could not be found`);
  if (asset?.kind === "too-large") return line(`${label}: not embedded (size limit reached)`);
  return line(label);
}

// Builds the body of one section as WordprocessingML. The heading itself
// ("7. Course Syllabus") comes from the Word template.
// assets: the result of loadAttachmentAssets() (optional).
export function buildSectionBody(section, assets = null) {
  const { kind, data } = section;

  switch (kind) {
    case "details":
      return table({
        columns: ["", ""],
        rows: data.rows,
        headerRow: false,
      });

    case "vision-mission":
      return (
        (data.name ? paragraph(run(data.name, { bold: true })) : "") +
        heading("Vision") +
        textOrNote(data.vision) +
        heading("Mission") +
        textOrNote(data.mission)
      );

    case "list":
      return data.items.length === 0
        ? note("None.")
        : data.items
            .map((item, index) => paragraph(run(`${index + 1}. ${item}`), { after: 80, indent: 360 }))
            .join("");

    case "program-outcomes":
      return (
        (data.programName ? paragraph(run(data.programName, { bold: true })) : "") +
        heading("Program Educational Objectives (PEOs)") +
        outcomeLines(data.peos) +
        heading("Program Outcomes (POs)") +
        outcomeLines(data.pos) +
        heading("Program Specific Outcomes (PSOs)") +
        outcomeLines(data.psos)
      );

    case "co-po": {
      if (data.outcomes.length === 0) return note("No course outcomes defined.");
      const columns = ["CO", ...data.columns];
      const rows = data.outcomes.map((outcome) => [
        outcome.code,
        ...data.columns.map((column) => data.matrix[outcome.code]?.[column] ?? "-"),
      ]);
      return (
        outcomeLines(data.outcomes) +
        paragraph("", { after: 60 }) +
        table({ columns, rows, size: columns.length > 10 ? 16 : 20, centerFrom: 1 })
      );
    }

    case "students":
      return data.students.length === 0
        ? note("No students.")
        : table({
            columns: ["#", "Enrollment no.", "Roll no.", "Name", "Class group"],
            rows: data.students.map((student, index) => [
              String(index + 1),
              student.enrollmentNo,
              student.rollNo,
              student.name,
              student.classGroup,
            ]),
          });

    case "marks": {
      if (data.components.length === 0 || data.rows.length === 0) return note("No marks.");
      const columns = [
        "Enrollment no.",
        "Name",
        ...data.components.map((c) => `${c.name} (max ${c.maxMarks})`),
      ];
      const rows = data.rows.map((row) => [row.enrollmentNo, row.name, ...row.values]);
      return table({ columns, rows, size: columns.length > 8 ? 16 : 18, centerFrom: 2 });
    }

    case "co-attainment": {
      if (data.rows.length === 0) return note("Not calculated.");
      const settings = data.settings;
      let intro = "";
      if (settings) {
        intro += note(
          `A student attains a CO when the marks in the components mapped to it reach ${settings.thresholdPercent}% of the maximum. ` +
            `Level 1, 2 and 3 need at least ${settings.level1MinPercent}%, ${settings.level2MinPercent}% and ${settings.level3MinPercent}% of students to attain.`
        );
        if (!settings.confirmed) {
          intro += paragraph(
            run("Provisional: these settings are not yet confirmed by the department.", {
              bold: true,
              color: "C00000",
            })
          );
        }
      }
      const columns = ["Course Outcome", ...data.rows.map((row) => row.code)];
      const rows = [
        [
          "No. of students who attained",
          ...data.rows.map((row) => (row.percentage === null ? "-" : String(row.attained))),
        ],
        [
          "% of students who attained",
          ...data.rows.map((row) => (row.percentage === null ? "-" : row.percentage.toFixed(2))),
        ],
        [
          "Attainment level",
          ...data.rows.map((row) => (row.level === null ? "-" : String(row.level))),
        ],
      ];
      return intro + table({ columns, rows, centerFrom: 1 });
    }

    case "form": {
      let xml = "";
      for (const field of data.fields) {
        xml += heading(field.label);
        if (field.type === "table") {
          xml +=
            field.rows.length === 0
              ? notProvided()
              : table({
                  columns: field.columns.map((column) => column.label),
                  rows: field.rows.map((row) => field.columns.map((column) => row[column.key] ?? "")),
                  size: field.columns.length > 5 ? 18 : 20,
                });
        } else {
          xml += textOrNote(field.value);
        }
      }
      if (data.hasAttachments) {
        xml += heading("Files");
        xml +=
          data.attachments.length === 0
            ? note("No files uploaded.")
            : data.attachments.map((file) => attachmentXml(file, assets)).join("");
      }
      return xml;
    }

    default:
      return note(data.message ?? "Nothing has been entered for this section.") + emptyParagraph();
  }
}