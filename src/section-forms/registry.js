import { z } from "zod";

const MAX_FIELD_LENGTH = 10000;

// One entry per section type (formKey). Add new text-based sections here.
// field: { name, label, help?, required, rows }
// atLeastOne: for optional sections, at least one field must be filled to submit.
const FORMS = {
  "course-description": {
    fields: [
      { name: "description", label: "Course description", required: true, rows: 8 },
      { name: "objectives", label: "Course objectives", required: true, rows: 6 },
    ],
  },
  "midterm-reflections": {
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
    fields: [
      { name: "information", label: "Additional information", required: true, rows: 8 },
    ],
  },
};

export function getFormDefinition(formKey) {
  return FORMS[formKey] ?? null;
}

// Draft: only a length limit. Submit: required fields must be filled.
export function buildContentSchema(definition, { submit }) {
  const shape = {};
  for (const field of definition.fields) {
    let schema = z
      .string()
      .trim()
      .max(
        MAX_FIELD_LENGTH,
        `${field.label} is too long (max ${MAX_FIELD_LENGTH} characters).`
      );
    if (submit && field.required) {
      schema = schema.min(1, `${field.label} is required.`);
    }
    shape[field.name] = schema;
  }

  let objectSchema = z.object(shape);
  if (submit && definition.atLeastOne) {
    objectSchema = objectSchema.refine(
      (values) => Object.values(values).some((value) => value.length > 0),
      { message: "Fill in at least one field before submitting." }
    );
  }
  return objectSchema;
}