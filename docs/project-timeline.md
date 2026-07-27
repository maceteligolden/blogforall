# Bloggr — Project Timeline (Execution Tracker)

**Status:** Active  
**Owner:** Lead AI Engineer / Technical Project Manager  
**Added:** 2026-07-27  
**Last updated:** 2026-07-27 (M2 T2.1–T2.3 complete)  
**Source of truth (architecture):** [`docs/architecture/v0.5/`](./architecture/v0.5/)  
**Decisions log:** [`docs/architecture-decisions.md`](./architecture-decisions.md)

---

## 1. How to use this file

Before any major task:

1. Read this file (current phase, blockers, dependencies).
2. Confirm the task is **Approved** / in MVP scope ([14](./architecture/v0.5/14-mvp-and-roadmap.md)).
3. Check [`architecture-decisions.md`](./architecture-decisions.md) for conflicts.

After completing work:

1. Update **Status**, **Completed**, **Notes**.
2. Sync architecture/PRD docs if behavior or contracts changed.
3. Add/update ADRs if a decision changed.
4. Commit with `type(scope): description`.

**Status values:** `Planned` | `In Progress` | `Blocked` | `Completed` | `Discarded` | `Post-MVP`  
**Priority values:** `Critical` | `High` | `Medium` | `Low`

---

## 2. Current project state (2026-07-27)

| Item | State |
|------|--------|
| Architecture docs v0.5 (01–20) | **Frozen (M0)** — committed |
| Formal M0 sign-off (Draft → Frozen) | **Completed** 2026-07-27 |
| Execution tracker + ADR log | Active |
| M1 Zod contracts + OrchestratorState | **Completed** on `feat/m1-contracts` |
| LangGraph orchestrator graph (nodes) | **Not implemented** (state Annotation only) |
| Conversation Intelligence module | **Facade + deterministic analyzer** (T2.1); LLM `ci.analyze.v1` deferred |
| Memory Manager facade | **retrieve / rememberAsync** (T2.2); Bull queue later |
| Research lite + Writing no-search guards | **Completed** (T2.3) |
| Production chat today | LLM Supervisor + optional Cognition flag |
| Dirty worktree | Unrelated WIP may still exist on branch — keep M2 commits narrow |

**Active milestone:** **M2** — Skills + pipelines (CI / MM / Research lite done; Writing wrap + Optimize + Strategy next).

**Next approved coding tasks:** T2.5 Writing wrap (require package_id); T2.6 thin Optimize; T2.7 Strategy thin; T2.4 Research full after lite path is wired.

---

## 3. Roadmap overview (Gantt-style)

```text
2026-07-27                                                    →
M0 Docs freeze        ████ DONE
M1 Contracts          ████ DONE (feat/m1-contracts)
M2 Skills + pipelines         ░░░░ NEXT
M3 Graph behind flag                    ░░░░░░░
M4 Strategist UX                                  ░░░░░░
M5 Remove dual brain                                        ░░░░
M6 Learning / agency pack                                         ░░░░░ Post-MVP lean
```

Dependencies: **M0 → M1 → M2 → M3 → M4 → M5**; M6 after M5 (or parallel thin Analytics read only).

---

## 4. Master task table

| ID | Phase | Task | Status | Priority | Owner | Depends on | Start | Due | Completed | Notes |
|----|-------|------|--------|----------|-------|------------|-------|-----|-----------|-------|
| T0.1 | M0 | Architecture set v0.5 (01–15) | Completed | Critical | Arch | — | 2026-07 | 2026-07-27 | 2026-07-27 | Initial orchestrator/skills docs |
| T0.2 | M0 | Research Package docs (16) | Completed | Critical | Arch | T0.1 | 2026-07 | 2026-07-27 | 2026-07-27 | 14-phase nested Research |
| T0.3 | M0 | Content Optimization docs (17) + PRD | Completed | Critical | Arch | T0.1 | 2026-07 | 2026-07-27 | 2026-07-27 | Replaces Review skill |
| T0.4 | M0 | Memory Manager docs (18) + PRD | Completed | Critical | Arch | T0.1 | 2026-07 | 2026-07-27 | 2026-07-27 | KMS; async remember |
| T0.5 | M0 | Conversation Intelligence docs (19) + PRD | Completed | Critical | Arch | T0.1 | 2026-07 | 2026-07-27 | 2026-07-27 | Pre-orch NLU |
| T0.6 | M0 | Architecture freeze hygiene + MVP locks (14) | Completed | Critical | Arch | T0.2–T0.5 | 2026-07-27 | 2026-07-27 | 2026-07-27 | coverage_min, routing, authz |
| T0.7 | M0 | ICP / GTM architecture (20) | Completed | High | Arch | T0.6 | 2026-07-27 | 2026-07-27 | 2026-07-27 | Solo/SMB primary; agency later |
| T0.8 | M0 | Project timeline + ADR log | Completed | Critical | TPM | T0.6 | 2026-07-27 | 2026-07-27 | 2026-07-27 | This file + architecture-decisions.md |
| T0.9 | M0 | Formal M0 sign-off (README → Frozen) | Completed | Critical | Owner | T0.8 | 2026-07-27 | 2026-07-27 | 2026-07-27 | Commit c9274bd |
| T1.1 | M1 | Zod: `ConversationContext` | Completed | Critical | Eng | T0.9 | 2026-07-27 | 2026-07-27 | 2026-07-27 | contracts/conversation-context.ts |
| T1.2 | M1 | Zod: `ResearchPackage` + summary | Completed | Critical | Eng | T0.9 | 2026-07-27 | 2026-07-27 | 2026-07-27 | Provenance helper + coverage retry |
| T1.3 | M1 | Zod: `ContentOptimizationReport` / plan / scores | Completed | Critical | Eng | T0.9 | 2026-07-27 | 2026-07-27 | 2026-07-27 | Gate helpers overall≥72 |
| T1.4 | M1 | Zod: `MemoryRecord` / `MemoryCandidate` | Completed | Critical | Eng | T0.9 | 2026-07-27 | 2026-07-27 | 2026-07-27 | contracts/memory-record.ts |
| T1.5 | M1 | `OrchestratorState` Annotation + reducers | Completed | Critical | Eng | T1.1–T1.4 | 2026-07-27 | 2026-07-27 | 2026-07-27 | graph/state.ts |
| T1.6 | M1 | Checkpoint PII / field allowlist | Completed | High | Eng | T1.5 | 2026-07-27 | 2026-07-27 | 2026-07-27 | checkpoint-allowlist.ts |
| T1.7 | M1 | Unit tests for schemas / invariants | Completed | Critical | Eng | T1.1–T1.5 | 2026-07-27 | 2026-07-27 | 2026-07-27 | 13 tests passing |
| T2.1 | M2 | CI facade `analyze` + `ci.analyze.v1` | Completed | Critical | Eng | T1.7 | 2026-07-27 | 2026-07-27 | 2026-07-27 | Deterministic analyzer; LLM prompt deferred |
| T2.2 | M2 | Memory Manager facade (retrieve/rememberAsync) | Completed | Critical | Eng | T1.7 | 2026-07-27 | 2026-07-27 | 2026-07-27 | Adapters over ContextPackBuilder + extraction |
| T2.3 | M2 | Research skill lite pipeline | Completed | Critical | Eng | T1.2 | 2026-07-27 | 2026-07-27 | 2026-07-27 | Tavily→Package; Writing guards |
| T2.4 | M2 | Research skill full (simplified phases) | Planned | High | Eng | T2.3 | TBD | TBD | — | coverage_min=0.55 |
| T2.5 | M2 | Writing skill wrap BlogGraph (no Tavily) | Planned | Critical | Eng | T2.3 | TBD | TBD | — | Require package_id |
| T2.6 | M2 | Content Optimization thin validators + gate | Planned | Critical | Eng | T1.3 | TBD | TBD | — | UX thin; wrap review runner |
| T2.7 | M2 | Strategy skill thin structured output | Planned | High | Eng | T1.5 | TBD | TBD | — | One LLM call |
| T2.8 | M2 | Persist packages / reports / memory_records | Planned | High | Eng | T2.2–T2.6 | TBD | TBD | — | Mongo collections |
| T3.1 | M3 | Graph nodes: load / plan / invoke / compose / persist | Planned | Critical | Eng | T2.* | TBD | TBD | — | No understand node |
| T3.2 | M3 | Feature flag route in OrchestratorService | Planned | Critical | Eng | T3.1 | TBD | TBD | — | Supervisor fallback remains |
| T3.3 | M3 | quick_draft path end-to-end | Planned | Critical | Eng | T3.2, T2.3, T2.5, T2.6 | TBD | TBD | — | Parity checklist 14 §7 |
| T3.4 | M3 | CI golden utterance tests A1–A10 | Planned | Critical | Eng | T2.1, T3.2 | TBD | TBD | — | Blocking before flag-on default |
| T3.5 | M3 | Observability spans (ci / plan / skills) | Planned | High | Eng | T3.1 | TBD | TBD | — | 12 |
| T4.1 | M4 | strategist_pipeline staging demo | Planned | High | Eng | T3.3, T2.4 | TBD | TBD | — | Stream phases |
| T4.2 | M4 | UI: Package coverage + SEO/GAO scores | Planned | High | Eng | T4.1 | TBD | TBD | — | Doc 20 moat visibility |
| T4.3 | M4 | Retire writer-embedded research on new paths | Planned | Critical | Eng | T4.1 | TBD | TBD | — | Keep flag fallback |
| T4.4 | M4 | Retire Review skill id on new paths | Planned | High | Eng | T2.6 | TBD | TBD | — | content_optimization only |
| T5.1 | M5 | Default flag on; remove supervisor + cognition | Planned | Critical | Eng | T4.* parity | TBD | TBD | — | Single brain |
| T5.2 | M5 | Remove legacy understand / raw updateMemory graph path | Planned | High | Eng | T5.1 | TBD | TBD | — | — |
| T6.1 | M6 | Content Intelligence closed loop | Post-MVP | Medium | Eng | T5.1 | — | — | — | 14 §4 C |
| T6.2 | M6 | Agency multi-workspace pack | Post-MVP | Medium | Eng | T5.1 | — | — | — | Doc 20; tenancy locked |
| T6.3 | M6 | Full UX validator / rich linking | Post-MVP | Low | Eng | T4.4 | — | — | — | — |
| T6.4 | M6 | Required Qdrant / hybrid retrieve | Post-MVP | Low | Eng | T2.2 | — | — | — | Optional only in MVP |

---

## 5. Milestone exit criteria

| Milestone | Exit when |
|-----------|-----------|
| **M0** | Docs 16–20 + locks in 14 signed off; timeline + ADR exist; README status Frozen |
| **M1** | Zod schemas + OrchestratorState tests green; no production flag flip |
| **M2** | CI + MM facades; Research lite; Writing no-search; thin Optimize; unit tests |
| **M3** | Flagged graph passes [14 §7 parity checklist](./architecture/v0.5/14-mvp-and-roadmap.md) |
| **M4** | Staging strategist demo; Package/scores in UI; writer search retired on new paths |
| **M5** | Single chat brain; dual path deleted |
| **M6** | Post-MVP items only when explicitly approved |

---

## 6. Risks (execution)

| ID | Risk | Impact | Mitigation | Status |
|----|------|--------|------------|--------|
| R1 | Overbuilding full Research/Opt before lite path | Slip MVP | Lite-first tasks T2.3 before T2.4 | Open |
| R2 | Mixing WIP on `prod` with AI milestone commits | Broken deploys | Branch per milestone; narrow commits | Open |
| R3 | Docs/code drift | Unmaintainable platform | Sync rule + timeline notes | Open |
| R4 | Reopening frozen locks mid-M1–M3 | Thrash | ADR change required | Open |
| R5 | CI latency / cost | Poor UX | Small model tier; degrade path | Open |

---

## 7. Decisions snapshot

Canonical detail lives in [`architecture-decisions.md`](./architecture-decisions.md).  
MVP locks from architecture review are **Approved** (ADR-001 … ADR-012).

---

## 8. Immediate next actions

1. Continue on `feat/m1-contracts`: **T2.5** Writing wrap (require `research_package_id`, no Tavily).  
2. **T2.6** Content Optimization thin validators + gate (overall≥72, max 2 loops).  
3. **T2.7** Strategy skill thin structured output; then **T2.4** Research full if needed for strategist path.

---

## 9. Changelog (this file)

| Date | Change |
|------|--------|
| 2026-07-27 | Created tracker; assessed repo; M0 docs marked Completed; M1 set as next implementation milestone |
| 2026-07-27 | M0 signed off (Frozen); M1 contracts implemented + tested; next = M2 |
| 2026-07-27 | M2 T2.1–T2.3: CI + MM facades, Research lite, Writing guards; 15 tests |
