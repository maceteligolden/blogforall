import { ScheduledPostRepository } from "../repositories/scheduled-post.repository";
import { CampaignPostItemRepository } from "../repositories/campaign-post-item.repository";

/**
 * Campaign posts must use the scheduled-post HITL pipeline — never immediate publish via chat.
 */
export async function assertBlogNotCampaignImmediatePublish(
  blogId: string,
  siteId: string,
  scheduledPostRepository: ScheduledPostRepository,
  postItemRepository: CampaignPostItemRepository
): Promise<void> {
  const scheduledPosts = await scheduledPostRepository.findByBlog(blogId);
  const campaignLinked = scheduledPosts.some((p) => p.site_id === siteId && p.campaign_id);
  if (campaignLinked) {
    throw new Error(
      "This post belongs to a campaign and must be approved via the scheduled post review flow before publishing."
    );
  }
  const items = await postItemRepository.findByBlogId(blogId, siteId);
  if (items.length > 0) {
    throw new Error(
      "This post belongs to a campaign and must be approved via the scheduled post review flow before publishing."
    );
  }
}
