import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignRoadmapRepository } from "../repositories/campaign-roadmap.repository";
import { CampaignPostItemRepository } from "../repositories/campaign-post-item.repository";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";
import { CampaignScheduleMaterializerService } from "./campaign-schedule-materializer.service";
import { CampaignMemoryService } from "./campaign-memory.service";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import {
  CampaignLifecycleStatus,
  CampaignRoadmapStatus,
  CampaignPostItemStatus,
  CampaignEventType,
  CampaignStatus,
} from "../../../shared/constants/campaign.constant";

@injectable()
export class CampaignRoadmapService {
  constructor(
    private campaignRepository: CampaignRepository,
    private roadmapRepository: CampaignRoadmapRepository,
    private postItemRepository: CampaignPostItemRepository,
    private eventRepository: CampaignEventRepository,
    private materializer: CampaignScheduleMaterializerService,
    private memoryService: CampaignMemoryService
  ) {}

  async getRoadmap(campaignId: string, siteId: string) {
    const latest = await this.roadmapRepository.findLatest(campaignId, siteId);
    const history = await this.roadmapRepository.listVersions(campaignId, siteId);
    return { current: latest, history };
  }

  async approveRoadmap(campaignId: string, siteId: string, userId: string) {
    const roadmap = await this.roadmapRepository.findLatest(campaignId, siteId);
    if (!roadmap || roadmap.status !== CampaignRoadmapStatus.PROPOSED) {
      throw new BadRequestError("No proposed roadmap to approve");
    }

    await this.postItemRepository.deleteByCampaign(campaignId, siteId);

    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    for (const snap of roadmap.items) {
      await this.postItemRepository.create({
        campaign_id: campaignId,
        site_id: siteId,
        sequence_index: snap.sequence_index,
        title: snap.title,
        objective: snap.objective,
        strategic_intent: snap.strategic_intent,
        narrative_phase: snap.narrative_phase,
        scheduled_at: snap.scheduled_at,
        timezone: campaign.timezone,
        status: CampaignPostItemStatus.PLANNED,
        target_keywords: [],
        generated_by: "ai",
        manually_added: false,
        locked: false,
        dependencies: [],
      });
    }

    await this.roadmapRepository.updateStatus(roadmap._id!.toString(), siteId, CampaignRoadmapStatus.APPROVED);

    await this.campaignRepository.update(campaignId, siteId, {
      lifecycle_status: CampaignLifecycleStatus.ACTIVE,
      status: CampaignStatus.ACTIVE,
    });

    await this.materializer.materialize(campaignId, siteId, userId);

    await this.eventRepository.append({
      campaign_id: campaignId,
      site_id: siteId,
      type: CampaignEventType.ROADMAP_APPROVED,
      actor_user_id: userId,
      payload: { version: roadmap.version },
    });

    await this.memoryService.recordDecision(
      campaignId,
      siteId,
      `Roadmap v${roadmap.version} approved (${roadmap.items.length} posts materialized).`,
      "user"
    );

    return this.getRoadmap(campaignId, siteId);
  }

  async rejectRoadmap(campaignId: string, siteId: string, userId: string, reason?: string) {
    const roadmap = await this.roadmapRepository.findLatest(campaignId, siteId);
    if (!roadmap) {
      throw new NotFoundError("Roadmap not found");
    }
    await this.roadmapRepository.updateStatus(roadmap._id!.toString(), siteId, CampaignRoadmapStatus.DRAFT, {
      rejection_reason: reason,
    });
    await this.campaignRepository.update(campaignId, siteId, {
      lifecycle_status: CampaignLifecycleStatus.PLANNING,
    });
    await this.eventRepository.append({
      campaign_id: campaignId,
      site_id: siteId,
      type: CampaignEventType.ROADMAP_REJECTED,
      actor_user_id: userId,
      payload: { reason },
    });
    return roadmap;
  }
}
