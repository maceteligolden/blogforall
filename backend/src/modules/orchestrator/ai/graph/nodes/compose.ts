import type { ResearchPackage } from "../../contracts/research-package";
import type { OrchestratorState } from "../state";

function formatResearchReport(pkg: ResearchPackage, summary?: OrchestratorState["research_summary"]): string {
  const topic = pkg.topic || summary?.topic || "this topic";
  const notes = [
    ...pkg.facts,
    ...pkg.definitions,
    ...pkg.statistics,
    ...pkg.examples,
    ...pkg.recent_developments,
  ]
    .map((f) => f.text.trim())
    .filter(Boolean)
    .slice(0, 8);

  const sources = (pkg.sources.length
    ? pkg.sources
    : pkg.references.map((r) => ({
        title: r.title,
        url: r.url,
      }))
  )
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.title}${s.url ? ` — ${s.url}` : ""}`);

  const lines: string[] = [`Here’s what I found on “${topic}”:`];

  if (notes.length) {
    lines.push("", "Notes", ...notes.map((n) => `• ${n}`));
  } else {
    lines.push(
      "",
      `I pulled ${summary?.source_count ?? pkg.sources.length} sources but didn’t extract clear notes — skim the sources below.`,
    );
  }

  if (sources.length) {
    lines.push("", "Sources", ...sources);
  }

  if (summary?.degraded || pkg.degraded) {
    lines.push("", "(Research was degraded — treat citations carefully.)");
  }

  if (summary?.contradiction_count || pkg.contradictions?.length) {
    const n = summary?.contradiction_count ?? pkg.contradictions.length;
    lines.push("", `Contradictions noted: ${n}.`);
  }

  return lines.join("\n");
}

/**
 * compose — format user-visible reply from artifacts / Conversation skill reply.
 * Clarification, casual, and explain dialogue are produced by the Conversation skill;
 * this node only formats artifacts or uses an existing reply.
 */
export function composeNode(state: OrchestratorState): Partial<OrchestratorState> {
  if (state.reply?.trim()) {
    return {
      progress_events: [
        {
          type: "compose",
          message: "Using existing reply",
          at: new Date().toISOString(),
        },
      ],
    };
  }

  const ctx = state.conversation_context;
  const parts: string[] = [];

  if (ctx?.suggested_next_action === "emit_memory_candidate") {
    parts.push("Got it — I'll remember that preference for this workspace.");
  }
  // Strategy artifacts are discussed via Conversation skill — never dump raw "Strategy draft:" to chat.

  if (state.research_package) {
    parts.push(formatResearchReport(state.research_package, state.research_summary));
  } else if (state.research_summary) {
    parts.push(
      `Research (${state.research_summary.depth}) on “${state.research_summary.topic}”: coverage ${state.research_summary.coverage_score.toFixed(2)} across ${state.research_summary.source_count} sources` +
        (state.research_summary.degraded ? " (degraded — Writing must not invent citations)." : ".") +
        (state.research_summary.contradiction_count
          ? ` Contradictions noted: ${state.research_summary.contradiction_count}.`
          : "") +
        " Full notes weren’t available this turn — ask me to expand on any angle.",
    );
  }

  if (state.outline) {
    const outline = state.outline as { title?: string; sections?: Array<{ heading: string }> };
    const headings = (outline.sections ?? []).map((s) => s.heading).filter(Boolean);
    parts.push(
      headings.length
        ? `Outline “${outline.title ?? "Draft"}”: ${headings.join(" → ")}.`
        : `Outline ready${outline.title ? `: “${outline.title}”` : ""}.`,
    );
  }

  if (state.draft) {
    const title = String((state.draft as { title?: string }).title ?? "Draft");
    parts.push(`Draft ready: “${title}”.`);
  }

  if (state.optimization_plan) {
    const overall = state.quality_gate_passed ? "passed" : "needs work";
    const scores = state.metadata?.quality_scores as
      | { seo?: number; gao?: number; overall?: number }
      | undefined;
    const scoreLine =
      scores &&
      [scores.seo, scores.gao, scores.overall].every((n) => typeof n === "number")
        ? ` SEO ${scores.seo} / GAO ${scores.gao} / overall ${scores.overall}.`
        : "";
    parts.push(
      `Optimization gate ${overall}.${scoreLine} Critical items: ${state.optimization_plan.critical.length}.`,
    );
    if (state.optimization_plan.writing_brief) {
      parts.push(state.optimization_plan.writing_brief);
    }
  }

  if (state.errors.length) {
    parts.push(`Note: ${state.errors.map((e) => e.message).join("; ")}`);
  }

  // Last-resort only — Conversation skill should normally have set reply already.
  if (!parts.length) {
    parts.push(
      ctx?.clarification_question?.trim() ||
        "What would you like to do next — draft, research, or look something up here?",
    );
  }

  const brevity = ctx?.response_style?.brevity;
  let reply = parts.join("\n\n");
  if (brevity === "short" && reply.length > 280) {
    reply = reply.slice(0, 277) + "...";
  }

  const candidates =
    ctx?.suggested_next_action === "emit_memory_candidate"
      ? [
          {
            turn_id: state.turn_id,
            workspace_id: state.workspace_id,
            user_id: state.user_id,
            text: state.message,
            source: "user_utterance" as const,
            proposed_layer: "user_preference" as const,
            proposed_key: "preference.raw",
            proposed_value: state.message,
            confidence: ctx.confidence,
          },
        ]
      : [];

  return {
    reply,
    memory_candidates: candidates,
    progress_events: [
      {
        type: "compose",
        message: "Composed user reply",
        at: new Date().toISOString(),
      },
    ],
  };
}
