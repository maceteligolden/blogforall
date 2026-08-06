import type { OrchestratorMessage } from "@/lib/api/types/orchestrator.types";
import type { ResearchFindingsCardProps } from "@/components/orchestrator/research-findings-card";
import type { OutlineApprovalCardProps } from "@/components/orchestrator/outline-approval-card";

type Finding = { text: string; value?: string };
type Source = { title: string; url?: string };

function asFindings(raw: unknown): Finding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { text: item };
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const text =
          typeof o.text === "string"
            ? o.text
            : typeof o.label === "string"
              ? o.label
              : typeof o.claim === "string"
                ? o.claim
                : typeof o.snippet === "string"
                  ? o.snippet
                  : "";
        if (!text.trim()) return null;
        return {
          text: text.trim(),
          value: typeof o.value === "string" ? o.value : undefined,
        };
      }
      return null;
    })
    .filter((x): x is Finding => !!x);
}

function asSources(raw: unknown): Source[] {
  if (!Array.isArray(raw)) return [];
  const out: Source[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : typeof o.url === "string" ? o.url : "";
    if (!title.trim()) continue;
    out.push({
      title: title.trim(),
      ...(typeof o.url === "string" ? { url: o.url } : {}),
    });
  }
  return out;
}

function packageFromOutput(data: Record<string, unknown>): Record<string, unknown> | null {
  const pkg = data.research_package;
  if (pkg && typeof pkg === "object") return pkg as Record<string, unknown>;
  return null;
}

export function extractResearchCardProps(
  output: Record<string, unknown>
): Omit<ResearchFindingsCardProps, "onApprove" | "onRevise" | "onContinue" | "disabled" | "className"> | null {
  const pkg = packageFromOutput(output);
  const summary =
    output.research_summary && typeof output.research_summary === "object"
      ? (output.research_summary as Record<string, unknown>)
      : null;

  const topic =
    (typeof pkg?.topic === "string" && pkg.topic) ||
    (typeof summary?.topic === "string" && summary.topic) ||
    (typeof output.topic === "string" && output.topic) ||
    undefined;

  const facts = asFindings(pkg?.facts ?? output.facts);
  const definitions = asFindings(pkg?.definitions ?? output.definitions);
  const statistics = asFindings(pkg?.statistics ?? output.statistics);
  const sources = asSources(pkg?.sources ?? pkg?.references ?? output.sources);
  const pkgInsights = Array.isArray(pkg?.key_insights)
    ? pkg!.key_insights.filter((x): x is string => typeof x === "string")
    : [];
  const keyInsights = (
    Array.isArray(output.key_insights)
      ? output.key_insights.filter((x): x is string => typeof x === "string")
      : pkgInsights
  ).filter(Boolean);

  const hasSignal =
    Boolean(topic) ||
    facts.length + definitions.length + statistics.length + sources.length + keyInsights.length > 0 ||
    Boolean(summary);

  if (!hasSignal) return null;

  // #region agent log
  fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
    body: JSON.stringify({
      sessionId: "17457c",
      runId: "post-fix",
      hypothesisId: "H-UI",
      location: "writing-hitl.ts:extractResearchCardProps",
      message: "research card props extracted",
      data: {
        topic: topic?.slice(0, 60) ?? null,
        factCount: facts.length,
        defCount: definitions.length,
        statCount: statistics.length,
        sourceCount: sources.length,
        insightCount: keyInsights.length,
        sampleFact: facts[0]?.text?.slice(0, 80) ?? null,
        outputKeys: Object.keys(output).slice(0, 12),
        pkgKeys: pkg ? Object.keys(pkg).slice(0, 12) : [],
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  return {
    topic,
    facts,
    definitions,
    statistics,
    sources,
    keyInsights,
    coverageScore:
      typeof summary?.coverage_score === "number"
        ? summary.coverage_score
        : typeof (pkg?.coverage as { coverage_score?: number } | undefined)?.coverage_score === "number"
          ? (pkg!.coverage as { coverage_score: number }).coverage_score
          : undefined,
    sourceCount:
      typeof summary?.source_count === "number"
        ? summary.source_count
        : Array.isArray(pkg?.sources)
          ? pkg!.sources.length
          : undefined,
    degraded: Boolean(summary?.degraded ?? pkg?.degraded ?? output.degraded),
  };
}

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

export type WritingHitlKind = "research" | "outline";

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

    if (tool === "research" || checkpoint === "research" || data.research_package || data.research_summary) {
      if (extractResearchCardProps(data)) {
        return { kind: "research", output: data };
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
