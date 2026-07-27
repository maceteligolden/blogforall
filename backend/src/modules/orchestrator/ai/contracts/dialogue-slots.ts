import { z } from "zod";

export const dialogueSlotsSchema = z.object({
  topic: z.string().optional(),
  blog_id: z.string().optional(),
  title_query: z.string().optional(),
  tone: z.string().optional(),
  target_audience: z.string().optional(),
  word_count: z.number().int().positive().optional(),
  scheduled_at: z.string().optional(),
  category_ids: z.array(z.string()).optional(),
  feedback: z.string().optional(),
  proceed_despite_strategy_warning: z.boolean().optional(),
  outline_approved: z.boolean().optional(),
  selection: z
    .object({
      blog_id: z.string().optional(),
      highlight: z.string().optional(),
    })
    .optional(),
});

export type DialogueSlots = z.infer<typeof dialogueSlotsSchema>;
