import type { ThreadFocus } from "@/lib/api/types/orchestrator.types";

type LooseFocus = {
  campaign_id?: string | null;
  roadmap_sequence_index?: number | null;
  blog_id?: string | null;
  topic?: string | null;
  intent?: string | null;
};

function nonempty(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Drop null/empty optional fields so chat validation does not reject them. */
export function compactThreadFocus(focus?: LooseFocus | null): ThreadFocus | undefined {
  if (!focus) return undefined;
  const next: ThreadFocus = {};
  const campaignId = nonempty(focus.campaign_id);
  const blogId = nonempty(focus.blog_id);
  const topic = nonempty(focus.topic);
  const intent = nonempty(focus.intent);
  if (campaignId) next.campaign_id = campaignId;
  if (focus.roadmap_sequence_index != null) next.roadmap_sequence_index = focus.roadmap_sequence_index;
  if (blogId) next.blog_id = blogId;
  if (topic) next.topic = topic;
  if (intent) next.intent = intent;
  return Object.keys(next).length ? next : undefined;
}
