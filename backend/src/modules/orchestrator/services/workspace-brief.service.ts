import { injectable } from "tsyringe";
import { BlogStatus } from "../../../shared/constants";
import { CampaignHealthStatus } from "../../../shared/constants/campaign.constant";
import { OrchestratorApprovalStatus } from "../../../shared/schemas/orchestrator-approval.schema";
import { WorkspaceMemoryRepository } from "../repositories/workspace-memory.repository";
import { OrchestratorApprovalRepository } from "../repositories/orchestrator-approval.repository";
import { WorkspaceStrategyRepository } from "../../strategic-intelligence/repositories/workspace-strategy.repository";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { BusinessKnowledgeService } from "../../strategic-intelligence/services/business-knowledge.service";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { listMissingRequiredOnboardingFields } from "../utils/onboarding-interview.helper";

export type WorkspaceBriefPriority =
  | "onboarding"
  | "approvals"
  | "drafts"
  | "campaign_risk"
  | "strategy_gap"
  | "welcome_back";

export type WorkspaceBrief = {
  text: string;
  chips: string[];
  priority: WorkspaceBriefPriority;
  opener_line: string;
};

const BRIEF_MAX_CHARS = 1200;
const CAMPAIGN_DIGEST_LIMIT = 5;
const DEADLINE_DAYS = 14;

/**
 * Builds a capped workspace brief for proactive openers and voice product-steer.
 * Template-based — no LLM.
 */
@injectable()
export class WorkspaceBriefService {
  constructor(
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly strategyRepository: WorkspaceStrategyRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly approvalRepository: OrchestratorApprovalRepository,
    private readonly knowledge: BusinessKnowledgeService,
    private readonly blogRepository: BlogRepository
  ) {}

  async buildBrief(siteId: string, userId: string): Promise<WorkspaceBrief> {
    const memory = await this.memoryRepository.ensureForSite(siteId, userId);
    const strategic = memory.strategic ?? {};

    const hotKeyParts: string[] = [];
    if (strategic.business_description?.trim()) {
      hotKeyParts.push(strategic.business_description.trim().slice(0, 160));
    } else if (strategic.business_type?.trim()) {
      hotKeyParts.push(strategic.business_type.trim().slice(0, 160));
    }
    if (strategic.business_model) hotKeyParts.push(`Model: ${strategic.business_model}`);
    if (strategic.target_audience?.length) {
      hotKeyParts.push(`Audience: ${strategic.target_audience.slice(0, 3).join(", ")}`);
    }
    if (strategic.brand_voice?.trim()) {
      hotKeyParts.push(`Voice: ${strategic.brand_voice.trim().slice(0, 80)}`);
    }
    if (strategic.business_goals?.length) {
      hotKeyParts.push(`Goals: ${strategic.business_goals.slice(0, 2).join("; ")}`);
    }
    const hotKeysSummary = hotKeyParts.join(" · ") || "Business profile still light.";

    const strategy = await this.strategyRepository.findActive(siteId);
    const strategyLine = strategy
      ? `Strategy: ${strategy.purpose.slice(0, 140)}${
          strategy.audience_summary?.trim() ? ` · Audience: ${strategy.audience_summary.slice(0, 80)}` : ""
        }`
      : "No active workspace strategy yet.";

    const campaignsPage = await this.campaignRepository.findAll(siteId, { limit: CAMPAIGN_DIGEST_LIMIT, page: 1 });
    const campaignDigest = campaignsPage.data
      .map((c) => {
        const goal = (c.goal || "").trim().slice(0, 60);
        const def = c.is_default ? " (default)" : "";
        return `${c.name}${def}${goal ? `: ${goal}` : ""}`;
      })
      .join("; ");

    const pendingApprovals = await this.approvalRepository.listForUser(siteId, userId, {
      status: OrchestratorApprovalStatus.PENDING,
      limit: 50,
    });
    const pendingApprovalCount = pendingApprovals.length;

    const draftCount = await this.blogRepository.countBySiteAndStatus(siteId, BlogStatus.DRAFT);

    let topGapQuestion: string | undefined;
    try {
      const gaps = await this.knowledge.listGaps(siteId);
      topGapQuestion = gaps[0]?.question;
    } catch {
      topGapQuestion = undefined;
    }

    const missingOnboarding = listMissingRequiredOnboardingFields(memory);
    const now = Date.now();
    const deadlineMs = DEADLINE_DAYS * 24 * 60 * 60 * 1000;
    const campaignRisk = campaignsPage.data.find((c) => {
      const atRisk =
        c.health_status === CampaignHealthStatus.AT_RISK || c.health_status === CampaignHealthStatus.UNDERPERFORMING;
      const endingSoon =
        c.end_date instanceof Date &&
        c.end_date.getTime() > now &&
        c.end_date.getTime() - now <= deadlineMs &&
        !c.is_default;
      return atRisk || endingSoon;
    });

    const chips: string[] = [];
    if (missingOnboarding.length) chips.push("Finish brand setup");
    if (pendingApprovalCount > 0)
      chips.push(`Review ${pendingApprovalCount} approval${pendingApprovalCount === 1 ? "" : "s"}`);
    if (draftCount > 0) chips.push(`Review ${draftCount} draft${draftCount === 1 ? "" : "s"}`);
    if (campaignRisk) chips.push(`Check ${campaignRisk.name}`);
    if (topGapQuestion) chips.push("Fill a knowledge gap");
    if (chips.length === 0) chips.push("Plan next post", "Review strategy");

    let priority: WorkspaceBriefPriority = "welcome_back";
    let opener_line: string;

    if (missingOnboarding.length > 0) {
      priority = "onboarding";
      opener_line = "Welcome back — a few brand-setup answers are still open. Want to finish those together?";
    } else if (pendingApprovalCount > 0) {
      priority = "approvals";
      opener_line =
        pendingApprovalCount === 1
          ? "You've got one approval waiting — want to review it now?"
          : `You've got ${pendingApprovalCount} approvals waiting — want to knock those out?`;
    } else if (draftCount > 0) {
      priority = "drafts";
      opener_line =
        draftCount === 1
          ? "There's a draft waiting for your review — want to look at it?"
          : `You've got ${draftCount} drafts waiting for review — which should we open first?`;
    } else if (campaignRisk) {
      priority = "campaign_risk";
      opener_line = `${campaignRisk.name} needs attention soon — want a quick status check?`;
    } else if (topGapQuestion || !strategy) {
      priority = "strategy_gap";
      opener_line = topGapQuestion
        ? `One quick gap before we plan content: ${topGapQuestion.replace(/\?$/, "")}?`
        : "We don't have a clear workspace strategy yet — want to set direction before drafting?";
    } else {
      priority = "welcome_back";
      const audienceHint = strategic.target_audience?.[0];
      opener_line = audienceHint
        ? `Welcome back — ready to plan the next piece for ${audienceHint}?`
        : "Welcome back — what should we focus on for your content today?";
    }

    const textParts = [
      hotKeysSummary,
      strategyLine,
      campaignDigest ? `Campaigns: ${campaignDigest}` : "Campaigns: none yet.",
      `Pending approvals: ${pendingApprovalCount}. Drafts: ${draftCount}.`,
      topGapQuestion ? `Top knowledge gap: ${topGapQuestion}` : null,
    ].filter(Boolean) as string[];

    let text = textParts.join("\n");
    if (text.length > BRIEF_MAX_CHARS) {
      text = `${text.slice(0, BRIEF_MAX_CHARS - 1).trim()}…`;
    }

    return { text, chips: chips.slice(0, 4), priority, opener_line };
  }
}
