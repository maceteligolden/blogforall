import { z } from "zod";
import { skillIdSchema, workflowStageSchema } from "./enums";

export const confirmationRequestSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.unknown()),
  summary: z.string().min(1),
  kind: z.enum([
    "destructive",
    "strategy_warning",
    "outline_approval",
    "ambiguous_target",
  ]),
});

export const planResultSchema = z.object({
  next: z.enum(["invoke_skill", "await_human", "compose", "end"]),
  skill_id: skillIdSchema.optional(),
  skill_args: z.record(z.unknown()).optional(),
  workflow_stage: workflowStageSchema.optional(),
  confirmation: confirmationRequestSchema.optional(),
  rationale: z.string().min(1),
});

export type PlanResult = z.infer<typeof planResultSchema>;
export type ConfirmationRequest = z.infer<typeof confirmationRequestSchema>;
