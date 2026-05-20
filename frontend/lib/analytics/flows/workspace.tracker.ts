import { AnalyticsEvents } from "../events";
import type { WorkspaceEventProperties } from "../properties";
import { captureEvent } from "../posthog";

export const workspaceTracker = {
  creationStarted: (props?: WorkspaceEventProperties) =>
    captureEvent(AnalyticsEvents.WORKSPACE_CREATION_STARTED, props),

  created: (props?: WorkspaceEventProperties) =>
    captureEvent(AnalyticsEvents.WORKSPACE_CREATED, props),

  switched: (props: WorkspaceEventProperties & { previous_workspace_id?: string }) =>
    captureEvent(AnalyticsEvents.WORKSPACE_SWITCHED, props),

  deleted: (props?: WorkspaceEventProperties) =>
    captureEvent(AnalyticsEvents.WORKSPACE_DELETED, props),

  updated: (props?: WorkspaceEventProperties) =>
    captureEvent(AnalyticsEvents.WORKSPACE_UPDATED, props),
};
