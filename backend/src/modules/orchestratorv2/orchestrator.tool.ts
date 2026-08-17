import { tool } from "langchain";
import { z } from "zod";
import { container } from "tsyringe";
import { WorkspaceStrategyService } from "../strategic-intelligence/services/workspace-strategy.service";
import type { WorkspaceStrategy } from "../strategic-intelligence/repositories/workspace-strategy.repository";
import {
  formatContentStrategyDiff,
  formatContentStrategyForPrompt,
  mergeContentStrategyDocument,
  parseContentStrategyDocument,
  type ContentStrategyDocument,
} from "../../shared/types/content-strategy.document";

const strategyUpdateSchema = z.object({
  purpose: z.string().min(1).max(2000).optional(),
  long_term_outcomes: z.array(z.string()).optional(),
  principles: z.array(z.string()).optional(),
  audience_summary: z.string().max(2000).optional(),
  perception_goals: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
  document: z.record(z.string(), z.unknown()).optional(),
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
  const doc = parseContentStrategyDocument(strategy.document);
  const northStar = doc.north_star.what_we_are || strategy.purpose;
  return [
    `Content Strategy v${strategy.version} (${strategy.generation_status ?? "ready"})`,
    `North star: ${truncate(northStar || "(empty)")}`,
    `Audience: ${truncate(doc.audience.primary.who || strategy.audience_summary || "(empty)")}`,
    doc.positioning.statement ? `Positioning: ${truncate(doc.positioning.statement)}` : null,
    doc.conversion.primary_cta ? `Primary CTA: ${truncate(doc.conversion.primary_cta)}` : null,
    doc.content_franchise.pillars.length
      ? `Pillars: ${truncate(doc.content_franchise.pillars.map((p) => p.name).join(", "))}`
      : null,
    "",
    formatContentStrategyForPrompt(doc),
  ]
    .filter((line) => line != null)
    .join("\n");
}

function proposedDocumentFromArgs(
  current: ContentStrategyDocument,
  args: Record<string, unknown>
): ContentStrategyDocument {
  let next = current;
  if (args.document && typeof args.document === "object") {
    next = mergeContentStrategyDocument(next, args.document as Partial<ContentStrategyDocument>);
  }
  if (typeof args.purpose === "string" && args.purpose.trim()) {
    next = mergeContentStrategyDocument(next, { north_star: { ...next.north_star, what_we_are: args.purpose } });
  }
  if (typeof args.audience_summary === "string" && args.audience_summary.trim()) {
    next = mergeContentStrategyDocument(next, {
      audience: { ...next.audience, primary: { ...next.audience.primary, who: args.audience_summary } },
    });
  }
  if (Array.isArray(args.constraints) && args.constraints.length) {
    next = mergeContentStrategyDocument(next, {
      guardrails: { ...next.guardrails, always: args.constraints as string[] },
    });
  }
  return parseContentStrategyDocument(next);
}

export async function formatStrategyUpdateDraft(
  args: Record<string, unknown>,
  siteId?: string
): Promise<string> {
  if (!siteId) {
    return "Proposed Content Strategy update. Approve to apply, or reject to keep the current strategy.";
  }
  const strategies = container.resolve(WorkspaceStrategyService);
  const current = await strategies.getActive(siteId);
  const before = parseContentStrategyDocument(current?.document);
  const after = proposedDocumentFromArgs(before, args);
  return formatContentStrategyDiff(before, after);
}

/**
 * Strategy tools owned by the content_strategy skill.
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
        "Read the active Content Strategy for this workspace (editorial constitution). Returns a compact summary for you — paraphrase for the user; never dump raw payloads.",
      schema: z.object({}),
    }
  );

  const strategy_update = tool(
    async (input: StrategyUpdateArgs) => {
      const parsed = strategyUpdateSchema.parse(input);
      const strategy = await strategies.update(ctx.siteId, ctx.userId, parsed);
      return `Updated Content Strategy to v${strategy.version}. ${formatStrategySummary(strategy)}`;
    },
    {
      name: "strategy_update",
      description:
        "Patch Content Strategy fields (document sections: north_star, audience, positioning, narrative, pillars, voice, conversion, guardrails). Requires human approval. Call this whenever the user states a durable fact — do not wait for them to say 'update the strategy'.",
      schema: strategyUpdateSchema,
    }
  );

  return [strategy_get, strategy_update] as const;
}
