import { injectable } from "tsyringe";
import * as cron from "node-cron";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignProgressReportService } from "./campaign-progress-report.service";
import { CampaignHealthService } from "./campaign-health.service";

/** Builds daily progress snapshots and refreshes health for active campaigns. */
@injectable()
export class CampaignProgressReportCronService {
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly progressReportService: CampaignProgressReportService,
    private readonly healthService: CampaignHealthService
  ) {}

  start(): void {
    const expression = env.campaign.progressReportCron;
    if (!cron.validate(expression)) {
      logger.warn(
        "Invalid campaign progress report cron — scheduler disabled",
        { expression },
        "CampaignProgressReportCronService"
      );
      return;
    }
    cron.schedule(expression, () => {
      this.sweep().catch((err) =>
        logger.error(
          "Campaign progress report cron failed",
          err as Error,
          {},
          "CampaignProgressReportCronService"
        )
      );
    });
    logger.info(
      `Campaign progress report cron scheduled (${expression})`,
      {},
      "CampaignProgressReportCronService"
    );
  }

  async sweep(): Promise<void> {
    const campaigns = await this.campaignRepository.findForDailyProgress();
    for (const campaign of campaigns) {
      const campaignId = campaign._id!.toString();
      const siteId = campaign.site_id;
      await this.healthService.persist(campaignId, siteId);
      await this.progressReportService.buildDailyReport(campaignId, siteId);
    }
  }
}
