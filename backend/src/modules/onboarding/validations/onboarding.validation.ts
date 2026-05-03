import { z } from "zod";

export const completeOnboardingBodySchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});
