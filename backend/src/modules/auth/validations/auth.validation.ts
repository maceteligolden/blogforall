import { z } from "zod";

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol");

export const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: strongPassword,
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone_number: z.string().optional(),
  accept_terms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the Terms and Conditions to sign up" }),
  }),
  terms_version: z.string().optional(),
  referral_code: z.string().trim().min(4).max(32).optional(),
  invite_token: z.string().trim().min(16).max(128).optional(),
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
  new_password: strongPassword,
});

export const updateSiteContextSchema = z.object({
  site_id: z.string().min(1, "Site ID is required"),
});

export const refreshTokenBodySchema = z.object({
  refresh_token: z.string().min(1, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const verifyResetCodeSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  new_password: strongPassword,
});

export const verifyEmailSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const companyRoleSchema = z.object({
  company_role: z.enum(["founder", "marketer", "content", "engineer", "agency", "other"]),
  company_role_detail: z.string().trim().max(200).optional(),
});
