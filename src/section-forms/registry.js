import { z } from "zod";

const MAX_TEXT_LENGTH = 10000;
const MAX_CELL_LENGTH = 3000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SESSION_TYPES = ["Lecture", "Lab", "Tutorial"];

// One entry per section type (formKey). Add new sections here.
//
// Text field:  { name, label, required, rows }
// Table field: { name, label, type: "table", minRows, maxRows, columns,
//                totalColumn?, totalTarget?, timeRange? }
//   column: { key, label, type: "text"|"textarea"|"select"|"time"|"number",
//             required, options?, min?, max? }
// atLeastOne: at least one text field must be filled to submit.
// attachments: { min }: the section accepts uploaded files; "min" is how many
//   are needed before it can be submitted (0 = optional).
const FORMS = {
  "course-description": {
    fields: [
      { name: "description", label: "Course description", required: true, rows: 8 },
      { name: "objectives", label: "Course objectives", required: true, rows: 6 },
    ],
  },
  "session-plan": {
    attachments: { min: 0 },
    fields: [
      {
        name: "sessions",
        label: "Session plan",
        type: "table",
        minRows: 1,
        maxRows: 60,
        columns: [
          { key: "week", label: "Week / session", type: "text", required: true },
          { key: "topics", label: "Topics and activities", type: "textarea", required: true },
          { key: "cos", label: "COs mapped", type: "text", required: false },
        ],
      },
    ],
  },
  "weekly-timetable": {
    attachments: { min: 0 },
    fields: [
      {
        name: "slots",
        label: "Weekly timetable",
        type: "table",
        minRows: 1,
        maxRows: 40,
        timeRange: ["startTime", "endTime"],
        columns: [
          { key: "day", label: "Day", type: "select", options: DAYS, required: true },
          { key: "startTime", label: "Start", type: "time", required: true },
          { key: "endTime", label: "End", type: "time", required: true },
          { key: "type", label: "Type", type: "select", options: SESSION_TYPES, required: true },
          { key: "room", label: "Room", type: "text", required: false },
          { key: "classGroup", label: "Class group", type: "text", required: false },
        ],
      },
    ],
  },
  "internal-assessments": {
    attachments: { min: 0 },
    fields: [
      { name: "pattern", label: "Assessment pattern", required: true, rows: 5 },
      {
        name: "components",
        label: "Evaluation components",
        type: "table",
        minRows: 1,
        maxRows: 15,
        totalColumn: "weightage",
        totalTarget: 100,
        columns: [
          { key: "component", label: "Evaluation component", type: "text", required: true },
          { key: "weightage", label: "Weightage (%)", type: "number", min: 0, max: 100, required: true },
          { key: "schedule", label: "Schedule", type: "text", required: true },
          { key: "rubrics", label: "Rubrics", type: "textarea", required: false },
          { key: "cos", label: "COs mapped", type: "text", required: false },
        ],
      },
      {
        name: "responsibilities",
        label: "Student responsibilities and policies (optional)",
        required: false,
        rows: 5,
      },
    ],
  },
    "course-syllabus": {
    attachments: { min: 0 },
    fields: [
      {
        name: "topics",
        label: "Topics of the course",
        type: "table",
        minRows: 1,
        maxRows: 40,
        totalColumn: "sessions",
        columns: [
          { key: "topic", label: "Topics / module content", type: "textarea", required: true },
          { key: "sessions", label: "Sessions (hours)", type: "number", min: 0, max: 200, required: true },
          { key: "cos", label: "COs mapped", type: "text", required: true },
          { key: "readings", label: "Readings", type: "text", required: false },
          { key: "activities", label: "Activities", type: "text", required: false },
          { key: "strategy", label: "Teaching strategy", type: "text", required: false },
        ],
      },
      { name: "textbooks", label: "Textbook(s)", required: true, rows: 4 },
      { name: "references", label: "Reference books (optional)", required: false, rows: 4 },
      { name: "otherResources", label: "Other learning resources (optional)", required: false, rows: 4 },
    ],
  },
  attendance: {
    attachments: { min: 1 },
    fields: [{ name: "notes", label: "Summary or notes (optional)", required: false, rows: 4 }],
  },
  "final-results": {
    attachments: { min: 1 },
    fields: [{ name: "notes", label: "Summary or notes (optional)", required: false, rows: 4 }],
  },
  "midsem-papers": {
    attachments: { min: 1 },
    fields: [{ name: "notes", label: "Notes (optional)", required: false, rows: 4 }],
  },
  "evaluated-submissions": {
    attachments: { min: 1 },
    fields: [
      { name: "weakStudents", label: "Identification of weak students", required: true, rows: 6 },
      { name: "notes", label: "Notes (optional)", required: false, rows: 4 },
    ],
  },
  "midterm-reflections": {
    attachments: { min: 0 },
    fields: [
      {
        name: "reflections",
        label: "Reflections from the mid-term feedback received",
        required: true,
        rows: 6,
      },
      {
        name: "interventions",
        label: "Interventions made to improve learning and teaching strategies",
        required: true,
        rows: 6,
      },
    ],
  },
  interventions: {
    attachments: { min: 0 },
    fields: [
      { name: "slowPerformers", label: "Interventions for slow performers", required: true, rows: 5 },
      { name: "advancedLearners", label: "Interventions for advanced learners", required: true, rows: 5 },
      {
        name: "initiatives",
        label: "Other initiatives (retests, resubmissions, etc.)",
        required: false,
        rows: 4,
      },
    ],
  },
  "endsem-papers": {
    attachments: { min: 1 },
    fields: [{ name: "notes", label: "Notes (optional)", required: false, rows: 4 }],
  },
  "direct-feedback": {
    fields: [
      {
        name: "analysis",
        label: "Analysis of direct feedback received on Course Outcomes",
        required: true,
        rows: 10,
      },
    ],
  },
  "feedback-corrective-actions": {
    attachments: { min: 0 },
    fields: [
      {
        name: "feedback",
        label: "Feedback received (class committee or otherwise)",
        required: true,
        rows: 6,
      },
      { name: "correctiveActions", label: "Corrective actions taken (if any)", required: false, rows: 6 },
    ],
  },
  "faculty-review": {
    atLeastOne: true,
    fields: [
      { name: "innovativePedagogies", label: "Use of innovative pedagogies", required: false, rows: 4 },
      { name: "technology", label: "Technology", required: false, rows: 4 },
      { name: "experientialLearning", label: "Experiential learning", required: false, rows: 4 },
      {
        name: "visionMissionIntegration",
        label: "Integration with the Vision and Mission of the University",
        required: false,
        rows: 4,
      },
      { name: "feedback", label: "Feedback", required: false, rows: 4 },
      {
        name: "nextRunAttainment",
        label: "Course Outcome attainment for the next run of the course",
        required: false,
        rows: 4,
      },
    ],
  },
  "additional-info": {
    attachments: { min: 0 },
    fields: [{ name: "information", label: "Additional information", required: true, rows: 8 }],
  },
};

export function getFormDefinition(formKey) {
  return FORMS[formKey] ?? null;
}

function isBlankRow(row) {
  return Object.values(row).every((value) => String(value ?? "").trim() === "");
}

// Reads the submitted form into plain content. Tables arrive as JSON text;
// cells are trimmed and completely blank rows are dropped.
export function extractRawContent(definition, formData) {
  const raw = {};
  for (const field of definition.fields) {
    const value = String(formData.get(field.name) ?? "");
    if (field.type !== "table") {
      raw[field.name] = value;
      continue;
    }

    let parsed = [];
    try {
      parsed = JSON.parse(value || "[]");
    } catch {
      parsed = [];
    }
    if (!Array.isArray(parsed)) parsed = [];

    raw[field.name] = parsed
      .filter((row) => row && typeof row === "object")
      .map((row) =>
        Object.fromEntries(
          field.columns.map((column) => [column.key, String(row[column.key] ?? "").trim()])
        )
      )
      .filter((row) => !isBlankRow(row));
  }
  return raw;
}

function buildTableSchema(field, submit) {
  const maxRows = field.maxRows ?? 50;
  const cellShape = {};
  for (const column of field.columns) {
    cellShape[column.key] = z
      .string()
      .max(MAX_CELL_LENGTH, `${field.label}: ${column.label} is too long.`);
  }

  return z
    .array(z.object(cellShape))
    .max(maxRows, `${field.label}: at most ${maxRows} rows.`)
    .superRefine((rows, context) => {
      const fail = (message) => context.addIssue({ code: "custom", message });

      if (submit && rows.length < (field.minRows ?? 0)) {
        fail(`${field.label}: add at least ${field.minRows} row(s).`);
      }

      rows.forEach((row, index) => {
        const where = `${field.label}, row ${index + 1}`;

        for (const column of field.columns) {
          const value = row[column.key];
          if (!value) {
            if (submit && column.required) fail(`${where}: ${column.label} is required.`);
            continue;
          }
          if (column.type === "select" && !column.options.includes(value)) {
            fail(`${where}: choose a valid ${column.label}.`);
          }
          if (column.type === "time" && !TIME_PATTERN.test(value)) {
            fail(`${where}: ${column.label} must be a valid time.`);
          }
          if (column.type === "number") {
            const number = Number(value);
            const min = column.min ?? -Infinity;
            const max = column.max ?? Infinity;
            if (!Number.isFinite(number) || number < min || number > max) {
              fail(`${where}: ${column.label} must be a number between ${column.min ?? "any"} and ${column.max ?? "any"}.`);
            }
          }
        }

        if (field.timeRange) {
          const [startKey, endKey] = field.timeRange;
          if (row[startKey] && row[endKey] && row[endKey] <= row[startKey]) {
            fail(`${where}: the end time must be after the start time.`);
          }
        }
      });
    });
}

// Draft: only length and format checks. Submit: required fields must be filled.
export function buildContentSchema(definition, { submit }) {
  const shape = {};
  for (const field of definition.fields) {
    if (field.type === "table") {
      shape[field.name] = buildTableSchema(field, submit);
      continue;
    }

    let schema = z
      .string()
      .trim()
      .max(MAX_TEXT_LENGTH, `${field.label} is too long (max ${MAX_TEXT_LENGTH} characters).`);
    if (submit && field.required) {
      schema = schema.min(1, `${field.label} is required.`);
    }
    shape[field.name] = schema;
  }

  let objectSchema = z.object(shape);
  if (submit && definition.atLeastOne) {
    objectSchema = objectSchema.refine(
      (values) =>
        Object.values(values).some((value) => typeof value === "string" && value.length > 0),
      { message: "Fill in at least one field before submitting." }
    );
  }
  return objectSchema;
}