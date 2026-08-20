import { z } from "zod";

export const completeOnboardingBodySchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  paymentMethodId: z.string().min(1, "Payment method ID is required"),
});

export const siteIdQuerySchema = z.object({
  site_id: z.string().uuid("A valid workspace id is required"),
});

export const startStrategistBootstrapBodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .optional()
  .default({});

export const acknowledgeStrategistReadyBodySchema = z.object({
  degraded: z.boolean().optional(),
});
