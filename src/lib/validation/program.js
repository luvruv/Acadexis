import { z } from "zod";

function longText(label) {
  return z
    .string()
    .trim()
    .min(10, `${label} must be at least 10 characters.`)
    .max(5000, `${label} is too long (max 5000 characters).`);
}

// Same shape for a university and for a school.
export const visionMissionFormSchema = z.object({
  id: z.string().min(1),
  vision: longText("Vision"),
  mission: longText("Mission"),
});

// One graduate attribute per line in the textarea.
export const graduateAttributesFormSchema = z.object({
  universityId: z.string().min(1),
  attributes: z
    .string()
    .transform((text) =>
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    )
    .pipe(
      z
        .array(
          z
            .string()
            .min(3, "Each attribute must be at least 3 characters.")
            .max(500, "Each attribute must be at most 500 characters.")
        )
        .min(1, "Add at least one graduate attribute.")
        .max(20, "At most 20 graduate attributes.")
    ),
});