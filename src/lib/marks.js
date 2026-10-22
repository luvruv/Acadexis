// Keeps the "Detail of Marks" section in step with the marks data.
// Complete (every student has a value or AB for every component) -> Submitted.
// Incomplete while Submitted or Approved -> back to Pending.
// "db" is either the prisma client or a transaction client.
export async function syncMarksSection(db, courseFileId) {
  const section = await db.courseFileSection.findFirst({
    where: { courseFileId, formKey: "marks-all-components" },
    select: { id: true, status: true },
  });
  if (!section) return;

  const [componentCount, studentCount, enteredCount] = await Promise.all([
    db.assessmentComponent.count({ where: { courseFileId } }),
    db.student.count({ where: { courseFileId } }),
    db.mark.count({ where: { component: { courseFileId } } }),
  ]);
  const complete =
    componentCount > 0 &&
    studentCount > 0 &&
    enteredCount === componentCount * studentCount;

  if (complete) {
    await db.courseFileSection.update({
      where: { id: section.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        approvedAt: null,
        version: { increment: 1 },
      },
    });
  } else if (section.status === "SUBMITTED" || section.status === "APPROVED") {
    await db.courseFileSection.update({
      where: { id: section.id },
      data: { status: "PENDING", approvedAt: null, version: { increment: 1 } },
    });
  }
}