import OrchestratorThread from "../schemas/orchestrator-thread.schema";
import OrchestratorMessage from "../schemas/orchestrator-message.schema";
import OrchestratorApproval from "../schemas/orchestrator-approval.schema";
import WorkspaceMemory from "../schemas/workspace-memory.schema";
import MemoryRecord from "../schemas/memory-record.schema";
import MemoryChunkMeta from "../schemas/memory-chunk-meta.schema";
import KnowledgeChunk from "../schemas/knowledge-chunk.schema";
import WorkspaceKnowledgeSource from "../schemas/workspace-knowledge-source.schema";
import ResearchPackage from "../schemas/research-package.schema";
import OptimizationReport from "../schemas/optimization-report.schema";
import WorkspaceStrategy from "../schemas/workspace-strategy.schema";
import CampaignMemory from "../schemas/campaign-memory.schema";
import CampaignEvent from "../schemas/campaign-event.schema";
import CampaignRoadmap from "../schemas/campaign-roadmap.schema";
import CampaignProgressReport from "../schemas/campaign-progress-report.schema";
import GoogleDriveToken from "../schemas/google-drive-token.schema";
import EpisodicEpisode from "../schemas/episodic-episode.schema";
import { logger } from "./logger";
import { container } from "tsyringe";
import { OrchestratorThreadRepository } from "../../modules/orchestrator/repositories/orchestrator-thread.repository";

/** Best-effort cleanup of AI collections that remain on Mongo after a site is deleted in Postgres. */
export async function deleteMongoAiBySiteId(siteId: string): Promise<void> {
  const ops = [
    OrchestratorThread.deleteMany({ site_id: siteId }),
    OrchestratorMessage.deleteMany({ site_id: siteId }),
    OrchestratorApproval.deleteMany({ site_id: siteId }),
    WorkspaceMemory.deleteMany({ site_id: siteId }),
    MemoryRecord.deleteMany({ workspace_id: siteId }),
    MemoryChunkMeta.deleteMany({ site_id: siteId }),
    KnowledgeChunk.deleteMany({ site_id: siteId }),
    WorkspaceKnowledgeSource.deleteMany({ site_id: siteId }),
    ResearchPackage.deleteMany({ workspace_id: siteId }),
    OptimizationReport.deleteMany({ workspace_id: siteId }),
    WorkspaceStrategy.deleteMany({ site_id: siteId }),
    CampaignMemory.deleteMany({ site_id: siteId }),
    CampaignEvent.deleteMany({ site_id: siteId }),
    CampaignRoadmap.deleteMany({ site_id: siteId }),
    CampaignProgressReport.deleteMany({ site_id: siteId }),
    GoogleDriveToken.deleteMany({ site_id: siteId }),
    EpisodicEpisode.deleteMany({ site_id: siteId }),
  ];
  const results = await Promise.allSettled(ops);
  try {
    await container.resolve(OrchestratorThreadRepository).deleteBySiteId(siteId);
  } catch (err) {
    logger.warn(
      "Postgres orchestrator threads failed to delete for site",
      { siteId, error: (err as Error).message },
      "deleteMongoAiBySiteId"
    );
  }
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) {
    logger.warn("Some Mongo AI collections failed to delete for site", { siteId, failed }, "deleteMongoAiBySiteId");
  }
}
