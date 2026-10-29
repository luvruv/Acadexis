import {
  emptyParagraph,
  heading,
  imageParagraph,
  listItem,
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

// "PEO1" -> "PEO 1", as written in the BMU course files.
function spacedCode(code) {
  return String(code).replace(/^([A-Za-z]+)(\d+)$/, "$1 $2");
}

function outcomeLines(items, { spaced = false } = {}) {
  if (items.length === 0) return note("None.");
  return items
    .map((item) =>
      paragraph(
        run(`${spaced ? spacedCode(item.code) : item.code}: `, { bold: true }) + run(item.description),
        { after: 100, justify: true, line: 280 }
      )
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

// The session plan is written as "Week 1-3: topics" lines, like the sample.
function sessionPlanXml(field) {
  if (field.rows.length === 0) return notProvided();
  return field.rows
    .map((row) => {
      const cos = row.cos ? ` (${row.cos})` : "";
      return paragraph(run(`${row.week}: `, { bold: true }) + run(`${row.topics}${cos}`), {
        after: 120,
        justify: true,
        line: 280,
      });
    })
    .join("");
}

// A table field. Optional columns nobody filled in are left out, and a total
// line is added when the field defines one (for example total sessions).
function tableFieldXml(field) {
  if (field.rows.length === 0) return notProvided();

  const columns = field.columns.filter(
    (column) => column.required || field.rows.some((row) => String(row[column.key] ?? "").trim() !== "")
  );

  let xml = table({
    columns: columns.map((column) => column.label),
    rows: field.rows.map((row) => columns.map((column) => row[column.key] ?? "")),
    size: columns.length > 5 ? 18 : 20,
  });

  if (field.totalColumn) {
    const column = field.columns.find((item) => item.key === field.totalColumn);
    const total =
      Math.round(field.rows.reduce((sum, row) => sum + (Number(row[field.totalColumn]) || 0), 0) * 100) / 100;
    xml += paragraph(run(`Total ${column?.label ?? ""}: ${total}`, { bold: true }), { after: 120 });
  }
  return xml;
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

    case "vision-mission": {
      const scope = section.formKey.startsWith("school") ? "School" : "University";
      return (
        heading(`Vision of the ${scope}:`, { center: true }) +
        textOrNote(data.vision) +
        heading(`Mission of the ${scope}:`, { center: true }) +
        textOrNote(data.mission)
      );
    }

    case "list":
      return data.items.length === 0
        ? note("None.")
        : data.items.map((item) => listItem("\u2022", run(item))).join("");

    case "program-outcomes":
      return (
        (data.programName ? paragraph(run(data.programName, { bold: true })) : "") +
        heading("Program Educational Objectives (PEOs)") +
        outcomeLines(data.peos, { spaced: true }) +
        heading("Program Outcomes (POs)") +
        outcomeLines(data.pos, { spaced: true }) +
        heading("Program Specific Outcomes (PSOs)") +
        outcomeLines(data.psos, { spaced: true })
      );

    case "co-po": {
      if (data.outcomes.length === 0) return note("No course outcomes defined.");
      const columns = ["CO", ...data.columns];
      const rows = data.outcomes.map((outcome) => [
        outcome.code,
        ...data.columns.map((column) => data.matrix[outcome.code]?.[column] ?? "-"),
      ]);
      return (
        paragraph(
          run("Course Outcomes (CO): ", { bold: true }) +
            run("At the end of the course the students should be able to do the following:"),
          { after: 100, justify: true }
        ) +
        outcomeLines(data.outcomes) +
        heading("CO-PO Mapping") +
        table({ columns, rows, size: columns.length > 10 ? 16 : 20, centerFrom: 1 }) +
        note("1 - Low correlation; 2 - Moderate correlation; 3 - Substantial correlation.")
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
      const isNew = data.rows[0].average !== undefined;
      const pct = (fraction) => String(Math.round(fraction * 10000) / 100);
      let intro = "";
      if (settings && isNew) {
        intro += note(
          "For each CO, a student's score is the sum of (component weight x marks) divided by the sum of (component weight x maximum marks). " +
            `A student is at Level 3 with ${pct(settings.studentLevel3Min)}% or more, at Level 2 with ${pct(settings.studentLevel2Min)}% or more, otherwise at Level 1. ` +
            "CO attainment is the average of the student levels. " +
            `The target attainment level is 3 when ${settings.courseLevel3MinPercent}% or more of the students are at Level 3, and 2 when ${settings.courseLevel2MinPercent}% or more are.`
        );
        if (!settings.confirmed) {
          intro += paragraph(
            run("These settings are not yet confirmed by the department.", {
              bold: true,
              color: "C00000",
            })
          );
        }
      } else if (settings) {
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
      const rows = isNew
        ? [
            [
              "Students at Level 3",
              ...data.rows.map((row) => (row.level === null ? "-" : `${row.attained} of ${row.assessed}`)),
            ],
            [
              "% of students at Level 3",
              ...data.rows.map((row) => (row.level === null ? "-" : row.percentage.toFixed(2))),
            ],
            [
              "Target attainment level",
              ...data.rows.map((row) => (row.level === null ? "-" : String(row.level))),
            ],
            [
              "CO attainment (average of student levels)",
              ...data.rows.map((row) => (row.average === null ? "-" : row.average.toFixed(2))),
            ],
          ]
        : [
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
      let outro = "";
      if (isNew && data.overall !== null && data.overall !== undefined) {
        outro = paragraph(run(`Overall course attainment: ${data.overall.toFixed(2)}`, { bold: true }));
      }
      return intro + table({ columns, rows, centerFrom: 1 }) + outro;
    }

    case "form": {
      let xml = "";
      for (const field of data.fields) {
        // The session plan reads as paragraphs and needs no field heading.
        if (section.formKey !== "session-plan") xml += heading(field.label);
        if (field.type === "table") {
          xml += section.formKey === "session-plan" ? sessionPlanXml(field) : tableFieldXml(field);
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

    case "po-attainment": {
      if (data.rows.length === 0) return note(data.message) + emptyParagraph();
      return (
        table({
          columns: ["Programme outcome", "Attainment"],
          rows: data.rows.map((item) => [item.code, item.value === null ? "-" : item.value.toFixed(2)]),
          centerFrom: 1,
        }) +
        note(
          "PO attainment is the sum of (CO attainment x CO-PO level) divided by the sum of the CO-PO levels. A dash means no Course Outcome is mapped to that outcome."
        )
      );
    }

    default:
      return note(data.message ?? "Nothing has been entered for this section.") + emptyParagraph();
  }
}