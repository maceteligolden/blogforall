import type { QueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/api/config";
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

export const VIEWABLE_ARTIFACT_TOOLS = new Set([
  "blogs.generateDraft",
  "blogs.createDraft",
  "blogs.update",
  "blogs.review",
]);

export const DRAFT_ARTIFACT_TOOLS = new Set(["blogs.generateDraft", "blogs.createDraft", "blogs.update"]);

export function extractBlogIdFromArtifactData(data: Record<string, unknown>): string | undefined {
  if (typeof data.blog_id === "string") return data.blog_id;
  if (typeof data.id === "string") return data.id;
  return undefined;
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
        : undefined;
  if (!content && !content_blocks && !updated_at) return false;

  queryClient.setQueryData(QUERY_KEYS.BLOG(blogId), (old: Record<string, unknown> | undefined) => ({
    ...(old ?? { _id: blogId }),
    ...(content !== undefined ? { content } : {}),
    ...(content_blocks !== undefined ? { content_blocks } : {}),
    ...(updated_at ? { updated_at } : {}),
    ...(typeof outputData.title === "string" ? { title: outputData.title } : {}),
    ...(typeof outputData.excerpt === "string" ? { excerpt: outputData.excerpt } : {}),
    ...(typeof outputData.status === "string" ? { status: outputData.status } : {}),
  }));
  return true;
}

export function isViewableArtifactTool(tool?: string): boolean {
  return !!tool && VIEWABLE_ARTIFACT_TOOLS.has(tool);
}

export function findArtifactIdForToolMessage(
  toolName: string | undefined,
  content: string,
  artifacts: OrchestratorArtifact[]
): string | undefined {
  if (!isViewableArtifactTool(toolName)) return undefined;
  const exact = artifacts.find((a) => a.tool === toolName && a.summary != null && a.summary === content);
  if (exact) return exact.id;
  const fuzzy = artifacts.find(
    (a) =>
      a.tool === toolName && ((a.summary && content.includes(a.summary)) || (a.summary && a.summary.includes(content)))
  );
  if (fuzzy) return fuzzy.id;
  const sameTool = artifacts.filter((a) => a.tool === toolName);
  return sameTool[sameTool.length - 1]?.id;
}

export function findArtifactIdForAssistantMessage(
  message: OrchestratorMessage,
  artifacts: OrchestratorArtifact[]
): string | undefined {
  if (message.role !== "assistant" || !message.tool_calls?.length) return undefined;
  for (const call of message.tool_calls) {
    if (!isViewableArtifactTool(call.tool)) continue;
    const id = findArtifactIdForToolMessage(call.tool, call.output_summary ?? "", artifacts);
    if (id) return id;
    const byData = artifacts.find(
      (a) =>
        a.tool === call.tool &&
        call.output_data &&
        typeof call.output_data === "object" &&
        (call.output_data as { blog_id?: string }).blog_id === (a.outputData.blog_id as string | undefined)
    );
    if (byData) return byData.id;
  }
  return undefined;
}
