import type { SpanName, SpanStatus } from "./turn-tracer";

type LatencyBucket = { count: number; total_ms: number; max_ms: number };

const latencies = new Map<string, LatencyBucket>();
const counters = new Map<string, number>();

function key(name: string, label?: string): string {
  return label ? `${name}|${label}` : name;
}

/** Lightweight in-process metrics (doc 12 / inventory skill-metrics). */
export function recordSkillLatency(name: SpanName | string, latencyMs: number, label?: string): void {
  const k = key(name, label);
  const prev = latencies.get(k) ?? { count: 0, total_ms: 0, max_ms: 0 };
  latencies.set(k, {
    count: prev.count + 1,
    total_ms: prev.total_ms + latencyMs,
    max_ms: Math.max(prev.max_ms, latencyMs),
  });
}

export function recordSpanCount(name: SpanName | string, status: SpanStatus): void {
  const k = key(`${name}.count`, status);
  counters.set(k, (counters.get(k) ?? 0) + 1);
}

export function incrementCounter(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function getLatencySnapshot(name: SpanName | string, label?: string): LatencyBucket | undefined {
  return latencies.get(key(name, label));
}

export function getCounter(name: string): number {
  return counters.get(name) ?? 0;
}

export function resetSkillMetrics(): void {
  latencies.clear();
  counters.clear();
}

export function skillMetricsSnapshot(): {
  latencies: Record<string, LatencyBucket & { avg_ms: number }>;
  counters: Record<string, number>;
} {
  const lat: Record<string, LatencyBucket & { avg_ms: number }> = {};
  for (const [k, v] of latencies.entries()) {
    lat[k] = { ...v, avg_ms: v.count ? v.total_ms / v.count : 0 };
  }
  return { latencies: lat, counters: Object.fromEntries(counters.entries()) };
}
