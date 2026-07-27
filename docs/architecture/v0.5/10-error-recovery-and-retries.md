# 10 — Error Recovery and Retry Strategy

## 1. Goals

- Fail gracefully without inventing success
- Prefer degrade-and-disclose over hard stop when a partial Research Package remains usable
- Bound retries, coverage loops, and optimize/revise loops
- Keep destructive actions behind human confirmation
- Preserve provenance: never “fix” missing sources by hallucinating

---

## 2. Error taxonomy

| Class | Examples | Default strategy |
|-------|----------|------------------|
| Transient | HTTP 429/503, timeout, Tavily blip | retry with backoff |
| Dependency down | Search unavailable, LLM outage | degrade Research or ask_user |
| Validation | Zod fail, missing blog_id, Writing without package_id | ask_user / clarify / abort Writing |
| Business rule | Destructive without confirm, strategy conflict | await_human |
| Model quality | Empty structured output | retry once → ask_user |
| Coverage shortfall | Phase 10 below threshold | coverage retry (max 1) then continue partial |
| Permanent | Authz denied, not found | abort_stage + explain |

---

## 3. Retry policy

| Operation | Max retries | Backoff |
|-----------|-------------|---------|
| LLM structured (CI.analyze / plan / skill phase) | 2 | immediate, then 500ms |
| Idempotent tool read (`search.web`, `blogs.get`) | 3 | exp 250ms–2s |
| Non-idempotent writes (publish, createDraft) | 0 automatic | ask_user |
| Research coverage loop (Phase 10 → 4) | **1** | immediate with remaining gaps |
| Writing draft | 1 | provider 5xx only |

**Never auto-retry** publish/delete/unpublish/schedule mutations.

---

## 4. Recovery strategies

### retry

Same skill/phase when `retryable && retry_count < max`.

### degrade

| Skill | Degradation |
|-------|-------------|
| Research | Emit partial Package: `degraded=true`, disclosure, honest `coverage_score`; skip competitor if needed |
| Writing | If sectional fails → single-shot draft **still from package slices** |
| Content Optimization | Drop failed validator; continue others; note in report |
| Analytics | Partial metrics |

### ask_user

Missing id, ambiguous blog match, confirmation, or **no Research Package available for Writing**.

### abort_stage

Stop pipeline; leave prior artifacts (e.g. strategy + partial research) intact; explain.

---

## 5. Writing without research (forbidden path)

If `plan` attempts Writing and `research_package_id` is missing:

1. Prefer re-plan → Research (lite or full per mode)
2. Else `ask_user` / abort — **do not** call Writing with empty research and silent web search

---

## 6. Optimize / revise bound

```
!quality_gate_passed && optimize_count < 2 → Writing revise(plan) → Content Optimization
else → compose + ask user (surface remaining Critical/High)
```

Quality gate: overall >= 72 and no Critical items ([17](./17-content-optimization.md)).

---

## 7. Human gates

| Action | Gate |
|--------|------|
| publish / unpublish / delete | `await_human` |
| strategy conflict proceed | explicit yes |
| outline approval | optional MVP; default post-MVP |
| low coverage proceed to write | auto in MVP with disclosure; HITL post-MVP |

---

## 8. Idempotency

Pass `turn_id` / idempotency keys on create/generate so retries do not duplicate blogs. Never generate twice for the same topic without user intent.

---

## 9. Partial success reporting

Composer must state what succeeded (e.g. strategy + research package saved), what failed, coverage_score, and safe next steps. Never claim publish without Publishing result.

---

## 10. Memory pipeline failures

| Failure | Strategy |
|---------|----------|
| remember job / Mongo down | Retry with backoff; DLQ; **do not** fail user turn |
| retrieve timeout | Degrade to Session + cached Workspace summary; disclose thin context |
| summarization fail | Keep raw tail; retry summarize later |
| idempotent replay | Same `turn_id` + candidate hash → no duplicate records |

See [18](./18-memory-manager.md).

## 11. Conversation Intelligence failures

| Failure | Strategy |
|---------|----------|
| CI.analyze timeout / malformed | Retry once; degrade to `unknown` + clarify or safe casual |
| Low confidence action | Prefer clarify only if blocking slots missing |
| CI says action but slots empty | compose clarify — do not start Research/Writing |
| Never | Invent a successful workflow when CI failed |

See [19](./19-conversation-intelligence.md).

## 12. Timeout budget

| Phase | Soft timeout |
|-------|----------------|
| CI.analyze + plan | 20s combined |
| Research full | 120–180s (stream phase progress) |
| Research lite | 45–60s |
| Writing / Content Optimization | 60–120s (optimization may stream validators) |
| whole turn | 240s then compose timeout message |

---

## Next

- Prompts: [11-prompts-and-context.md](./11-prompts-and-context.md)
