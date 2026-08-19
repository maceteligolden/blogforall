import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignRoadmapRepository } from "../repositories/campaign-roadmap.repository";
import { CampaignPostItemRepository } from "../repositories/campaign-post-item.repository";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";
import { CampaignScheduleMaterializerService } from "./campaign-schedule-materializer.service";
import { CampaignMemoryService } from "./campaign-memory.service";
import { OrchestratorApprovalRepository } from "../../orchestrator/repositories/orchestrator-approval.repository";
import { OrchestratorApprovalStatus } from "../../../shared/schemas/orchestrator-approval.schema";
import { ScheduledPostPrepareService } from "../../orchestrator/services/scheduled-post-prepare.service";
import { RealtimeService, REALTIME_EVENTS } from "../../../shared/realtime";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import {
  CampaignLifecycleStatus,
  CampaignRoadmapStatus,
  CampaignPostItemStatus,
  CampaignEventType,
  CampaignStatus,
} from "../../../shared/constants/campaign.constant";
import type { CampaignRoadmap, CampaignRoadmapItemSnapshot } from "../../../shared/schemas/campaign-roadmap.schema";

@injectable()
export class CampaignRoadmapService {
  constructor(
    private campaignRepository: CampaignRepository,
    private roadmapRepository: CampaignRoadmapRepository,
    private postItemRepository: CampaignPostItemRepository,
    private eventRepository: CampaignEventRepository,
    private materializer: CampaignScheduleMaterializerService,
    private memoryService: CampaignMemoryService,
    private approvalRepository: OrchestratorApprovalRepository,
    private prepareService: ScheduledPostPrepareService,
    private realtimeService: RealtimeService
  ) {}

  async getRoadmap(campaignId: string, siteId: string) {
    const latest = await this.roadmapRepository.findLatest(campaignId, siteId);
    const history = await this.roadmapRepository.listVersions(campaignId, siteId);
    if (!latest) {
      return { current: null, history };
    }

    const current = this.toPlainRoadmap(latest);
    if (current.status === CampaignRoadmapStatus.APPROVED) {
      const postItems = await this.postItemRepository.findByCampaign(campaignId, siteId);
      const bySequence = new Map(postItems.map((item) => [item.sequence_index, item]));
      current.items = (current.items ?? []).map((snap: CampaignRoadmapItemSnapshot) => {
        const post = bySequence.get(snap.sequence_index);
        return {
          ...snap,
          draft_status: post?.status,
          blog_id: post?.blog_id,
          scheduled_post_id: post?.scheduled_post_id,
        };
      });
    }

    return { current, history };
  }

  async approveRoadmap(campaignId: string, siteId: string, userId: string, options?: { skipMaterialize?: boolean }) {
    const roadmap = await this.roadmapRepository.findLatest(campaignId, siteId);
    if (!roadmap) {
      throw new NotFoundError("Roadmap not found");
    }

    if (roadmap.status === CampaignRoadmapStatus.APPROVED) {
      if (!options?.skipMaterialize) {
        await this.materializer.materialize(campaignId, siteId, userId);
      }
      await this.closePendingRoadmapApproval(campaignId, siteId, userId);
      return this.getRoadmap(campaignId, siteId);
    }

    if (roadmap.status !== CampaignRoadmapStatus.PROPOSED) {
      throw new BadRequestError("No proposed roadmap to approve");
    }

    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    await this.postItemRepository.deleteByCampaign(campaignId, siteId);
    await this.postItemRepository.createMany(
      roadmap.items.map((snap) => ({
        campaign_id: campaignId,
        site_id: siteId,
        sequence_index: snap.sequence_index,
        title: snap.title,
        objective: snap.about || snap.objective,
        strategic_intent: snap.strategic_intent,
        narrative_phase: snap.narrative_phase,
        scheduled_at: snap.scheduled_at,
        timezone: campaign.timezone,
        status: CampaignPostItemStatus.PLANNED,
        target_keywords: snap.keywords ?? [],
        content_angle: snap.post_type,
        generated_by: "ai",
        manually_added: false,
        locked: false,
        dependencies: [],
      }))
    );

    const updated = await this.roadmapRepository.updateStatus(
      roadmap._id!.toString(),
      siteId,
      CampaignRoadmapStatus.APPROVED
    );
    if (!updated) {
      throw new NotFoundError("Failed to update roadmap status");
    }

    await this.campaignRepository.update(campaignId, siteId, {
      lifecycle_status: CampaignLifecycleStatus.ACTIVE,
      status: CampaignStatus.ACTIVE,
    });

    if (!options?.skipMaterialize) {
      await this.materializer.materialize(campaignId, siteId, userId);
    }

    await this.eventRepository.append({
      campaign_id: campaignId,
      site_id: siteId,
      type: CampaignEventType.ROADMAP_APPROVED,
      actor_user_id: userId,
      payload: { version: roadmap.version, materialized: !options?.skipMaterialize },
    });

    await this.memoryService.recordDecision(
      campaignId,
      siteId,
      options?.skipMaterialize
        ? `Roadmap v${roadmap.version} approved with ${roadmap.items.length} topics. Posts will be written later.`
        : `Roadmap v${roadmap.version} approved (${roadmap.items.length} posts materialized).`,
      "user"
    );

    await this.closePendingRoadmapApproval(campaignId, siteId, userId);

    return this.getRoadmap(campaignId, siteId);
  }

  async startItemDraft(campaignId: string, siteId: string, sequenceIndex: number, userId: string) {
    const roadmap = await this.roadmapRepository.findLatest(campaignId, siteId);
    if (!roadmap) {
      throw new NotFoundError("Roadmap not found");
    }
    if (roadmap.status !== CampaignRoadmapStatus.APPROVED) {
      throw new BadRequestError("Approve the roadmap before starting a draft");
    }

    const item = await this.postItemRepository.findBySequence(campaignId, siteId, sequenceIndex);
    if (!item) {
      throw new NotFoundError("Roadmap item not found");
    }
    if (!item.scheduled_post_id) {
      throw new BadRequestError("This topic is not on the schedule yet");
    }
    if (item.blog_id) {
      throw new BadRequestError("A draft already exists for this topic");
    }

    const itemId = item._id!.toString();
    const scheduledPostId = item.scheduled_post_id;
    await this.postItemRepository.update(itemId, siteId, {
      status: CampaignPostItemStatus.DRAFTING,
    });

    void this.prepareService
      .prepareOne(scheduledPostId, siteId)
      .then(async (outcome) => {
        if (outcome.ok) {
          await this.postItemRepository.update(itemId, siteId, {
            status: CampaignPostItemStatus.DRAFT_READY,
            ...(outcome.blogId ? { blog_id: outcome.blogId } : {}),
          });
          this.realtimeService.emitToUser(
            userId,
            REALTIME_EVENTS.SCHEDULED_POST_PREPARED,
            { scheduledPostId, siteId, blogId: outcome.blogId, campaignId },
            { siteId }
          );
          return;
        }
        await this.postItemRepository.update(itemId, siteId, {
          status: CampaignPostItemStatus.FAILED,
        });
        this.realtimeService.emitToUser(
          userId,
          REALTIME_EVENTS.SCHEDULED_POST_FAILED,
          { scheduledPostId, siteId, campaignId, reason: outcome.reason },
          { siteId }
        );
      })
      .catch(async (error) => {
        logger.error(
          "Background campaign draft failed",
          error instanceof Error ? error : new Error(String(error)),
          { campaignId, sequenceIndex, scheduledPostId },
          "CampaignRoadmapService"
        );
        await this.postItemRepository.update(itemId, siteId, {
          status: CampaignPostItemStatus.FAILED,
        });
        this.realtimeService.emitToUser(
          userId,
          REALTIME_EVENTS.SCHEDULED_POST_FAILED,
          { scheduledPostId, siteId, campaignId },
          { siteId }
        );
      });

    return { sequence_index: sequenceIndex, draft_status: CampaignPostItemStatus.DRAFTING };
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

  private async closePendingRoadmapApproval(campaignId: string, siteId: string, userId: string): Promise<void> {
    const pending = await this.approvalRepository.findPendingCampaignRoadmap(siteId, campaignId);
    if (!pending?._id) {
      return;
    }
    const approvalId = pending._id.toString();
    await this.approvalRepository.decide(approvalId, siteId, OrchestratorApprovalStatus.APPROVED, userId);
    await this.approvalRepository.markExecuted(approvalId, siteId, {
      ok: true,
      summary: "Campaign roadmap approved and schedule materialized.",
    });
  }

  private toPlainRoadmap(doc: CampaignRoadmap): CampaignRoadmap {
    const maybeDoc = doc as CampaignRoadmap & { toObject?: () => CampaignRoadmap };
    if (typeof maybeDoc.toObject === "function") {
      return maybeDoc.toObject();
    }
    return { ...doc };
  }
}
