# 14 — MVP Scope, Roadmap, Risks, and Phased Plan

## 1. Extensibility

| Extension | Hook |
|-----------|------|
| Vector / KG stores | RetrievalIndex / storage adapters behind Memory Manager |
| New validators / skills | Unchanged orchestrator edges |
| Tunable optimize weights | Workspace config |
| Content Intelligence closed loop | Strategy/Writing retrieve profile |
| Richer CI pipeline | Split affect/initiative stages post-MVP |
| Multi-brand / client workspaces | Workspace tenancy + campaign binding (see [20](./20-go-to-market-architecture.md)) |

---

## 2. Locked MVP decisions (freeze)

These resolve prior architecture-review blockers. Do not reopen casually during M1–M3.

| Decision | Lock |
|----------|------|
| `coverage_min` (Research full) | **0.55**; lite = no coverage retry |
| `max_skills_per_turn` | **5** (chat often uses 1) |
| Memory retrieve | Turn entry: `chat_light` for CI; `load_context` enriches only if profile differs |
| Memory jobs | Reuse existing backend worker/queue stack (BullMQ if already present); idempotent on `turn_id` + candidate hash |
| UX validator (Optimize) | **Thin / heuristic in MVP**; full UX depth post-MVP |
| Optimize gate | `overall >= 72` AND zero Critical; max **2** revise loops |
| Supervisor fallback | **Allowed through M4**; removed in M5 |
| Qdrant | Optional adapter; **not** required for MVP |
| Analytics closed loop | **Out** of MVP |

### Model routing (MVP defaults)

| Call site | Tier | Notes |
|-----------|------|-------|
| `ci.analyze` | Small / fast | Timeout degrade → unknown + clarify/casual |
| `plan` | Small / fast | Deterministic policies override |
| Strategy structured | Mid | One shot |
| Research extract / phases | Mid; batch where possible | Prefer deterministic rank/score |
| Writing draft/revise | Large | Dominant quality spend |
| Optimize validators | Deterministic first; Mid LLM for plan narrative | Do not LLM every SEO check |
| Conversation compose | Mid | Honor CI `response_style` |

Token budgets: enforce RetrievalEngine profiles; never “load all memory.” Cap research sources: lite ≤5, full ≤12.

### AI authorization (MVP minimum)

| Workspace role (see Workspace PRD) | Allowed |
|------------------------------------|---------|
| View | Read/list content; explain; no publish/delete/forget |
| Edit | Create/optimize/research/write; no destructive publish/delete without confirm |
| All / Owner | Publish/unpublish/delete; memory forget; onboarding complete |

Destructive tools always go through `await_human` even for All. Research spend is Edit+.

### Mode selection (MVP)

| Signal | Mode |
|--------|------|
| User says quick/rough draft; or `urgency=high` + create | `quick_draft` |
| SEO / strategist / high-quality / authority language | `strategist_pipeline` |
| Ops, explain, casual, preference | `chat` |
| Incomplete onboarding | `onboarding` |

---

## 3. MVP scope

**In**

- CI.analyze (single call) + LangGraph plan/skills path
- Research lite + Research full (simplified algorithms; all phase slots may exist)
- Writing from Package only (no search)
- Content Optimization: SEO + GAO + authority + readability (+ thin UX); gate 72 / 2 loops
- Memory Manager facade: Session, Workspace, Preference split, async remember skeleton
- Publishing via existing tools + destructive HITL
- Feature flag + supervisor fallback through M4
- Docs 16–20 + PRDs

**Out of MVP**

- Multi-stage CI affect/initiative pipelines
- Full UX validator depth / rich internal linking graph
- Content Intelligence → Strategy/Writing closed loop
- Required vector DB
- Analytics recommendation engine
- Outline HITL as default
- Cross-workspace Knowledge

---

## 4. Post-MVP

| Phase | Deliverable |
|-------|-------------|
| A | Outline / low-coverage HITL |
| B | Richer UX optimize + internal linking |
| C | Content Intelligence → Strategy/Writing |
| D | Multi-stage CI + voice profiles |
| E | Decay tuning; semantic index default |
| F | Client/agency workspace pack (see [20](./20-go-to-market-architecture.md)) |

---

## 5. Risks

| Risk | Mitigation |
|------|------------|
| Extra LLM latency for CI | Small model; timeout + degrade |
| Dual NLU (CI + plan) | Plan consumes CI; no re-classify |
| Literal regressions | Golden utterance evals (A1–A10) |
| Cost blowup on full research | Caps + coverage_min + model tiers above |
| Cognition regex vs CI | Wrap ConversationService; delete after M5 |

---

## 6. Milestones (aligned with MIGRATION.md)

| M | Focus | Exit |
|---|--------|------|
| M0 | Docs freeze (incl. 20 ICP) | Sign-off on 16–20 + PRDs |
| M1 | Zod contracts | Schema tests pass |
| M2 | Skills + Research/Opt pipelines + MM + CI facades | Unit + staging retrieve/remember |
| M3 | Graph flag: CI → load → plan → skills | Parity checklist below |
| M4 | Strategist + package/scorecard UX; retire writer search + Review id | Staging demo |
| M5 | Remove dual brain + legacy understand/updateMemory | Single chat brain |
| M6 | Learning loops + deeper research + agency pack starts | Closed-loop metrics |

---

## 7. Parity checklist (M3)

- [ ] CI maps clear create requests to workflows (no passive ack)
- [ ] Plan honors ConversationContext; `max_skills_per_turn=5`
- [ ] No duplicate retrieve of identical `chat_light` profile
- [ ] Research full honors `coverage_min=0.55` (max 1 retry)
- [ ] Writing never searches; optimize gate works; UX thin
- [ ] remember jobs idempotent; turn never blocked
- [ ] Onboarding still completes (sync remember OK)
- [ ] No direct Mongo belief writes from graph nodes

---

## Next

- [15-file-inventory.md](./15-file-inventory.md)
- [MIGRATION.md](./MIGRATION.md)
- [20-go-to-market-architecture.md](./20-go-to-market-architecture.md)
- [19-conversation-intelligence.md](./19-conversation-intelligence.md)
