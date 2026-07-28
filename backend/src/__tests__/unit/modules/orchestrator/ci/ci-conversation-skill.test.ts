import { describe, expect, it } from "@jest/globals";
import { ConversationSkillService } from "../../../../../modules/orchestrator/ai/skills/conversation/conversation.service";
import { planFromState } from "../../../../../modules/orchestrator/ai/graph/plan.policy";
import { createInitialOrchestratorState } from "../../../../../modules/orchestrator/ai/graph/state";
import type { ConversationContext } from "../../../../../modules/orchestrator/ai/contracts/conversation-context";
import { buildCiAnalyzePrompt, CI_ANALYZE_PROMPT_ID } from "../../../../../modules/orchestrator/ai/prompts/ci.analyze";
import { ciAnalyzeLlmSchema } from "../../../../../modules/orchestrator/ai/conversation-intelligence/pipeline/analyze-llm";
import { ConversationIntelligenceService } from "../../../../../modules/orchestrator/ai/conversation-intelligence/conversation-intelligence";

function ctx(partial: Partial<ConversationContext>): ConversationContext {
  return {
    communicative_category: "unknown",
    workflow_intent: "unknown",
    confidence: 0.5,
    action_required: false,
    conversation_mode: "information",
    humor_detected: false,
    tone_preference: "professional",
    urgency: "normal",
    entities: [],
    references_previous_context: false,
    requires_clarification: false,
    suggested_next_action: "clarify",
    response_style: { brevity: "normal", formality: "neutral", initiative: "suggest" },
    slots_patch: {},
    ...partial,
  };
}

describe("ci.analyze.v1 + Conversation skill", () => {
  it("exposes ci.analyze.v1 prompt id and builds prompt body", () => {
    expect(CI_ANALYZE_PROMPT_ID).toBe("ci.analyze.v1");
    const prompt = buildCiAnalyzePrompt({
      memoryViewsChatLight: "brand: playful",
      recentMessages: "user: hi",
      openArtifacts: "(none)",
      currentSlots: "(none)",
      userMessage: "Write a blog about SEO",
    });
    expect(prompt).toMatch(/Conversation Intelligence/);
    expect(prompt).toMatch(/Write a blog about SEO/);
  });

  it("parses structured LLM CI schema", () => {
    const parsed = ciAnalyzeLlmSchema.parse({
      communicative_category: "request_action",
      workflow_intent: "create_content",
      confidence: 0.9,
      action_required: true,
      conversation_mode: "creation",
      humor_detected: false,
      tone_preference: "professional",
      urgency: "normal",
      entities: [{ type: "topic", value: "SEO", confidence: 0.9 }],
      references_previous_context: false,
      requires_clarification: false,
      suggested_next_action: "start_content_workflow",
      response_style: { brevity: "normal", formality: "neutral", initiative: "lead" },
      slots_patch: { topic: "SEO" },
    });
    expect(parsed.workflow_intent).toBe("create_content");
    expect(parsed.slots_patch.topic).toBe("SEO");
  });

  it("deterministic fallback when no API key still classifies create", async () => {
    const ci = new ConversationIntelligenceService();
    const out = await ci.analyze({
      workspace_id: "ws",
      user_id: "u",
      thread_id: "th",
      message: "Write a blog post about AI agents.",
    });
    expect(out.workflow_intent).toBe("create_content");
    expect(out.suggested_next_action).toBe("start_content_workflow");
  });

  it("Conversation skill clarify ends with a question", async () => {
    const skill = new ConversationSkillService();
    const out = await skill.run({
      purpose: "clarify",
      user_message: "Write a blog post.",
      clarification_question: "What topic should we cover?",
      injected_reply: "Happy to help with a draft",
    });
    expect(out.reply).toMatch(/\?/);
    expect(out.reply).toMatch(/topic/i);
  });

  it("plan routes explain to conversation skill", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "How does SEO work?",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
    });
    state.conversation_context = ctx({
      communicative_category: "ask_information",
      workflow_intent: "explain",
      suggested_next_action: "explain",
    });
    const plan = planFromState(state);
    expect(plan.next).toBe("invoke_skill");
    expect(plan.skill_id).toBe("conversation");
    expect(plan.skill_args?.purpose).toBe("explain");
  });

  it("plan does not re-invoke conversation when reply already set", () => {
    const state = createInitialOrchestratorState({
      turn_id: "t",
      thread_id: "th",
      workspace_id: "ws",
      user_id: "u",
      message: "Hey!",
      current_time_iso: "2026-07-27T00:00:00.000Z",
      current_date_human: "Mon",
    });
    state.conversation_context = ctx({
      communicative_category: "casual",
      workflow_intent: "casual",
      suggested_next_action: "casual_reply",
      conversation_mode: "casual",
    });
    state.reply = "Hey — good to hear from you.";
    const plan = planFromState(state);
    expect(plan.next).toBe("compose");
  });
});
