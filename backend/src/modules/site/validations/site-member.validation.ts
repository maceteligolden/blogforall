import { z } from "zod";
import { SiteMemberRole } from "../../../shared/constants";

export const addMemberSchema = z.object({
  user_id: z.string().min(1, "User ID is required"),
  role: z.nativeEnum(SiteMemberRole).refine((val) => val !== SiteMemberRole.OWNER, "Cannot assign owner role"),
});

export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(SiteMemberRole).refine((val) => val !== SiteMemberRole.OWNER, "Cannot assign owner role"),
});
