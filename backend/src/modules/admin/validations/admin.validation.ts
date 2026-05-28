import { z } from "zod";
import { UserRole } from "../../../shared/constants";

export const adminLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createPlatformAdminSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  role: z.enum([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
});

const numericString = z.coerce.number().int().positive();

export const adminPaginationQuerySchema = z.object({
  page: numericString.default(1),
  limit: numericString.max(100).default(20),
  search: z.string().trim().optional(),
});

export const adminUserBlogsParamsSchema = z.object({
  userId: z.string().min(1),
});

export const adminDateRangeQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type CreatePlatformAdminInput = z.infer<typeof createPlatformAdminSchema>;
export type AdminPaginationQueryInput = z.infer<typeof adminPaginationQuerySchema>;
export type AdminDateRangeQueryInput = z.infer<typeof adminDateRangeQuerySchema>;
export type AdminUserBlogsParamsInput = z.infer<typeof adminUserBlogsParamsSchema>;
