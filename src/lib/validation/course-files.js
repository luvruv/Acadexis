import { z } from "zod";

export const createCourseFileSchema = z.object({
  courseCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Enter the course code.")
    .max(20, "Course code is too long.")
    .regex(
      /^[A-Z0-9][A-Z0-9 -]*$/,
      "Course code may contain only letters, numbers, spaces and hyphens."
    ),
  title: z.string().trim().min(3, "Enter the course title.").max(200, "Title is too long."),
  programId: z.string().min(1, "Choose a program."),
  semester: z
    .string()
    .trim()
    .min(1, "Enter the semester or term.")
    .max(50, "Semester is too long."),
  academicYear: z
    .string()
    .trim()
    .min(4, "Enter the academic year, for example 2026-27.")
    .max(20, "Academic year is too long."),
  batch: z
    .string()
    .trim()
    .max(50, "Batch is too long.")
    .transform((value) => value || null),
  templateVersionId: z.string().min(1, "Choose a template."),
});