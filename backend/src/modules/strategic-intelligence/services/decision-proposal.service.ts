import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import { StrategicDecisionEngineService, type StrategicDecision } from "./strategic-decision.service";
import { CampaignService } from "../../campaign/services/campaign.service";
import { CampaignPostItemRepository } from "../../campaign/repositories/campaign-post-item.repository";
import { CampaignPostItemStatus } from "../../../shared/constants/campaign.constant";
import { BadRequestError } from "../../../shared/errors";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";

export type DecisionProposalResult = {
  proposal_id: string;
  status: "pending_approval" | "applied" | "rejected";
  decision: StrategicDecision;
  draft_items?: Array<{
    id?: string;
    title: string;
    objective: string;
    narrative_phase?: string;
    auto_generate_prompt?: string;
  }>;
  message: string;
};

/**
 * Bridge Decision Engine → campaign planning (HITL).
 * plan_content / publish_awareness can create draft CampaignPostItems for human approval.
 */
@injectable()
export class DecisionProposalService {
  constructor(
    private readonly decisions: StrategicDecisionEngineService,
    private readonly campaigns: CampaignService,
    private readonly postItems: CampaignPostItemRepository
  ) {}

  async propose(
    siteId: string,
    userId: string,
    input: { kind: string; campaign_id?: string; accept?: boolean }
  ): Promise<DecisionProposalResult> {
    if (!env.orchestrator.strategicIntelligenceEnabled) {
      throw new BadRequestError("Strategic Intelligence is disabled");
    }

    const ranked = await this.decisions.proposeNext(siteId, userId, {
      campaignId: input.campaign_id,
      contentIntent: true,
    });
    const decision =
      ranked.decisions.find((d) => d.kind === input.kind) ?? (ranked.top?.kind === input.kind ? ranked.top : null);

    if (!decision) {
      throw new BadRequestError(`No decision of kind '${input.kind}' available`);
    }

    const proposalId = `sdp_${randomUUID()}`;

    if (decision.kind !== "plan_content" && decision.kind !== "publish_awareness") {
      return {
        proposal_id: proposalId,
        status: "pending_approval",
        decision: { ...decision, proposal_id: proposalId } as StrategicDecision & { proposal_id: string },
        message: `Decision '${decision.title}' recorded. Act on it in chat or the Strategy board — no auto-plan for this kind.`,
      };
    }

    const campaignId = decision.campaign_id ?? ranked.default_campaign_id;
    if (!campaignId) throw new BadRequestError("No campaign to attach planning proposal");

    const campaign = await this.campaigns.getCampaignById(campaignId, siteId);
    const phase = decision.kind === "publish_awareness" ? "awareness" : "consideration";
    const title =
      decision.kind === "publish_awareness"
        ? `Awareness: ${campaign.goal.slice(0, 80)}`
        : `Planned: next content for ${campaign.name}`;
    const objective = decision.rationale || `Advance campaign “${campaign.name}” toward: ${campaign.goal}`;
    const prompt = `Write a blog post supporting the campaign goal: ${campaign.goal}. Focus on ${phase}. Audience: ${campaign.target_audience || "workspace audience"}.`;

    const draft = {
      title,
      objective,
      narrative_phase: phase,
      auto_generate_prompt: prompt,
    };

    // accept=false → return draft for UI confirmation; accept=true → persist as planned item.
    if (!input.accept) {
      return {
        proposal_id: proposalId,
        status: "pending_approval",
        decision,
        draft_items: [draft],
        message: `Proposed 1 ${phase} post for campaign “${campaign.name}”. Review and approve in the campaign roadmap, or call again with accept=true.`,
      };
    }

    const existing = await this.postItems.findByCampaign(campaignId, siteId);
    const sequence_index = existing.length;
    const created = await this.postItems.create({
      campaign_id: campaignId,
      site_id: siteId,
      sequence_index,
      title: draft.title,
      objective: draft.objective,
      strategic_intent: decision.title,
      target_keywords: [],
      narrative_phase: phase,
      content_angle: decision.rationale,
      status: CampaignPostItemStatus.PLANNED,
      timezone: campaign.timezone || "UTC",
      generated_by: "ai",
      manually_added: false,
      locked: false,
      dependencies: [],
    });

    logger.info(
      "Decision proposal applied as campaign post item",
      { siteId, campaignId, itemId: created._id, kind: decision.kind },
      "DecisionProposalService"
    );

    return {
      proposal_id: proposalId,
      status: "applied",
      decision,
      draft_items: [
        {
          id: created._id?.toString(),
          title: created.title,
          objective: created.objective,
          narrative_phase: created.narrative_phase,
          auto_generate_prompt: prompt,
        },
      ],
      message: `Added planned post “${created.title}” to campaign “${campaign.name}”. Approve the roadmap / schedule before publish.`,
    };
  }
}
