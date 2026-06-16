import { z } from "zod";

export const changePlanBodySchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});
