# 12 — Observability and Logging

## 1. Goals

- Reconstruct turns: CI → nodes → skills → Memory Manager → tools
- Cost/latency per CI analyze, skill, research phase, optimization validator, memory job
- Provenance (research) + quality gate (optimize) + memory rates + **CI category accuracy**
- LangSmith / OpenTelemetry ready

---

## 2. Correlation IDs

Include: `turn_id`, `thread_id`, `workspace_id`, `skill_run_id`, `research_package_id`, `optimization_report_id`, `memory_job_id`, **`ci_analyze_id`**.

---

## 3. Conversation Intelligence events

```typescript
{
  type: "ci.analyze",
  communicative_category?: string,
  workflow_intent?: string,
  suggested_next_action?: string,
  confidence?: number,
  requires_clarification?: boolean,
  action_required?: boolean,
  latency_ms?: number
}
```

Do not log full message bodies with PII by default.

---

## 4. Memory events

```typescript
{
  type: "memory.retrieve" | "memory.remember.enqueue" | "memory.remember.job" | "memory.summarize",
  profile?: string,
  layer?: string,
  status?: "stored" | "ignored" | "superseded" | "failed",
  token_budget_used?: number,
  latency_ms?: number
}
```

---

## 5. Metrics

| Metric | Use |
|--------|-----|
| `ci.analyze.latency_ms` | SLO |
| `ci.category_rate{category}` | Product mix |
| `ci.false_passive_ack` (sampled eval) | Literal-over-action regressions |
| `ci.clarify_rate` | Over-clarification |
| `memory.retrieve.latency_ms{profile}` | SLO |
| `memory.remember.ignore_rate` | Noise control |
| Existing orch/research/optimize metrics | Unchanged |

---

## 6. Tracing

```
turn
 ├─ ci.analyze
 ├─ memory.retrieve
 ├─ plan
 ├─ skills…
 ├─ memory.remember.enqueue
 └─ (async) memory.job
```

---

## Next

- Testing: [13-testing-strategy.md](./13-testing-strategy.md)
- CI: [19-conversation-intelligence.md](./19-conversation-intelligence.md)
