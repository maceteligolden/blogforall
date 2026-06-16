import { z } from "zod";

export const confirmCardBodySchema = z.object({
  payment_method_id: z.string().min(1, "payment_method_id is required"),
});

export const cardIdParamSchema = z.object({
  id: z.string().min(1, "Card id is required"),
});

export const invoiceListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
});

export const invoiceIdParamSchema = z.object({
  id: z.string().min(1, "Invoice id is required"),
});
