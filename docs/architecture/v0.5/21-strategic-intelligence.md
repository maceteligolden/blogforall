# 21 — Strategic Intelligence Layer

**Status:** Canonical design (M6 Strategic Intelligence)  
**Date:** 2026-07-29  
**ADR:** [ADR-015](../../architecture-decisions.md#adr-015--strategic-intelligence-hierarchy)  
**Companion:** [08](./08-memory-architecture.md), [18](./18-memory-manager.md), [14](./14-mvp-and-roadmap.md), [20](./20-go-to-market-architecture.md)  
**Supersedes (scope):** [`docs/CAMPAIGN_AGENT_IMPLEMENTATION_PLAN.md`](../../CAMPAIGN_AGENT_IMPLEMENTATION_PLAN.md) for “separate campaign chat agent” — campaign planning stays inside the orchestrator + campaign tools.

---

## 1. Philosophy

Bloggr’s AI is a **strategist**, not primarily a writer. Content is one output of a larger loop:

```
Business Understanding → Strategy → Campaign → Knowledge Gathering →
Content Planning → Generation → Publishing → Performance → Strategy Refinement
```

The strategy is a **living knowledge system**, not a static document.

---

## 2. Hierarchy

```
Site (Workspace)
  ├── Business Knowledge (confidence-scored beliefs)
  ├── WorkspaceStrategy (default long-term direction)
  ├── Campaigns (incl. exactly one Default / Evergreen)
  └── Content (Blog.campaign_id required)
```

**Rules**

- Exactly one `Campaign.is_default` per site.
- Every Blog belongs to a Campaign; missing id → Default Campaign.
- Campaigns inherit the active WorkspaceStrategy unless pinned.
- Naming: **WorkspaceStrategy** (business) ≠ **ContentStrategyArtifact** (per-post) ≠ `strategy_state` (content themes / program).

---

## 3. Domain model

### BusinessKnowledgeBelief

Implemented as `MemoryRecord` with a constrained `canonical_key` taxonomy (not a parallel collection).

| Field | Notes |
|-------|--------|
| `canonical_key` | e.g. `business.audience`, `business.usp`, `business.objections` |
| `confidence` / `importance` | 0–1 on `metadata` |
| `source` | onboarding \| conversation \| edit \| publish \| analytics \| user_explicit \| doc_upload |

Hot keys project into `WorkspaceMemory.strategic` for cheap reads.

### WorkspaceStrategy

Collection `workspace_strategies`: purpose, long_term_outcomes, principles, audience_summary, perception_goals, constraints, version, status (active\|archived), generated_from, confidence_summary.

### Campaign (extended)

Adds: `is_default`, `strategy_id`, messaging, desired_transformation, funnel_focus, guardrails, assumptions, hypotheses, related_products, supporting_evidence, `intelligence` (cached snapshot). Schedule/lifecycle fields retained.

### CampaignIntelligence

Cached on campaign: knowledge gaps, funnel coverage, assumptions unverified, next questions, progress, success_probability, recommended_actions, dimension scores.

### StrategicDecision

Ranked next actions (gather knowledge, publish, refine messaging, new campaign, …). Content generation is one option.

---

## 4. Orchestration flow

```
CI → Memory retrieve (strategy_full) → Load WorkspaceStrategy →
Resolve Campaign → StrategicDecisionEngine →
  clarify | gather_knowledge | ContentStrategy → Research → Write → Optimize |
  refine_strategy
→ rememberAsync
Publish / stats → Content Intelligence → belief confirm/invalidate
```

Feature flag: `STRATEGIC_INTELLIGENCE_ENABLED`.

Unbound content intent → strategist clarification (Default vs existing vs new campaign) before generation when the flag is on (except `quick_draft`, which silently uses Default).

---

## 5. Lifecycles (summary)

**Knowledge:** seed (onboarding) → gap detect → ask (≤1–2/turn) → evaluate → New/Confirmed/Updated/Invalidated → project → retrieve.

**Campaign:** ensure Default → create under Strategy → intelligence bootstrap → roadmap → approve → execute → learn → refine/complete.

**Strategy:** generate after onboarding → user/AI edit (HITL for material changes) → version/archive → never block content (stub if missing).

---

## 6. APIs

| Area | Endpoints |
|------|-----------|
| Strategy | `GET/PATCH /sites/:siteId/strategy`, `GET .../versions`, `POST .../regenerate` |
| Knowledge | `GET/PATCH /sites/:siteId/knowledge`, `GET .../gaps` |
| Campaign | existing + `.../intelligence`, `.../intelligence/recompute`; no orphan remove-from-campaign |
| Decisions | `GET /sites/:siteId/decisions/next` |
| Blogs | `campaign_id` accepted; server defaults to Default Campaign |

Orchestrator tools: `strategy.*`, `knowledge.*`, `decisions.propose`, campaign resolve helpers.

---

## 7. Events

| Event | Consumers |
|-------|-----------|
| onboarding / setup complete | Seed beliefs; WorkspaceStrategy; Default Campaign |
| belief updated | WorkspaceMemory projection; intelligence invalidate |
| campaign created / roadmap approved | Intelligence recompute |
| blog published / stats updated | Campaign counters; Content Intelligence; hypothesis hooks |
| strategy refined | Active campaigns notified |

---

## 8. Migration

1. Additive schema + `STRATEGIC_INTELLIGENCE_ENABLED`.
2. Backfill Default Campaign per site; blogs + unbound scheduled posts → Default.
3. Seed beliefs from WorkspaceMemory (~0.55 confidence).
4. Generate WorkspaceStrategy (stub if thin onboarding).
5. Require `campaign_id` after backfill; reassignment required instead of orphaning.

---

## 9. Phased delivery

| Phase | Deliverable |
|-------|-------------|
| 0 | This doc + ADR-015 + timeline |
| 1 | Default Campaign + Blog.campaign_id |
| 2 | WorkspaceStrategy CRUD + generation |
| 3 | Belief taxonomy + gaps + projection |
| 4 | Campaign enrichment + intelligence + strategic health |
| 5 | Orchestrator plan policies |
| 6 | Strategic Decision Engine |
| 7 | Learning loop (publish/stats → beliefs/strategy) |

---

## 10. Risks

Over-asking → cap questions, never block quick_draft. Dual WorkspaceMemory/MemoryRecord → Memory Manager single writer + projection. Latency → retrieval profiles. Naming → typed names in code/docs.

This document is the **authoritative** source for strategic hierarchy. Update it before diverging in code.
