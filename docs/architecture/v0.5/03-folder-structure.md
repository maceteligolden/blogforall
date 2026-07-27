# 03 — Folder Structure

## 1. Target tree (orchestrator AI)

```
backend/src/modules/orchestrator/
├── ai/
│   ├── bootstrap.ts                    # register tools + skills (evolve existing)
│   ├── tool-registry.ts                # keep
│   ├── graph/
│   │   ├── orchestrator.graph.ts       # StateGraph compile + invoke/stream
│   │   ├── state.ts                    # OrchestratorState Annotation
│   │   ├── edges.ts                    # conditional routing
│   │   └── nodes/
│   │       ├── load-context.ts
│   │       ├── plan.ts                 # consumes ConversationContext (no understand)
│   │       ├── invoke-skill.ts
│   │       ├── await-human.ts
│   │       ├── compose.ts
│   │       ├── persist.ts
│   │       └── recover.ts              # optional explicit recover node
│   ├── conversation-intelligence/
│   │   ├── conversation-intelligence.ts  # public analyze API
│   │   ├── pipeline/                   # intent, action, affect, ambiguity, initiative
│   │   └── models/conversation-context.ts
│   ├── skills/
│   │   ├── registry.ts
│   │   ├── types.ts                    # Skill interface, SkillContext, SkillResult
│   │   ├── conversation/
│   │   │   ├── conversation.skill.ts
│   │   │   ├── schema.ts
│   │   │   └── prompts.ts
│   │   ├── content-strategy/
│   │   │   ├── content-strategy.skill.ts
│   │   │   ├── schema.ts
│   │   │   └── prompts.ts
│   │   ├── research/
│   │   │   ├── research.skill.ts       # entry: invokes nested pipeline
│   │   │   ├── schema.ts               # ResearchPackage Zod
│   │   │   ├── types/
│   │   │   │   └── evidence-graph.ts
│   │   │   ├── pipeline/
│   │   │   │   ├── research.graph.ts
│   │   │   │   ├── state.ts            # ResearchPipelineState
│   │   │   │   └── nodes/              # 14 phase nodes (may group files)
│   │   │   └── prompts/                # phase prompt modules
│   │   ├── writing/
│   │   │   ├── writing.skill.ts        # wraps BlogGenerationGraph — no search
│   │   │   ├── schema.ts
│   │   │   └── prompts.ts              # outline/draft/revise (package slices)
│   │   ├── content-optimization/
│   │   │   ├── content-optimization.skill.ts
│   │   │   ├── schema.ts
│   │   │   ├── pipeline/optimization.graph.ts
│   │   │   ├── validators/
│   │   │   ├── generators/
│   │   │   ├── planner/
│   │   │   ├── scoring/
│   │   │   └── prompts/
│   │   ├── publishing/
│   │   │   ├── publishing.skill.ts
│   │   │   └── schema.ts
│   │   └── analytics/
│   │       ├── analytics.skill.ts
│   │       └── schema.ts
│   ├── tools/                          # regroup existing tools by feature
│   │   ├── content/                    # blogs.*, categories.*
│   │   ├── research/                   # search.web (+ future SERP)
│   │   ├── seo/                        # future dedicated SEO tools
│   │   ├── analytics/                  # blogs.statistics (+ future)
│   │   ├── publishing/                 # publish/schedule/unpublish
│   │   ├── images/                     # future
│   │   ├── storage/                    # future asset tools
│   │   ├── communication/              # future notify/email
│   │   ├── workspace/                  # workspace.* memory tools
│   │   ├── campaign/                   # campaigns.*
│   │   └── strategy/                   # strategy.proposeCalendar (calendar ops)
│   ├── prompts/
│   │   ├── catalog.ts                  # prompt id → renderer registry
│   │   ├── orchestrator.system.ts      # evolve from prompts/system.ts
│   │   ├── ci.analyze.ts               # Conversation Intelligence
│   │   ├── understand.ts               # deprecated shim → CI
│   │   └── plan.ts
│   ├── memory/
│   │   ├── manager/memory-manager.ts   # public API
│   │   ├── pipeline/                   # detect→…→index
│   │   ├── retrieval/retrieval-engine.ts
│   │   ├── summarization/
│   │   ├── models/
│   │   └── adapters/{mongo,qdrant-optional,redis-checkpoint}.ts
│   ├── context/                        # deprecated → retrieval-engine
│   │   └── context-assembler.ts        # thin re-export during migration
│   └── observability/
│       ├── turn-tracer.ts
│       └── skill-metrics.ts
├── services/                           # OrchestratorService, digests, routers…
├── repositories/
├── controllers/
├── routes/
├── interfaces/
├── validations/
└── utils/
```

Blog AI stays where it is initially:

```
backend/src/modules/blog/ai/
├── blog-generation-graph.service.ts    # Writing skill dependency
├── blog-review.runner.ts               # Transitional adapter for Content Optimization
├── tavily-search.service.ts
├── search-query.util.ts
└── types.ts
```

Memory module stays shared:

```
backend/src/modules/memory/services/
├── context-pack-builder.service.ts     # adapter behind RetrievalEngine
├── semantic-memory.service.ts          # optional Qdrant RetrievalIndex
├── memory-extraction.service.ts        # candidate detection adapter
├── strategy-engine.service.ts
└── …
```

---

## 2. Migration mapping (today → target)

| Today | Target |
|-------|--------|
| `ai/orchestrator-graph.service.ts` | Replaced by `ai/graph/*`; keep as `LEGACY_SUPERVISOR` fallback |
| `ai/prompts/system.ts` | `ai/prompts/orchestrator.system.ts` + catalog |
| `ai/tools/*.ts` (flat) | `ai/tools/{feature}/*.ts` (move gradually; re-export ok) |
| `ai/bootstrap.ts` | Also registers skills |
| `cognition/application/turn-use-case.ts` | Logic absorbed into graph nodes + skills; delete after parity |
| `cognition/domain/conversation/*` | Absorb into Conversation Intelligence ([19](./19-conversation-intelligence.md)) |
| `cognition/skills/*` | Patterns move to `orchestrator/ai/skills/*` |
| `cognition/skills/research/multi-query-research.service.ts` | Absorb into Research pipeline Phases 4–6 |
| `cognition/domain/planner/planner.service.ts` | Inform `plan` node policy (anti-tool-happy) |
| `cognition/graph/state.ts` checkpointer | `SessionMemoryPort` Redis/memory adapter |
| `blog/ai/blog-generation-graph.service.ts` | Writing only; bypass embedded web research for new paths |
| `blog/ai/tavily-search.service.ts` | Research skill tools — not Writing |
| `memory/services/*` | Adapters behind Memory Manager (not parallel APIs) |

---

## 3. What stays outside orchestrator/

| Module | Why |
|--------|-----|
| `blog/` | Domain CRUD + generation graph implementation |
| `campaign/` | Campaign planning/scheduling domain |
| `memory/` | Shared extraction, embeddings, digests |
| `shared/ai/` | `create-chat-openai`, usage callbacks |
| `cognition/` | Temporary; remove after absorb |

**Rule:** do not create a parallel `cognition` LangGraph. Empty scaffolds under cognition (`graph/nodes`, `infrastructure/langgraph`, …) are deleted in cleanup — not completed.

---

## 4. Frontend (no restructure required for v0.5)

Existing:

- `frontend/components/orchestrator/*`
- `frontend/lib/hooks/use-blog-generation.ts`
- `frontend/app/dashboard/blogs/new/page.tsx`

v0.5 frontend changes (later implementation): surface workflow stage + artifacts (strategy/research/outline) in chat; not part of this docs phase.

---

## 5. Tests layout (target)

```
backend/src/__tests__/
├── unit/modules/orchestrator/
│   ├── graph/
│   │   ├── edges.test.ts
│   │   └── nodes/*.test.ts
│   ├── skills/
│   │   └── *.skill.test.ts
│   └── context/
│       └── context-assembler.test.ts
├── evals/orchestrator/
│   └── golden-fixtures.test.ts
└── (existing cognition/blog helper tests remain until cleanup)
```

---

## Next

- LangGraph workflow: [04-langgraph-workflow.md](./04-langgraph-workflow.md)
- File inventory: [15-file-inventory.md](./15-file-inventory.md)
