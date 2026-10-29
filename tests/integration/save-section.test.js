import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveSectionAction } from "@/app/(app)/sections/[id]/actions";
import { form, makeCourseFile, makeUser, reload, signInAs } from "./fixtures";

const VALID = { description: "Introduces HCI.", objectives: "Learn usability." };

async function setup({ formKey = "course-description", fileStatus = "IN_PROGRESS", sectionStatus } = {}) {
  const coordinator = await makeUser("COORDINATOR");
  const teacher1 = await makeUser("CO_TEACHER");
  const teacher2 = await makeUser("CO_TEACHER");
  const { courseFile, sections } = await makeCourseFile(coordinator, { status: fileStatus });
  const section = sections[formKey];
  await prisma.courseFileSection.update({
    where: { id: section.id },
    data: { assigneeId: teacher1.id, ...(sectionStatus ? { status: sectionStatus } : {}) },
  });
  return { coordinator, teacher1, teacher2, courseFile, section };
}

function saveForm(section, extra = {}, version = 1) {
  return form({ sectionId: section.id, sectionVersion: String(version), ...extra });
}

describe("saveSectionAction", () => {
  it("saves a draft with missing required fields and keeps the status", async () => {
    const { teacher1, section } = await setup();
    signInAs(teacher1);
    const result = await saveSectionAction(null, saveForm(section));
    expect(result).toEqual({ ok: true, message: "Draft saved." });
    const saved = await reload("courseFileSection", section.id);
    expect(saved.status).toBe("PENDING");
    expect(saved.version).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "SECTION_DRAFT_SAVED" } })).toBe(1);
  });

  it("refuses to submit while a required field is empty", async () => {
    const { teacher1, section } = await setup();
    signInAs(teacher1);
    const result = await saveSectionAction(null, saveForm(section, { intent: "submit", objectives: "x" }));
    expect(result).toEqual({ ok: false, message: "Course description is required." });
    expect((await reload("courseFileSection", section.id)).status).toBe("PENDING");
  });

  it("submits a complete form", async () => {
    const { teacher1, section } = await setup();
    signInAs(teacher1);
    const result = await saveSectionAction(null, saveForm(section, { intent: "submit", ...VALID }));
    expect(result).toEqual({ ok: true, message: "Submitted for review." });
    const saved = await reload("courseFileSection", section.id);
    expect(saved.status).toBe("SUBMITTED");
    expect(saved.submittedAt).not.toBeNull();
    expect(saved.content).toMatchObject(VALID);
    expect(await prisma.auditLog.count({ where: { action: "SECTION_SUBMITTED" } })).toBe(1);
  });

  it("refuses a co-teacher who is not the assignee", async () => {
    const { teacher2, section } = await setup();
    signInAs(teacher2);
    const result = await saveSectionAction(null, saveForm(section, VALID));
    expect(result).toEqual({ ok: false, message: "You are not allowed to edit this section." });
    expect((await reload("courseFileSection", section.id)).version).toBe(1);
  });

  it("refuses the coordinator when the section is assigned to someone else", async () => {
    const { coordinator, section } = await setup();
    signInAs(coordinator);
    const result = await saveSectionAction(null, saveForm(section, VALID));
    expect(result).toEqual({ ok: false, message: "You are not allowed to edit this section." });
  });

  it("refuses an admin", async () => {
    const { section } = await setup();
    signInAs(await makeUser("ADMIN"));
    const result = await saveSectionAction(null, saveForm(section, VALID));
    expect(result).toEqual({ ok: false, message: "You do not have permission to do this." });
  });

  it("refuses a signed-out request", async () => {
    const { section } = await setup();
    signInAs(null);
    const result = await saveSectionAction(null, saveForm(section, VALID));
    expect(result).toEqual({ ok: false, message: "Authentication required." });
  });

  it("refuses a deactivated assignee", async () => {
    const { teacher1, section } = await setup();
    await prisma.user.update({ where: { id: teacher1.id }, data: { isActive: false } });
    signInAs(teacher1);
    const result = await saveSectionAction(null, saveForm(section, VALID));
    expect(result).toEqual({ ok: false, message: "Authentication required." });
  });

  it("rejects an invalid request", async () => {
    const { teacher1 } = await setup();
    signInAs(teacher1);
    const result = await saveSectionAction(null, form({ sectionVersion: "1" }));
    expect(result).toEqual({ ok: false, message: "Invalid request." });
  });

  it("rejects a stale version", async () => {
    const { teacher1, section } = await setup();
    signInAs(teacher1);
    const first = await saveSectionAction(null, saveForm(section, VALID, 1));
    expect(first.ok).toBe(true);
    const stale = await saveSectionAction(null, saveForm(section, VALID, 1));
    expect(stale).toEqual({
      ok: false,
      message:
        "This section was changed in another tab or by the coordinator. Refresh the page and try again.",
    });
    const fresh = await saveSectionAction(null, saveForm(section, VALID, 2));
    expect(fresh.ok).toBe(true);
  });

  it("does not allow edits after submission", async () => {
    const { teacher1, section } = await setup({ sectionStatus: "SUBMITTED" });
    signInAs(teacher1);
    const result = await saveSectionAction(null, saveForm(section, VALID));
    expect(result).toEqual({ ok: false, message: "This section can no longer be edited." });
  });

  it("allows editing again after changes were requested", async () => {
    const { teacher1, section } = await setup({ sectionStatus: "CHANGES_REQUESTED" });
    signInAs(teacher1);
    const result = await saveSectionAction(null, saveForm(section, { intent: "submit", ...VALID }));
    expect(result.ok).toBe(true);
    expect((await reload("courseFileSection", section.id)).status).toBe("SUBMITTED");
  });

  it("blocks edits when the course file is locked or exported", async () => {
    for (const fileStatus of ["LOCKED", "EXPORTED"]) {
      const { teacher1, section } = await setup({ fileStatus });
      signInAs(teacher1);
      const result = await saveSectionAction(null, saveForm(section, VALID));
      expect(result).toEqual({
        ok: false,
        message: "The course file is locked and cannot be edited.",
      });
    }
  });

  it("needs the minimum number of uploaded files before submitting", async () => {
    const { teacher1, section } = await setup({ formKey: "midsem-papers" });
    signInAs(teacher1);

    const blocked = await saveSectionAction(null, saveForm(section, { intent: "submit" }));
    expect(blocked).toEqual({ ok: false, message: "Upload at least 1 file(s) before submitting." });

    await prisma.attachment.create({
      data: {
        sectionId: section.id,
        uploadedById: teacher1.id,
        originalName: "paper.pdf",
        storagePath: "x/paper.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      },
    });
    const allowed = await saveSectionAction(null, saveForm(section, { intent: "submit" }));
    expect(allowed).toEqual({ ok: true, message: "Submitted for review." });
  });
});
