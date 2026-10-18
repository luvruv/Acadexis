import { z } from "zod";

export const outcomeTypeSchema = z.enum(["PEO", "PO", "PSO"]);

const descriptionSchema = z
  .string()
  .trim()
  .min(10, "Each description must be at least 10 characters.")
  .max(2000, "Each description must be at most 2000 characters.");

export const saveOutcomesSchema = z.object({
  programId: z.string().min(1),
  type: outcomeTypeSchema,
  descriptions: z
    .record(z.string(), descriptionSchema)
    .refine((items) => Object.keys(items).length > 0, "Nothing to save."),
});

export const addOutcomeSchema = z.object({
  programId: z.string().min(1),
  type: outcomeTypeSchema,
  description: descriptionSchema,
});

export const deleteOutcomeSchema = z.object({
  outcomeId: z.string().min(1),
});