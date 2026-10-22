import { z } from "zod";

function percent(label) {
  return z
    .number(`${label} must be a number.`)
    .min(0, `${label} cannot be below 0.`)
    .max(100, `${label} cannot be above 100.`);
}

export const attainmentSettingsSchema = z
  .object({
    courseFileId: z.string().min(1),
    thresholdPercent: percent("Attainment threshold"),
    level1MinPercent: percent("Level 1 minimum"),
    level2MinPercent: percent("Level 2 minimum"),
    level3MinPercent: percent("Level 3 minimum"),
    absentAsZero: z.boolean(),
    confirmed: z.boolean(),
  })
  .refine(
    (data) =>
      data.level1MinPercent < data.level2MinPercent &&
      data.level2MinPercent < data.level3MinPercent,
    { message: "The level minimums must increase: Level 1 < Level 2 < Level 3." }
  );