import { z } from "zod";
import { SiteMemberRole } from "../../../shared/constants";

export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(SiteMemberRole).refine((val) => val !== SiteMemberRole.OWNER, "Cannot invite with owner role"),
});

export const siteInvitationCancelParamSchema = z.object({
  id: z.string().min(1, "Site id is required"),
  invitationId: z.string().min(1, "Invitation id is required"),
});

export const invitationTokenParamSchema = z.object({
  token: z.string().min(1, "Invitation token is required"),
});

export type SiteInvitationCancelParams = z.infer<typeof siteInvitationCancelParamSchema>;
export type InvitationTokenParam = z.infer<typeof invitationTokenParamSchema>;
