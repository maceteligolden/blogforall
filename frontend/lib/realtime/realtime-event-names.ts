export const REALTIME_EVENTS = {
  NOTIFICATION_CREATED: "notification.created",
  ORCHESTRATOR_PHASE: "orchestrator.phase",
  ORCHESTRATOR_TURN_STARTED: "orchestrator.turn.started",
  ORCHESTRATOR_TURN_COMPLETED: "orchestrator.turn.completed",
  THREAD_RENAMED: "thread.renamed",
  APPROVAL_CREATED: "approval.created",
  APPROVAL_DECIDED: "approval.decided",
  SCHEDULED_POST_PREPARED: "scheduled_post.prepared",
  SCHEDULED_POST_PUBLISHED: "scheduled_post.published",
  SCHEDULED_POST_FAILED: "scheduled_post.failed",
  CAMPAIGN_EVENT_APPENDED: "campaign.event.appended",
  BLOG_STATUS_CHANGED: "blog.status.changed",
  STRATEGY_STATUS_CHANGED: "strategy.status.changed",
  SIGNUP_BOOTSTRAP_STEP: "signup.bootstrap.step",
  SIGNUP_BOOTSTRAP_COMPLETED: "signup.bootstrap.completed",
  SIGNUP_BOOTSTRAP_FAILED: "signup.bootstrap.failed",
  REALTIME_ERROR: "realtime:error",
  REALTIME_CONNECTED: "realtime:connected",
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export const CLIENT_EVENTS = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
} as const;
