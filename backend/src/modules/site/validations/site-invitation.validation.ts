import { z } from "zod";
import { SiteMemberRole } from "../../../shared/constants";

export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.nativeEnum(SiteMemberRole).refine(
    (val) => val !== SiteMemberRole.OWNER,
    "Cannot invite with owner role"
  ),
});
