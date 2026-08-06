import type { ResearchPackage } from "../../contracts/research-package";
import type { OrchestratorState } from "../state";

function formatResearchReport(pkg: ResearchPackage, summary?: OrchestratorState["research_summary"]): string {
  const topic = pkg.topic || summary?.topic || "this topic";
  const notes = [...pkg.facts, ...pkg.definitions, ...pkg.statistics, ...pkg.examples, ...pkg.recent_developments]
    .map((f) => f.text.trim())
    .filter(Boolean)
    .slice(0, 8);

  const sources = (
    pkg.sources.length
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
      `I pulled ${summary?.source_count ?? pkg.sources.length} sources but didn’t extract clear notes — skim the sources below.`
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

  const hitlResearch =
    state.workflow_stage === "research" ||
    state.metadata?.writing_checkpoint === "research" ||
    state.plan?.confirmation?.kind === "research_approval";
  const hitlOutline =
    state.workflow_stage === "outline" ||
    state.metadata?.writing_checkpoint === "outline" ||
    state.plan?.confirmation?.kind === "outline_approval";

  if (state.research_package || state.research_summary) {
    if (hitlResearch && !state.outline && !state.draft) {
      // Card owns the full board; also include a short bullet preview so findings
      // are never "empty" if the card payload fails to render.
      const preview = [
        ...(state.research_package?.facts ?? []).map((f) => f.text),
        ...(state.research_package?.definitions ?? []).map((f) => f.text),
        ...(state.research_package?.statistics ?? []).map((f) => f.text),
      ]
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 5);
      parts.push("Research is ready — review the findings below.");
      if (preview.length) {
        parts.push("", ...preview.map((t) => `• ${t.slice(0, 180)}`));
      }
    } else if (state.research_package) {
      parts.push(formatResearchReport(state.research_package, state.research_summary));
    } else if (state.research_summary) {
      parts.push(
        `Research (${state.research_summary.depth}) on “${state.research_summary.topic}”: coverage ${state.research_summary.coverage_score.toFixed(2)} across ${state.research_summary.source_count} sources` +
          (state.research_summary.degraded ? " (degraded — Writing must not invent citations)." : ".") +
          (state.research_summary.contradiction_count
            ? ` Contradictions noted: ${state.research_summary.contradiction_count}.`
            : "") +
          " Full notes weren’t available this turn — ask me to expand on any angle."
      );
    }
  }

  if (state.outline) {
    const outline = state.outline as { title?: string; sections?: Array<{ heading: string }> };
    if (hitlOutline && !state.draft) {
      parts.push("Outline is ready — review the structure below.");
    } else {
      const headings = (outline.sections ?? []).map((s) => s.heading).filter(Boolean);
      parts.push(
        headings.length
          ? `Outline “${outline.title ?? "Draft"}”: ${headings.join(" → ")}.`
          : `Outline ready${outline.title ? `: “${outline.title}”` : ""}.`
      );
    }
  }

  if (state.draft) {
    const title = String((state.draft as { title?: string }).title ?? "Draft");
    const campaignHint =
      typeof state.metadata?.campaign_name === "string" && state.metadata.campaign_name.trim()
        ? ` It sits under **${state.metadata.campaign_name}**.`
        : state.campaign_id
          ? " It’s attached to your campaign."
          : "";
    const strategyHint =
      typeof state.metadata?.strategy_purpose === "string" && state.metadata.strategy_purpose.trim()
        ? ` Strategy focus: ${String(state.metadata.strategy_purpose).slice(0, 120)}.`
        : "";
    parts.push(
      `Draft ready: “${title}”.${campaignHint}${strategyHint} Open it in the results panel when you want to edit.`
    );
  }

  if (state.optimization_plan) {
    const overall = state.quality_gate_passed ? "looks solid" : "needs a bit more work";
    const scores = state.metadata?.quality_scores as { seo?: number; gao?: number; overall?: number } | undefined;
    const scoreLine =
      scores && [scores.seo, scores.gao, scores.overall].every((n) => typeof n === "number")
        ? ` SEO ${scores.seo} / GAO ${scores.gao} / overall ${scores.overall}.`
        : "";
    parts.push(`Quality check ${overall}.${scoreLine}`);
    if (state.optimization_plan.critical.length) {
      parts.push(`Worth fixing next: ${state.optimization_plan.critical.slice(0, 2).join("; ")}.`);
    }
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
        "What should we tackle next — a draft, research, or something else in the workspace?"
    );
  } else if (!hitlResearch && !hitlOutline && !parts[parts.length - 1]?.includes("?")) {
    parts.push("Want me to tweak anything, or shall we move on?");
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
