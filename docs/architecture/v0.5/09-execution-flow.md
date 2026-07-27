# 09 — Execution Flow

## 1. Casual chat turn

```mermaid
sequenceDiagram
  participant U as User
  participant S as OrchestratorService
  participant CI as ConversationIntelligence
  participant G as LangGraph
  participant C as Conversation

  U->>S: "What tone are we using?"
  S->>CI: analyze → ask_information / explain
  S->>G: invoke conversation_context
  G->>G: load_context
  G->>G: plan next=compose
  G->>C: purpose=explain
  C-->>G: reply
  G->>G: persist
  G-->>U: brand voice from memory
```

---

## 2. Strategist pipeline (create article)

User: “Write a high-quality post about remote payroll compliance for SMBs.”

```mermaid
flowchart TD
  CI[CI.analyze request_action] --> A[load_context]
  A --> C{requires_clarification}
  C -->|yes| D[compose_clarify]
  C -->|no strategist| E[ContentStrategy]
  E --> F[Research_full]
  F --> G[Writing_outline]
  G --> H[Writing_draft]
  H --> I[ContentOptimization]
  I --> J{quality_gate_or_max}
  J -->|fail and optimize_count lt 2| K[Writing_revise]
  K --> I
  J -->|pass or max| L[compose_summary]
  L --> M[persist]
```

**Research → Writing detail:**

```mermaid
sequenceDiagram
  participant Orch as Orchestrator
  participant Res as Research
  participant Mem as ContentMemory
  participant W as Writing

  Orch->>Res: depth=full
  Res-->>Orch: research_package_id + summary
  Res->>Mem: save package
  Orch->>W: outline
  W->>Mem: load package slices
  W-->>Orch: outline
  Orch->>W: draft
  W->>Mem: load package slices
  W-->>Orch: draft HTML
```

**User-visible reply** includes: strategy angle, research coverage_score + source count, contradictions note if any, outline headings, preview link, SEO/GAO/overall scores + Critical plan items, offer to publish or deepen research.

**Publish** is a separate turn → `await_human` → Publishing.

---

## 3. Quick draft mode

User: “Quick draft: 5 tips for founders hiring remotely.”

```
CI.analyze → load_context (mode=quick_draft)
  → plan → Research depth=lite
  → Writing draft
  → Content Optimization
  → compose (preview_url) → persist
```

**No** Writing-embedded Tavily. Lite package still carries provenance (thinner).

---

## 4. Publish with confirmation

Unchanged: resolve blog_id → `await_human` → Publishing on explicit confirm. Exact tool names in confirmation payload.

---

## 5. Content Optimization → revise loop

```
Content Optimization (draft + Research Package + strategy)
  → quality_gate_passed?
  no + optimize_count < 2 → Writing revise(OptimizationPlan Critical+High) → Content Optimization
  yes → compose (scores + plan summary)
  no + optimize_count >= 2 → compose remaining Critical/High; ask user
```

Gate: `overall >= 72` AND zero Critical planner items. See [17](./17-content-optimization.md).

---

## 6. Strategy conflict

Warn via Conversation / `await_human` (`strategy_warning`) before Research/Writing if topic conflicts with workspace goals.

---

## 7. Research-only turn

User: “Research competitors on AI payroll blogging.”

```
CI.analyze (workflow_intent=research) → load_context → plan
  → Research depth=full
  → Conversation summarize package (coverage, competitor gaps, key sources)
  → persist package for later Writing
```

---

## 8. Analytics turn

```
Analytics → Conversation summarize recommendations
```

---

## 9. Failure path (research degraded)

```
Research tool/coverage failure
  → recover: degrade
  → ResearchPackage.degraded=true + disclosure + honest coverage_score
  → Writing may continue with package slices + soft language on gaps
  → compose discloses limitation to user
```

If Research fails completely and no package exists, **do not** let Writing invent sources — compose ask_user or abort_stage.

---

## 10. Onboarding

Legacy supervisor until ported; then Conversation + plan policy with `workspace.completeOnboarding` only.

---

## 11. Memory retrieve → act → remember (background)

```mermaid
sequenceDiagram
  participant U as User
  participant Orch as Orchestrator
  participant MM as MemoryManager
  participant Skills as Skills

  U->>Orch: message
  Orch->>MM: retrieve profile
  Note over Orch: CI already ran pre-graph
  MM-->>Orch: MemoryViews
  Orch->>Skills: strategy research write optimize
  Orch-->>U: reply
  Orch->>MM: rememberAsync candidates
  Note over MM: evaluate classify score persist index
```

Rules:

- Retrieve is sync on `load_context`
- Remember is async after reply (onboarding may sync)
- Skills do not write belief Mongo; Research Package facts may enqueue Knowledge candidates
- Optimization accept/reject enqueues Learning candidates
- Publish/stats may enqueue Content Intelligence candidates

See [18-memory-manager.md](./18-memory-manager.md).

## 12. Conversation Intelligence handoff

```mermaid
sequenceDiagram
  participant U as User
  participant S as OrchService
  participant CI as ConversationIntelligence
  participant MM as MemoryManager
  participant G as LangGraph

  U->>S: message
  S->>MM: retrieve chat_light
  S->>CI: analyze
  CI-->>S: ConversationContext
  S->>G: invoke with conversation_context
  G->>G: load_context enrich
  G->>G: plan from CI priors
```

Clear actions start workflows. Casual / explain → compose only. Preferences → memory candidates. See [19](./19-conversation-intelligence.md).

## Next

- Errors: [10-error-recovery-and-retries.md](./10-error-recovery-and-retries.md)
- Research: [16-research-pipeline.md](./16-research-pipeline.md)
