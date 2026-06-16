import { AnalyticsEvents } from "../events";
import type { GenerationEventProperties } from "../properties";
import { captureEvent } from "../posthog";

export const generationTracker = {
  viewed: (props?: GenerationEventProperties) =>
    captureEvent(AnalyticsEvents.GENERATION_FLOW_VIEWED, props),

  typeSelected: (props: GenerationEventProperties & { generation_type: string }) =>
    captureEvent(AnalyticsEvents.GENERATION_TYPE_SELECTED, props),

  started: (props: GenerationEventProperties & { stage: "analyze" | "generate"; prompt_length: number }) =>
    captureEvent(AnalyticsEvents.GENERATION_STARTED, props),

  confirmed: (props?: GenerationEventProperties) =>
    captureEvent(AnalyticsEvents.GENERATION_CONFIRMED, props),

  success: (props: GenerationEventProperties & { duration_ms: number }) =>
    captureEvent(AnalyticsEvents.GENERATION_SUCCESS, props),

  failed: (props: GenerationEventProperties & { stage: string; error_code?: string }) =>
    captureEvent(AnalyticsEvents.GENERATION_FAILED, props),

  retry: (props?: GenerationEventProperties) =>
    captureEvent(AnalyticsEvents.GENERATION_RETRY, props),

  abandoned: (props?: GenerationEventProperties) =>
    captureEvent(AnalyticsEvents.GENERATION_ABANDONED, props),

  blogSaved: (props?: GenerationEventProperties) =>
    captureEvent(AnalyticsEvents.BLOG_SAVED, props),

  blogPublished: (props?: GenerationEventProperties) =>
    captureEvent(AnalyticsEvents.BLOG_PUBLISHED, props),
};
