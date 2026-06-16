import { z } from "zod";

/**
 * Review tokens are emitted as base64url strings; we constrain to a sane
 * length window and the base64url alphabet so junk requests never reach
 * the repository. The exact length is implementation-defined and may
 * grow; the upper bound here is generous on purpose.
 */
export const reviewTokenParamSchema = z.object({
  token: z
    .string()
    .min(16, "Invalid review token")
    .max(256, "Invalid review token")
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid review token"),
});

export const reviewReworkBodySchema = z.object({
  comments: z
    .string()
    .min(1, "Please describe what to change.")
    .max(4000, "Rework comments must be 4000 characters or fewer."),
});
