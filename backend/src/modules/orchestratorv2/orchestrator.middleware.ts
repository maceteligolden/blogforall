import {
  createMiddleware,
  humanInTheLoopMiddleware,
  piiMiddleware,
  summarizationMiddleware,
  ToolMessage,
  type PIIMatch,
} from "langchain";
import { Command } from "@langchain/langgraph";
import { z } from "zod";
import { container } from "tsyringe";
import {
  createLoadSkillTool,
  findSkillOwningTool,
  SKILLS,
} from "./orchestrator.skill";
import {
  createStrategyTools,
  formatStrategyUpdateDraft,
} from "./orchestrator.tool";
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

function detectSsn(content: string): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const pattern = /\b\d{3}-\d{2}-\d{4}\b/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content)) !== null) {
    const ssn = match[0];
    const firstThree = parseInt(ssn.substring(0, 3), 10);
    if (
      firstThree !== 0 &&
      firstThree !== 666 &&
      !(firstThree >= 900 && firstThree <= 999)
    ) {
      matches.push({
        text: ssn,
        start: match.index,
        end: match.index + ssn.length,
      });
    }
  }

  return matches;
}

const piiMiddlewares = [
  piiMiddleware("email", {
    strategy: "redact",
    applyToInput: true,
  }),
  piiMiddleware("credit_card", {
    strategy: "mask",
    applyToInput: true,
    applyToOutput: true,
  }),
  piiMiddleware("ip", {
    strategy: "redact",
    applyToInput: true,
  }),
  piiMiddleware("mac_address", {
    strategy: "redact",
    applyToInput: true,
  }),
  piiMiddleware("url", {
    strategy: "redact",
    applyToInput: true,
    applyToOutput: false,
  }),
  piiMiddleware("phone_number", {
    detector: /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{4}/,
    strategy: "mask",
    applyToInput: true,
  }),
  piiMiddleware("ssn", {
    detector: detectSsn,
    strategy: "hash",
    applyToInput: true,
    applyToOutput: true,
  }),
  piiMiddleware("api_key", {
    detector: /(?:sk-[a-zA-Z0-9]{20,}|Bearer\s+[A-Za-z0-9\-._~+/]+=*)/,
    strategy: "block",
    applyToInput: true,
    applyToOutput: true,
  }),
];

const summarizationMw = summarizationMiddleware({
  model: AGENT_MODEL,
  trigger: { tokens: 4000 },
  keep: { messages: 20 },
});

const skillStateSchema = z.object({
  loadedSkills: z.array(z.string()).default([]),
});

/**
 * Progressive disclosure: only load_skill is always available.
 * Skill-owned tools (e.g. strategy_*) unlock after load_skill updates loadedSkills.
 */
function createSkillMiddleware(args: { siteId: string; userId: string }) {
  const loadSkill = createLoadSkillTool();
  const strategyTools = createStrategyTools(args);
  const skillToolByName = new Map(
    strategyTools.map((t) => [t.name as string, t]),
  );

  const toolsForSkill = (skillName: string) => {
    const skill = SKILLS.find((s) => s.name === skillName);
    if (!skill) return [];
    return skill.toolNames
      .map((name) => skillToolByName.get(name))
      .filter((t): t is (typeof strategyTools)[number] => Boolean(t));
  };

  return createMiddleware({
    name: "skillMiddleware",
    stateSchema: skillStateSchema,
    tools: [loadSkill],
    wrapModelCall: async (request, handler) => {
      const loadedSkills: string[] = request.state.loadedSkills ?? [];
      const unlocked = loadedSkills.flatMap((name) => toolsForSkill(name));

      const skillsAddendum =
        `\n\n## Available Skills\n\n${skillsPrompt}\n\n` +
        "Use the load_skill tool when you need detailed information " +
        "about handling a specific type of request. Skill tools unlock only after load_skill.";

      return handler({
        ...request,
        tools: [loadSkill, ...unlocked],
        systemPrompt: `${request.systemPrompt ?? ""}${skillsAddendum}`,
      });
    },
    wrapToolCall: async (request, handler) => {
      const toolName = request.toolCall.name;
      const toolCallId = request.toolCall.id ?? "";

      if (skillOwnedToolNames.has(toolName)) {
        const owner = findSkillOwningTool(toolName);
        const loaded: string[] = request.state.loadedSkills ?? [];
        if (!owner || !loaded.includes(owner.name)) {
          return new ToolMessage({
            content:
              `Tool '${toolName}' is locked. ` +
              `Call load_skill with skillName='${owner?.name ?? "workspace_strategy"}' first.`,
            tool_call_id: toolCallId,
            name: toolName,
          });
        }
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
        const result = await handler(request);
        const skillName = String(request.toolCall.args?.skillName ?? "");
        const skill = SKILLS.find((s) => s.name === skillName);
        if (!skill || !ToolMessage.isInstance(result)) {
          return result;
        }
        const prev: string[] = request.state.loadedSkills ?? [];
        const next = prev.includes(skillName) ? prev : [...prev, skillName];
        return new Command({
          update: {
            loadedSkills: next,
            messages: [result],
          },
        });
      }

      return handler(request);
    },
  });
}

function createStrategyHitlMiddleware() {
  return humanInTheLoopMiddleware({
    interruptOn: {
      strategy_update: {
        allowedDecisions: ["approve", "edit", "reject"],
        description: (toolCall) =>
          formatStrategyUpdateDraft(
            (toolCall.args ?? {}) as Record<string, unknown>,
          ),
      },
    },
    descriptionPrefix: "Strategy update pending approval",
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
  createStrategyHitlMiddleware,
  createLongTermMemoryMiddleware,
  piiMiddlewares,
  summarizationMw,
};
