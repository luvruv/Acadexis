import { computeAttainment } from "@/lib/attainment";
import { loadAttainmentInputs } from "@/lib/attainment-data";
import { loadProgramSnapshots } from "@/lib/program-snapshot";
import { getFormDefinition } from "@/section-forms/registry";

const PROGRAM_KEYS = new Set([
  "university-vision-mission",
  "graduate-attributes",
  "school-vision-mission",
  "program-outcomes",
]);

function isFilled(value) {
  return Boolean(value) && typeof value === "object" && Object.keys(value).length > 0;
}

function buildFormData(definition, content, attachments) {
  const source = content && typeof content === "object" ? content : {};
  return {
    fields: definition.fields.map((field) => {
      const value = source[field.name];
      if (field.type === "table") {
        return {
          type: "table",
          label: field.label,
          columns: field.columns.map(({ key, label }) => ({ key, label })),          columns: field.columns.map(({ key, label, required }) => ({
            key,
            label,
            required: Boolean(required),
          })),
          totalColumn: field.totalColumn ?? null,
          rows: Array.isArray(value) ? value : [],
        };
      }
      return { type: "text", label: field.label, value: typeof value === "string" ? value : "" };
    }),
    hasAttachments: Boolean(definition.attachments),
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.originalName,
      sizeBytes: attachment.sizeBytes,
      mimeType: attachment.mimeType,
      storagePath: attachment.storagePath,
    })),
  };
}

// Everything the preview page (and, later, the DOCX export) needs, in one
// plain structure. "db" is the prisma client or a transaction client.
export async function loadCourseFileDocument(db, courseFileId) {
  const courseFile = await db.courseFile.findUnique({
    where: { id: courseFileId },
    include: {
      course: {
        include: {
          program: {
            include: {
              school: { select: { name: true, university: { select: { name: true } } } },
            },
          },
        },
      },
      coordinator: { select: { name: true } },
      templateVersion: { select: { name: true } },
      lockedBy: { select: { name: true } },
      students: { orderBy: [{ classGroup: "asc" }, { enrollmentNo: "asc" }] },
      outcomes: {
        orderBy: { position: "asc" },
        include: { poMappings: { include: { programOutcome: { select: { code: true } } } } },
      },
      sections: {
        orderBy: { number: "asc" },
        include: {
          attachments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              originalName: true,
              sizeBytes: true,
              mimeType: true,
              storagePath: true,
            },
          },
        },
      },
    },
  });
  if (!courseFile) return null;

  const programId = courseFile.course.programId;
  const programColumns = await db.programOutcome.findMany({
    where: { programId, type: { in: ["PO", "PSO"] } },
    orderBy: [{ type: "asc" }, { position: "asc" }],
    select: { code: true },
  });
  const snapshots = await loadProgramSnapshots(db, programId);
  const inputs = await loadAttainmentInputs(db, courseFileId);
  const attainment = computeAttainment(inputs);

  const matrix = {};
  for (const outcome of courseFile.outcomes) {
    matrix[outcome.code] = {};
    for (const mapping of outcome.poMappings) {
      matrix[outcome.code][mapping.programOutcome.code] = mapping.level;
    }
  }

  const header = {
    courseCode: courseFile.course.code,
    courseTitle: courseFile.course.title,
    programName: courseFile.course.program.name,
    schoolName: courseFile.course.program.school.name,
    universityName: courseFile.course.program.school.university.name,
    semester: courseFile.semester,
    academicYear: courseFile.academicYear,
    batch: courseFile.batch,
    coordinatorName: courseFile.coordinator.name,
    templateName: courseFile.templateVersion.name,
    status: courseFile.status,
    lockedAt: courseFile.lockedAt,
    lockedByName: courseFile.lockedBy?.name ?? null,
  };

  const sections = courseFile.sections.map((section) => {
    let kind = "empty";
    let data = { message: "Nothing has been entered for this section." };

    if (PROGRAM_KEYS.has(section.formKey)) {
      // Locked files hold a frozen copy; otherwise read the live program data.
      const snapshot = isFilled(section.content) ? section.content : snapshots?.[section.formKey];
      if (snapshot) {
        if (section.formKey === "university-vision-mission") {
          kind = "vision-mission";
          data = { name: snapshot.universityName, vision: snapshot.vision, mission: snapshot.mission };
        } else if (section.formKey === "school-vision-mission") {
          kind = "vision-mission";
          data = { name: snapshot.schoolName, vision: snapshot.vision, mission: snapshot.mission };
        } else if (section.formKey === "graduate-attributes") {
          kind = "list";
          data = { items: snapshot.attributes };
        } else {
          kind = "program-outcomes";
          data = {
            programName: snapshot.programName,
            peos: snapshot.peos,
            pos: snapshot.pos,
            psos: snapshot.psos,
          };
        }
      }
    } else if (section.formKey === "course-details") {
      kind = "details";
      data = {
        rows: [
          ["Course code", header.courseCode],
          ["Course title", header.courseTitle],
          ["Program", header.programName],
          ["School", header.schoolName],
          ["Semester / term", header.semester],
          ["Academic year", header.academicYear],
          ["Batch", header.batch ?? "-"],
          ["Coordinator", header.coordinatorName],
        ],
      };
    } else if (section.formKey === "course-outcomes") {
      kind = "co-po";
      data = {
        outcomes: courseFile.outcomes.map(({ code, description }) => ({ code, description })),
        columns: programColumns.map((column) => column.code),
        matrix,
      };
    } else if (section.formKey === "student-list") {
      kind = "students";
      data = {
        students: courseFile.students.map((student) => ({
          enrollmentNo: student.enrollmentNo,
          rollNo: student.rollNo ?? "",
          name: student.name,
          classGroup: student.classGroup ?? "",
        })),
      };
    } else if (section.formKey === "marks-all-components") {
      kind = "marks";
      data = {
        components: inputs.components.map((c) => ({ name: c.name, maxMarks: c.maxMarks })),
        rows: inputs.students.map((student) => ({
          enrollmentNo: student.enrollmentNo,
          name: student.name,
          values: inputs.components.map((component) => {
            const cell = inputs.marks.get(`${student.id}:${component.id}`);
            if (!cell) return "";
            return cell.absent ? "AB" : String(cell.value);
          }),
        })),
      };
    } else if (section.formKey === "co-attainment") {
      kind = "co-attainment";
      const frozen = isFilled(section.content) && Array.isArray(section.content.rows);
      data = frozen
        ? {
            live: false,
            rows: section.content.rows,
            settings: section.content.settings,
            calculatedAt: section.content.calculatedAt ?? null,
            problems: [],
          }
        : {
            live: true,
            rows: attainment.rows,
            settings: attainment.settings,
            calculatedAt: null,
            problems: attainment.problems,
          };
    } else if (section.formKey === "po-attainment") {
      data = { message: "PO attainment is not calculated yet. The formula is not confirmed." };
    } else {
      const definition = getFormDefinition(section.formKey);
      if (definition) {
        kind = "form";
        data = buildFormData(definition, section.content, section.attachments);
      }
    }

    return {
      id: section.id,
      number: section.number,
      title: section.title,
      formKey: section.formKey,
      status: section.status,
      isRequired: section.isRequired,
      source: section.source,
      kind,
      data,
    };
  });

  return { header, sections };
}