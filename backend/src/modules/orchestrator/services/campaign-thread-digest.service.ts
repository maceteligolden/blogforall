import { injectable } from "tsyringe";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { OrchestratorMessageRepository } from "../repositories/orchestrator-message.repository";
import { OrchestratorThreadRepository } from "../repositories/orchestrator-thread.repository";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import { logger } from "../../../shared/utils/logger";

const MAX_THREADS = 8;
const SNIPPET = 180;

@injectable()
export class CampaignThreadDigestService {
  constructor(
    private readonly threads: OrchestratorThreadRepository,
    private readonly messages: OrchestratorMessageRepository,
    private readonly campaigns: CampaignRepository
  ) {}

  async refresh(siteId: string, campaignId: string): Promise<string> {
    try {
      const { threads } = await this.threads.listForSite(siteId, {
        entityType: "campaign",
        entityId: campaignId,
        limit: MAX_THREADS,
      });
      const lines: string[] = [];
      for (const thread of threads) {
        const history = await this.messages.listByThread(thread._id!.toString(), siteId, { limit: 4 });
        const lastUser = [...history].reverse().find((m) => m.role === OrchestratorMessageRole.USER);
        const snippet = (lastUser?.content || "").replace(/\s+/g, " ").trim().slice(0, SNIPPET);
        const label = thread.associations?.some((a) => a.entity_type === "blog") ? "post" : "campaign";
        lines.push(`- ${thread.title} (${label}${snippet ? `: ${snippet}` : ""})`);
      }
      const digest = lines.length ? `Related conversations:\n${lines.join("\n")}` : "No related conversations yet.";

      const campaign = await this.campaigns.findById(campaignId, siteId);
      if (campaign) {
        const intelligence = {
          ...(campaign.intelligence as unknown as Record<string, unknown>),
          thread_digest: digest,
        };
        await this.campaigns.update(campaignId, siteId, {
          intelligence: intelligence as unknown as typeof campaign.intelligence,
        });
      }
      return digest;
    } catch (err) {
      logger.warn(
        "Campaign thread digest failed",
        { siteId, campaignId, error: (err as Error).message },
        "CampaignThreadDigestService"
      );
      return "";
    }
  }

  async load(siteId: string, campaignId: string): Promise<string> {
    const campaign = await this.campaigns.findById(campaignId, siteId);
    const stored = (campaign?.intelligence as unknown as { thread_digest?: string } | undefined)?.thread_digest;
    if (typeof stored === "string" && stored.trim()) return stored;
    return this.refresh(siteId, campaignId);
  }
}
