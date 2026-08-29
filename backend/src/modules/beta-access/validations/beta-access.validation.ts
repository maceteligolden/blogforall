import { z } from "zod";

export const betaAccessTokenSchema = z.object({
  token: z
    .string()
    .min(16, "Invalid approval token")
    .max(512, "Invalid approval token")
    .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, "Invalid approval token"),
});

export type BetaAccessTokenInput = z.infer<typeof betaAccessTokenSchema>;
