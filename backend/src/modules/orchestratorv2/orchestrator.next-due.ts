import { container } from "tsyringe";
import { CampaignRepository } from "../campaign/repositories/campaign.repository";
import { CampaignPostItemRepository } from "../campaign/repositories/campaign-post-item.repository";
import { CampaignPostItemStatus } from "../../shared/constants/campaign.constant";

export type NextDueTopic = {
  campaign_id: string;
  campaign_name: string;
  sequence_index: number;
  title: string;
  objective: string;
  strategic_intent: string;
  scheduled_at?: string;
  overdue: boolean;
};

const SKIP_STATUSES = new Set<string>([
  CampaignPostItemStatus.DRAFTING,
  CampaignPostItemStatus.DRAFT_READY,
  CampaignPostItemStatus.PUBLISHED,
  CampaignPostItemStatus.SKIPPED,
  CampaignPostItemStatus.CANCELLED,
  CampaignPostItemStatus.AWAITING_APPROVAL,
]);

export function compareNextDueTopics(a: NextDueTopic, b: NextDueTopic): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.sequence_index - b.sequence_index;
}

export async function listNextDueTopics(siteId: string, limit = 4, campaignId?: string): Promise<NextDueTopic[]> {
  const campaigns = container.resolve(CampaignRepository);
  const items = container.resolve(CampaignPostItemRepository);
  const page = await campaigns.findAll(siteId, { limit: 20, page: 1 });
  const now = Date.now();
  const collected: NextDueTopic[] = [];

  for (const campaign of page.data) {
    const resolvedCampaignId = campaign._id!.toString();
    if (campaignId && resolvedCampaignId !== campaignId) continue;
    const posts = await items.findByCampaign(resolvedCampaignId, siteId);
    for (const post of posts) {
      if (post.blog_id) continue;
      if (SKIP_STATUSES.has(post.status) && post.status !== CampaignPostItemStatus.DRAFTING) continue;
      const scheduledAt = post.scheduled_at ? new Date(post.scheduled_at) : undefined;
      collected.push({
        campaign_id: resolvedCampaignId,
        campaign_name: campaign.name,
        sequence_index: post.sequence_index,
        title: post.title,
        objective: post.objective,
        strategic_intent: post.strategic_intent,
        scheduled_at: scheduledAt?.toISOString(),
        overdue: Boolean(scheduledAt && scheduledAt.getTime() < now),
      });
    }
  }

  collected.sort(compareNextDueTopics);

  return collected.slice(0, limit);
}
