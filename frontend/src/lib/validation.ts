import { z } from "zod";

export const emailSchema = z
  .string()
  .min(5, "Email is required")
  .max(254, "Email is too long")
  .regex(
    /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
    "Please enter a valid email address (e.g., user@example.com)"
  );

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?/\\`~]/,
    "Password must contain at least one special character"
  );

export const nameSchema = z
  .string()
  .max(120, "Name is too long")
  .refine(
    (v) => v.trim() === "" || /^[a-zA-Z\s.'\-]+$/.test(v),
    "Name can only contain letters, spaces, hyphens, and apostrophes"
  );

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
});

export const otpSchema = z
  .string()
  .length(6, "OTP must be exactly 6 digits")
  .regex(/^\d{6}$/, "OTP must contain only numbers");

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
