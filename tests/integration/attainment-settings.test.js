import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveAttainmentSettingsAction } from "@/app/(app)/coordinator/course-files/[id]/attainment/actions";
import { saveAssessmentsAction } from "@/app/(app)/coordinator/course-files/[id]/assessments/actions";
import { form, makeCourseFile, makeUser, signInAs } from "./fixtures";

async function setup(status = "IN_PROGRESS") {
  const coordinator = await makeUser("COORDINATOR");
  const { courseFile } = await makeCourseFile(coordinator, { status });
  const co1 = await prisma.courseOutcome.create({
    data: { courseFileId: courseFile.id, code: "CO1", description: "One", position: 1 },
  });
  const co2 = await prisma.courseOutcome.create({
    data: { courseFileId: courseFile.id, code: "CO2", description: "Two", position: 2 },
  });
  return { coordinator, courseFile, co1, co2 };
}

function settingsForm(ctx, overrides = {}) {
  return form({
    courseFileId: ctx.courseFile.id,
    studentLevel3MinPercent: "50",
    studentLevel2MinPercent: "45",
    courseLevel3MinPercent: "70",
    courseLevel2MinPercent: "65",
    absentPolicy: "zero",
    confirmed: "on",
    [`coWeight:${ctx.co1.id}`]: "60",
    [`coWeight:${ctx.co2.id}`]: "40",
    ...overrides,
  });
}

describe("saveAttainmentSettingsAction", () => {
  it("saves the thresholds and the CO weights", async () => {
    const ctx = await setup();
    signInAs(ctx.coordinator);
    expect(await saveAttainmentSettingsAction(null, settingsForm(ctx))).toEqual({
      ok: true,
      message: "Settings saved.",
    });

    const saved = await prisma.attainmentSetting.findUnique({
      where: { courseFileId: ctx.courseFile.id },
    });
    expect(Number(saved.studentLevel3Min)).toBe(0.5);
    expect(Number(saved.studentLevel2Min)).toBe(0.45);
    expect(Number(saved.courseLevel3MinPercent)).toBe(70);
    expect(Number(saved.courseLevel2MinPercent)).toBe(65);
    expect(saved.absentAsZero).toBe(true);
    expect(saved.confirmed).toBe(true);

    const outcomes = await prisma.courseOutcome.findMany({ orderBy: { position: "asc" } });
    expect(outcomes.map((o) => Number(o.attainmentWeight))).toEqual([0.6, 0.4]);
    expect(await prisma.auditLog.count({ where: { action: "ATTAINMENT_SETTINGS_SAVED" } })).toBe(1);
  });

  it("refuses CO weights that do not add up to 100 percent", async () => {
    const ctx = await setup();
    signInAs(ctx.coordinator);
    const result = await saveAttainmentSettingsAction(
      null,
      settingsForm(ctx, { [`coWeight:${ctx.co2.id}`]: "30" })
    );
    expect(result).toEqual({
      ok: false,
      message: "Course outcome weights must add up to 100%. They add up to 90%.",
    });
    expect(await prisma.attainmentSetting.count()).toBe(0);
  });

  it("refuses level thresholds in the wrong order", async () => {
    const ctx = await setup();
    signInAs(ctx.coordinator);
    const result = await saveAttainmentSettingsAction(
      null,
      settingsForm(ctx, { studentLevel2MinPercent: "60" })
    );
    expect(result).toEqual({
      ok: false,
      message: "For students, the Level 2 minimum must be lower than the Level 3 minimum.",
    });
  });

  it("refuses when an outcome has no weight", async () => {
    const ctx = await setup();
    signInAs(ctx.coordinator);
    const data = settingsForm(ctx);
    data.delete(`coWeight:${ctx.co2.id}`);
    data.set(`coWeight:${ctx.co1.id}`, "100");
    const result = await saveAttainmentSettingsAction(null, data);
    expect(result).toEqual({
      ok: false,
      message: "The course outcomes changed. Refresh the page and try again.",
    });
  });

  it("is limited to the owning coordinator and to unlocked files", async () => {
    const ctx = await setup();
    signInAs(await makeUser("COORDINATOR"));
    expect((await saveAttainmentSettingsAction(null, settingsForm(ctx))).message).toBe(
      "Course file not found."
    );
    signInAs(await makeUser("CO_TEACHER"));
    expect((await saveAttainmentSettingsAction(null, settingsForm(ctx))).message).toBe(
      "You do not have permission to do this."
    );

    const locked = await setup("LOCKED");
    signInAs(locked.coordinator);
    expect((await saveAttainmentSettingsAction(null, settingsForm(locked))).message).toBe(
      "This course file is locked and cannot be changed."
    );
  });
});

describe("saveAssessmentsAction: component weights", () => {
  const payload = (ctx, weight) =>
    form({
      payload: JSON.stringify({
        courseFileId: ctx.courseFile.id,
        components: [
          {
            id: null,
            name: "Lab-1",
            maxMarks: 30,
            courseOutcomeIds: [ctx.co1.id],
            outcomeWeights: { [ctx.co1.id]: weight },
          },
        ],
      }),
    });

  it("stores each weight as a fraction", async () => {
    const ctx = await setup();
    signInAs(ctx.coordinator);
    expect(await saveAssessmentsAction(null, payload(ctx, 40))).toEqual({ ok: true, message: "Saved." });
    const link = await prisma.componentCourseOutcome.findFirst();
    expect(Number(link.weight)).toBe(0.4);
  });

  it("keeps an empty weight as not entered", async () => {
    const ctx = await setup();
    signInAs(ctx.coordinator);
    expect((await saveAssessmentsAction(null, payload(ctx, null))).ok).toBe(true);
    expect((await prisma.componentCourseOutcome.findFirst()).weight).toBeNull();
  });

  it("rejects a weight above 100 percent", async () => {
    const ctx = await setup();
    signInAs(ctx.coordinator);
    expect(await saveAssessmentsAction(null, payload(ctx, 120))).toEqual({
      ok: false,
      message: "Weights cannot be above 100%.",
    });
  });

  it("is blocked when the file is locked", async () => {
    const ctx = await setup("LOCKED");
    signInAs(ctx.coordinator);
    expect((await saveAssessmentsAction(null, payload(ctx, 40))).message).toBe(
      "This course file is locked and cannot be edited."
    );
  });
});
