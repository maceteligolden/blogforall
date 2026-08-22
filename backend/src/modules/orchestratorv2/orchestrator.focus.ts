import type { OrchestratorThread } from "../../shared/schemas/orchestrator-thread.schema";

export type ThreadFocusInput = {
  campaign_id?: string;
  roadmap_sequence_index?: number;
  blog_id?: string;
  topic?: string;
  intent?: string;
};

export function buildDraftStartFocus(input: {
  campaignId?: string;
  sequence?: number;
  topic: string;
  intent?: string;
  blogId: string;
}): NonNullable<OrchestratorThread["focus"]> {
  return {
    campaign_id: input.campaignId,
    roadmap_sequence_index: input.sequence,
    topic: input.topic,
    intent: input.intent,
    blog_id: input.blogId,
  };
}

export function mergeFocus(
  existing: OrchestratorThread["focus"] | undefined,
  incoming: ThreadFocusInput | undefined
): OrchestratorThread["focus"] | undefined {
  if (!incoming && !existing) return existing;
  const merged: OrchestratorThread["focus"] = {
    ...(existing ?? {}),
    ...(incoming ?? {}),
  };
  const sameRoadmapItem =
    incoming?.campaign_id != null &&
    incoming.roadmap_sequence_index != null &&
    incoming.campaign_id === existing?.campaign_id &&
    incoming.roadmap_sequence_index === existing.roadmap_sequence_index;
  if (incoming && incoming.blog_id == null && (incoming.topic || incoming.campaign_id) && !sameRoadmapItem) {
    delete merged.blog_id;
  }
  return merged;
}
