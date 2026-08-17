import {
  AIMessage,
  createMiddleware,
  humanInTheLoopMiddleware,
  HumanMessage,
  PIIDetectionError,
  summarizationMiddleware,
  ToolMessage,
} from "langchain";
import { Command } from "@langchain/langgraph";
import { z } from "zod";
import { container } from "tsyringe";
import { env } from "../../shared/config/env";
import { createChatOpenAI } from "../../shared/ai/create-chat-openai";
import {
  createLoadSkillTool,
  findSkillOwningTool,
  SKILLS,
} from "./orchestrator.skill";
import {
  createStrategyTools,
  formatStrategyUpdateDraft,
} from "./orchestrator.tool";
import {
  createCampaignTools,
  formatCampaignCreateDraft,
  formatCampaignScheduleDraft,
  formatCampaignUpdateDraft,
} from "./orchestrator.campaign-tools";
import { createResearchTools } from "./orchestrator.research-tools";
import {
  createWritingTools,
  formatWritingConfirmResearchDraft,
  formatWritingResearchDraft,
} from "./orchestrator.writing-tools";
import {
  createBlogTools,
  formatBlogPublishDraft,
  formatBlogScheduleDraft,
  formatBlogUnpublishDraft,
  formatBlogUnscheduleDraft,
} from "./orchestrator.blog-tools";
import { LangChainMemoryRepository } from "./longterm-memory.repository";
import { LongTermMemory } from "./orchestrator.validation";
import { AGENT_MODEL } from "./orchestrator.constants";

const skillsPrompt = SKILLS.map(
  (skill) => `- **${skill.name}**: ${skill.description}`,
).join("\n");

const memoryRepository = container.resolve(LangChainMemoryRepository);

const skillOwnedToolNames = new Set(
  SKILLS.flatMap((skill) => skill.toolNames),
);

export type LongTermMemoryMiddlewareIdentity = {
  userId: string;
  siteId: string;
  userName?: string;
  workspaceName?: string;
  companyRole?: string;
  companyRoleDetail?: string;
  memberRole?: string;
};

function getMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") {
          return block;
        }
        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof (block as { text: unknown }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }

  if (content == null) {
    return "";
  }

  return String(content);
}

function getMessageRole(message: {
  role?: string;
  type?: string;
  getType?: () => string;
}): string | undefined {
  if (typeof message.getType === "function") {
    return message.getType();
  }
  return message.role ?? message.type;
}

function getLatestUserQuery(
  messages: Array<{
    role?: string;
    type?: string;
    content?: unknown;
    getType?: () => string;
  }>,
): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const role = getMessageRole(messages[i]);
    if (role === "user" || role === "human") {
      return getMessageText(messages[i].content);
    }
  }

  if (messages.length === 0) {
    return "";
  }

  return getMessageText(messages[messages.length - 1].content);
}

function formatIdentityBlock(identity: LongTermMemoryMiddlewareIdentity): string {
  const lines = [
    "## Conversation context",
    `- User name: ${identity.userName || "Unknown"}`,
    `- Workspace: ${identity.workspaceName || "Unknown"}`,
    `- User company role: ${
      identity.companyRole
        ? `${identity.companyRole}${
            identity.companyRoleDetail
              ? ` (${identity.companyRoleDetail})`
              : ""
          }`
        : "Unknown"
    }`,
    `- Workspace membership role: ${identity.memberRole || "Unknown"}`,
  ];

  return `\n\n${lines.join("\n")}`;
}

function formatMemoriesForPrompt(memories: LongTermMemory[]): string {
  if (memories.length === 0) {
    return "";
  }

  const lines = memories.map((memory) => {
    const meta =
      memory.type === "episodic"
        ? memory.eventType
        : memory.type === "semantic" || memory.type === "procedural"
          ? memory.category
          : undefined;

    const importance =
      memory.importance != null ? ` importance=${memory.importance}` : "";
    const metaLabel = meta ? ` ${meta}` : "";

    return `- [${memory.type}${metaLabel}${importance}] ${memory.content}`;
  });

  return (
    `\n\n## Long-term memory\n\n` +
    `Use the following durable user/workspace memory when relevant:\n` +
    `${lines.join("\n")}`
  );
}

type PiiPhase = "input" | "output";

type PiiHit = { start: number; end: number; replacement: string };

function collectRegexHits(
  content: string,
  pattern: RegExp,
  replacement: (text: string) => string,
  predicate?: (text: string) => boolean,
): PiiHit[] {
  const hits: PiiHit[] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const text = match[0];
    if (predicate && !predicate(text)) continue;
    hits.push({
      start: match.index,
      end: match.index + text.length,
      replacement: replacement(text),
    });
  }
  return hits;
}

function applyHits(content: string, hits: PiiHit[]): string {
  let result = content;
  for (let i = hits.length - 1; i >= 0; i -= 1) {
    const hit = hits[i];
    result = result.slice(0, hit.start) + hit.replacement + result.slice(hit.end);
  }
  return result;
}

function isLikelySsn(text: string): boolean {
  const firstThree = parseInt(text.substring(0, 3), 10);
  return firstThree !== 0 && firstThree !== 666 && !(firstThree >= 900 && firstThree <= 999);
}

function luhnOk(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let even = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = parseInt(digits[i], 10);
    if (even) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    even = !even;
  }
  return sum % 10 === 0;
}

function redactPiiText(content: string, phase: PiiPhase): string {
  if (!content) return content;

  const apiKeyHits = collectRegexHits(
    content,
    /(?:sk-[a-zA-Z0-9]{20,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)/,
    () => "",
  );
  if (apiKeyHits.length > 0) {
    throw new PIIDetectionError("api_key", apiKeyHits.map((h) => ({ text: content.slice(h.start, h.end), start: h.start, end: h.end })));
  }

  const hits: PiiHit[] = [
    ...collectRegexHits(content, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, () => "[REDACTED_EMAIL]"),
    ...collectRegexHits(
      content,
      /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
      (text) => `****-****-****-${text.replace(/\D/g, "").slice(-4)}`,
      luhnOk,
    ),
    ...(phase === "input"
      ? [
          ...collectRegexHits(
            content,
            /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/,
            () => "[REDACTED_IP]",
          ),
          ...collectRegexHits(
            content,
            /\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b/,
            () => "[REDACTED_MAC_ADDRESS]",
          ),
          ...collectRegexHits(content, /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi, () => "[REDACTED_URL]"),
          ...collectRegexHits(
            content,
            /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/,
            (text) => `${"*".repeat(Math.max(0, text.length - 4))}${text.slice(-4)}`,
          ),
        ]
      : []),
    ...collectRegexHits(
      content,
      /\b\d{3}-\d{2}-\d{4}\b/,
      (text) => `<ssn_hash:${text.slice(-4)}>`,
      isLikelySsn,
    ),
  ];

  return applyHits(content, hits);
}

function redactContent(content: unknown, phase: PiiPhase): unknown {
  if (typeof content === "string") {
    return redactPiiText(content, phase);
  }
  if (Array.isArray(content)) {
    return content.map((block) => {
      if (typeof block === "string") return redactPiiText(block, phase);
      if (block && typeof block === "object" && "text" in block && typeof (block as { text: unknown }).text === "string") {
        return { ...block, text: redactPiiText((block as { text: string }).text, phase) };
      }
      return block;
    });
  }
  return content;
}

/**
 * One wrap-style PII pass. Built-in piiMiddleware uses beforeModel/afterModel
 * nodes — eight of those exhaust LangGraph's default recursionLimit of 25 on
 * the first tool call (load_skill).
 */
function createCombinedPiiMiddleware() {
  return createMiddleware({
    name: "combinedPiiMiddleware",
    wrapModelCall: async (request, handler) => {
      const messages = (request.messages ?? []).map((message) =>
        HumanMessage.isInstance(message)
          ? new HumanMessage({
              content: redactContent(message.content, "input") as HumanMessage["content"],
              id: message.id,
              name: message.name,
            })
          : message,
      );
      const response = await handler({ ...request, messages });
      if (!AIMessage.isInstance(response)) return response;
      return new AIMessage({
        content: redactContent(response.content, "output") as AIMessage["content"],
        id: response.id,
        name: response.name,
        tool_calls: response.tool_calls,
      });
    },
    wrapToolCall: async (request, handler) => {
      const result = await handler(request);
      if (result instanceof Command || !ToolMessage.isInstance(result)) {
        return result;
      }
      return new ToolMessage({
        content: redactContent(result.content, "input") as string,
        tool_call_id: result.tool_call_id,
        name: result.name,
        id: result.id,
      });
    },
  });
}

const piiMiddleware = createCombinedPiiMiddleware();

function createSummarizationMiddleware() {
  return summarizationMiddleware({
    model: createChatOpenAI({
      apiKey: env.orchestrator.openaiApiKey,
      model: AGENT_MODEL,
    }),
    trigger: { tokens: 4000 },
    keep: { messages: 20 },
  });
}

const skillStateSchema = z.object({
  loadedSkills: z.array(z.string()).default([]),
});

function skillsFromMessages(messages: unknown[] | undefined): string[] {
  const names = new Set<string>();
  for (const message of messages ?? []) {
    if (ToolMessage.isInstance(message)) {
      if (message.name === "load_skill") {
        const match = String(message.content).match(/^Loaded skill:\s+(\S+)/);
        if (match?.[1] && SKILLS.some((skill) => skill.name === match[1])) {
          names.add(match[1]);
        }
        continue;
      }
      const owner = findSkillOwningTool(message.name ?? "");
      if (owner) names.add(owner.name);
    }
    const toolCalls = (message as { tool_calls?: Array<{ name?: string }> }).tool_calls;
    if (!Array.isArray(toolCalls)) continue;
    for (const call of toolCalls) {
      const owner = findSkillOwningTool(typeof call.name === "string" ? call.name : "");
      if (owner) names.add(owner.name);
    }
  }
  return [...names];
}

function resolveLoadedSkills(state: { loadedSkills?: string[]; messages?: unknown[] }): string[] {
  return Array.from(new Set([...(state.loadedSkills ?? []), ...skillsFromMessages(state.messages)]));
}

/**
 * Progressive disclosure: only load_skill is always available.
 * Skill-owned tools unlock after load_skill updates loadedSkills.
 */
function sanitizeWritingHitlToolCalls(response: AIMessage): AIMessage {
  if (!response.tool_calls?.length) return response;
  const calls = response.tool_calls;
  const hasRequest = calls.some((call) => call.name === "writing_request_research");
  const hasConfirm = calls.some((call) => call.name === "writing_confirm_research");
  let next = hasRequest && hasConfirm
    ? calls.filter((call) => call.name !== "writing_confirm_research")
    : calls;
  const seenHitl = new Set<string>();
  next = next.filter((call) => {
    if (call.name !== "writing_request_research" && call.name !== "writing_confirm_research") {
      return true;
    }
    if (seenHitl.has(call.name)) return false;
    seenHitl.add(call.name);
    return true;
  });
  if (next.length === calls.length) return response;
  return new AIMessage({
    content: response.content,
    id: response.id,
    name: response.name,
    tool_calls: next,
  });
}

function createSkillMiddleware(args: {
  siteId: string;
  userId: string;
  threadId?: string;
  writingLoop?: boolean;
}) {
  const loadSkill = createLoadSkillTool();
  const allTools = [
    ...createStrategyTools(args),
    ...createCampaignTools(args),
    ...createResearchTools(args),
    ...createWritingTools(args),
    ...createBlogTools(args),
  ];
  const skillToolByName = new Map(
    allTools.map((t) => [t.name as string, t]),
  );

  const toolsForSkill = (skillName: string) => {
    const skill = SKILLS.find((s) => s.name === skillName);
    if (!skill) return [];
    return skill.toolNames
      .map((name) => skillToolByName.get(name))
      .filter((t): t is (typeof allTools)[number] => Boolean(t));
  };

  return createMiddleware({
    name: "skillMiddleware",
    stateSchema: skillStateSchema,
    tools: [loadSkill],
    wrapModelCall: async (request, handler) => {
      const loadedSkills = resolveLoadedSkills({
        loadedSkills: request.state.loadedSkills,
        messages: request.messages ?? request.state.messages,
      });
      if (args.writingLoop && !loadedSkills.includes("writing")) {
        loadedSkills.push("writing");
      }
      const unlocked = loadedSkills
        .flatMap((name) => toolsForSkill(name))
        .filter((tool) => !(args.writingLoop && tool.name === "research_run"));

      const writingSkill = args.writingLoop ? SKILLS.find((skill) => skill.name === "writing") : undefined;
      const writingPlaybook = writingSkill
        ? `\n\nLoaded skill: writing\n\n${writingSkill.content}\n\nUnlocked tools: ${writingSkill.toolNames.join(", ")}`
        : "";

      const skillsAddendum =
        `\n\n## Available Skills\n\n${skillsPrompt}\n\n` +
        "Use the load_skill tool when you need detailed information " +
        "about handling a specific type of request. Skill tools unlock only after load_skill." +
        writingPlaybook +
        (args.writingLoop
          ? "\n\nThis thread is the weekly writing loop. Do not call research_run. After you have a brief, call writing_request_research (HITL 1) only. After that tool returns the report, stop — the UI collects Continue (HITL 2). Do not call writing_confirm_research yourself."
          : "");

      const response = await handler({
        ...request,
        tools: [loadSkill, ...unlocked],
        systemPrompt: `${request.systemPrompt ?? ""}${skillsAddendum}`,
      });
      return AIMessage.isInstance(response) ? sanitizeWritingHitlToolCalls(response) : response;
    },
    wrapToolCall: async (request, handler) => {
      const toolName = request.toolCall.name;
      const toolCallId = request.toolCall.id ?? "";

      if (skillOwnedToolNames.has(toolName)) {
        // wrapModelCall already withholds locked tools from the model.
        // HITL resume must still execute an already-requested tool even if
        // summarization dropped the original load_skill message.
        const impl = skillToolByName.get(toolName);
        if (!impl) {
          return new ToolMessage({
            content: `Tool '${toolName}' is not registered for this skill.`,
            tool_call_id: toolCallId,
            name: toolName,
          });
        }
        return handler({ ...request, tool: impl });
      }

      if (toolName === "load_skill") {
        // Do not Command-update loadedSkills: parallel load_skill writes collide on LastValue.
        // wrapModelCall unlocks tools by reading "Loaded skill:" tool messages.
        return handler(request);
      }

      return handler(request);
    },
  });
}

const hitlReview = {
  allowedDecisions: ["approve", "edit", "reject"] as Array<
    "approve" | "edit" | "reject"
  >,
};

function createSkillHitlMiddleware(ctx: { siteId: string }) {
  return humanInTheLoopMiddleware({
    interruptOn: {
      strategy_update: {
        ...hitlReview,
        description: async (toolCall) =>
          formatStrategyUpdateDraft(
            (toolCall.args ?? {}) as Record<string, unknown>,
            ctx.siteId,
          ),
      },
      campaign_create: {
        ...hitlReview,
        description: (toolCall) =>
          formatCampaignCreateDraft(
            (toolCall.args ?? {}) as Record<string, unknown>,
          ),
      },
      campaign_update: {
        ...hitlReview,
        description: (toolCall) =>
          formatCampaignUpdateDraft(
            (toolCall.args ?? {}) as Record<string, unknown>,
          ),
      },
      campaign_schedule_additional_posts: {
        ...hitlReview,
        description: (toolCall) =>
          formatCampaignScheduleDraft(
            (toolCall.args ?? {}) as Record<string, unknown>,
          ),
      },
      writing_request_research: {
        ...hitlReview,
        description: (toolCall) =>
          formatWritingResearchDraft(
            (toolCall.args ?? {}) as Record<string, unknown>,
          ),
      },
      writing_confirm_research: {
        ...hitlReview,
        description: (toolCall) =>
          formatWritingConfirmResearchDraft(
            (toolCall.args ?? {}) as Record<string, unknown>,
          ),
      },
      blogs_publish: {
        ...hitlReview,
        description: (toolCall) =>
          formatBlogPublishDraft((toolCall.args ?? {}) as Record<string, unknown>),
      },
      blogs_unpublish: {
        ...hitlReview,
        description: (toolCall) =>
          formatBlogUnpublishDraft((toolCall.args ?? {}) as Record<string, unknown>),
      },
      blogs_schedule: {
        ...hitlReview,
        description: (toolCall) =>
          formatBlogScheduleDraft((toolCall.args ?? {}) as Record<string, unknown>),
      },
      blogs_unschedule: {
        ...hitlReview,
        description: (toolCall) =>
          formatBlogUnscheduleDraft((toolCall.args ?? {}) as Record<string, unknown>),
      },
    },
    descriptionPrefix: "Pending approval",
  });
}

function createLongTermMemoryMiddleware(
  identity: LongTermMemoryMiddlewareIdentity,
) {
  return createMiddleware({
    name: "longTermMemoryMiddleware",
    wrapModelCall: async (request, handler) => {
      const query = getLatestUserQuery(request.messages);
      const memories = query
        ? await memoryRepository.search(
            query,
            identity.userId,
            identity.siteId,
          )
        : [];

      const identityBlock = formatIdentityBlock(identity);
      const memoryAddendum = formatMemoriesForPrompt(memories);
      const newSystemPrompt = `${request.systemPrompt ?? ""}${identityBlock}${memoryAddendum}`;

      return handler({
        ...request,
        systemPrompt: newSystemPrompt,
      });
    },
    afterAgent: async (state) => {
      await memoryRepository.processMemoryData(
        { messages: state.messages },
        identity.userId,
        identity.siteId,
      );
      return;
    },
  });
}

export {
  createSkillMiddleware,
  createSkillHitlMiddleware,
  createLongTermMemoryMiddleware,
  createSummarizationMiddleware,
  piiMiddleware,
};
