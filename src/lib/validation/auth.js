import { z } from "zod";

// Used on the server both in the login action and inside Auth.js.
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address."),
  // No complexity rules at login. We only stop absurd input sizes.
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(128, "Password is too long."),
});