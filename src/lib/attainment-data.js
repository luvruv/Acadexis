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
