import type { QueryClient } from "@tanstack/react-query";
import type { OrchestratorMessage } from "@/lib/api/types/orchestrator.types";

export interface OrchestratorArtifact {
  id: string;
  tool: string;
  summary?: string;
  outputData: Record<string, unknown>;
  createdAt?: string;
}

export function extractArtifactsFromMessages(messages: OrchestratorMessage[]): OrchestratorArtifact[] {
  const artifacts: OrchestratorArtifact[] = [];

  for (const message of messages) {
    if (message.role !== "assistant" || !message.tool_calls?.length) continue;
    for (const call of message.tool_calls) {
      if (!call.output_data || typeof call.output_data !== "object") continue;
      artifacts.push({
        id: `${message._id}-${call.tool}-${artifacts.length}`,
        tool: call.tool,
        summary: call.output_summary,
        outputData: call.output_data as Record<string, unknown>,
        createdAt: message.created_at,
      });
    }
  }

  return artifacts;
}

export function extractUrlFromText(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s)]+/);
  return match ? match[0] : null;
}

/**
 * Tools that may auto-open the Results Panel (structured entities only — doc 22 follow-up).
 * Research / search / list stay in chat; they do not open the panel.
 */
export const ENTITY_PANEL_TOOLS = new Set([
  "blogs.generateDraft",
  "blogs.createDraft",
  "blogs.update",
  "blogs.get",
  "blogs.review",
  "writing.confirmResearch",
  "campaigns.get",
  "campaigns.create",
  "campaigns.update",
  "campaign_get",
  "campaign_create",
  "campaign_update",
  "strategy.get",
  "strategy.update",
]);

/** @deprecated Use ENTITY_PANEL_TOOLS — kept as alias for gradual migration */
export const VIEWABLE_ARTIFACT_TOOLS = ENTITY_PANEL_TOOLS;

export const DRAFT_ARTIFACT_TOOLS = new Set([
  "blogs.generateDraft",
  "blogs.createDraft",
  "blogs.update",
  "blogs.get",
  "writing.confirmResearch",
  "writing.reviseDraft",
]);

export const CAMPAIGN_PANEL_TOOLS = new Set([
  "campaigns.get",
  "campaigns.create",
  "campaigns.update",
  "campaign_get",
  "campaign_create",
  "campaign_update",
]);
export const STRATEGY_PANEL_TOOLS = new Set(["strategy.get", "strategy.update"]);

/** Outline stays in-chat as a workflow card — never auto-open the panel. */
export const WORKFLOW_CARD_TOOLS = new Set(["writing.outline", "content_strategy"]);

export function extractBlogIdFromArtifactData(data: Record<string, unknown>): string | undefined {
  if (typeof data.blog_id === "string") return data.blog_id;
  if (typeof data.id === "string" && !data.campaign_id && !data.purpose) return data.id;
  return undefined;
}

export function extractCampaignIdFromArtifactData(data: Record<string, unknown>): string | undefined {
  if (typeof data.campaign_id === "string") return data.campaign_id;
  if (typeof data.id === "string" && (data.goal != null || data.name != null)) return data.id;
  return undefined;
}

export function extractStrategyIdFromArtifactData(data: Record<string, unknown>): string | undefined {
  if (typeof data.strategy_id === "string") return data.strategy_id;
  if (typeof data.id === "string" && data.purpose != null) return data.id;
  return undefined;
}

export function artifactHasEntityId(artifact: OrchestratorArtifact): boolean {
  if (DRAFT_ARTIFACT_TOOLS.has(artifact.tool) || artifact.tool === "blogs.review") {
    return !!extractBlogIdFromArtifactData(artifact.outputData);
  }
  if (CAMPAIGN_PANEL_TOOLS.has(artifact.tool)) {
    return !!extractCampaignIdFromArtifactData(artifact.outputData);
  }
  if (STRATEGY_PANEL_TOOLS.has(artifact.tool)) {
    return !!extractStrategyIdFromArtifactData(artifact.outputData) || !!artifact.outputData.purpose;
  }
  return false;
}

/** Push blogs.update (or similar) tool output into the blog query cache so the result panel updates immediately. */
export function patchBlogCacheFromToolOutput(
  queryClient: QueryClient,
  blogId: string,
  outputData: Record<string, unknown>
): boolean {
  const content = typeof outputData.content === "string" ? outputData.content : undefined;
  const content_blocks = Array.isArray(outputData.content_blocks) ? outputData.content_blocks : undefined;
  const updated_at =
    typeof outputData.updated_at === "string"
      ? outputData.updated_at
      : outputData.updated_at instanceof Date
        ? outputData.updated_at.toISOString()
        : content
          ? new Date().toISOString()
          : undefined;
  if (!content && !content_blocks && !updated_at) return false;

  queryClient.setQueriesData(
    {
      predicate: (query) =>
        Array.isArray(query.queryKey) && query.queryKey[0] === "blogs" && query.queryKey[1] === blogId,
    },
    (old: Record<string, unknown> | undefined) => {
      const next: Record<string, unknown> = {
        ...(old ?? { _id: blogId }),
        ...(updated_at ? { updated_at } : {}),
        ...(typeof outputData.title === "string" ? { title: outputData.title } : {}),
        ...(typeof outputData.excerpt === "string" ? { excerpt: outputData.excerpt } : {}),
        ...(typeof outputData.status === "string" ? { status: outputData.status } : {}),
      };
      if (content_blocks !== undefined) {
        next.content_blocks = content_blocks;
        if (content !== undefined) next.content = content;
      } else if (content !== undefined) {
        next.content = content;
        next.content_blocks = undefined;
      }
      return next;
    }
  );
  return true;
}

export function isEntityPanelTool(tool?: string): boolean {
  return !!tool && ENTITY_PANEL_TOOLS.has(tool);
}

/** @deprecated Use isEntityPanelTool */
export function isViewableArtifactTool(tool?: string): boolean {
  return isEntityPanelTool(tool);
}

export function isDraftViewTool(tool?: string): boolean {
  return !!tool && DRAFT_ARTIFACT_TOOLS.has(tool);
}

export function findArtifactIdForToolMessage(
  toolName: string | undefined,
  content: string,
  artifacts: OrchestratorArtifact[]
): string | undefined {
  if (!isEntityPanelTool(toolName)) return undefined;
  const exact = artifacts.find((a) => a.tool === toolName && a.summary != null && a.summary === content);
  if (exact && artifactHasEntityId(exact)) return exact.id;
  const fuzzy = artifacts.find(
    (a) =>
      a.tool === toolName &&
      artifactHasEntityId(a) &&
      ((a.summary && content.includes(a.summary)) || (a.summary && a.summary.includes(content)))
  );
  if (fuzzy) return fuzzy.id;
  const sameTool = artifacts.filter((a) => a.tool === toolName && artifactHasEntityId(a));
  return sameTool[sameTool.length - 1]?.id;
}

export function findArtifactIdForAssistantMessage(
  message: OrchestratorMessage,
  artifacts: OrchestratorArtifact[]
): string | undefined {
  if (message.role !== "assistant" || !message.tool_calls?.length) return undefined;
  for (const call of message.tool_calls) {
    if (!isEntityPanelTool(call.tool)) continue;
    const id = findArtifactIdForToolMessage(call.tool, call.output_summary ?? "", artifacts);
    if (id) return id;
    const byData = artifacts.find(
      (a) =>
        a.tool === call.tool &&
        call.output_data &&
        typeof call.output_data === "object" &&
        artifactHasEntityId(a) &&
        (call.output_data as { blog_id?: string }).blog_id === (a.outputData.blog_id as string | undefined)
    );
    if (byData) return byData.id;
  }
  return undefined;
}

/** CTA label for opening an entity in the results panel. */
export function entityViewCtaLabel(tool?: string): string | null {
  if (!tool) return null;
  if (isDraftViewTool(tool)) return "View draft →";
  if (CAMPAIGN_PANEL_TOOLS.has(tool)) return "View campaign →";
  if (STRATEGY_PANEL_TOOLS.has(tool)) return "View strategy →";
  if (tool === "blogs.review") return "View review →";
  return null;
}
