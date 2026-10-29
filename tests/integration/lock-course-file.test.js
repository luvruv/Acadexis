import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { lockCourseFileAction } from "@/app/(app)/coordinator/course-files/[id]/lock-actions";
import { saveSectionAction } from "@/app/(app)/sections/[id]/actions";
import { assignSectionsAction } from "@/app/(app)/coordinator/course-files/[id]/actions";
import {
  addAttainmentData, form, makeCourseFile, makeLockableFile, makeUser, reload, signInAs,
} from "./fixtures";

const lock = (courseFileId) => lockCourseFileAction(null, form({ courseFileId }));

describe("lockCourseFileAction", () => {
  it("locks a ready course file and freezes program data and attainment", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile, sections } = await makeLockableFile(coordinator);
    signInAs(coordinator);

    const result = await lock(courseFile.id);
    expect(result).toEqual({ ok: true, message: "Course file locked." });

    const saved = await reload("courseFile", courseFile.id);
    expect(saved.status).toBe("LOCKED");
    expect(saved.lockedAt).not.toBeNull();
    expect(saved.lockedById).toBe(coordinator.id);

    const uni = await reload("courseFileSection", sections["university-vision-mission"].id);
    expect(uni.content.universityName).toMatch(/^Test University/);

    const att = await reload("courseFileSection", sections["co-attainment"].id);
    expect(att.status).toBe("APPROVED");
    expect(Array.isArray(att.content.rows)).toBe(true);
    expect(att.content.calculatedAt).toBeTruthy();

    expect(await prisma.auditLog.count({ where: { action: "COURSE_FILE_LOCKED" } })).toBe(1);
  });

  it("is blocked while a required section is not approved", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile, sections } = await makeLockableFile(coordinator);
    await prisma.courseFileSection.update({
      where: { id: sections["course-description"].id },
      data: { status: "SUBMITTED" },
    });
    signInAs(coordinator);
    const result = await lock(courseFile.id);
    expect(result).toEqual({
      ok: false,
      message: "1 section(s) are not ready. Refresh the page to see them.",
    });
    expect((await reload("courseFile", courseFile.id)).status).toBe("IN_PROGRESS");
  });

  it("is blocked when the CO attainment cannot be calculated", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeCourseFile(coordinator, { status: "IN_PROGRESS" });
    await prisma.courseFileSection.updateMany({
      where: { courseFileId: courseFile.id, source: { not: "COMPUTED" } },
      data: { status: "APPROVED" },
    });
    signInAs(coordinator);
    const result = await lock(courseFile.id);
    expect(result.ok).toBe(false);
    expect(result.message.startsWith("CO attainment cannot be calculated yet.")).toBe(true);
    expect((await reload("courseFile", courseFile.id)).status).toBe("IN_PROGRESS");
  });

  it("is blocked when marks are missing", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeCourseFile(coordinator, { status: "IN_PROGRESS" });
    await prisma.courseFileSection.updateMany({
      where: { courseFileId: courseFile.id, source: { not: "COMPUTED" } },
      data: { status: "APPROVED" },
    });
    await addAttainmentData(courseFile, { complete: false });
    signInAs(coordinator);
    const result = await lock(courseFile.id);
    expect(result.ok).toBe(false);
    expect(result.message.startsWith("CO attainment cannot be calculated yet.")).toBe(true);
  });

  it("is not blocked by a calculated section or an empty optional section", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile, sections } = await makeLockableFile(coordinator);
    // co-attainment is still Pending (calculated sections never block).
    await prisma.courseFileSection.update({
      where: { id: sections["session-plan"].id },
      data: { isRequired: false, status: "PENDING" },
    });
    signInAs(coordinator);
    expect((await lock(courseFile.id)).ok).toBe(true);
  });

  it("is blocked by an optional section that was submitted but not reviewed", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile, sections } = await makeLockableFile(coordinator);
    await prisma.courseFileSection.update({
      where: { id: sections["session-plan"].id },
      data: { isRequired: false, status: "SUBMITTED" },
    });
    signInAs(coordinator);
    const result = await lock(courseFile.id);
    expect(result.message).toBe("1 section(s) are not ready. Refresh the page to see them.");
  });

  it("works only for the owning coordinator", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeLockableFile(coordinator);
    signInAs(await makeUser("COORDINATOR"));
    expect(await lock(courseFile.id)).toEqual({ ok: false, message: "Course file not found." });
    expect((await reload("courseFile", courseFile.id)).status).toBe("IN_PROGRESS");
  });

  it("refuses a co-teacher, an admin and a signed-out request", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeLockableFile(coordinator);
    signInAs(await makeUser("CO_TEACHER"));
    expect((await lock(courseFile.id)).message).toBe("You do not have permission to do this.");
    signInAs(await makeUser("ADMIN"));
    expect((await lock(courseFile.id)).ok).toBe(false);
    signInAs(null);
    expect((await lock(courseFile.id)).message).toBe("Authentication required.");
    expect((await reload("courseFile", courseFile.id)).status).toBe("IN_PROGRESS");
  });

  it("rejects an invalid request and a second lock", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeLockableFile(coordinator);
    signInAs(coordinator);
    expect(await lockCourseFileAction(null, form({}))).toEqual({
      ok: false,
      message: "Invalid request.",
    });
    expect((await lock(courseFile.id)).ok).toBe(true);
    expect(await lock(courseFile.id)).toEqual({
      ok: false,
      message: "This course file is already locked.",
    });
  });

  it("freezes the file: edits and assignments fail afterwards", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const teacher = await makeUser("CO_TEACHER");
    const { courseFile, sections } = await makeLockableFile(coordinator);
    const section = sections["session-plan"];
    await prisma.courseFileSection.update({
      where: { id: section.id },
      data: { assigneeId: teacher.id, status: "PENDING" },
    });
    // Put it back to approved so the file can lock.
    await prisma.courseFileSection.update({ where: { id: section.id }, data: { status: "APPROVED" } });

    signInAs(coordinator);
    expect((await lock(courseFile.id)).ok).toBe(true);

    signInAs(teacher);
    const saved = await saveSectionAction(null, form({ sectionId: section.id, sectionVersion: "1" }));
    expect(saved).toEqual({ ok: false, message: "The course file is locked and cannot be edited." });

    signInAs(coordinator);
    const assigned = await assignSectionsAction(null, form({
      courseFileId: courseFile.id,
      [`assignee:${section.id}`]: coordinator.id,
    }));
    expect(assigned).toEqual({
      ok: false,
      message: "This course file is locked and cannot be changed.",
    });
  });
});
