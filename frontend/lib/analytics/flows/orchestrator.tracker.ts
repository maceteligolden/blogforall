import { AnalyticsEvents } from "../events";
import type { OrchestratorEventProperties } from "../properties";
import { captureEvent } from "../posthog";

export const orchestratorTracker = {
  opened: (props?: OrchestratorEventProperties) =>
    captureEvent(AnalyticsEvents.ORCHESTRATOR_OPENED, props),

  messageSent: (props?: OrchestratorEventProperties) =>
    captureEvent(AnalyticsEvents.ORCHESTRATOR_MESSAGE_SENT, props),

  toolExecuted: (props: OrchestratorEventProperties & { tool_name: string }) =>
    captureEvent(AnalyticsEvents.ORCHESTRATOR_TOOL_EXECUTED, props),

  approvalDecided: (props: OrchestratorEventProperties & { decision: "approved" | "rejected" }) =>
    captureEvent(AnalyticsEvents.ORCHESTRATOR_APPROVAL_DECIDED, props),
};
