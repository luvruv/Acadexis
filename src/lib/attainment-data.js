import { DEFAULT_ATTAINMENT_SETTINGS } from "@/lib/attainment";

const toNumber = (value) => (value === null || value === undefined ? null : Number(value));

// Loads everything computeAttainment needs. "db" is the prisma client or a
// transaction client. Queries run one after another so it is safe in both.
export async function loadAttainmentInputs(db, courseFileId) {
  const outcomes = await db.courseOutcome.findMany({
    where: { courseFileId },
    orderBy: { position: "asc" },
    select: { id: true, code: true, attainmentWeight: true },
  });
  const components = await db.assessmentComponent.findMany({
    where: { courseFileId },
    orderBy: { position: "asc" },
    include: { courseOutcomes: { select: { courseOutcomeId: true, weight: true } } },
  });
  const students = await db.student.findMany({
    where: { courseFileId },
    orderBy: [{ classGroup: "asc" }, { enrollmentNo: "asc" }],
    select: { id: true, enrollmentNo: true, name: true },
  });
  const markRows = await db.mark.findMany({
    where: { component: { courseFileId } },
    select: { componentId: true, studentId: true, marks: true, absent: true },
  });
  const saved = await db.attainmentSetting.findUnique({ where: { courseFileId } });

  // CO-PO correlation levels, one entry per PO / PSO of the program.
  const courseFile = await db.courseFile.findUnique({
    where: { id: courseFileId },
    select: { course: { select: { programId: true } } },
  });
  const programColumns = courseFile
    ? await db.programOutcome.findMany({
        where: { programId: courseFile.course.programId, type: { in: ["PO", "PSO"] } },
        orderBy: [{ type: "asc" }, { position: "asc" }],
        select: { id: true, code: true },
      })
    : [];
  const mappingRows = await db.coPoMapping.findMany({
    where: { courseOutcome: { courseFileId } },
    select: { courseOutcomeId: true, programOutcomeId: true, level: true },
  });
  const poMatrix = programColumns.map((column) => ({
    code: column.code,
    levels: Object.fromEntries(
      mappingRows
        .filter((mapping) => mapping.programOutcomeId === column.id)
        .map((mapping) => [mapping.courseOutcomeId, mapping.level])
    ),
  }));

  const marks = new Map();
  for (const mark of markRows) {
    marks.set(`${mark.studentId}:${mark.componentId}`, {
      value: mark.absent ? null : Number(mark.marks),
      absent: mark.absent,
    });
  }

  return {
    outcomes: outcomes.map((outcome) => ({
      id: outcome.id,
      code: outcome.code,
      weight: toNumber(outcome.attainmentWeight),
    })),
    components: components.map((component) => ({
      id: component.id,
      name: component.name,
      maxMarks: Number(component.maxMarks),
      links: component.courseOutcomes.map((link) => ({
        outcomeId: link.courseOutcomeId,
        weight: toNumber(link.weight),
      })),
    })),
    students,
    marks,
    poMatrix,
    settings: saved
      ? {
          studentLevel3Min: Number(saved.studentLevel3Min),
          studentLevel2Min: Number(saved.studentLevel2Min),
          courseLevel3MinPercent: Number(saved.courseLevel3MinPercent),
          courseLevel2MinPercent: Number(saved.courseLevel2MinPercent),
          absentAsZero: saved.absentAsZero,
          confirmed: saved.confirmed,
        }
      : { ...DEFAULT_ATTAINMENT_SETTINGS },
    settingsSaved: Boolean(saved),
  };
}
