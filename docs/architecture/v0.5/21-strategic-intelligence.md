# 21 — Strategic Intelligence Layer

**Status:** Canonical design (M6 Strategic Intelligence)  
**Date:** 2026-07-29  
**Last updated:** 2026-08-06 (richer business profile hot keys + `/dashboard/business` UI)  
**ADR:** [ADR-015](../../architecture-decisions.md#adr-015--strategic-intelligence-hierarchy)  
**Companion:** [08](./08-memory-architecture.md), [18](./18-memory-manager.md), [14](./14-mvp-and-roadmap.md), [20](./20-go-to-market-architecture.md)  
**Supersedes (scope):** [`docs/CAMPAIGN_AGENT_IMPLEMENTATION_PLAN.md`](../../CAMPAIGN_AGENT_IMPLEMENTATION_PLAN.md) for “separate campaign chat agent” — campaign planning stays inside the orchestrator + campaign tools.

---

## Implementation status (2026-08-06)

| Area | Status | Notes |
|------|--------|-------|
| Phases 0–7 backend (T6.SI.0–7) | **Done** | Default Campaign, WorkspaceStrategy, beliefs, intelligence, plan policies, decision engine, learning-loop stubs |
| Single knowledge writer + source-aware confidence | **Done (M6.5)** | All strategic patches → BusinessKnowledge → project hot keys |
| Strategist product UI | **Done (M6.5)** | Strategy page = WorkspaceStrategy + gaps + decisions (not content themes) |
| Campaign ↔ strategy_id + required campaign_id | **Done (M6.5)** | Backfill + enforce on create / writing path |
| Content Intelligence closed loop (T6.1) | **Done (M6.5)** | Evidence-based confirm; hypothesis notes; decision signals |
| Decisions → roadmap/post proposals | **Done (M6.5)** | `POST /decisions/propose` HITL-gated |
| Agency multi-brand | Post-MVP | Doc 20 / T6.2 |

**Single-writer rule:** Business-field updates go through `BusinessKnowledgeService.upsertBelief` (with `source` + confidence), then `projectHotKeys` into `WorkspaceMemory.strategic`. Direct hot-only strategic patches for mapped fields are not the authority.

**Source-aware seed confidence (defaults):** `website_inferred` 0.5 · `onboarding` / interview 0.7 · `user_explicit` / settings 0.8 · `conversation` 0.65 · `analytics` / publish deltas capped · `onboarding_backfill` 0.55.

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

**Hot-key taxonomy (business profile):**

| Canonical key | Hot field | Notes |
|---|---|---|
| `business.industries` | `industries: string[]` | Industry labels |
| `business.model` | `business_model` | `b2b \| b2c \| c2c \| b2b2c` |
| `business.description` | `business_description` | Paragraph description of the business |
| `business.type` | _(legacy)_ | Read-migrates into `business_description`; excluded from gap scoring |
| `business.audience` | `target_audience: string[]` | Short audience labels |
| `business.customers` | `customers: { who, pain_points?, success?, label? }[]` | Persona profiles |
| `business.brand_voice` | `brand_voice` | Descriptive prose (not a one-word label) |
| `business.brand_negatives` | `brand_negatives` | Words / tones / claims to avoid |
| `business.competitors` | `competitors: { name, notes? }[]` | Named competitors (legacy `competitive_notes` migrates in) |
| `business.goals` | `business_goals` | |
| `business.seo_priorities` | `seo_priorities` | |
| `business.publishing_channels` | `publishing_channels` | |
| `business.tone` | `preferences.tone` | Short draft tone |

Lazy migration on read / `projectHotKeys`: `business_type` → `business_description`; `competitive_notes` → `competitors[]`; empty `customers` seeded from `target_audience` labels.

Product UI: `/dashboard/business` (sidebar) for view/edit + AI refine CTAs into orchestrator chat.

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
| Decisions | `GET /sites/:siteId/decisions/next`, `POST .../decisions/propose` (HITL plan/awareness proposals) |
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

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0 | This doc + ADR-015 + timeline | Done |
| 1 | Default Campaign + Blog.campaign_id | Done |
| 2 | WorkspaceStrategy CRUD + generation | Done |
| 3 | Belief taxonomy + gaps + projection | Done |
| 4 | Campaign enrichment + intelligence + strategic health | Done |
| 5 | Orchestrator plan policies | Done |
| 6 | Strategic Decision Engine | Done |
| 7 | Learning loop (publish/stats → beliefs/strategy) | Done (thin stubs) |
| 8 (M6.5) | Single writer, product UI, hierarchy harden, T6.1 loop, decisions→planning | Done |

---

## 10. Risks

Over-asking → cap questions, never block quick_draft. Dual WorkspaceMemory/MemoryRecord → Memory Manager single writer + projection. Latency → retrieval profiles. Naming → typed names in code/docs.

This document is the **authoritative** source for strategic hierarchy. Update it before diverging in code.
