export type UrgencyTopic = {
  sequence_index: number;
  scheduled_at?: string;
  blog_id?: string;
  draft_status?: string;
};

const SKIP_STATUSES = new Set(["draft_ready", "published", "skipped", "cancelled", "awaiting_approval"]);

export function isUndraftedTopic(item: UrgencyTopic): boolean {
  if (item.blog_id) return false;
  const status = item.draft_status?.toLowerCase();
  if (status && SKIP_STATUSES.has(status)) return false;
  return true;
}

export function isOverdueTopic(item: UrgencyTopic, now = Date.now()): boolean {
  if (!item.scheduled_at) return false;
  const at = new Date(item.scheduled_at).getTime();
  return !Number.isNaN(at) && at < now;
}

export function compareTopicUrgency(a: UrgencyTopic, b: UrgencyTopic, now = Date.now()): number {
  const aOverdue = isOverdueTopic(a, now);
  const bOverdue = isOverdueTopic(b, now);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
  const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  return a.sequence_index - b.sequence_index;
}

export function pickMostUrgentUndrafted<T extends UrgencyTopic>(items: T[], now = Date.now()): T | undefined {
  const undrafted = items.filter(isUndraftedTopic).sort((a, b) => compareTopicUrgency(a, b, now));
  return undrafted[0] ?? items[0];
}
