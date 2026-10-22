import { DEFAULT_ATTAINMENT_SETTINGS } from "@/lib/attainment";

// Loads everything computeAttainment needs. "db" is the prisma client or a
// transaction client. Queries run one after another so it is safe in both.
export async function loadAttainmentInputs(db, courseFileId) {
  const outcomes = await db.courseOutcome.findMany({
    where: { courseFileId },
    orderBy: { position: "asc" },
    select: { id: true, code: true },
  });
  const components = await db.assessmentComponent.findMany({
    where: { courseFileId },
    orderBy: { position: "asc" },
    include: { courseOutcomes: { select: { courseOutcomeId: true } } },
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
    outcomes,
    components: components.map((component) => ({
      id: component.id,
      name: component.name,
      maxMarks: Number(component.maxMarks),
      outcomeIds: component.courseOutcomes.map((link) => link.courseOutcomeId),
    })),
    students,
    marks,
    settings: saved
      ? {
          thresholdPercent: Number(saved.thresholdPercent),
          level1MinPercent: Number(saved.level1MinPercent),
          level2MinPercent: Number(saved.level2MinPercent),
          level3MinPercent: Number(saved.level3MinPercent),
          absentAsZero: saved.absentAsZero,
          confirmed: saved.confirmed,
        }
      : { ...DEFAULT_ATTAINMENT_SETTINGS },
    settingsSaved: Boolean(saved),
  };
}