import { prisma } from "@/lib/prisma";
import { dueState } from "@/lib/dates";
import { buildReminderMessage } from "@/lib/reminder-message";

export const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Creates a reminder for every assigned, unfinished section that is overdue or
// due within two days, unless it was reminded in the last 24 hours.
// Locked and exported course files are skipped. Returns how many were created.
export async function createDueReminders(now = new Date()) {
  const cutoff = new Date(now.getTime() - REMINDER_COOLDOWN_MS);

  const sections = await prisma.courseFileSection.findMany({
    where: {
      assigneeId: { not: null },
      dueDate: { not: null },
      status: { in: ["PENDING", "CHANGES_REQUESTED"] },
      courseFile: { status: { notIn: ["LOCKED", "EXPORTED"] } },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: cutoff } }],
    },
    include: { courseFile: { select: { course: { select: { code: true } } } } },
  });

  const due = sections.filter((section) => {
    const state = dueState(section.dueDate, now);
    return state === "overdue" || state === "soon";
  });
  if (due.length === 0) return 0;

  await prisma.$transaction([
    prisma.notification.createMany({
      data: due.map((section) => ({
        userId: section.assigneeId,
        sectionId: section.id,
        message: buildReminderMessage(
          {
            number: section.number,
            title: section.title,
            courseCode: section.courseFile.course.code,
            dueDate: section.dueDate,
          },
          now
        ),
      })),
    }),
    ...due.map((section) =>
      prisma.courseFileSection.update({
        where: { id: section.id },
        data: { lastReminderAt: now },
      })
    ),
  ]);

  return due.length;
}