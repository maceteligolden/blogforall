import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import { CampaignAgentConfig } from "../../../shared/constants/campaign-agent.constant";
import { logger } from "../../../shared/utils/logger";
import { PostFrequency } from "../../../shared/constants/campaign.constant";
import type {
  AgentChatMessage,
  AgentChatResponse,
  AgentProposal,
  AgentProposalCampaign,
  AgentProposalScheduledPost,
} from "../interfaces/campaign-agent.interface";
import { CampaignService } from "./campaign.service";
import { ScheduledPostService } from "./scheduled-post.service";
import type { CreateCampaignInput } from "../interfaces/campaign.interface";

const HF_ROUTER_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";

const SYSTEM_PROMPT = `You are a veteran campaign manager for a blog platform. You help users plan marketing campaigns and content schedules.

Rules:
- Only discuss campaign and content planning: goals, audience, dates, posting frequency, number of posts, content themes, blog topics/titles, SEO and readability goals.
- If the user asks about something off-topic (support, account, non-marketing), politely say: "I can only help with campaign and content planning for your blog. For other questions please use the appropriate support channel."
- Extract campaign details from minimal input (e.g. "product launch next month, 3 posts a week" → goal, end_date, posting_frequency, total_posts_planned). Ask one or two short clarifying questions when something is ambiguous.
- When you have enough information to propose a full campaign, output a single JSON object in a markdown code block with the exact structure below. Use \`\`\`json and \`\`\` as fences. Do not add any other code blocks.
- The JSON must have: "campaign" (object with name, goal, target_audience?, start_date, end_date, posting_frequency, timezone?, total_posts_planned?) and "scheduled_posts" (array of objects with title, scheduled_at, timezone?, generation_prompt, content_theme?).
- Dates in ISO 8601 format (YYYY-MM-DD). posting_frequency must be one of: daily, weekly, biweekly, monthly, custom.
- For each scheduled post, generation_prompt should describe the blog topic and align with the campaign goal and audience so that auto-generation later produces on-brand content.
- Do not use <think> or </think> tags in your replies. Output only your final answer to the user.`;

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

  constructor(
    private campaignService: CampaignService,
    private scheduledPostService: ScheduledPostService
  ) {
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
  /**
   * Create a campaign and scheduled posts from an agent proposal.
   */
  async createFromProposal(
    userId: string,
    siteId: string,
    proposal: AgentProposal
  ): Promise<{ campaign: unknown; scheduled_posts: unknown[] }> {
    const c = proposal.campaign;
    const campaignInput: CreateCampaignInput = {
      name: c.name,
      goal: c.goal,
      start_date: new Date(c.start_date),
      end_date: new Date(c.end_date),
      posting_frequency: c.posting_frequency,
    };
    if (c.description) campaignInput.description = c.description;
    if (c.target_audience) campaignInput.target_audience = c.target_audience;
    if (c.timezone) campaignInput.timezone = c.timezone;
    if (c.total_posts_planned != null) campaignInput.total_posts_planned = c.total_posts_planned;

    const campaign = await this.campaignService.createCampaign(userId, siteId, campaignInput);
    const campaignId = campaign._id?.toString();
    if (!campaignId) {
      throw new Error("Campaign was created but has no id");
    }
    const timezone = c.timezone ?? "UTC";
    const scheduled_posts: unknown[] = [];

    for (const p of proposal.scheduled_posts) {
      const scheduledAt = new Date(p.scheduled_at);
      if (scheduledAt.getTime() < Date.now()) {
        logger.warn(
          "Skipping scheduled post in the past",
          { title: p.title, scheduled_at: p.scheduled_at },
          "CampaignAgentService"
        );
        continue;
      }
      const created = await this.scheduledPostService.createScheduledPost(userId, siteId, {
        campaign_id: campaignId,
        title: p.title,
        scheduled_at: scheduledAt,
        timezone: p.timezone ?? timezone,
        auto_generate: true,
        generation_prompt: p.generation_prompt,
        metadata: {
          campaign_goal: c.goal,
          target_audience: c.target_audience,
          content_theme: p.content_theme,
        },
      });
      scheduled_posts.push(created);
    }

    logger.info(
      "Campaign and scheduled posts created from agent proposal",
      { campaignId, postCount: scheduled_posts.length, userId, siteId },
      "CampaignAgentService"
    );
    return { campaign, scheduled_posts };
  }

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
    const rawReply = await this.hfChatCompletion(
      CampaignAgentConfig.AGENT_MODEL,
      modelMessages,
      CampaignAgentConfig.MAX_TOKENS,
      CampaignAgentConfig.TEMPERATURE
    );

    const proposal = this.parseProposalFromMessage(rawReply);
    const reply = this.replyForDisplay(rawReply);

    session.messages.push({ role: "user", content: message.trim() });
    session.messages.push({ role: "assistant", content: reply });
    session.updatedAt = Date.now();

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
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    return this.stripThinkBlocks(raw);
  }

  /** Remove <think>...</think> blocks from model output so they are not shown to the user. */
  private stripThinkBlocks(content: string): string {
    return content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  }

  /** Return only the part of the reply that should be shown to the user (no code/JSON blocks). */
  private replyForDisplay(content: string): string {
    let out = this.stripFencedJsonOnly(content);
    out = this.stripUnfencedProposalJson(out);
    return out.trim() || "I've prepared a campaign proposal for you — review it below and click Create campaign when ready.";
  }

  /** Remove only fenced blocks that contain JSON (start with {). Keep other code blocks (e.g. lists of details). */
  private stripFencedJsonOnly(content: string): string {
    return content.replace(/\s*```(?:json)?\s*([\s\S]*?)```\s*/g, (match, inner) => {
      if (/^\s*\{/.test(inner)) return "";
      return match;
    }).replace(/\n{3,}/g, "\n\n").trim();
  }

  /** Remove raw/unfenced JSON object that looks like { "campaign": ..., "scheduled_posts": ... } from text. */
  private stripUnfencedProposalJson(content: string): string {
    const startMatch = content.match(/\{\s*"campaign"\s*:/);
    if (!startMatch || startMatch.index === undefined) return content;
    const start = startMatch.index;
    let depth = 0;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) {
          const before = content.slice(0, start).trimEnd();
          const after = content.slice(i + 1).trimStart();
          return (before + (before && after ? "\n" : "") + after).trim();
        }
      }
    }
    return content.slice(0, start).trimEnd();
  }

  /**
   * Extract and validate a proposal from assistant message (fenced or unfenced JSON).
   */
  private parseProposalFromMessage(content: string): AgentProposal | undefined {
    const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = fenced
      ? fenced[1].trim()
      : this.extractUnfencedProposalJson(content);
    if (!jsonStr) return undefined;
    try {
      const parsed = JSON.parse(jsonStr) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        "campaign" in parsed &&
        "scheduled_posts" in parsed &&
        Array.isArray((parsed as AgentProposal).scheduled_posts)
      ) {
        return this.validateProposal(parsed as AgentProposal) ?? undefined;
      }
    } catch {
      // ignore
    }
    return undefined;
  }

  /** Extract raw JSON string for proposal from unfenced content (for parsing only). */
  private extractUnfencedProposalJson(content: string): string | null {
    const startMatch = content.match(/\{\s*"campaign"\s*:/);
    if (!startMatch || startMatch.index === undefined) return null;
    const start = startMatch.index;
    let depth = 0;
    for (let i = start; i < content.length; i++) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") {
        depth--;
        if (depth === 0) return content.slice(start, i + 1);
      }
    }
    return null;
  }

  /** Validate proposal shape and required fields; return proposal if valid. */
  private validateProposal(parsed: AgentProposal): AgentProposal | undefined {
    const campaign = parsed.campaign as unknown as Record<string, unknown>;
    const posts = parsed.scheduled_posts as unknown[];
    if (!campaign || typeof campaign !== "object") return undefined;
    const name = campaign.name;
    const goal = campaign.goal;
    const start_date = campaign.start_date;
    const end_date = campaign.end_date;
    const posting_frequency = campaign.posting_frequency;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof goal !== "string" ||
      !goal.trim() ||
      typeof start_date !== "string" ||
      !this.isIsoDate(start_date) ||
      typeof end_date !== "string" ||
      !this.isIsoDate(end_date) ||
      typeof posting_frequency !== "string" ||
      !Object.values(PostFrequency).includes(posting_frequency as PostFrequency)
    ) {
      return undefined;
    }
    const validCampaign: AgentProposalCampaign = {
      name: (name as string).trim(),
      goal: (goal as string).trim(),
      start_date: start_date as string,
      end_date: end_date as string,
      posting_frequency: posting_frequency as PostFrequency,
    };
    if (typeof campaign.description === "string") validCampaign.description = campaign.description;
    if (typeof campaign.target_audience === "string") validCampaign.target_audience = campaign.target_audience;
    if (typeof campaign.timezone === "string") validCampaign.timezone = campaign.timezone;
    if (typeof campaign.total_posts_planned === "number") validCampaign.total_posts_planned = campaign.total_posts_planned;

    const validPosts: AgentProposalScheduledPost[] = [];
    for (const p of posts) {
      const row = p as Record<string, unknown>;
      if (!row || typeof row !== "object") continue;
      const title = row.title;
      const scheduled_at = row.scheduled_at;
      const generation_prompt = row.generation_prompt;
      if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof scheduled_at !== "string" ||
        !this.isIsoDate(scheduled_at) ||
        typeof generation_prompt !== "string" ||
        !generation_prompt.trim()
      ) {
        continue;
      }
      const sp: AgentProposalScheduledPost = {
        title: (title as string).trim(),
        scheduled_at: scheduled_at as string,
        generation_prompt: (generation_prompt as string).trim(),
      };
      if (typeof row.timezone === "string") sp.timezone = row.timezone;
      if (typeof row.content_theme === "string") sp.content_theme = row.content_theme;
      validPosts.push(sp);
    }
    if (validPosts.length === 0) return undefined;
    return { campaign: validCampaign, scheduled_posts: validPosts };
  }

  private isIsoDate(s: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
  }

  private cleanupSessions(ttlMs: number): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.updatedAt > ttlMs) this.sessions.delete(id);
    }
  }
}
