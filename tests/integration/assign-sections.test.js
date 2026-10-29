import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { assignSectionsAction } from "@/app/(app)/coordinator/course-files/[id]/actions";
import { form, makeCourseFile, makeUser, reload, signInAs } from "./fixtures";

async function setup(fileStatus = "CREATED") {
  const coordinator = await makeUser("COORDINATOR");
  const teacher1 = await makeUser("CO_TEACHER");
  const teacher2 = await makeUser("CO_TEACHER");
  const { courseFile, sections } = await makeCourseFile(coordinator, { status: fileStatus });
  return { coordinator, teacher1, teacher2, courseFile, sections };
}

function assignForm(courseFileId, fields) {
  return form({ courseFileId, ...fields });
}

describe("assignSectionsAction", () => {
  it("lets the owning coordinator assign a section to an active co-teacher", async () => {
    const { coordinator, teacher1, courseFile, sections } = await setup();
    signInAs(coordinator);
    const s = sections["course-description"];

    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: teacher1.id,
    }));

    expect(result).toEqual({ ok: true, message: "Saved 1 change(s)." });
    expect((await reload("courseFileSection", s.id)).assigneeId).toBe(teacher1.id);
    expect(await prisma.sectionAssignment.count({ where: { sectionId: s.id } })).toBe(1);
    expect((await reload("courseFile", courseFile.id)).status).toBe("IN_PROGRESS");
    expect(await prisma.auditLog.count({ where: { action: "SECTIONS_ASSIGNED" } })).toBe(1);
  });

  it("lets the coordinator assign a section to themselves", async () => {
    const { coordinator, courseFile, sections } = await setup();
    signInAs(coordinator);
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: coordinator.id,
    }));
    expect(result.ok).toBe(true);
    expect((await reload("courseFileSection", s.id)).assigneeId).toBe(coordinator.id);
  });

  it("refuses a co-teacher", async () => {
    const { teacher1, courseFile, sections } = await setup();
    signInAs(teacher1);
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: teacher1.id,
    }));
    expect(result).toEqual({ ok: false, message: "You do not have permission to do this." });
    expect((await reload("courseFileSection", s.id)).assigneeId).toBeNull();
  });

  it("refuses an admin", async () => {
    const { teacher1, courseFile, sections } = await setup();
    signInAs(await makeUser("ADMIN"));
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: teacher1.id,
    }));
    expect(result.ok).toBe(false);
  });

  it("refuses a signed-out request", async () => {
    const { courseFile, sections, teacher1 } = await setup();
    signInAs(null);
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: teacher1.id,
    }));
    expect(result).toEqual({ ok: false, message: "Authentication required." });
  });

  it("does not let another coordinator change someone else's course file", async () => {
    const { teacher1, courseFile, sections } = await setup();
    const other = await makeUser("COORDINATOR");
    signInAs(other);
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: teacher1.id,
    }));
    expect(result).toEqual({ ok: false, message: "Course file not found." });
    expect((await reload("courseFileSection", s.id)).assigneeId).toBeNull();
  });

  it("rejects a deactivated co-teacher", async () => {
    const { coordinator, courseFile, sections } = await setup();
    const inactive = await makeUser("CO_TEACHER", { isActive: false });
    signInAs(coordinator);
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: inactive.id,
    }));
    expect(result).toEqual({
      ok: false,
      message: "Choose only active co-teachers. Refresh and try again.",
    });
  });

  it("rejects an admin as assignee", async () => {
    const { coordinator, courseFile, sections } = await setup();
    const admin = await makeUser("ADMIN");
    signInAs(coordinator);
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: admin.id,
    }));
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Choose only active co-teachers. Refresh and try again.");
  });

  it("does not assign program data, calculated or coordinator-only sections", async () => {
    const { coordinator, teacher1, courseFile, sections } = await setup();
    signInAs(coordinator);
    const cases = [
      ["university-vision-mission", 2],
      ["co-attainment", 6],
      ["course-details", 1],
    ];
    for (const [formKey, number] of cases) {
      const s = sections[formKey];
      const result = await assignSectionsAction(null, assignForm(courseFile.id, {
        [`assignee:${s.id}`]: teacher1.id,
      }));
      expect(result).toEqual({ ok: false, message: `Section ${number} cannot be assigned.` });
      expect((await reload("courseFileSection", s.id)).assigneeId).toBeNull();
    }
  });

  it("does not reassign an approved section", async () => {
    const { coordinator, teacher1, teacher2, courseFile, sections } = await setup();
    const s = sections["course-description"];
    await prisma.courseFileSection.update({
      where: { id: s.id },
      data: { assigneeId: teacher1.id, status: "APPROVED" },
    });
    signInAs(coordinator);
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: teacher2.id,
    }));
    expect(result).toEqual({
      ok: false,
      message: "Section 3 is approved and cannot be reassigned.",
    });
    expect((await reload("courseFileSection", s.id)).assigneeId).toBe(teacher1.id);
  });

  it("blocks changes once the file is locked or exported", async () => {
    for (const status of ["LOCKED", "EXPORTED"]) {
      const { coordinator, teacher1, courseFile, sections } = await setup(status);
      signInAs(coordinator);
      const s = sections["session-plan"];
      const result = await assignSectionsAction(null, assignForm(courseFile.id, {
        [`assignee:${s.id}`]: teacher1.id,
      }));
      expect(result).toEqual({
        ok: false,
        message: "This course file is locked and cannot be changed.",
      });
    }
  });

  it("rejects an impossible due date", async () => {
    const { coordinator, courseFile, sections } = await setup();
    signInAs(coordinator);
    const s = sections["session-plan"];
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`due:${s.id}`]: "2026-02-30",
    }));
    expect(result).toEqual({ ok: false, message: "Enter due dates as valid dates." });
  });

  it("saves a due date and restarts the reminder cycle", async () => {
    const { coordinator, courseFile, sections } = await setup();
    const s = sections["session-plan"];
    await prisma.courseFileSection.update({
      where: { id: s.id },
      data: { lastReminderAt: new Date() },
    });
    signInAs(coordinator);
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`due:${s.id}`]: "2026-11-15",
    }));
    expect(result).toEqual({ ok: true, message: "Saved 1 change(s)." });
    const saved = await reload("courseFileSection", s.id);
    expect(saved.dueDate.toISOString().slice(0, 10)).toBe("2026-11-15");
    expect(saved.lastReminderAt).toBeNull();
  });

  it("answers \"No changes.\" when nothing differs, and \"Nothing to save.\" when empty", async () => {
    const { coordinator, teacher1, courseFile, sections } = await setup();
    signInAs(coordinator);
    const s = sections["session-plan"];
    const data = assignForm(courseFile.id, { [`assignee:${s.id}`]: teacher1.id });
    await assignSectionsAction(null, data);
    const again = await assignSectionsAction(null, assignForm(courseFile.id, {
      [`assignee:${s.id}`]: teacher1.id,
    }));
    expect(again).toEqual({ ok: true, message: "No changes." });
    const empty = await assignSectionsAction(null, assignForm(courseFile.id, {}));
    expect(empty).toEqual({ ok: false, message: "Nothing to save." });
  });

  it("rejects a section id that does not belong to the course file", async () => {
    const { coordinator, teacher1, courseFile } = await setup();
    signInAs(coordinator);
    const result = await assignSectionsAction(null, assignForm(courseFile.id, {
      "assignee:does-not-exist": teacher1.id,
    }));
    expect(result).toEqual({
      ok: false,
      message: "Some sections were not found. Refresh and try again.",
    });
  });
});
