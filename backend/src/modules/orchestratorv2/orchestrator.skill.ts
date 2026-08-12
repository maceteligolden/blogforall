import { tool } from "langchain";
import { z } from "zod";
import type { Skill } from "./orchestrator.validation";

const WORKSPACE_STRATEGY_PLAYBOOK = `# Workspace Strategy

You help the user shape the long-term WorkspaceStrategy for this brand:
purpose, audience, outcomes, principles, perception goals, and constraints.

## Modes

- **Casual brainstorm**: Explore ideas conversationally. Ask clarifying questions.
  Do not call strategy_update until the user wants a lasting change.
- **Strategy work**: Read the current strategy with strategy_get when needed,
  propose concrete edits, and only then prepare a write.

## Draft-before-write (required)

Before calling strategy_update you MUST:
1. Call strategy_get if you do not already have the current fields.
2. Show the user a plain-language **before → after** draft of the fields you
   intend to change (not raw JSON / tool payloads).
3. Only then call strategy_update with the patched fields.

strategy_update pauses for human approval. The user will approve or reject
in the UI. Do not pretend the write already happened.

## Voice

- Sound like a senior strategist in chat — warm, concise, decisive.
- Never dump raw API responses, tool names, schemas, or JSON at the user.
- Summarize tool results in natural language.
- Ask one question at a time when you need more signal.
- Always leave a clear next step.

## Tools (unlocked with this skill)

- strategy_get — read the active workspace strategy (summary for you).
- strategy_update — patch strategy fields (HITL-gated; draft first).
`;

const SKILLS: Skill[] = [
  {
    name: "workspace_strategy",
    description:
      "Long-term workspace strategy: brainstorm direction, read the active strategy, and propose durable updates (purpose, audience, outcomes, principles) with human approval before writes.",
    content: WORKSPACE_STRATEGY_PLAYBOOK,
    toolNames: ["strategy_get", "strategy_update"],
  },
];

function createLoadSkillTool() {
  return tool(
    ({ skillName }: { skillName: string }) => {
      const skill = SKILLS.find((s) => s.name === skillName);
      if (skill) {
        const toolsLine =
          skill.toolNames.length > 0
            ? `\n\nUnlocked tools: ${skill.toolNames.join(", ")}`
            : "";
        return `Loaded skill: ${skillName}\n\n${skill.content}${toolsLine}`;
      }
      const available = SKILLS.map((s) => s.name).join(", ");
      return `Skill '${skillName}' not found. Available skills: ${available}`;
    },
    {
      name: "load_skill",
      description: `Load the full content of a skill into the agent's context.
Use this when you need detailed information about how to handle a specific
type of request. This unlocks that skill's tools for the rest of the turn.`,
      schema: z.object({
        skillName: z.string(),
      }),
    },
  );
}

function findSkillOwningTool(toolName: string): Skill | undefined {
  return SKILLS.find((skill) => skill.toolNames.includes(toolName));
}

export { SKILLS, createLoadSkillTool, findSkillOwningTool };
