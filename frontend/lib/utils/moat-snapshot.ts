import type { ChatTurnResponse, OrchestratorMessage, V05MoatSnapshot } from "@/lib/api/types/orchestrator.types";

function asMoatPiece(data: Record<string, unknown> | undefined): V05MoatSnapshot {
  if (!data) return {};
  const research_summary = data.research_summary as V05MoatSnapshot["research_summary"] | undefined;
  const optimization = data.optimization as V05MoatSnapshot["optimization"] | undefined;
  return {
    ...(research_summary ? { research_summary } : {}),
    ...(optimization ? { optimization } : {}),
  };
}

/** Merge moat snapshots from v05 response and/or skill tool_calls. */
export function extractMoatSnapshot(input: {
  v05?: ChatTurnResponse["v05_graph"];
  toolCalls?: Array<{ tool: string; output_data?: Record<string, unknown> }>;
  messages?: OrchestratorMessage[];
}): V05MoatSnapshot | null {
  let research_summary = input.v05?.research_summary;
  let optimization = input.v05?.optimization;

  const consider = (tool: string, data?: Record<string, unknown>) => {
    const piece = asMoatPiece(data);
    if (tool === "research" && piece.research_summary) research_summary = piece.research_summary;
    if (tool === "content_optimization" && piece.optimization) optimization = piece.optimization;
  };

  for (const call of input.toolCalls ?? []) {
    consider(call.tool, call.output_data);
  }
  for (const m of input.messages ?? []) {
    for (const call of m.tool_calls ?? []) {
      consider(call.tool, call.output_data as Record<string, unknown> | undefined);
    }
  }

  if (!research_summary && !optimization) return null;
  return { research_summary, optimization };
}
