import { z } from "zod";

export const joinWaitlistSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((value) => value.trim().toLowerCase()),
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
});

export type JoinWaitlistInput = z.infer<typeof joinWaitlistSchema>;
