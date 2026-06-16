import { injectable } from "tsyringe";
import CampaignProgressReportModel, {
  CampaignProgressReport,
} from "../../../shared/schemas/campaign-progress-report.schema";

@injectable()
export class CampaignProgressReportRepository {
  async upsert(report: Partial<CampaignProgressReport>): Promise<CampaignProgressReport> {
    return CampaignProgressReportModel.findOneAndUpdate(
      { campaign_id: report.campaign_id, report_date: report.report_date },
      { $set: report },
      { upsert: true, new: true }
    );
  }

  async findLatest(campaignId: string): Promise<CampaignProgressReport | null> {
    return CampaignProgressReportModel.findOne({ campaign_id: campaignId }).sort({
      report_date: -1,
    });
  }

  async findByDate(campaignId: string, reportDate: string): Promise<CampaignProgressReport | null> {
    return CampaignProgressReportModel.findOne({ campaign_id: campaignId, report_date: reportDate });
  }

  async list(campaignId: string, limit = 30): Promise<CampaignProgressReport[]> {
    return CampaignProgressReportModel.find({ campaign_id: campaignId })
      .sort({ report_date: -1 })
      .limit(limit);
  }

  async listBySiteForDate(siteId: string, reportDate: string): Promise<CampaignProgressReport[]> {
    return CampaignProgressReportModel.find({ site_id: siteId, report_date: reportDate });
  }
}
