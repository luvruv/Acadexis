import { z } from "zod";

function percent(label) {
  return z
    .number(`${label} must be a number.`)
    .min(0, `${label} cannot be below 0.`)
    .max(100, `${label} cannot be above 100.`)
    .refine((value) => Math.round(value * 100) / 100 === value, `${label} can have at most 2 decimals.`);
}

export const attainmentSettingsSchema = z
  .object({
    courseFileId: z.string().min(1),
    studentLevel3MinPercent: percent("Student Level 3 minimum"),
    studentLevel2MinPercent: percent("Student Level 2 minimum"),
    courseLevel3MinPercent: percent("Course Level 3 target"),
    courseLevel2MinPercent: percent("Course Level 2 target"),
    absentAsZero: z.boolean(),
    confirmed: z.boolean(),
    coWeights: z
      .array(
        z.object({
          courseOutcomeId: z.string().min(1),
          weightPercent: percent("Course outcome weight"),
        })
      )
      .max(20),
  })
  .superRefine((data, context) => {
    if (!(data.studentLevel2MinPercent < data.studentLevel3MinPercent)) {
      context.addIssue({
        code: "custom",
        message: "For students, the Level 2 minimum must be lower than the Level 3 minimum.",
      });
    }
    if (!(data.courseLevel2MinPercent < data.courseLevel3MinPercent)) {
      context.addIssue({
        code: "custom",
        message: "For the course, the Level 2 target must be lower than the Level 3 target.",
      });
    }
    if (data.coWeights.length > 0) {
      const sum = data.coWeights.reduce((total, item) => total + item.weightPercent, 0);
      if (Math.abs(sum - 100) > 0.01) {
        context.addIssue({
          code: "custom",
          message: `Course outcome weights must add up to 100%. They add up to ${Math.round(sum * 100) / 100}%.`,
        });
      }
    }
  });
