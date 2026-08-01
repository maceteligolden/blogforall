import { randomUUID } from "crypto";
import { logger } from "../../../../shared/utils/logger";
import { addSentryBreadcrumb } from "../../../../shared/observability/sentry";
import { recordSkillLatency, recordSpanCount } from "./skill-metrics";

export type SpanName =
  | "turn"
  | "ci.analyze"
  | "memory.retrieve"
  | "plan"
  | "skill"
  | "compose"
  | "persist"
  | "memory.remember.enqueue";

export type SpanStatus = "ok" | "error";

export type SpanCorrelation = {
  turn_id?: string;
  thread_id?: string;
  workspace_id?: string;
  user_id?: string;
  skill_id?: string;
  skill_run_id?: string;
  ci_analyze_id?: string;
  research_package_id?: string;
  optimization_report_id?: string;
  memory_job_id?: string;
};

export type CompletedSpan = {
  span_id: string;
  name: SpanName;
  started_at: string;
  ended_at: string;
  latency_ms: number;
  status: SpanStatus;
  attrs: SpanCorrelation & Record<string, unknown>;
  error?: string;
};

export type SpanHandle = {
  span_id: string;
  name: SpanName;
  setAttributes: (attrs: Record<string, unknown>) => void;
  end: (result?: { status?: SpanStatus; error?: string; attrs?: Record<string, unknown> }) => CompletedSpan;
};

/**
 * Turn tracer (doc 12) — structured spans for CI → plan → skills → memory.
 * Logs via AppLogger + Sentry breadcrumbs; OTEL/LangSmith can wrap later.
 */
export class TurnTracer {
  private readonly completed: CompletedSpan[] = [];
  private readonly base: SpanCorrelation;

  constructor(base: SpanCorrelation = {}) {
    this.base = { ...base };
  }

  get spans(): readonly CompletedSpan[] {
    return this.completed;
  }

  startSpan(name: SpanName, attrs: Record<string, unknown> = {}): SpanHandle {
    const span_id = randomUUID();
    const started = Date.now();
    const started_at = new Date(started).toISOString();
    let merged: SpanCorrelation & Record<string, unknown> = {
      ...this.base,
      ...attrs,
    };

    return {
      span_id,
      name,
      setAttributes: (more) => {
        merged = { ...merged, ...more };
      },
      end: (result) => {
        const ended = Date.now();
        const latency_ms = ended - started;
        const status = result?.status ?? "ok";
        const finalAttrs = { ...merged, ...(result?.attrs ?? {}) };
        const completed: CompletedSpan = {
          span_id,
          name,
          started_at,
          ended_at: new Date(ended).toISOString(),
          latency_ms,
          status,
          attrs: finalAttrs,
          error: result?.error,
        };
        this.completed.push(completed);
        recordSpanCount(name, status);
        recordSkillLatency(name, latency_ms);

        const logMeta = {
          event: `orch.span.${name}`,
          span_id,
          latency_ms,
          status,
          ...sanitizeForLog(finalAttrs),
          ...(result?.error ? { error: result.error } : {}),
        };
        if (status === "error") {
          logger.warn(`Orchestrator span failed: ${name}`, logMeta, "TurnTracer");
        } else {
          logger.info(`Orchestrator span: ${name}`, logMeta, "TurnTracer");
        }
        addSentryBreadcrumb(`orch.${name}`, status === "error" ? "warning" : "info", logMeta);
        return completed;
      },
    };
  }

  /** Convenience: time an async fn as a named span. */
  async timed<T>(name: SpanName, attrs: Record<string, unknown>, fn: (span: SpanHandle) => Promise<T>): Promise<T> {
    const span = this.startSpan(name, attrs);
    try {
      const value = await fn(span);
      span.end({ status: "ok" });
      return value;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      span.end({ status: "error", error: message });
      throw e;
    }
  }
}

function sanitizeForLog(attrs: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined) continue;
    // Never dump raw user message / draft HTML into default logs.
    if (k === "message" || k === "content" || k === "prompt_block") continue;
    out[k] = v;
  }
  return out;
}

export function createTurnTracer(base: SpanCorrelation): TurnTracer {
  return new TurnTracer(base);
}
