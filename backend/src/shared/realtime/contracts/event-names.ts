/**
 * Canonical realtime event names.
 * Naming: `{domain}.{entity}.{action}` (lowercase, dotted).
 * Infra exceptions use `realtime:*`.
 */
export const REALTIME_EVENTS = {
  NOTIFICATION_CREATED: "notification.created",
  ORCHESTRATOR_PHASE: "orchestrator.phase",
  ORCHESTRATOR_TURN_STARTED: "orchestrator.turn.started",
  ORCHESTRATOR_TURN_COMPLETED: "orchestrator.turn.completed",
  APPROVAL_CREATED: "approval.created",
  APPROVAL_DECIDED: "approval.decided",
  SCHEDULED_POST_PREPARED: "scheduled_post.prepared",
  SCHEDULED_POST_PUBLISHED: "scheduled_post.published",
  SCHEDULED_POST_FAILED: "scheduled_post.failed",
  CAMPAIGN_EVENT_APPENDED: "campaign.event.appended",
  BLOG_STATUS_CHANGED: "blog.status.changed",
  WORKSPACE_INVITATION_SENT: "workspace.invitation.sent",
  WORKSPACE_INVITATION_ACCEPTED: "workspace.invitation.accepted",
  WORKSPACE_INVITATION_REJECTED: "workspace.invitation.rejected",
  WORKSPACE_MEMBER_ADDED: "workspace.member.added",
  WORKSPACE_MEMBER_ROLE_CHANGED: "workspace.member.role_changed",
  WORKSPACE_MEMBER_REMOVED: "workspace.member.removed",
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];
