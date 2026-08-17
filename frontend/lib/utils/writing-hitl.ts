import type { OrchestratorMessage } from "@/lib/api/types/orchestrator.types";
import type { OutlineApprovalCardProps } from "@/components/orchestrator/outline-approval-card";

export function extractOutlineCardProps(
  output: Record<string, unknown>
): Omit<OutlineApprovalCardProps, "onApprove" | "onModify" | "onContinue" | "disabled" | "className"> | null {
  const outline =
    output.outline && typeof output.outline === "object" ? (output.outline as Record<string, unknown>) : output;

  const title = typeof outline.title === "string" ? outline.title : undefined;
  const sectionsRaw = Array.isArray(outline.sections) ? outline.sections : [];
  const sections: Array<{ heading: string; summary?: string }> = [];
  for (const s of sectionsRaw) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    const heading = typeof o.heading === "string" ? o.heading : "";
    if (!heading.trim()) continue;
    sections.push({
      heading: heading.trim(),
      ...(typeof o.summary === "string" ? { summary: o.summary } : {}),
    });
  }

  if (!title && sections.length === 0) return null;
  return { title, sections };
}

export type WritingHitlKind = "outline";

export function detectWritingHitlFromMessage(
  message: OrchestratorMessage | undefined
): { kind: WritingHitlKind; output: Record<string, unknown> } | null {
  if (!message || message.role !== "assistant" || !message.tool_calls?.length) return null;

  // Prefer the latest matching tool call on this assistant turn.
  for (let i = message.tool_calls.length - 1; i >= 0; i--) {
    const call = message.tool_calls[i];
    const data = (call.output_data ?? {}) as Record<string, unknown>;
    const tool = call.tool;
    const action = typeof data.action === "string" ? data.action : undefined;
    const checkpoint = typeof data.writing_checkpoint === "string" ? data.writing_checkpoint : undefined;

    if (
      tool === "writing.outline" ||
      checkpoint === "outline" ||
      (tool === "writing" && action === "outline") ||
      data.outline
    ) {
      if (extractOutlineCardProps(data)) {
        return { kind: "outline", output: data };
      }
    }
  }
  return null;
}

/** Latest assistant message that still has an open writing HITL card (no draft tool after it). */
export function findActiveWritingHitl(
  messages: OrchestratorMessage[]
): { kind: WritingHitlKind; output: Record<string, unknown>; messageId: string } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;

    // Campaign collect/create supersedes a stale research/outline card from earlier in the thread.
    const campaignTurn = m.tool_calls?.some(
      (c) => c.tool === "campaign.collect" || c.tool === "campaigns.create" || c.tool === "campaigns.get"
    );
    if (campaignTurn) return null;

    // If this turn already produced a draft entity, no open HITL card.
    const drafted = m.tool_calls?.some((c) => {
      const data = (c.output_data ?? {}) as Record<string, unknown>;
      if (c.tool === "blogs.generateDraft" || c.tool === "blogs.createDraft" || c.tool === "blogs.update") {
        return true;
      }
      if (c.tool === "writing" && data.action === "draft") return true;
      if (typeof data.blog_id === "string" && data.blog_id) return true;
      return false;
    });
    if (drafted) return null;

    const hitl = detectWritingHitlFromMessage(m);
    if (hitl) {
      return { ...hitl, messageId: m._id };
    }
  }
  return null;
}
