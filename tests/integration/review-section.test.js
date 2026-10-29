import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { reviewSectionAction } from "@/app/(app)/sections/[id]/review-actions";
import { saveSectionAction } from "@/app/(app)/sections/[id]/actions";
import { form, makeCourseFile, makeUser, reload, signInAs } from "./fixtures";

async function setup({ formKey = "course-description", sectionStatus = "SUBMITTED", fileStatus = "IN_PROGRESS" } = {}) {
  const coordinator = await makeUser("COORDINATOR");
  const teacher = await makeUser("CO_TEACHER");
  const { courseFile, sections } = await makeCourseFile(coordinator, { status: fileStatus });
  const section = sections[formKey];
  await prisma.courseFileSection.update({
    where: { id: section.id },
    data: { assigneeId: teacher.id, status: sectionStatus },
  });
  return { coordinator, teacher, courseFile, section };
}

function review(section, intent, comment = "", version = 1) {
  return form({ sectionId: section.id, sectionVersion: String(version), intent, comment });
}

describe("reviewSectionAction", () => {
  it("approves a submitted section", async () => {
    const { coordinator, section } = await setup();
    signInAs(coordinator);
    const result = await reviewSectionAction(null, review(section, "approve"));
    expect(result).toEqual({ ok: true, message: "Section approved." });
    const saved = await reload("courseFileSection", section.id);
    expect(saved.status).toBe("APPROVED");
    expect(saved.approvedAt).not.toBeNull();
    expect(saved.version).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "SECTION_APPROVED" } })).toBe(1);
  });

  it("requires a comment of at least 5 characters to request changes", async () => {
    const { coordinator, section } = await setup();
    signInAs(coordinator);
    for (const comment of ["", "abc"]) {
      const result = await reviewSectionAction(null, review(section, "changes", comment));
      expect(result).toEqual({
        ok: false,
        message: "Write a comment (at least 5 characters) explaining what to change.",
      });
    }
    expect((await reload("courseFileSection", section.id)).status).toBe("SUBMITTED");
  });

  it("requests changes, stores the comment and updates the course file status", async () => {
    const { coordinator, courseFile, section } = await setup();
    signInAs(coordinator);
    const result = await reviewSectionAction(null, review(section, "changes", "Add the week 7 topics"));
    expect(result).toEqual({
      ok: true,
      message: "Changes requested. The assignee can now edit and resubmit.",
    });
    expect((await reload("courseFileSection", section.id)).status).toBe("CHANGES_REQUESTED");
    const comments = await prisma.reviewComment.findMany({ where: { sectionId: section.id } });
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({ body: "Add the week 7 topics", requestsChanges: true });
    expect((await reload("courseFile", courseFile.id)).status).toBe("CHANGES_REQUESTED");
  });

  it("can send an approved section back", async () => {
    const { coordinator, section } = await setup({ sectionStatus: "APPROVED" });
    signInAs(coordinator);
    const result = await reviewSectionAction(null, review(section, "changes", "Please fix the table"));
    expect(result.ok).toBe(true);
    expect((await reload("courseFileSection", section.id)).status).toBe("CHANGES_REQUESTED");
  });

  it("does not approve a section that was never submitted", async () => {
    const { coordinator, section } = await setup({ sectionStatus: "PENDING" });
    signInAs(coordinator);
    const result = await reviewSectionAction(null, review(section, "approve"));
    expect(result).toEqual({ ok: false, message: "Only submitted sections can be approved." });
  });

  it("does not send back a pending section", async () => {
    const { coordinator, section } = await setup({ sectionStatus: "PENDING" });
    signInAs(coordinator);
    const result = await reviewSectionAction(null, review(section, "changes", "Some comment"));
    expect(result).toEqual({
      ok: false,
      message: "Only submitted or approved sections can be sent back.",
    });
  });

  it("rejects an unknown intent and a missing section", async () => {
    const { coordinator, section } = await setup();
    signInAs(coordinator);
    expect(await reviewSectionAction(null, review(section, "delete"))).toEqual({
      ok: false,
      message: "Invalid request.",
    });
    expect(await reviewSectionAction(null, form({ sectionVersion: "1", intent: "approve" }))).toEqual({
      ok: false,
      message: "Invalid request.",
    });
  });

  it("rejects a stale version", async () => {
    const { coordinator, section } = await setup();
    signInAs(coordinator);
    const result = await reviewSectionAction(null, review(section, "approve", "", 7));
    expect(result).toEqual({
      ok: false,
      message: "This section changed in the meantime. Refresh the page and review again.",
    });
    expect((await reload("courseFileSection", section.id)).status).toBe("SUBMITTED");
  });

  it("is limited to the owning coordinator", async () => {
    const { section } = await setup();
    signInAs(await makeUser("COORDINATOR"));
    const result = await reviewSectionAction(null, review(section, "approve"));
    expect(result).toEqual({ ok: false, message: "Section not found." });
  });

  it("refuses a co-teacher, an admin and a signed-out request", async () => {
    const { teacher, section } = await setup();
    signInAs(teacher);
    expect((await reviewSectionAction(null, review(section, "approve"))).message).toBe(
      "You do not have permission to do this."
    );
    signInAs(await makeUser("ADMIN"));
    expect((await reviewSectionAction(null, review(section, "approve"))).ok).toBe(false);
    signInAs(null);
    expect((await reviewSectionAction(null, review(section, "approve"))).message).toBe(
      "Authentication required."
    );
    expect((await reload("courseFileSection", section.id)).status).toBe("SUBMITTED");
  });

  it("is blocked when the course file is locked or exported", async () => {
    for (const fileStatus of ["LOCKED", "EXPORTED"]) {
      const { coordinator, section } = await setup({ fileStatus });
      signInAs(coordinator);
      const result = await reviewSectionAction(null, review(section, "approve"));
      expect(result).toEqual({ ok: false, message: "The course file is locked." });
    }
  });

  it("does not review program data, calculated or course-details sections", async () => {
    for (const formKey of ["university-vision-mission", "co-attainment", "course-details"]) {
      const { coordinator, section } = await setup({ formKey });
      signInAs(coordinator);
      const result = await reviewSectionAction(null, review(section, "approve"));
      expect(result).toEqual({
        ok: false,
        message: "This section is completed by the system and is not reviewed.",
      });
    }
  });
});

describe("full section workflow", () => {
  it("goes Pending, Submitted, Changes Requested, Submitted, Approved", async () => {
    const { coordinator, teacher, section } = await setup({ sectionStatus: "PENDING" });
    const content = { description: "Introduces HCI.", objectives: "Learn usability." };

    signInAs(teacher);
    expect((await saveSectionAction(null, form({
      sectionId: section.id, sectionVersion: "1", intent: "submit", ...content,
    }))).ok).toBe(true);
    let current = await reload("courseFileSection", section.id);
    expect(current.status).toBe("SUBMITTED");

    signInAs(coordinator);
    expect((await reviewSectionAction(null, review(section, "changes", "Be more specific", current.version))).ok).toBe(true);
    current = await reload("courseFileSection", section.id);
    expect(current.status).toBe("CHANGES_REQUESTED");

    signInAs(teacher);
    expect((await saveSectionAction(null, form({
      sectionId: section.id, sectionVersion: String(current.version), intent: "submit",
      description: "A clearer description.", objectives: "Learn usability.",
    }))).ok).toBe(true);
    current = await reload("courseFileSection", section.id);
    expect(current.status).toBe("SUBMITTED");

    signInAs(coordinator);
    expect((await reviewSectionAction(null, review(section, "approve", "", current.version))).ok).toBe(true);
    current = await reload("courseFileSection", section.id);
    expect(current.status).toBe("APPROVED");

    // Approved sections are frozen for the teacher.
    signInAs(teacher);
    const blocked = await saveSectionAction(null, form({
      sectionId: section.id, sectionVersion: String(current.version), ...content,
    }));
    expect(blocked).toEqual({ ok: false, message: "This section can no longer be edited." });
  });
});
