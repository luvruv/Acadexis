import { z } from "zod";

export const saveAssessmentsSchema = z
  .object({
    courseFileId: z.string().min(1),
    components: z
      .array(
        z.object({
          id: z.string().min(1).nullable(),
          name: z
            .string()
            .trim()
            .min(1, "Every component needs a name.")
            .max(60, "Component name is too long (max 60 characters)."),
          maxMarks: z
            .number("Enter the maximum marks for every component.")
            .positive("Maximum marks must be greater than 0.")
            .max(1000, "Maximum marks cannot exceed 1000.")
            .refine(
              (value) => Math.round(value * 100) / 100 === value,
              "Maximum marks can have at most 2 decimals."
            ),
          courseOutcomeIds: z.array(z.string().min(1)).max(20),
        })
      )
      .min(1, "Add at least one component.")
      .max(15, "At most 15 components."),
  })
  .superRefine((data, context) => {
    const seen = new Set();
    for (const component of data.components) {
      const key = component.name.toLowerCase();
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: `Two components are named "${component.name}". Names must be different.`,
        });
        return;
      }
      seen.add(key);
    }
  });