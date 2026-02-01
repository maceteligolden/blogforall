import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_number: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required").optional(),
  last_name: z.string().min(1, "Last name is required").optional(),
  phone_number: z.string().optional(),
});

export const changePasswordSchema = z.object({
  old_password: z.string().min(1, "Old password is required"),
  new_password: z.string().min(8, "New password must be at least 8 characters"),
});

export const updateSiteContextSchema = z.object({
  site_id: z.string().min(1, "Site ID is required"),
});
