import { injectable } from "tsyringe";
import { z } from "zod";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";
import { StrategyEngineService } from "../../../memory/services/strategy-engine.service";
import { WorkspaceStrategyService } from "../../../strategic-intelligence/services/workspace-strategy.service";
import { BusinessKnowledgeService } from "../../../strategic-intelligence/services/business-knowledge.service";
import { StrategicDecisionEngineService } from "../../../strategic-intelligence/services/strategic-decision.service";
import { BUSINESS_KNOWLEDGE_KEYS } from "../../../strategic-intelligence/constants/business-knowledge.keys";
import type { BusinessKnowledgeKey } from "../../../strategic-intelligence/constants/business-knowledge.keys";

const proposeCalendarSchema = z.object({
  horizon_weeks: z.number().min(1).max(12).optional(),
});

@injectable()
export class StrategyProposeCalendarTool implements OrchestratorTool {
  name = "strategy.proposeCalendar";
  description =
    "Generate a content strategy with themed ideas and a proposed posting calendar for the workspace. Use in strategy or planning mode.";
  requiresConfirmation = false;

  constructor(private readonly strategyEngine: StrategyEngineService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(proposeCalendarSchema, invocation.input, this.name);
    const result = await this.strategyEngine.generateStrategy(invocation.siteId, invocation.userId, {
      horizonWeeks: input.horizon_weeks,
    });
    return {
      summary: truncateSummary(
        `Generated ${result.ideas.length} ideas and ${result.calendar.length} calendar slots over ${result.horizon_weeks} weeks.`
      ),
      data: result,
    };
  }
}

@injectable()
export class StrategyGetTool implements OrchestratorTool {
  name = "strategy.get";
  description = "Get the active long-term WorkspaceStrategy (business direction) for this workspace.";
  requiresConfirmation = false;

  constructor(private readonly strategies: WorkspaceStrategyService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const strategy = await this.strategies.ensureStrategy(invocation.siteId, invocation.userId);
    return {
      summary: truncateSummary(`Workspace strategy v${strategy.version}: ${strategy.purpose.slice(0, 120)}`),
      data: strategy,
    };
  }
}

const strategyUpdateSchema = z.object({
  purpose: z.string().min(1).max(2000).optional(),
  long_term_outcomes: z.array(z.string()).optional(),
  principles: z.array(z.string()).optional(),
  audience_summary: z.string().max(2000).optional(),
  perception_goals: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

@injectable()
export class StrategyUpdateTool implements OrchestratorTool {
  name = "strategy.update";
  description = "Update the active WorkspaceStrategy fields (purpose, outcomes, principles, audience).";
  requiresConfirmation = true;

  constructor(private readonly strategies: WorkspaceStrategyService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(strategyUpdateSchema, invocation.input, this.name);
    const strategy = await this.strategies.update(invocation.siteId, invocation.userId, input);
    return {
      summary: truncateSummary(`Updated workspace strategy v${strategy.version}`),
      data: strategy,
    };
  }
}

@injectable()
export class KnowledgeListGapsTool implements OrchestratorTool {
  name = "knowledge.listGaps";
  description = "List prioritized business knowledge gaps with suggested questions.";
  requiresConfirmation = false;

  constructor(private readonly knowledge: BusinessKnowledgeService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const gaps = await this.knowledge.listGaps(invocation.siteId);
    return {
      summary: truncateSummary(`${gaps.length} knowledge gap(s); top: ${gaps[0]?.key ?? "none"}`),
      data: { gaps: gaps.slice(0, 10) },
    };
  }
}

const knowledgeUpsertSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  confidence: z.number().min(0).max(1).optional(),
});

@injectable()
export class KnowledgeUpsertTool implements OrchestratorTool {
  name = "knowledge.upsert";
  description = "Create or update a business knowledge belief by canonical key (e.g. business.usp).";
  requiresConfirmation = false;

  constructor(private readonly knowledge: BusinessKnowledgeService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(knowledgeUpsertSchema, invocation.input, this.name);
    if (
      !BUSINESS_KNOWLEDGE_KEYS.includes(input.key as BusinessKnowledgeKey) &&
      !input.key.startsWith("business.")
    ) {
      throw new Error("Unknown knowledge key");
    }
    const belief = await this.knowledge.upsertBelief(
      invocation.siteId,
      invocation.userId,
      input.key,
      input.value,
      { confidence: input.confidence ?? 0.75, source: "conversation" }
    );
    return {
      summary: truncateSummary(`Saved knowledge ${input.key} (confidence ${belief.metadata.confidence})`),
      data: belief,
    };
  }
}

const decisionsSchema = z.object({
  campaign_id: z.string().optional(),
});

@injectable()
export class DecisionsProposeTool implements OrchestratorTool {
  name = "decisions.propose";
  description =
    "Propose the highest-value next strategic actions (gather knowledge, publish, refine strategy, etc.).";
  requiresConfirmation = false;

  constructor(private readonly decisions: StrategicDecisionEngineService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(decisionsSchema, invocation.input ?? {}, this.name);
    const result = await this.decisions.proposeNext(invocation.siteId, invocation.userId, {
      campaignId: input.campaign_id,
    });
    const top = result.top;
    return {
      summary: truncateSummary(
        top ? `Top action: ${top.title} (score ${top.score.toFixed(2)})` : "No strategic actions"
      ),
      data: result,
    };
  }
}
