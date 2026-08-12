import { tool } from "langchain";
import { z } from "zod";
import { container } from "tsyringe";
import { WorkspaceStrategyService } from "../strategic-intelligence/services/workspace-strategy.service";
import type { WorkspaceStrategy } from "../strategic-intelligence/repositories/workspace-strategy.repository";

const strategyUpdateSchema = z.object({
  purpose: z.string().min(1).max(2000).optional(),
  long_term_outcomes: z.array(z.string()).optional(),
  principles: z.array(z.string()).optional(),
  audience_summary: z.string().max(2000).optional(),
  perception_goals: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

export type StrategyUpdateArgs = z.infer<typeof strategyUpdateSchema>;

export type StrategyToolContext = {
  siteId: string;
  userId: string;
};

function truncate(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatStrategySummary(strategy: WorkspaceStrategy): string {
  const outcomes = (strategy.long_term_outcomes ?? []).slice(0, 3).join("; ");
  const principles = (strategy.principles ?? []).slice(0, 3).join("; ");
  return [
    `Workspace strategy v${strategy.version}`,
    `Purpose: ${truncate(strategy.purpose || "(empty)")}`,
    `Audience: ${truncate(strategy.audience_summary || "(empty)")}`,
    outcomes ? `Outcomes: ${truncate(outcomes)}` : null,
    principles ? `Principles: ${truncate(principles)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatStrategyUpdateDraft(args: Record<string, unknown>): string {
  const lines = ["Proposed workspace strategy update:"];
  const fields: Array<[string, unknown]> = [
    ["purpose", args.purpose],
    ["audience_summary", args.audience_summary],
    ["long_term_outcomes", args.long_term_outcomes],
    ["principles", args.principles],
    ["perception_goals", args.perception_goals],
    ["constraints", args.constraints],
  ];
  for (const [key, value] of fields) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`- ${key}: ${value.map(String).join("; ")}`);
    } else if (typeof value === "string" && value.trim()) {
      lines.push(`- ${key}: ${value.trim()}`);
    }
  }
  if (lines.length === 1) {
    lines.push("- (no field changes detected)");
  }
  lines.push("", "Approve to apply, or reject to keep the current strategy.");
  return lines.join("\n");
}

/**
 * Strategy tools owned by the workspace_strategy skill.
 * Not registered as peer tools on createAgent — unlocked via skill middleware.
 */
export function createStrategyTools(ctx: StrategyToolContext) {
  const strategies = container.resolve(WorkspaceStrategyService);

  const strategy_get = tool(
    async () => {
      const strategy = await strategies.ensureStrategy(ctx.siteId, ctx.userId);
      return formatStrategySummary(strategy);
    },
    {
      name: "strategy_get",
      description:
        "Read the active long-term WorkspaceStrategy for this workspace. Returns a compact summary for you — paraphrase for the user; never dump raw payloads.",
      schema: z.object({}),
    },
  );

  const strategy_update = tool(
    async (input: StrategyUpdateArgs) => {
      const parsed = strategyUpdateSchema.parse(input);
      const strategy = await strategies.update(ctx.siteId, ctx.userId, parsed);
      return `Updated workspace strategy to v${strategy.version}. ${formatStrategySummary(strategy)}`;
    },
    {
      name: "strategy_update",
      description:
        "Patch WorkspaceStrategy fields (purpose, audience_summary, long_term_outcomes, principles, perception_goals, constraints). Requires human approval. Show a before→after draft in chat before calling.",
      schema: strategyUpdateSchema,
    },
  );

  return [strategy_get, strategy_update] as const;
}
