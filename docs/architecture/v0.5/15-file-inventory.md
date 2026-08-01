# 15 — File Inventory

Files **to create** or **materially change** during implementation. Docs in this folder are already created.

Legend: **C** = create, **M** = modify, **K** = keep as dependency, **D** = delete later

---

## 1. Documentation (v0.5 + Research Package revision)

| File | Action | How it works |
|------|--------|--------------|
| `docs/architecture/v0.5/README.md` | C/M | Index, changelog |
| `docs/architecture/v0.5/01-*.md` … `15-*.md` | C/M | Architecture set |
| `docs/architecture/v0.5/16-research-pipeline.md` | C | 14-phase Research Package design |
| `docs/architecture/v0.5/17-content-optimization.md` | C | Content Optimization / GAO / planner |
| `docs/architecture/v0.5/18-memory-manager.md` | C | Memory Manager KMS design |
| `docs/architecture/v0.5/19-conversation-intelligence.md` | C | Conversation Intelligence design |
| `docs/architecture/v0.5/20-go-to-market-architecture.md` | C | ICP / go-to-market architecture |
| `docs/PRD_CONTENT_OPTIMIZATION.md` | C | Product PRD |
| `docs/PRD_MEMORY_SYSTEM.md` | C | Memory product PRD |
| `docs/PRD_CONVERSATION_INTELLIGENCE.md` | C | Conversation Intelligence PRD |
| `docs/architecture/v0.5/MIGRATION.md` | C/M | Phase migration map |

---

## 2. LangGraph orchestrator

| File | Action | How it works |
|------|--------|--------------|
| `backend/src/modules/orchestrator/ai/graph/state.ts` | C | `Annotation.Root` for `OrchestratorState`; array reducers for errors/progress |
| `backend/src/modules/orchestrator/ai/graph/edges.ts` | C | Conditional functions: after plan, invoke, recover |
| `backend/src/modules/orchestrator/ai/graph/orchestrator.graph.ts` | C | Builds `StateGraph`, compiles with checkpointer, exports `invokeTurn` / `streamTurn` |
| `backend/src/modules/orchestrator/ai/graph/nodes/load-context.ts` | C | Loads memory views + time; no LLM |
| `backend/src/modules/orchestrator/ai/graph/nodes/understand.ts` | M/D | Deprecated shim; CI runs pre-graph |
| `backend/src/modules/orchestrator/ai/conversation-intelligence/conversation-intelligence.ts` | C | Public `analyze` → ConversationContext (LLM-primary) |
| `backend/src/modules/orchestrator/ai/conversation-intelligence/pipeline/analyze-llm.ts` | C | `ci.analyze.v1` structured LLM |
| `backend/src/modules/orchestrator/ai/conversation-intelligence/pipeline/analyze-deterministic.ts` | C | Offline / API-failure fallback + section-edit / storytelling rules |
| `backend/src/modules/orchestrator/ai/contracts/conversation-context.ts` | C | Types + Zod |
| `backend/src/modules/orchestrator/ai/graph/nodes/plan.ts` | C | Consumes ConversationContext + policy → PlanResult |
| `backend/src/modules/orchestrator/ai/graph/nodes/invoke-skill.ts` | C | Registry dispatch; merges `SkillResult` |
| `backend/src/modules/orchestrator/ai/graph/nodes/await-human.ts` | C | Writes pending confirmation; ends turn |
| `backend/src/modules/orchestrator/ai/graph/nodes/compose.ts` | C | Calls Conversation skill or formats reply |
| `backend/src/modules/orchestrator/ai/graph/nodes/persist.ts` | C | Messages + checkpoint + artifact saves |
| `backend/src/modules/orchestrator/ai/graph/nodes/recover.ts` | C | Maps errors → retry/degrade/ask_user |

---

## 3. Skills

| File | Action | How it works |
|------|--------|--------------|
| `ai/skills/types.ts` | C | `Skill`, `SkillContext`, `SkillResult`, `SkillId` |
| `ai/skills/registry.ts` | C | Map + validate + run + allowlist tools |
| `ai/skills/conversation/conversation.service.ts` | C | LLM reply from purpose/facts (`skill.conversation.v1`) |
| `ai/prompts/skill.conversation.ts` | C | Conversation skill prompt |
| `ai/skills/content-strategy/content-strategy.skill.ts` | C | Structured strategy artifact |
| `ai/skills/content-strategy/schema.ts` | C | Zod I/O |
| `ai/skills/content-strategy/prompts.ts` | C | `skill.content_strategy.v1` |
| `ai/skills/research/research.skill.ts` | C | Entry: invokes nested 14-phase pipeline; returns package id |
| `ai/skills/research/schema.ts` | C | ResearchPackage Zod |
| `ai/skills/research/types/evidence-graph.ts` | C | Evidence graph types |
| `ai/skills/research/pipeline/research.graph.ts` | C | Nested StateGraph compile |
| `ai/skills/research/pipeline/state.ts` | C | ResearchPipelineState Annotation |
| `ai/skills/research/pipeline/nodes/*.ts` | C | Phases 1–14 (group files OK) |
| `ai/skills/research/prompts/*.ts` | C | Phase prompts from doc 11 |
| `ai/skills/writing/writing.service.ts` | C | Outline/draft from package; revise from draft+feedback (**no package required for revise**); **no search** |
| `ai/skills/writing/schema.ts` | C | Zod |
| `ai/skills/writing/prompts.ts` | C | Package-slice prompts |
| `ai/skills/content-optimization/content-optimization.skill.ts` | C | Nested optimize pipeline; replaces Review |
| `ai/skills/content-optimization/schema.ts` | C | Report/plan Zod |
| `ai/skills/content-optimization/pipeline/optimization.graph.ts` | C | Validator graph |
| `ai/skills/content-optimization/validators/*.ts` | C | Intent, semantic, structural, authority, readability, ux, gao |
| `ai/skills/content-optimization/generators/*.ts` | C | Metadata, schema, internal/external links |
| `ai/skills/content-optimization/planner/optimization-planner.ts` | C | Merge + prioritize |
| `ai/skills/content-optimization/scoring/scorecards.ts` | C | SEO/GAO/overall weights |
| `ai/skills/content-optimization/prompts/*.ts` | C | LLM validator + planner prompts |
| `ai/skills/publishing/publishing.skill.ts` | C | Calls publish/schedule tools via ToolInvoker |
| `ai/skills/publishing/schema.ts` | C | Zod |
| `ai/skills/analytics/analytics.skill.ts` | C | statistics + optional summarize LLM |
| `ai/skills/analytics/schema.ts` | C | Zod |

---

## 4. Prompts / context / memory / observability

| File | Action | How it works |
|------|--------|--------------|
| `ai/prompts/catalog.ts` | C | id → render fn registry |
| `ai/prompts/orchestrator.system.ts` | C | Port/evolve from `prompts/system.ts` |
| `ai/prompts/ci.analyze.ts` | C | Conversation Intelligence renderer |
| `ai/prompts/understand.ts` | M | Deprecated shim → ci.analyze |
| `ai/prompts/plan.ts` | C | plan renderer |
| `ai/prompts/system.ts` | M | Thin re-export during migration, then deprecate |
| `ai/memory/manager/memory-manager.ts` | C | Public remember/retrieve/summarize API |
| `ai/memory/pipeline/*.ts` | C | detect→classify→score→lookup→conflict→persist→index |
| `ai/memory/retrieval/retrieval-engine.ts` | C | Profiles (absorbs ContextAssembler) |
| `ai/memory/summarization/*.ts` | C | Thread summarization |
| `ai/memory/models/*.ts` | C | MemoryRecord, Candidate, etc. |
| `ai/memory/adapters/{mongo,qdrant-optional,redis-checkpoint}.ts` | C | Storage adapters |
| `ai/context/context-assembler.ts` | M | Thin re-export → RetrievalEngine during migration |
| `ai/observability/turn-tracer.ts` | C | Spans + log events |
| `ai/observability/skill-metrics.ts` | C | Counters/histograms helpers |

---

## 5. Bootstrap / service wiring

| File | Action | How it works |
|------|--------|--------------|
| `ai/bootstrap.ts` | M | Register tools **and** skills |
| `services/orchestrator.service.ts` | M | If flag: invoke LangGraph; else legacy supervisor / cognition |
| `ai/orchestrator-graph.service.ts` | M→D | Keep as `LegacySupervisor` until Milestone 5; then delete |
| `shared/ai/create-chat-openai.ts` | K/M | Extend toward multi-provider factory later |
| `shared/ai/langchain-usage.callback.ts` | K | Wire into turn tracer |

---

## 6. Tools (gradual regroup)

| File | Action | How it works |
|------|--------|--------------|
| `ai/tools/content/*` | C (move) | Existing blog/category tools relocated |
| `ai/tools/publishing/*` | C (move) | publish/schedule/delete |
| `ai/tools/research/*` | C (move) | `search.web` |
| `ai/tools/workspace/*` | C (move) | workspace.* |
| `ai/tools/campaign/*` | C (move) | campaigns.* |
| `ai/tools/strategy/*` | C (move) | proposeCalendar |
| `ai/tools/analytics/*` | C (move) | statistics exports |
| Flat `ai/tools/*.ts` | M | Re-export shims during move |

---

## 7. Blog / memory dependencies (keep)

| File | Action | How it works |
|------|--------|--------------|
| `blog/ai/blog-generation-graph.service.ts` | K/M | Writing only; **bypass/remove** embedded Tavily research for new paths |
| `blog/ai/blog-review.runner.ts` | K/M | Transitional LLM adapter inside Content Optimization |
| `blog/ai/tavily-search.service.ts` | K | Research pipeline tools only |
| `cognition/skills/research/multi-query-research.service.ts` | K→move | Absorb into Research Phases 4–6 |
| `memory/services/*` | K/M | Adapters behind Memory Manager |
| `shared/schemas/workspace-memory.schema.ts` | K | Workspace port backing |
| Mongo `research_packages` collection / model | C | Content Memory persistence for packages |
| Mongo `optimization_reports` collection / model | C | Content Optimization reports |
| Mongo `memory_records` collection / model | C | Layered belief memories |
| Memory job queue / worker | C | Async remember pipeline |

---

## 8. Cognition cleanup (later)

| File | Action | How it works |
|------|--------|--------------|
| `cognition/application/turn-use-case.ts` | D | After parity |
| `cognition/graph/nodes|edges` empty | D | Do not implement |
| `cognition/infrastructure/*` empty | D | |
| Useful: planner anti-tool-happy, PII, persona | M | Port snippets into plan policies / conversation |

---

## 9. Tests to create

| File | Action | How it works |
|------|--------|--------------|
| `__tests__/unit/modules/orchestrator/graph/edges.test.ts` | C | Routing |
| `__tests__/unit/modules/orchestrator/graph/plan.policy.test.ts` | C | Policies |
| `__tests__/unit/modules/orchestrator/skills/*.test.ts` | C | Mocked skills |
| `__tests__/unit/modules/orchestrator/context/context-assembler.test.ts` | C | Budgets (→ retrieval-engine) |
| `__tests__/unit/modules/orchestrator/memory/memory-manager.test.ts` | C | retrieve budgets; remember ignore/store |
| `__tests__/unit/modules/orchestrator/memory/pipeline.idempotency.test.ts` | C | turn_id + candidate hash |
| `__tests__/unit/modules/orchestrator/conversation-intelligence/*.test.ts` | C | Golden utterances → ConversationContext |
| `__tests__/evals/orchestrator/golden-fixtures.test.ts` | C | Sequences + schemas |

---

## 10. Config / env

| Key | Purpose |
|-----|---------|
| `LANGGRAPH_ORCHESTRATOR_ENABLED` | Route to new graph |
| `ORCHESTRATOR_REDIS_URL` | Checkpointer (optional; can reuse cognition redis URL) |
| `ORCH_LOG_PROMPTS` | Staging prompt logging |
| `ORCH_LIVE_SMOKE` | Live LLM tests |
| `ORCH_MAX_SKILLS_PER_TURN` | Default 5 |
| `ORCH_REVIEW_PASS_THRESHOLD` | Default 70 |
| `ORCH_MAX_IMPROVE_LOOPS` | Default 2 |

---

## 11. Frontend (implementation later — not docs phase)

| File | Change |
|------|--------|
| Orchestrator chat components | Show strategy/research/outline artifacts + new progress phases |
| Types for API turn response | Include `workflow_stage`, artifact refs |

---

## How a turn finds code (target)

```
Controller
  → OrchestratorService.runTurn
    → orchestrator.graph.invokeTurn
      → nodes/*
      → skills/registry
        → skills/<name>
          → tools/<feature> and/or blog/ai/*
      → memory adapters
```

---

## Next

- [MIGRATION.md](./MIGRATION.md)
