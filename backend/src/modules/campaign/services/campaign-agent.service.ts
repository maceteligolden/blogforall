import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import { CampaignAgentConfig } from "../../../shared/constants/campaign-agent.constant";
import { logger } from "../../../shared/utils/logger";
import type {
  AgentChatMessage,
  AgentChatResponse,
  AgentProposal,
} from "../interfaces/campaign-agent.interface";

const HF_ROUTER_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

const SYSTEM_PROMPT = `You are a veteran campaign manager for a blog platform. You help users plan marketing campaigns and content schedules.

Rules:
- Only discuss campaign and content planning: goals, audience, dates, posting frequency, number of posts, content themes, blog topics/titles, SEO and readability goals.
- If the user asks about something off-topic (support, account, non-marketing), politely say: "I can only help with campaign and content planning for your blog. For other questions please use the appropriate support channel."
- Extract campaign details from minimal input (e.g. "product launch next month, 3 posts a week" → goal, end_date, posting_frequency, total_posts_planned). Ask one or two short clarifying questions when something is ambiguous.
- When you have enough information to propose a full campaign, output a single JSON object in a markdown code block with the exact structure below. Use \`\`\`json and \`\`\` as fences. Do not add any other code blocks.
- The JSON must have: "campaign" (object with name, goal, target_audience?, start_date, end_date, posting_frequency, timezone?, total_posts_planned?) and "scheduled_posts" (array of objects with title, scheduled_at, timezone?, generation_prompt, content_theme?).
- Dates in ISO 8601 format (YYYY-MM-DD). posting_frequency must be one of: daily, weekly, biweekly, monthly, custom.
- For each scheduled post, generation_prompt should describe the blog topic and align with the campaign goal and audience so that auto-generation later produces on-brand content.`;

/** In-memory session: messages and last activity. */
interface AgentSession {
  messages: AgentChatMessage[];
  updatedAt: number;
}

/** Keywords that suggest the user is off-topic (support, account, etc.). */
const OFF_TOPIC_PATTERNS = [
  /\b(support|refund|cancel subscription|billing|payment|password|login|account)\b/i,
  /\b(how do i contact|customer service|help desk)\b/i,
];

@injectable()
export class CampaignAgentService {
  private readonly sessions = new Map<string, AgentSession>();

  constructor() {
    const token = CampaignAgentConfig.HUGGINGFACE_API_TOKEN;
    if (!token) {
      logger.warn(
        "Campaign agent: HUGGINGFACE_API_TOKEN / HF_TOKEN not set. Agent chat will fail.",
        {},
        "CampaignAgentService"
      );
    }
    const ttl = CampaignAgentConfig.SESSION_TTL_MS;
    setInterval(() => this.cleanupSessions(ttl), Math.min(ttl, 300_000));
  }

  /**
   * Handle one user message: guardrails, HF chat, history, optional proposal.
   */
  async chat(params: {
    sessionId?: string;
    siteId?: string;
    userId?: string;
    message: string;
  }): Promise<AgentChatResponse> {
    const { message } = params;
    const sessionId = params.sessionId ?? randomUUID();

    if (!message?.trim()) {
      return {
        reply: "Please send a message to plan your campaign.",
        session_id: sessionId,
      };
    }

    if (this.isOffTopic(message)) {
      return {
        reply:
          "I can only help with campaign and content planning for your blog. For other questions please use the appropriate support channel.",
        session_id: sessionId,
      };
    }

    const session = this.getOrCreateSession(sessionId);
    const modelMessages = this.buildMessages(session.messages, message);
    const reply = await this.hfChatCompletion(
      CampaignAgentConfig.AGENT_MODEL,
      modelMessages,
      CampaignAgentConfig.MAX_TOKENS,
      CampaignAgentConfig.TEMPERATURE
    );

    session.messages.push({ role: "user", content: message.trim() });
    session.messages.push({ role: "assistant", content: reply });
    session.updatedAt = Date.now();

    const proposal = this.parseProposalFromMessage(reply);

    return {
      reply,
      session_id: sessionId,
      ...(proposal && { proposal }),
    };
  }

  getOrCreateSession(sessionId: string): AgentSession {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = { messages: [], updatedAt: Date.now() };
      this.sessions.set(sessionId, session);
    }
    return session;
  }

  private isOffTopic(text: string): boolean {
    return OFF_TOPIC_PATTERNS.some((re) => re.test(text));
  }

  private buildMessages(history: AgentChatMessage[], userMessage: string): { role: string; content: string }[] {
    const maxTurns = CampaignAgentConfig.MAX_HISTORY_TURNS;
    const recent = history.slice(-maxTurns * 2);
    const messages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recent.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage.trim() },
    ];
    return messages;
  }

  private async hfChatCompletion(
    model: string,
    messages: { role: string; content: string }[],
    maxTokens: number,
    temperature: number
  ): Promise<string> {
    const token = CampaignAgentConfig.HUGGINGFACE_API_TOKEN;
    if (!token) {
      throw new Error("Campaign agent: Hugging Face token not configured.");
    }
    const modelWithProvider = model.includes(":") ? model : `${model}:hf-inference`;
    const res = await fetch(HF_ROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: modelWithProvider,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) {
      const contentType = res.headers.get("Content-Type");
      let body: unknown;
      try {
        body = contentType?.includes("application/json") ? await res.json() : await res.text();
      } catch {
        body = "";
      }
      const err = new Error(
        typeof body === "object" &&
          body !== null &&
          "error" in (body as object) &&
          typeof (body as { error: unknown }).error === "object" &&
          (body as { error: { message?: string } }).error?.message
          ? (body as { error: { message: string } }).error.message
          : `HTTP ${res.status}`
      ) as Error & { httpResponse?: { status: number; body: unknown } };
      (err as Error & { httpResponse?: { status: number; body: unknown } }).httpResponse = {
        status: res.status,
        body,
      };
      throw err;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? "";
  }

  /**
   * Extract a proposal from assistant message if it contains a fenced JSON block.
   * Validation of shape is done in a separate step (subtask 3).
   */
  private parseProposalFromMessage(content: string): AgentProposal | undefined {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (!match) return undefined;
    try {
      const parsed = JSON.parse(match[1].trim()) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "campaign" in parsed &&
        "scheduled_posts" in parsed &&
        Array.isArray((parsed as AgentProposal).scheduled_posts)
      ) {
        return parsed as AgentProposal;
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  private cleanupSessions(ttlMs: number): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt > ttlMs) this.sessions.delete(id);
    }
  }
}
