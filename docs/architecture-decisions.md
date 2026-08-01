# Bloggr — Architecture Decision Records (ADR)

**Status:** Active  
**Added:** 2026-07-27  
**Last updated:** 2026-07-27  
**Companion:** [`docs/project-timeline.md`](./project-timeline.md)  
**Architecture home:** [`docs/architecture/v0.5/`](./architecture/v0.5/)

---

## How to use

- **Before proposing new architecture:** search this file for conflicts, prior rejections, or existing Approvals.
- **When deciding:** add a new ADR (do not overwrite history). If replacing an old decision, set the old one to `Deprecated` and link the new ADR.
- **Status values:** `Proposed` | `Approved` | `Rejected` | `Deprecated`

Lifecycle fields on each ADR: **Date Added**, **Last Updated**, **Closed** (when Deprecated/Rejected finalized).

---

## Index

| ID | Title | Status | Date Added |
|----|-------|--------|------------|
| ADR-001 | Single LangGraph orchestrator (no multi-agent peers) | Approved | 2026-07-27 |
| ADR-002 | Conversation Intelligence before orchestrator | Approved | 2026-07-27 |
| ADR-003 | Memory Manager as KMS (not a skill) | Approved | 2026-07-27 |
| ADR-004 | Research Package + nested Research graph; Writing never searches | Approved | 2026-07-27 |
| ADR-005 | Content Optimization replaces Review | Approved | 2026-07-27 |
| ADR-006 | MongoDB SoR for memory; Qdrant optional | Approved | 2026-07-27 |
| ADR-007 | Async remember; sync retrieve; enrich-only double-fetch policy | Approved | 2026-07-27 |
| ADR-008 | MVP numeric locks (coverage_min, max_skills, optimize gate) | Approved | 2026-07-27 |
| ADR-009 | Model routing tiers for MVP | Approved | 2026-07-27 |
| ADR-010 | AI authorization minimum (View/Edit/All) | Approved | 2026-07-27 |
| ADR-011 | Strangler fig + supervisor fallback through M4 | Approved | 2026-07-27 |
| ADR-012 | Workspace = brand; no cross-workspace Knowledge in MVP | Approved | 2026-07-27 |
| ADR-013 | Project execution via timeline + ADR docs | Approved | 2026-07-27 |
| ADR-014 | M5 single default brain; cognition removed | Approved | 2026-07-27 |
| ADR-015 | Strategic intelligence hierarchy | Approved | 2026-07-29 |

---

## ADR-001 — Single LangGraph orchestrator (no multi-agent peers)

### Decision
Use one LangGraph orchestrator that plans and dispatches skills. Do not use multi-agent peer chat.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Peer agents create ownership fights, unbounded latency, and untestable prompt spaghetti. A single coordinator with modular skills is maintainable and aligns with MVP delivery.

### Alternatives Considered
- Multi-agent debate / swarm  
- Pure ChatGPT tool loop only (status quo supervisor) as final architecture  

### Status
Approved

### Impact
Orchestrator graph, skills registry, migration away from dual-brain (supervisor + cognition).

---

## ADR-002 — Conversation Intelligence before orchestrator

### Decision
NLU lives in a Conversation Intelligence layer that emits `ConversationContext` before LangGraph invoke. Graph `understand` node is retired. CI never invokes Skills/Tools.

### Date Added
2026-07-27

### Last Updated
2026-07-28

### Closed
—

### Reason
Fixes literal-assistant failure modes (passive acks instead of starting work). Separates communicative intent from plan/policy.

### Alternatives Considered
- Intent only inside `plan`  
- CI as a LangGraph skill peer  
- Keep graph `understand` as sole NLU  

### Status
Approved

### Impact
`OrchestratorService` turn entry, prompts (`ci.analyze.v1`), state (`conversation_context`), Conversation skill, docs 04/05/09/11/19. **2026-07-28:** LLM-primary CI; storytelling + section-edit rules; open-draft selection seeding for revise.

---

## ADR-003 — Memory Manager as KMS (not a skill)

### Decision
All belief memory goes through Memory Manager (`retrieve` / `remember` / `summarize`). Orchestrator and skills do not write Mongo beliefs directly. Artifacts (blogs, packages, reports) stay in Content Artifact Store.

### Date Added
2026-07-27

### Last Updated
2026-07-28

### Closed
—

### Reason
Prevents memory pollution and couples evaluation/merge/index behind one facade.

### Alternatives Considered
- Memory as a skill  
- Direct `workspace.updateMemory` from orchestrator long-term  
- Loading all memories every turn  

### Status
Approved

### Impact
Docs 08/18; tool deprecation path; async jobs; skill context injects `MemoryManager`. **MVP note (2026-07-28):** chat only enqueues LTM for preference (`emit_memory_candidate`). Strategy talk and narrative storytelling are not auto-persisted as beliefs; blogs remain Content Artifact Store records.

---

## ADR-004 — Research Package + nested Research; Writing never searches

### Decision
Research skill owns a nested 14-phase graph and emits a Research Package with provenance. Writing consumes package slices and never calls web search.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Provenance is the product differentiator vs generic AI writers.

### Alternatives Considered
- 14 phases as orchestrator nodes  
- Flat “search → stuff into prompt”  
- Writer-embedded Tavily (legacy)  

### Status
Approved

### Impact
Docs 16; Writing skill; blog generation graph migration; Tavily under Research tools only.

---

## ADR-005 — Content Optimization replaces Review

### Decision
Unified Content Optimization skill (validators + planner + scorecards). Stage `optimize`. No silent full rewrite; max 2 revise loops; gate `overall >= 72` and no Critical.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
SEO + GAO as one quality story; reports/plans are client-defendable.

### Alternatives Considered
- Peer SEO and GAO skills  
- Legacy Review skill as permanent path  

### Status
Approved

### Impact
Docs 17; PRD_CONTENT_OPTIMIZATION; retire Review skill id on new paths (M4).

---

## ADR-006 — MongoDB SoR for memory; Qdrant optional

### Decision
MongoDB is system of record for memory records and summaries. Existing Qdrant is an optional RetrievalIndex adapter. MVP does not require new vector infra.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Ship structured memory first; avoid blocking MVP on vector ops.

### Alternatives Considered
- Qdrant required for MVP  
- Vectors as primary SoR  

### Status
Approved

### Impact
Memory adapters; migration wrap of semantic-memory.service.

---

## ADR-007 — Async remember; sync retrieve; enrich-only fetch policy

### Decision
Retrieve is sync on turn entry (`chat_light` for CI). Remember runs async after reply (onboarding may sync). `load_context` must not re-fetch the same `chat_light` profile—enrich only when a richer profile is needed.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Keep SSE replies fast; control cost; avoid duplicate retrieves.

### Alternatives Considered
- Sync remember every turn  
- Always double-retrieve in graph  

### Status
Approved

### Impact
OrchestratorService, load_context, Memory Manager jobs, docs 04/14/18/19.

---

## ADR-008 — MVP numeric locks

### Decision
- `coverage_min` (Research full) = **0.55**; lite = no coverage retry  
- `max_skills_per_turn` = **5**  
- Optimize gate: **overall ≥ 72**, zero Critical, max **2** loops  
- UX validator: **thin/heuristic** in MVP (does not solely fail gate)

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Architecture review found undefined knobs blocking freeze; locks prevent thrash in M1–M3.

### Alternatives Considered
- Defer numbers until after coding  
- Full UX depth in MVP  

### Status
Approved

### Impact
Docs 14/16/17; PRD_CONTENT_OPTIMIZATION CO-2; plan policies; Research Phase 10.

---

## ADR-009 — Model routing tiers for MVP

### Decision
Use call-site tiers: CI/plan = small/fast; Strategy/Research extract/Conversation = mid; Writing = large; Optimize = deterministic first + mid LLM for plan narrative. Cap sources lite≤5, full≤12.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Unbounded model spend was a critical readiness gap.

### Alternatives Considered
- One model for all nodes  
- Defer routing until post-MVP  

### Status
Approved

### Impact
LLM factory / create-chat helpers; cost observability; doc 14 §2.

---

## ADR-010 — AI authorization minimum

### Decision
Map workspace roles: View = read/explain; Edit = create/research/write/optimize (no destructive without confirm); All/Owner = publish/delete/forget/onboarding. Destructive always `await_human`.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
AI path previously assumed workspace_id without role→action matrix.

### Alternatives Considered
- Auth only at HTTP edge with no skill-level checks  
- Full RBAC redesign before MVP  

### Status
Approved

### Impact
OrchestratorService guards; tools; Publishing; link to PRD_WORKSPACE_AND_USER_ACCESS.

---

## ADR-011 — Strangler fig + supervisor fallback through M4

### Decision
Ship new LangGraph path behind a feature flag. Keep supervisor (and cognition absorb path) until M5. Do not finish empty cognition scaffolds—port useful pieces then delete.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Safe production migration; reuse existing tools/blog graph.

### Alternatives Considered
- Big-bang cutover  
- Completing cognition as a permanent second brain  

### Status
Approved (superseded for active-chat default by ADR-014)

### Impact
MIGRATION.md; OrchestratorService routing; M3–M5 tasks in project-timeline.

---

## ADR-012 — Workspace = brand; no cross-workspace Knowledge in MVP

### Decision
All memory and artifact queries are `workspace_id`-scoped. Cross-workspace Knowledge is forbidden until tenancy review. Agency multi-client UX is Post-MVP (doc 20) but must not poison MVP state design.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
ICP for marketers managing clients requires hard isolation; solos/SMBs map cleanly to one workspace = one brand.

### Alternatives Considered
- Global knowledge pool in MVP  
- Multi-brand threads in one workspace  

### Status
Approved

### Impact
Memory Manager; RetrievalEngine; doc 20; future agency pack.

---

## ADR-013 — Project execution via timeline + ADR docs

### Decision
`docs/project-timeline.md` is the master execution tracker. `docs/architecture-decisions.md` records decisions. Implementation must stay synced with architecture docs; undocumented architectural changes are disallowed.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
Make progress, decisions, and design/code alignment visible for MVP delivery and future contributors.

### Alternatives Considered
- Track only in chat / issues without durable docs  
- ADRs only inside architecture/v0.5 without execution tracker  

### Status
Approved

### Impact
All future implementation milestones; commit checklist; eng operating model.

---

## ADR-014 — M5 single default brain (v0.5); cognition removed

### Decision
Default `ORCHESTRATOR_V05_GRAPH_ENABLED` to **true**. Remove Cognition routing and bootstrap. Supervisor remains only for **onboarding** and as an emergency opt-out (`ORCHESTRATOR_V05_GRAPH_ENABLED=false`) until remaining ops tools are fully skill-wrapped. Preference updates on the v0.5 path use Memory Manager `rememberAsync`, not supervisor `update_memory`.

### Date Added
2026-07-27

### Last Updated
2026-07-27

### Closed
—

### Reason
ADR-001 / ADR-011 strangler complete for active chat. Dual-brain latency and drift are unacceptable for MVP.

### Alternatives Considered
- Keep cognition as permanent second brain  
- Delete supervisor code entirely before ops skills exist  

### Status
Approved

### Impact
`env.ts`; `OrchestratorService` routing; `index.ts` bootstrap; timeline M5.

---

## ADR-015 — Strategic intelligence hierarchy

### Decision
Extend (do not replace) Memory Manager, Campaign module, and v0.5 orchestrator with a strategic hierarchy: **Business Knowledge** (confidence-scored MemoryRecords) → **WorkspaceStrategy** → **Campaign** (exactly one Default per site) → **Content** (`Blog.campaign_id` required). Add CampaignIntelligence, Strategic Decision Engine, and a publish/stats learning loop behind `STRATEGIC_INTELLIGENCE_ENABLED`. Canonical design: [`architecture/v0.5/21-strategic-intelligence.md`](./architecture/v0.5/21-strategic-intelligence.md).

Naming lock: **WorkspaceStrategy** (business) ≠ **ContentStrategyArtifact** (per-post) ≠ `strategy_state` (content themes).

Campaign chat planning stays inside the orchestrator + campaign tools; a separate HF “Campaign Agent” app is **not** the target architecture ([`CAMPAIGN_AGENT_IMPLEMENTATION_PLAN.md`](./CAMPAIGN_AGENT_IMPLEMENTATION_PLAN.md) superseded for that scope).

### Date Added
2026-07-29

### Last Updated
2026-07-29

### Closed
—

### Reason
MVP content pipeline ships posts; ICP differentiation requires a living strategist that binds content to campaigns, tracks knowledge confidence, and chooses highest-value next actions.

### Alternatives Considered
- Replace campaigns with a new “program” model  
- Separate multi-agent campaign chat (rejected — ADR-001)  
- Require Strategy before any draft (rejected — never block content; use Default + stub)

### Status
Approved

### Impact
M6 Strategic Intelligence phases 1–7; schemas; APIs; orchestrator plan policies; docs 21.

---

## Rejected / Deprecated

_None yet. Preserve history here when statuses change._
