import type { WritingThreadRequest } from "@/lib/writing/use-start-writing-thread";
import { compactThreadFocus } from "@/lib/writing/compact-thread-focus";

export function buildWritePostThreadRequest(input: {
  campaignId: string;
  campaignName: string;
  sequenceIndex: number;
  topic: string;
  intent?: string | null;
  blogId?: string | null;
  stayOnPage?: boolean;
}): WritingThreadRequest {
  return {
    ...compactThreadFocus({
      campaign_id: input.campaignId,
      roadmap_sequence_index: input.sequenceIndex,
      topic: input.topic,
      intent: input.intent,
      blog_id: input.blogId,
    }),
    campaign_name: input.campaignName,
    stayOnPage: input.stayOnPage,
  };
}
