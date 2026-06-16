import { injectable } from "tsyringe";
import { CampaignMemoryRepository } from "../repositories/campaign-memory.repository";
import type { CampaignMemory } from "../../../shared/schemas/campaign-memory.schema";

@injectable()
export class CampaignMemoryService {
  constructor(private readonly memoryRepository: CampaignMemoryRepository) {}

  async get(campaignId: string, siteId: string): Promise<CampaignMemory> {
    return this.memoryRepository.ensureForCampaign(campaignId, siteId);
  }

  async recordDecision(
    campaignId: string,
    siteId: string,
    decision: string,
    by: "user" | "ai" = "user"
  ): Promise<CampaignMemory> {
    const mem = await this.memoryRepository.ensureForCampaign(campaignId, siteId);
    const decisions = [...(mem.decisions ?? []), { decision, by, at: new Date() }];
    const updated = await this.memoryRepository.update(campaignId, {
      decisions,
      summary: mem.summary || decision.slice(0, 500),
      updated_at: new Date(),
    });
    return updated ?? mem;
  }
}
