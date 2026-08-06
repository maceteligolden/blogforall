import { injectable } from "tsyringe";
import { BusinessKnowledgeService } from "./business-knowledge.service";
import { CampaignIntelligenceService } from "./campaign-intelligence.service";
import { CampaignService } from "../../campaign/services/campaign.service";
import { WorkspaceStrategyService } from "./workspace-strategy.service";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { env } from "../../../shared/config/env";

export type StrategicActionKind =
  | "gather_knowledge"
  | "publish_awareness"
  | "improve_conversion"
  | "clarify_campaign"
  | "plan_content"
  | "refine_strategy"
  | "launch_campaign"
  | "continue_cadence";

export type StrategicDecision = {
  kind: StrategicActionKind;
  title: string;
  rationale: string;
  score: number;
  campaign_id?: string;
  knowledge_key?: string;
  question?: string;
  proposal_id?: string;
};

export type StrategicDecisionResult = {
  decisions: StrategicDecision[];
  strategy_id?: string;
  default_campaign_id?: string;
  top: StrategicDecision | null;
};

@injectable()
export class StrategicDecisionEngineService {
  constructor(
    private readonly knowledge: BusinessKnowledgeService,
    private readonly intelligence: CampaignIntelligenceService,
    private readonly campaigns: CampaignService,
    private readonly strategies: WorkspaceStrategyService,
    private readonly campaignRepository: CampaignRepository
  ) {}

  async proposeNext(
    siteId: string,
    userId: string,
    opts?: { campaignId?: string; contentIntent?: boolean; quickDraft?: boolean }
  ): Promise<StrategicDecisionResult> {
    if (!env.orchestrator.strategicIntelligenceEnabled) {
      return { decisions: [], top: null };
    }

    const strategy = await this.strategies.ensureStrategy(siteId, userId);
    const def = await this.campaigns.ensureDefaultCampaign(siteId, userId);
    const campaignId = opts?.campaignId ?? def._id!.toString();
    const intel = await this.intelligence.recompute(campaignId, siteId);
    const gaps = await this.knowledge.listGaps(siteId);
    // Engagement / health signal from campaign intelligence dimensions (T6.1).
    const engagementBoost = (intel.dimensions?.overall_confidence ?? 0) > 0.6 ? 0.08 : 0;

    const decisions: StrategicDecision[] = [];

    if (opts?.contentIntent && !opts?.campaignId && !opts?.quickDraft) {
      const others = (await this.campaignRepository.findAll(siteId, { limit: 20 })).data.filter(
        (c) => !c.is_default && c._id!.toString() !== campaignId
      );
      if (others.length > 0) {
        decisions.push({
          kind: "clarify_campaign",
          title: "Confirm which campaign this content supports",
          rationale:
            "Multiple campaigns exist. Align this request to Default, an existing campaign, or create a new one.",
          score: 0.95,
          campaign_id: campaignId,
        });
      }
    }

    const topGap = gaps[0];
    if (topGap && topGap.strategic_value >= 0.45) {
      decisions.push({
        kind: "gather_knowledge",
        title: "Gather high-value business knowledge",
        rationale: `Low confidence on ${topGap.key} (value ${topGap.strategic_value.toFixed(2)})`,
        score: 0.5 + topGap.strategic_value * 0.4,
        knowledge_key: topGap.key,
        question: topGap.question,
        campaign_id: campaignId,
      });
    }

    if (intel.funnel_coverage.awareness < 0.25) {
      decisions.push({
        kind: "publish_awareness",
        title: "Publish another awareness article",
        rationale: "Funnel coverage is thin at awareness",
        score: 0.72 + engagementBoost,
        campaign_id: campaignId,
      });
    }

    if (intel.funnel_coverage.conversion < 0.2 || intel.dimensions.conversion_readiness < 0.5) {
      decisions.push({
        kind: "improve_conversion",
        title: "Improve conversion messaging",
        rationale: "Conversion readiness is below target",
        score: 0.7,
        campaign_id: campaignId,
      });
    }

    if ((strategy.confidence_summary ?? 0) < 0.5) {
      decisions.push({
        kind: "refine_strategy",
        title: "Refine the workspace strategy",
        rationale: "Strategy confidence is low; clarify outcomes and principles",
        score: 0.68,
      });
    }

    decisions.push({
      kind: "plan_content",
      title: "Plan and generate campaign content",
      rationale: "Content generation remains a valid next step under the resolved campaign",
      score: (opts?.contentIntent ? 0.8 : 0.55) + engagementBoost * 0.5,
      campaign_id: campaignId,
    });

    decisions.push({
      kind: "continue_cadence",
      title: "Continue the publishing cadence",
      rationale: intel.recommended_actions[0] ?? "Stay on the campaign timeline",
      score: 0.5,
      campaign_id: campaignId,
    });

    decisions.sort((a, b) => b.score - a.score);

    return {
      decisions: decisions.slice(0, 6),
      strategy_id: strategy._id?.toString(),
      default_campaign_id: def._id!.toString(),
      top: decisions[0] ?? null,
    };
  }
}
