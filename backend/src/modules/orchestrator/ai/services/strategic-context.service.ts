import { injectable } from "tsyringe";
import { CampaignService } from "../../../campaign/services/campaign.service";
import { CampaignRepository } from "../../../campaign/repositories/campaign.repository";
import { WorkspaceStrategyService } from "../../../strategic-intelligence/services/workspace-strategy.service";
import { BusinessKnowledgeService } from "../../../strategic-intelligence/services/business-knowledge.service";
import { CampaignIntelligenceService } from "../../../strategic-intelligence/services/campaign-intelligence.service";
import type { StrategicContextLoader, StrategicContextResult } from "../strategic-context";
import { env } from "../../../../shared/config/env";

@injectable()
export class StrategicContextService implements StrategicContextLoader {
  constructor(
    private readonly campaigns: CampaignService,
    private readonly campaignRepository: CampaignRepository,
    private readonly strategies: WorkspaceStrategyService,
    private readonly knowledge: BusinessKnowledgeService,
    private readonly intelligence: CampaignIntelligenceService
  ) {}

  async load(workspaceId: string, userId: string, campaignId?: string): Promise<StrategicContextResult> {
    if (!env.orchestrator.strategicIntelligenceEnabled) {
      return { metadata: {} };
    }

    const strategy = await this.strategies.ensureStrategy(workspaceId, userId);
    const def = await this.campaigns.ensureDefaultCampaign(workspaceId, userId);
    const resolvedCampaignId = campaignId ?? def._id!.toString();

    const [gaps, others, intel] = await Promise.all([
      this.knowledge.listGaps(workspaceId),
      this.campaignRepository.findAll(workspaceId, { limit: 20 }),
      this.intelligence.get(resolvedCampaignId, workspaceId).catch(() => null),
    ]);

    const nonDefault = others.data.filter((c) => !c.is_default);
    const topGap = gaps[0];
    const strategic_top_gap_question = topGap && topGap.strategic_value >= 0.85 ? topGap.question : undefined;

    const prompt_suffix = [
      "[WORKSPACE STRATEGY]",
      `Purpose: ${strategy.purpose}`,
      `Audience: ${strategy.audience_summary}`,
      `Outcomes: ${strategy.long_term_outcomes.join("; ") || "n/a"}`,
      `Confidence: ${Math.round((strategy.confidence_summary ?? 0) * 100)}%`,
      "",
      "[CAMPAIGN]",
      `Active campaign_id: ${resolvedCampaignId}${campaignId ? "" : " (Default/Evergreen)"}`,
      intel
        ? `Intelligence: success_probability=${intel.success_probability}; next=${intel.recommended_actions[0] ?? "n/a"}`
        : "",
      topGap ? `Top knowledge gap: ${topGap.key} — ${topGap.question}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const campaign = others.data.find((c) => c._id?.toString() === resolvedCampaignId) ?? def;

    return {
      campaign_id: resolvedCampaignId,
      strategy_id: strategy._id?.toString(),
      prompt_suffix,
      metadata: {
        strategy_id: strategy._id?.toString(),
        strategy_purpose: strategy.purpose,
        campaign_name: campaign.name,
        campaign_goal: campaign.goal,
        default_campaign_id: def._id!.toString(),
        needs_campaign_clarify: !campaignId && nonDefault.length > 0,
        strategic_top_gap_question,
        strategic_gap_asked: false,
        campaign_clarify_asked: false,
      },
    };
  }
}
