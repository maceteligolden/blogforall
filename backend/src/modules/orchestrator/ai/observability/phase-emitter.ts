/**
 * Coarse client-facing workflow phases (docs 06 §5, 16 § UI map).
 * Used for staging demos / SSE wiring — no PII message bodies.
 */

export type WorkflowPhaseEvent = {
  phase: string;
  message: string;
  percent?: number;
  skill_id?: string;
  meta?: Record<string, unknown>;
};

export type PhaseListener = (event: WorkflowPhaseEvent) => void;

export function createPhaseCollector(onPhase?: PhaseListener): {
  phases: WorkflowPhaseEvent[];
  emit: PhaseListener;
} {
  const phases: WorkflowPhaseEvent[] = [];
  return {
    phases,
    emit: (event) => {
      phases.push(event);
      onPhase?.(event);
    },
  };
}
