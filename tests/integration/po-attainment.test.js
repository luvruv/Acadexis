import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeAttainment } from "@/lib/attainment";
import { loadAttainmentInputs } from "@/lib/attainment-data";
import { loadCourseFileDocument } from "@/lib/course-file-data";
import { lockCourseFileAction } from "@/app/(app)/coordinator/course-files/[id]/lock-actions";
import { form, makeLockableFile, makeUser, reload, signInAs } from "./fixtures";

// Adds PO1 (mapped to CO1 at level 3) and PSO1 (not mapped), plus a PO attainment section.
async function addPoData(courseFile) {
  const course = await prisma.course.findUnique({ where: { id: courseFile.courseId } });
  const po1 = await prisma.programOutcome.create({
    data: { programId: course.programId, type: "PO", code: "PO1", description: "PO one", position: 1 },
  });
  await prisma.programOutcome.create({
    data: { programId: course.programId, type: "PSO", code: "PSO1", description: "PSO one", position: 1 },
  });
  const co1 = await prisma.courseOutcome.findFirst({ where: { courseFileId: courseFile.id } });
  await prisma.coPoMapping.create({
    data: { courseOutcomeId: co1.id, programOutcomeId: po1.id, level: 3 },
  });
  return prisma.courseFileSection.create({
    data: {
      courseFileId: courseFile.id,
      number: 7,
      title: "PO Attainment",
      formKey: "po-attainment",
      source: "COMPUTED",
      isRequired: true,
    },
  });
}

describe("PO and PSO attainment", () => {
  it("is calculated from the CO attainment and the CO-PO matrix", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeLockableFile(coordinator);
    await addPoData(courseFile);

    const result = computeAttainment(await loadAttainmentInputs(prisma, courseFile.id));
    expect(result.ready).toBe(true);
    // Both students score 70% (Level 3), so CO1 attainment is 3 and PO1 = 3.
    expect(result.po).toEqual([
      { code: "PO1", value: 3 },
      { code: "PSO1", value: null },
    ]);
  });

  it("is frozen into the PO attainment section when the file is locked", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeLockableFile(coordinator);
    const poSection = await addPoData(courseFile);

    signInAs(coordinator);
    const locked = await lockCourseFileAction(null, form({ courseFileId: courseFile.id }));
    expect(locked.ok).toBe(true);

    const saved = await reload("courseFileSection", poSection.id);
    expect(saved.status).toBe("APPROVED");
    expect(saved.content.po).toEqual([
      { code: "PO1", value: 3 },
      { code: "PSO1", value: null },
    ]);
  });

  it("is shown live before locking and frozen after locking in the document data", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeLockableFile(coordinator);
    await addPoData(courseFile);

    let doc = await loadCourseFileDocument(prisma, courseFile.id);
    let section = doc.sections.find((item) => item.formKey === "po-attainment");
    expect(section.kind).toBe("po-attainment");
    expect(section.data.live).toBe(true);
    expect(section.data.rows[0]).toEqual({ code: "PO1", value: 3 });

    signInAs(coordinator);
    await lockCourseFileAction(null, form({ courseFileId: courseFile.id }));
    doc = await loadCourseFileDocument(prisma, courseFile.id);
    section = doc.sections.find((item) => item.formKey === "po-attainment");
    expect(section.data.live).toBe(false);
    expect(section.data.rows[0]).toEqual({ code: "PO1", value: 3 });
  });

  it("is empty when the CO attainment is not complete", async () => {
    const coordinator = await makeUser("COORDINATOR");
    const { courseFile } = await makeLockableFile(coordinator);
    await addPoData(courseFile);
    await prisma.courseOutcome.updateMany({
      where: { courseFileId: courseFile.id },
      data: { attainmentWeight: null },
    });
    const doc = await loadCourseFileDocument(prisma, courseFile.id);
    const section = doc.sections.find((item) => item.formKey === "po-attainment");
    expect(section.data.rows).toEqual([]);
  });
});
