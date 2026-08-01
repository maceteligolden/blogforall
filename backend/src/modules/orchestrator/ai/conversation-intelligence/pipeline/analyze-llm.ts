import { z } from "zod";
import { createChatOpenAI } from "../../../../../shared/ai/create-chat-openai";
import { env } from "../../../../../shared/config/env";
import {
  conversationContextSchema,
  type ConversationContext,
} from "../../contracts/conversation-context";
import { normalizeIntent } from "../../contracts/enums";
import { buildCiAnalyzePrompt } from "../../prompts/ci.analyze";
import type { ConversationIntelligenceInput } from "./analyze-deterministic";

/** LLM output schema for ci.analyze.v1 (maps into ConversationContext). */
export const ciAnalyzeLlmSchema = z.object({
  communicative_category: z.enum([
    "ask_information",
    "request_action",
    "brainstorm",
    "provide_feedback",
    "update_preferences",
    "casual",
    "unknown",
  ]),
  workflow_intent: z.enum([
    "create_content",
    "update_content",
    "optimize_content",
    "review_content",
    "publish_content",
    "schedule_content",
    "unpublish_content",
    "delete_content",
    "list_content",
    "get_content",
    "explain",
    "strategy",
    "research",
    "analytics",
    "update_memory",
    "onboarding",
    "casual",
    "unknown",
  ]),
  confidence: z.number().min(0).max(1),
  action_required: z.boolean(),
  conversation_mode: z.enum([
    "information",
    "creation",
    "planning",
    "editing",
    "feedback",
    "casual",
  ]),
  emotional_state: z.string().optional(),
  humor_detected: z.boolean(),
  tone_preference: z.enum(["casual", "professional", "technical", "friendly"]),
  urgency: z.enum(["low", "normal", "high"]).optional(),
  entities: z
    .array(
      z.object({
        type: z.enum(["topic", "blog_id", "url", "audience", "channel", "other"]),
        value: z.string().min(1),
        confidence: z.number().min(0).max(1),
      }),
    )
    .optional()
    .default([]),
  references_previous_context: z.boolean(),
  requires_clarification: z.boolean(),
  clarification_question: z.string().optional(),
  suggested_next_action: z.enum([
    "explain",
    "start_content_workflow",
    "start_planning",
    "revise_current_artifact",
    "emit_memory_candidate",
    "casual_reply",
    "clarify",
  ]),
  response_style: z.object({
    brevity: z.enum(["short", "normal", "detailed"]),
    formality: z.enum(["casual", "neutral", "formal"]),
    initiative: z.enum(["passive", "suggest", "lead"]),
  }),
  slots_patch: z
    .object({
      topic: z.string().optional(),
      blog_id: z.string().optional(),
      title_query: z.string().optional(),
      tone: z.string().optional(),
      target_audience: z.string().optional(),
      feedback: z.string().optional(),
      post_format: z
        .enum(["personal_story", "engineering_reflection", "productivity", "linkedin_post"])
        .optional(),
    })
    .optional()
    .default({}),
  literal_interpretation: z.string().optional(),
  communicative_rationale: z.string().optional(),
});

function formatRecent(input: ConversationIntelligenceInput): string {
  return (input.recent_messages ?? [])
    .slice(-8)
    .map((m) => `${m.role}: ${m.content.slice(0, 280)}`)
    .join("\n");
}

function formatMemory(input: ConversationIntelligenceInput): string {
  if (!input.memory_views || !Object.keys(input.memory_views).length) return "(none)";
  try {
    return JSON.stringify(input.memory_views).slice(0, 1200);
  } catch {
    return "(unavailable)";
  }
}

function formatOpenArtifacts(input: ConversationIntelligenceInput): string {
  if (!input.open_artifacts) return "(none)";
  return JSON.stringify(input.open_artifacts);
}

/**
 * ci.analyze.v1 — LLM-primary Conversation Intelligence classify.
 * Returns null when the API key is missing or the model call fails.
 */
export async function analyzeConversationWithLlm(
  input: ConversationIntelligenceInput,
): Promise<ConversationContext | null> {
  const apiKey = env.orchestrator.openaiApiKey;
  if (!apiKey) return null;

  const prompt = buildCiAnalyzePrompt({
    memoryViewsChatLight: formatMemory(input),
    recentMessages: formatRecent(input),
    openArtifacts: formatOpenArtifacts(input),
    currentSlots: input.prior_context?.slots_patch
      ? JSON.stringify(input.prior_context.slots_patch)
      : "(none)",
    userMessage: input.message.slice(0, 800),
    priorContextHint: input.prior_context
      ? `${input.prior_context.workflow_intent}/${input.prior_context.suggested_next_action} conf=${input.prior_context.confidence}`
      : undefined,
  });

  const chat = createChatOpenAI({
    apiKey,
    model: env.orchestrator.supervisorModel,
    temperature: 0,
    timeout: 20_000,
  });

  try {
    let rawParsed: unknown = null;

    try {
      const structured = chat.withStructuredOutput(ciAnalyzeLlmSchema);
      rawParsed = await structured.invoke([{ role: "user", content: prompt }]);
    } catch {
      const res = await chat.invoke([{ role: "user", content: prompt }]);
      const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      rawParsed = JSON.parse(jsonMatch[0]);
    }

    const soft = ciAnalyzeLlmSchema.safeParse({
      humor_detected: false,
      references_previous_context: false,
      entities: [],
      slots_patch: {},
      ...(typeof rawParsed === "object" && rawParsed ? rawParsed : {}),
    });
    if (!soft.success) return null;
    const parsed = soft.data;

    const workflow_intent = normalizeIntent(parsed.workflow_intent);
    const topic =
      parsed.slots_patch?.topic?.trim() ||
      parsed.entities.find((e) => e.type === "topic")?.value;

    const ctx: ConversationContext = {
      communicative_category: parsed.communicative_category,
      workflow_intent,
      confidence: parsed.confidence,
      action_required: parsed.action_required,
      conversation_mode: parsed.conversation_mode,
      emotional_state: parsed.emotional_state,
      humor_detected: parsed.humor_detected,
      tone_preference: parsed.tone_preference,
      urgency: parsed.urgency,
      entities:
        parsed.entities.length > 0
          ? parsed.entities
          : topic
            ? [{ type: "topic", value: topic, confidence: parsed.confidence }]
            : [],
      references_previous_context: parsed.references_previous_context,
      requires_clarification: parsed.requires_clarification,
      clarification_question: parsed.clarification_question,
      suggested_next_action: parsed.suggested_next_action,
      response_style: parsed.response_style,
      slots_patch: {
        ...parsed.slots_patch,
        ...(topic ? { topic } : {}),
      },
      literal_interpretation: parsed.literal_interpretation ?? input.message.slice(0, 200),
      communicative_rationale:
        parsed.communicative_rationale ?? `ci.analyze.v1:${workflow_intent}→${parsed.suggested_next_action}`,
    };

    return conversationContextSchema.parse(ctx);
  } catch {
    return null;
  }
}
