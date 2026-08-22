import type { OrchestratorThread } from "../../../shared/schemas/orchestrator-thread.schema";

const DEFAULT_TITLE = "New conversation";

export function seedThreadTitle(input: { blogTitle?: string; campaignName?: string; topic?: string }): {
  title: string;
  title_source: OrchestratorThread["title_source"];
} {
  const topic = input.topic?.trim();
  if (topic) {
    return { title: topic.slice(0, 80), title_source: "auto" };
  }
  const blogTitle = input.blogTitle?.trim();
  if (blogTitle) {
    const title = `Draft: ${blogTitle}`.slice(0, 80);
    return { title, title_source: "auto" };
  }
  const campaignName = input.campaignName?.trim();
  if (campaignName) {
    return { title: campaignName.slice(0, 80), title_source: "auto" };
  }
  return { title: DEFAULT_TITLE, title_source: "default" };
}
