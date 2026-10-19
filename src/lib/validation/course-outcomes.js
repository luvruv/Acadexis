import { z } from "zod";

export const saveCourseOutcomesSchema = z.object({
  courseFileId: z.string().min(1),
  sectionVersion: z.number().int().min(1),
  outcomes: z
    .array(
      z.object({
        id: z.string().min(1).nullable(),
        description: z
          .string()
          .trim()
          .min(5, "Each course outcome needs a description (at least 5 characters).")
          .max(1000, "A course outcome description is too long (max 1000 characters)."),
        // programOutcomeId -> level (1 to 3). Unmapped cells are simply absent.
        levels: z.record(z.string(), z.number().int().min(1).max(3)),
      })
    )
    .min(1, "Add at least one course outcome.")
    .max(10, "At most 10 course outcomes."),
});