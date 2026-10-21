import { prisma } from "@/lib/prisma";
import { countsTowardCompletion } from "@/lib/sections";

// Works out the course file status from its sections, following the
// state-transition diagram. Locked and exported files never change here.
export function deriveCourseFileStatus(currentStatus, sections) {
  if (currentStatus === "LOCKED" || currentStatus === "EXPORTED") {
    return currentStatus;
  }

  if (sections.some((section) => section.status === "CHANGES_REQUESTED")) {
    return "CHANGES_REQUESTED";
  }

  const counted = sections.filter(countsTowardCompletion);
  if (
    counted.length > 0 &&
    counted.every(
      (section) => section.status === "SUBMITTED" || section.status === "APPROVED"
    )
  ) {
    return "UNDER_REVIEW";
  }

  const started = sections.some(
    (section) =>
      section.assigneeId ||
      section.status === "SUBMITTED" ||
      section.status === "CHANGES_REQUESTED"
  );
  if (currentStatus === "CREATED" && !started) return "CREATED";

  return "IN_PROGRESS";
}

// Recomputes and stores the status. The status condition on the update stops
// this from overwriting a lock that happened a moment earlier.
export async function refreshCourseFileStatus(courseFileId) {
  const courseFile = await prisma.courseFile.findUnique({
    where: { id: courseFileId },
    select: {
      status: true,
      sections: {
        select: { status: true, isRequired: true, source: true, assigneeId: true },
      },
    },
  });
  if (!courseFile) return null;

  const next = deriveCourseFileStatus(courseFile.status, courseFile.sections);
  if (next !== courseFile.status) {
    await prisma.courseFile.updateMany({
      where: { id: courseFileId, status: courseFile.status },
      data: { status: next },
    });
  }
  return next;
}