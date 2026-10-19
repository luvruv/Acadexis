import { z } from "zod";

const studentSchema = z.object({
  enrollmentNo: z
    .string()
    .trim()
    .min(1, "Every student needs an enrollment number.")
    .max(30, "Enrollment number is too long."),
  rollNo: z
    .string()
    .trim()
    .max(30, "Roll number is too long.")
    .transform((value) => value || null),
  name: z
    .string()
    .trim()
    .min(2, "Every student needs a name.")
    .max(100, "Student name is too long."),
  classGroup: z
    .string()
    .trim()
    .max(30, "Class group is too long.")
    .transform((value) => value || null),
});

export const saveStudentsSchema = z
  .object({
    courseFileId: z.string().min(1),
    sectionVersion: z.number().int().min(1),
    students: z
      .array(studentSchema)
      .min(1, "Add at least one student.")
      .max(1000, "At most 1000 students."),
  })
  .superRefine((data, context) => {
    const seen = new Map();
    data.students.forEach((student, index) => {
      const key = student.enrollmentNo.toLowerCase();
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["students", index, "enrollmentNo"],
          message: `Duplicate enrollment number ${student.enrollmentNo} (students ${
            seen.get(key) + 1
          } and ${index + 1}).`,
        });
      } else {
        seen.set(key, index);
      }
    });
  });