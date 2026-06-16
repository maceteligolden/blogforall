import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignPostItemRepository } from "../repositories/campaign-post-item.repository";
import { CampaignProgressReportRepository } from "../repositories/campaign-progress-report.repository";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";
import { CampaignHealthService } from "./campaign-health.service";
import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { NotFoundError } from "../../../shared/errors";
import {
  CampaignLifecycleStatus,
  CampaignPostItemStatus,
  CampaignEventType,
  ScheduledPostStatus,
} from "../../../shared/constants/campaign.constant";
import type { CampaignProgressReport } from "../../../shared/schemas/campaign-progress-report.schema";

@injectable()
export class CampaignProgressReportService {
  constructor(
    private campaignRepository: CampaignRepository,
    private postItemRepository: CampaignPostItemRepository,
    private reportRepository: CampaignProgressReportRepository,
    private eventRepository: CampaignEventRepository,
    private healthService: CampaignHealthService,
    private scheduledPostRepository: ScheduledPostRepository
  ) {}

  async buildDailyReport(
    campaignId: string,
    siteId: string,
    reportDate?: string
  ): Promise<CampaignProgressReport> {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    const dateStr =
      reportDate ?? new Date().toISOString().slice(0, 10);
    const health = await this.healthService.compute(campaign);
    const items = await this.postItemRepository.findByCampaign(campaignId, siteId);
    const total = items.length || campaign.total_posts_planned || 0;
    const published = items.filter((i) => i.status === CampaignPostItemStatus.PUBLISHED).length;
    const now = new Date();

    const scheduledPosts = await this.scheduledPostRepository.findByCampaign(campaignId, siteId);
    const awaiting = scheduledPosts.filter(
      (p) => p.status === ScheduledPostStatus.AWAITING_APPROVAL && !p.approved_at
    );
    const upcoming = scheduledPosts.filter(
      (p) =>
        p.scheduled_at > now &&
        (p.status === ScheduledPostStatus.PENDING || p.status === ScheduledPostStatus.SCHEDULED)
    );

    const daysTotal = Math.max(
      1,
      Math.ceil((campaign.end_date.getTime() - campaign.start_date.getTime()) / 86400000)
    );
    const daysElapsed = Math.min(
      daysTotal,
      Math.max(0, Math.ceil((now.getTime() - campaign.start_date.getTime()) / 86400000))
    );
    const daysRemaining = Math.max(0, daysTotal - daysElapsed);

    const highlights: string[] = [];
    if (published > 0) {
      highlights.push(`${published} of ${total} planned posts published.`);
    }
    const risks = [...health.health_reasons];
    const overdue = awaiting.filter((p) => p.scheduled_at <= now);
    if (overdue.length > 0) {
      risks.push(
        `${overdue.length} post(s) missed publish window — approval required before they can go live.`
      );
    }

    const narrative_summary = [
      `Campaign "${campaign.name}" is ${health.health_status.replace(/_/g, " ")}.`,
      total > 0
        ? `${Math.round((published / total) * 100)}% complete (${published}/${total} posts).`
        : "Roadmap not yet materialized.",
      awaiting.length > 0
        ? `${awaiting.length} post(s) need your pre-publish approval.`
        : "No posts currently blocked on approval.",
    ].join(" ");

    const report = await this.reportRepository.upsert({
      campaign_id: campaignId,
      site_id: siteId,
      report_date: dateStr,
      period_label: `Daily report — ${dateStr}`,
      lifecycle_status:
        campaign.lifecycle_status ?? CampaignLifecycleStatus.DRAFT,
      health_status: health.health_status,
      health_reasons: health.health_reasons,
      progress: {
        total_planned: total,
        published,
        scheduled_upcoming: upcoming.length,
        awaiting_approval: awaiting.length,
        failed: items.filter((i) => i.status === CampaignPostItemStatus.FAILED).length,
        skipped: items.filter((i) => i.status === CampaignPostItemStatus.SKIPPED).length,
        percent_complete: total > 0 ? Math.round((published / total) * 100) : 0,
        days_elapsed: daysElapsed,
        days_remaining: daysRemaining,
      },
      highlights,
      risks,
      recommendations: overdue.length
        ? ["Approve pending posts in the approvals inbox to unblock publishing."]
        : ["Review upcoming posts in the Schedule tab."],
      narrative_summary,
      upcoming_7d: upcoming.slice(0, 7).map((p) => ({
        title: p.title,
        scheduled_at: p.scheduled_at.toISOString(),
        status: p.status,
      })),
      pending_approvals: awaiting.slice(0, 10).map((p) => ({
        title: p.title,
        due_at: p.scheduled_at.toISOString(),
        scheduled_post_id: p._id!.toString(),
      })),
      generated_at: new Date(),
    });

    await this.campaignRepository.update(campaignId, siteId, {
      health_status: health.health_status,
      health_computed_at: new Date(),
      health_reasons: health.health_reasons,
    });

    await this.eventRepository.append({
      campaign_id: campaignId,
      site_id: siteId,
      type: CampaignEventType.PROGRESS_REPORT_GENERATED,
      payload: { report_date: dateStr },
    });

    return report;
  }

  async getLatest(campaignId: string, siteId: string) {
    await this.buildDailyReport(campaignId, siteId).catch(() => undefined);
    const report = await this.reportRepository.findLatest(campaignId);
    if (!report) {
      return this.buildDailyReport(campaignId, siteId);
    }
    return report;
  }
}
