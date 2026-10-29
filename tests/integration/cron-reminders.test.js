import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST as cronRoute } from "@/app/api/cron/reminders/route";
import { createDueReminders } from "@/lib/reminders";
import { makeCourseFile, makeUser, reload } from "./fixtures";

const SECRET = process.env.CRON_SECRET;
afterEach(() => {
  process.env.CRON_SECRET = SECRET;
});

const day = (offset) => new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
const call = (authorization) =>
  cronRoute(
    new Request("http://localhost/api/cron/reminders", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    })
  );
const authorized = () => call(`Bearer ${SECRET}`);

async function setup({ dueOffset = -3, sectionStatus = "PENDING", fileStatus = "IN_PROGRESS" } = {}) {
  const coordinator = await makeUser("COORDINATOR");
  const teacher = await makeUser("CO_TEACHER");
  const { courseFile, sections } = await makeCourseFile(coordinator, { status: fileStatus });
  const section = sections["session-plan"];
  await prisma.courseFileSection.update({
    where: { id: section.id },
    data: { assigneeId: teacher.id, dueDate: day(dueOffset), status: sectionStatus },
  });
  return { teacher, section, courseFile };
}

describe("POST /api/cron/reminders: secret handling", () => {
  it("returns 503 when CRON_SECRET is missing or too short", async () => {
    delete process.env.CRON_SECRET;
    let response = await call("Bearer anything");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Reminders are not configured." });

    process.env.CRON_SECRET = "short";
    response = await call("Bearer short");
    expect(response.status).toBe(503);
  });

  it("returns 401 without the header or with a wrong secret", async () => {
    for (const header of [undefined, "Bearer wrong-secret-0123456789", SECRET]) {
      const response = await call(header);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized." });
    }
  });

  it("returns { created: 0 } when nothing is due", async () => {
    const response = await authorized();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ created: 0 });
  });
});

describe("POST /api/cron/reminders: reminders", () => {
  it("creates an overdue reminder, then respects the 24-hour cooldown", async () => {
    const { teacher, section } = await setup({ dueOffset: -3 });

    const first = await authorized();
    expect(await first.json()).toEqual({ created: 1 });

    const notes = await prisma.notification.findMany({ where: { userId: teacher.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0].sectionId).toBe(section.id);
    expect(notes[0].message.startsWith("Overdue:")).toBe(true);
    expect((await reload("courseFileSection", section.id)).lastReminderAt).not.toBeNull();
    expect(await prisma.auditLog.count({ where: { action: "REMINDERS_GENERATED" } })).toBe(1);

    const second = await authorized();
    expect(await second.json()).toEqual({ created: 0 });
    expect(await prisma.notification.count()).toBe(1);
  });

  it("reminds again after the cooldown has passed", async () => {
    const { section } = await setup({ dueOffset: -3 });
    expect(await createDueReminders()).toBe(1);
    expect(await createDueReminders()).toBe(0);
    await prisma.courseFileSection.update({
      where: { id: section.id },
      data: { lastReminderAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    expect(await createDueReminders()).toBe(1);
  });

  it("reminds about a section due tomorrow", async () => {
    await setup({ dueOffset: 1 });
    expect(await createDueReminders()).toBe(1);
  });

  it("does not remind about a section due in 10 days", async () => {
    await setup({ dueOffset: 10 });
    expect(await createDueReminders()).toBe(0);
  });

  it("skips submitted sections", async () => {
    await setup({ dueOffset: -3, sectionStatus: "SUBMITTED" });
    expect(await createDueReminders()).toBe(0);
  });

  it("also reminds when changes were requested", async () => {
    await setup({ dueOffset: -3, sectionStatus: "CHANGES_REQUESTED" });
    expect(await createDueReminders()).toBe(1);
  });

  it("skips locked and exported course files", async () => {
    await setup({ dueOffset: -3, fileStatus: "LOCKED" });
    await setup({ dueOffset: -3, fileStatus: "EXPORTED" });
    expect(await createDueReminders()).toBe(0);
  });

  it("skips sections without an assignee or without a due date", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { sections } = await makeCourseFile(coordinator, { status: "IN_PROGRESS" });
    await prisma.courseFileSection.update({
      where: { id: sections["session-plan"].id },
      data: { dueDate: day(-3) },
    });
    const teacher = await makeUser("CO_TEACHER");
    await prisma.courseFileSection.update({
      where: { id: sections["course-description"].id },
      data: { assigneeId: teacher.id },
    });
    expect(await createDueReminders()).toBe(0);
  });
});
