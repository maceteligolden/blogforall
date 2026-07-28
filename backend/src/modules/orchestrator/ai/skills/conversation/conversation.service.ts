import { injectable } from "tsyringe";
import { createChatOpenAI } from "../../../../../shared/ai/create-chat-openai";
import { env } from "../../../../../shared/config/env";
import {
  buildConversationSkillPrompt,
  type ConversationSkillPurpose,
} from "../../prompts/skill.conversation";

export type ConversationSkillInput = {
  purpose: ConversationSkillPurpose;
  user_message: string;
  clarification_question?: string;
  facts?: string;
  brand_voice?: string;
  /** Injected reply for tests (skips LLM). */
  injected_reply?: string;
};

export type ConversationSkillResult = {
  reply: string;
  purpose: ConversationSkillPurpose;
};

/**
 * Conversation skill (doc 06 / skill.conversation.v1) — user-facing dialogue only.
 * Does not invoke Research/Writing/tools.
 */
@injectable()
export class ConversationSkillService {
  async run(input: ConversationSkillInput): Promise<ConversationSkillResult> {
    if (input.injected_reply?.trim()) {
      return {
        reply: this.ensureClarifyQuestion(input.injected_reply.trim(), input),
        purpose: input.purpose,
      };
    }

    const apiKey = env.orchestrator.openaiApiKey;
    if (!apiKey) {
      return { reply: this.offlineFallback(input), purpose: input.purpose };
    }

    const prompt = buildConversationSkillPrompt({
      purpose: input.purpose,
      question: input.clarification_question,
      facts: input.facts ?? "(none)",
      brandVoice: input.brand_voice ?? "(none)",
      userMessage: input.user_message.slice(0, 800),
    });

    try {
      const chat = createChatOpenAI({
        apiKey,
        model: env.orchestrator.supervisorModel,
        temperature: 0.5,
        timeout: 20_000,
      });
      const res = await chat.invoke([{ role: "user", content: prompt }]);
      const text = typeof res.content === "string" ? res.content : JSON.stringify(res.content);
      const reply = text.trim().replace(/^```(?:text|markdown)?\n?|\n?```$/g, "").trim();
      if (!reply) return { reply: this.offlineFallback(input), purpose: input.purpose };
      return { reply: this.ensureClarifyQuestion(reply, input), purpose: input.purpose };
    } catch {
      return { reply: this.offlineFallback(input), purpose: input.purpose };
    }
  }

  private ensureClarifyQuestion(reply: string, input: ConversationSkillInput): string {
    if (input.purpose !== "clarify" || /\?/.test(reply)) return reply;
    const q = input.clarification_question?.trim();
    return q ? `${reply.replace(/[.!]?$/, "")}. ${q}` : `${reply} What should we focus on?`;
  }

  private offlineFallback(input: ConversationSkillInput): string {
    if (input.purpose === "clarify") {
      return (
        input.clarification_question?.trim() ||
        "What topic should we use so I can help with the next step?"
      );
    }
    if (input.purpose === "casual") {
      return "Hey — good to hear from you. What's on your mind?";
    }
    if (input.purpose === "explain") {
      return (
        input.facts?.trim() ||
        "I can look that up in workspace settings or research it — which would help more?"
      );
    }
    return input.clarification_question?.trim() || "How would you like to continue?";
  }
}
