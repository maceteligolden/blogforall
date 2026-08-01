/**
 * In-memory realtime metrics with OTel-shaped names for later export.
 */
class RealtimeMetricsStore {
  private counters = new Map<string, number>();
  private activeConnections = 0;

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  setActive(n: number): void {
    this.activeConnections = Math.max(0, n);
  }

  adjustActive(delta: number): void {
    this.activeConnections = Math.max(0, this.activeConnections + delta);
  }

  observeDuration(name: string, ms: number): void {
    this.inc(`${name}.count`);
    this.inc(`${name}.sum_ms`, Math.round(ms));
  }

  snapshot(): Record<string, number> {
    const out: Record<string, number> = {
      "realtime.connections.active": this.activeConnections,
    };
    for (const [k, v] of this.counters) {
      out[k] = v;
    }
    return out;
  }

  resetForTests(): void {
    this.counters.clear();
    this.activeConnections = 0;
  }
}

export const realtimeMetrics = new RealtimeMetricsStore();
