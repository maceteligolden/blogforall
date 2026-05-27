import { injectable } from "tsyringe";
import * as cron from "node-cron";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import {
  EMAIL_TEMPLATE_KEYS,
  NotificationChannel,
  NotificationType,
} from "../../../shared/constants/notification.constant";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignProgressReportService } from "./campaign-progress-report.service";
import { CampaignProgressReportRepository } from "../repositories/campaign-progress-report.repository";
import { NotificationService } from "../../notification/services/notification.service";
import { UserRepository } from "../../auth/repositories/user.repository";
import { SiteRepository } from "../../site/repositories/site.repository";
import {
  CampaignLifecycleStatus,
  CampaignEventType,
} from "../../../shared/constants/campaign.constant";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";

@injectable()
export class CampaignProgressEmailService {
  private cronJob: cron.ScheduledTask | null = null;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly progressService: CampaignProgressReportService,
    private readonly progressReportRepository: CampaignProgressReportRepository,
    private readonly notificationService: NotificationService,
    private readonly userRepository: UserRepository,
    private readonly siteRepository: SiteRepository,
    private readonly eventRepository: CampaignEventRepository
  ) {}

  start(): void {
    if (this.cronJob) return;
    const expression = env.campaign.progressEmailCron;
    if (!cron.validate(expression)) {
      logger.error(
        "Invalid campaign progress email cron",
        new Error(expression),
        {},
        "CampaignProgressEmailService"
      );
      return;
    }
    this.cronJob = cron.schedule(expression, () => {
      this.runOnce().catch((err) =>
        logger.error("Campaign progress email run failed", err as Error, {}, "CampaignProgressEmailService")
      );
    });
    logger.info(`Campaign progress email scheduled (${expression})`, {}, "CampaignProgressEmailService");
  }

  async runOnce(): Promise<void> {
    const dateStr = new Date().toISOString().slice(0, 10);
    const campaigns = await this.campaignRepository.findForDailyProgress();
    for (const campaign of campaigns) {
      const lifecycle = campaign.lifecycle_status ?? CampaignLifecycleStatus.ACTIVE;
      if (
        lifecycle !== CampaignLifecycleStatus.ACTIVE &&
        lifecycle !== CampaignLifecycleStatus.PAUSED
      ) {
        continue;
      }
      if (campaign.notifications?.daily_progress_email === false) {
        continue;
      }
      const report = await this.progressService.buildDailyReport(
        campaign._id!.toString(),
        campaign.site_id,
        dateStr
      );
      if (report.emailed_at) {
        continue;
      }
      const user = await this.userRepository.findById(campaign.user_id);
      if (!user?.email) continue;
      const site = await this.siteRepository.findById(campaign.site_id);
      const ctaUrl = `${env.frontend.baseUrl}/dashboard/campaigns/${campaign._id}?tab=progress`;
      try {
        await this.notificationService.createAndSend({
          channel: NotificationChannel.EMAIL,
          type: NotificationType.CAMPAIGN_DAILY_PROGRESS_REPORT,
          recipientEmail: user.email,
          templateKey: EMAIL_TEMPLATE_KEYS.CAMPAIGN_DAILY_PROGRESS_REPORT,
          templateParams: {
            campaignName: campaign.name,
            siteName: site?.name ?? "Workspace",
            reportDate: dateStr,
            healthStatus: report.health_status,
            percentComplete: String(report.progress.percent_complete),
            narrativeSummary: report.narrative_summary,
            highlights: report.highlights.join(" • ") || "—",
            risks: report.risks.join(" • ") || "None",
            pendingCount: String(report.progress.awaiting_approval),
            ctaUrl,
          },
        });
        await this.progressReportRepository.upsert({
          ...report,
          emailed_at: new Date(),
          email_recipient_ids: [campaign.user_id],
        });
        await this.eventRepository.append({
          campaign_id: campaign._id!.toString(),
          site_id: campaign.site_id,
          type: CampaignEventType.PROGRESS_REPORT_EMAILED,
          payload: { report_date: dateStr },
        });
      } catch (err) {
        logger.error(
          "Failed to send campaign progress email",
          err as Error,
          { campaignId: campaign._id },
          "CampaignProgressEmailService"
        );
      }
    }
  }
}
