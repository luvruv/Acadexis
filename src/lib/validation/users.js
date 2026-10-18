import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "COORDINATOR", "CO_TEACHER"]);

// bcrypt only uses the first 72 bytes, so we cap the length there.
const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .max(72, "Password must be at most 72 characters.");

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name.").max(100, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address.")
    .max(254, "Email is too long."),
  role: roleSchema,
  password: passwordSchema,
});

export const changeRoleSchema = z.object({
  userId: z.string().min(1),
  role: roleSchema,
});

export const setActiveSchema = z.object({
  userId: z.string().min(1),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const resetPasswordSchema = z.object({
  userId: z.string().min(1),
  password: passwordSchema,
});