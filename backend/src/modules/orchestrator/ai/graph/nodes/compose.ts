import type { OrchestratorState } from "../state";

/** compose — format user-visible reply from CI style + artifacts (no understand). */
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

  if (ctx?.requires_clarification && ctx.clarification_question) {
    parts.push(ctx.clarification_question);
  } else if (ctx?.suggested_next_action === "casual_reply") {
    parts.push("Hey — happy to help whenever you're ready.");
  } else if (ctx?.suggested_next_action === "emit_memory_candidate") {
    parts.push("Got it — I'll remember that preference for this workspace.");
  } else if (state.strategy) {
    const angle = String((state.strategy as { content_angle?: string }).content_angle ?? "strategy ready");
    parts.push(`Strategy draft: ${angle}`);
  }

  if (state.research_summary) {
    parts.push(
      `Research (${state.research_summary.depth}): coverage ${state.research_summary.coverage_score.toFixed(2)} across ${state.research_summary.source_count} sources` +
        (state.research_summary.degraded ? " (degraded — Writing must not invent citations)." : ".") +
        (state.research_summary.contradiction_count
          ? ` Contradictions noted: ${state.research_summary.contradiction_count}.`
          : ""),
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
    parts.push(
      `Optimization gate ${overall}. Critical items: ${state.optimization_plan.critical.length}.`,
    );
    if (state.optimization_plan.writing_brief) {
      parts.push(state.optimization_plan.writing_brief);
    }
  }

  if (state.errors.length) {
    parts.push(`Note: ${state.errors.map((e) => e.message).join("; ")}`);
  }

  if (!parts.length) {
    if (ctx?.suggested_next_action === "explain" || ctx?.communicative_category === "ask_information") {
      const voice = (state.memory_views?.workspace_slice as { brand_voice?: string } | undefined)
        ?.brand_voice;
      parts.push(
        voice
          ? `We're using a “${voice}” brand voice based on workspace memory.`
          : "I can explain workspace settings, draft content, or research a topic — what do you need?",
      );
    } else {
      parts.push("Done — tell me what you'd like next.");
    }
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
