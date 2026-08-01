# Bloggr Architecture — v0.5

**Status:** Frozen (M0 signed off 2026-07-27) — **Architecture Freeze + ICP revision**  
**Product:** Bloggr (codebase: `blogforall`)  
**Date:** 2026-07-27  
**Scope:** Architecture approved for incremental implementation per [`docs/project-timeline.md`](../../project-timeline.md). MVP locks in [14](./14-mvp-and-roadmap.md) are non-negotiable without ADR.

---

## Changelog

| Revision | Notes |
|----------|-------|
| v0.5 initial | Single LangGraph orchestrator → skills → tools; first doc set |
| **v0.5 Research Package** | Research Skill = 14-phase nested graph; Research Package + Evidence Graph; Writing never searches; memory pre/post R/W; [16-research-pipeline.md](./16-research-pipeline.md) |
| **v0.5 Content Optimization** | Review → Content Optimization Skill; [17](./17-content-optimization.md); [PRD](../../PRD_CONTENT_OPTIMIZATION.md) |
| **v0.5 Memory Manager** | Memory as KMS; Memory Manager + 6 layers + Content Intelligence; [18](./18-memory-manager.md); [PRD](../../PRD_MEMORY_SYSTEM.md) |
| **v0.5 Conversation Intelligence** | Pre-orchestrator NLU; ConversationContext; [19](./19-conversation-intelligence.md); [PRD](../../PRD_CONVERSATION_INTELLIGENCE.md) |
| **v0.5 Architecture Freeze** | Hygiene (no stale understand/Review); locked MVP decisions (coverage_min, model routing, retrieve policy); [20](./20-go-to-market-architecture.md) ICP architecture |
| **v0.5 Dialogue + section revise (2026-07-28)** | CI LLM-primary + storytelling/section-edit; Conversation skill; seed open draft for user-directed Writing revise (no Research package); results panel `blogs.update` sync; LTM MVP = preferences only — see [19](./19-conversation-intelligence.md), [09](./09-execution-flow.md), [18](./18-memory-manager.md) |
| **v0.5 Strategic Intelligence (2026-07-29)** | Business Knowledge → WorkspaceStrategy → Campaign (Default) → Content; decision engine + learning loop; [21](./21-strategic-intelligence.md); ADR-015 |

---

## Vision

Bloggr is not a ChatGPT wrapper. It is an intelligent content strategist:

- understand business goals and audience
- understand search intent
- **research with provenance** (Research Package)
- generate and **optimize** for search + AI retrieval (Content Optimization)
- **understand communicative intent** via Conversation Intelligence
- **remember and learn** via Memory Manager
- publish and continuously improve

The AI should feel like an experienced content strategist, not a text generator.

---

## Core philosophy

**One AI orchestrator.** No multi-agent peer chat.

```
User → Conversation Intelligence → LangGraph Orchestrator → Skills → Tools → External Services
```

- **Conversation Intelligence** interprets communication (communicative ≠ literal); does not execute workflows.
- The orchestrator is the **coordinator** (plan, skill select, memory handoff, recovery) consuming `ConversationContext`.
- Skills own domain work. Research owns a nested 14-phase pipeline; Content Optimization owns nested validators + planner.
- Writing **never** performs research or web search.
- Tools are thin, single-responsibility adapters.
- Memory is a **Knowledge Management System** (Memory Manager) — not a skill and not raw DB access.
- Prefer structured objects between nodes — never pass prompts between nodes.

**Engineering goals:** deterministic execution where possible, modular skills, typed state, reusable tools, observability, **research provenance**, **search+GAO quality**, **durable strategist memory**, **human-like conversational understanding**, explainability, scalability, extensibility.

---

## How to read this set

| Order | Document | Covers |
|-------|----------|--------|
| 1 | [01-high-level-architecture.md](./01-high-level-architecture.md) | Layers, principles, differentiator |
| 2 | [02-component-diagram.md](./02-component-diagram.md) | Components and responsibilities |
| 3 | [03-folder-structure.md](./03-folder-structure.md) | Target tree + migration mapping |
| 4 | [04-langgraph-workflow.md](./04-langgraph-workflow.md) | Orchestrator nodes, edges, interrupts |
| **4b** | [19-conversation-intelligence.md](./19-conversation-intelligence.md) | **Conversation Intelligence (pre-orch)** |
| — | [PRD_CONVERSATION_INTELLIGENCE.md](../../PRD_CONVERSATION_INTELLIGENCE.md) | CI product requirements |
| 5 | [05-state-schema.md](./05-state-schema.md) | Typed `OrchestratorState` + package refs |
| 6 | [06-skill-architecture.md](./06-skill-architecture.md) | Skill contract and seven skills |
| **6b** | [16-research-pipeline.md](./16-research-pipeline.md) | **14-phase Research Package design** |
| **6c** | [17-content-optimization.md](./17-content-optimization.md) | **Content Optimization / GAO / planner** |
| — | [PRD_CONTENT_OPTIMIZATION.md](../../PRD_CONTENT_OPTIMIZATION.md) | Product requirements for optimization |
| 7 | [07-tool-architecture.md](./07-tool-architecture.md) | Feature-modular tools |
| 8 | [08-memory-architecture.md](./08-memory-architecture.md) | Memory index (points to 18) |
| **8b** | [18-memory-manager.md](./18-memory-manager.md) | **Memory Manager KMS design** |
| — | [PRD_MEMORY_SYSTEM.md](../../PRD_MEMORY_SYSTEM.md) | Memory product requirements |
| 9 | [09-execution-flow.md](./09-execution-flow.md) | End-to-end flows + research→writing |
| 10 | [10-error-recovery-and-retries.md](./10-error-recovery-and-retries.md) | Failures, retries, human gates |
| 11 | [11-prompts-and-context.md](./11-prompts-and-context.md) | **Full prompt drafts for review** |
| 12 | [12-observability.md](./12-observability.md) | Tracing, logs, cost, provenance metrics |
| 13 | [13-testing-strategy.md](./13-testing-strategy.md) | Unit / graph / evals |
| 14 | [14-mvp-and-roadmap.md](./14-mvp-and-roadmap.md) | MVP locks, roadmap, milestones |
| **14b** | [20-go-to-market-architecture.md](./20-go-to-market-architecture.md) | **ICP / go-to-market architecture** |
| **14c** | [21-strategic-intelligence.md](./21-strategic-intelligence.md) | **Strategic hierarchy, Default Campaign, decision engine** |
| 15 | [15-file-inventory.md](./15-file-inventory.md) | Every new/changed file + how it works |
| — | [MIGRATION.md](./MIGRATION.md) | Phase map from dual stack → target |

### Brief → doc mapping

| # | Deliverable | Document |
|---|-------------|----------|
| 1–2 | High-level + component diagrams | 01, 02 |
| 3 | Folder structure | 03 |
| 4–5 | LangGraph workflow + state | 04, 05, **19** |
| Conversation Intelligence | **19**, PRD |
| 6–7 | Skills + tools | 06, 07 |
| 8 | Memory | 08, **18**, PRD |
| Memory Manager + layers | **18**, 08, PRD |
| 9 | Execution / sequences | 09, 16 |
| Research pipeline + package models | **16**, 05 |
| Content Optimization + scorecards | **17**, 05, PRD |
| 10–11 | Errors / retries | 10 |
| 12–13 | Prompts + context | 11 |
| 14–15 | Observability + testing | 12, 13 |
| 16–20 | Extensibility, MVP, roadmap, risks, phases | 14 + MIGRATION |
| ICP / go-to-market | **20** |
| File inventory | 15 |

---

## Locked defaults

1. **Docs home:** `docs/architecture/v0.5/`
2. **Product stance:** evolve Blogforall in place (not a greenfield rewrite)
3. **Research:** nested 14-phase skill → Research Package (lite/full depth)
4. **Writing:** never calls search; always consumes a Package on draft paths
5. **Optimization:** `content_optimization` replaces Review; quality gate + planner; no silent rewrite
6. **Reuse:** tool registry, workspace memory, Tavily under Research, blog graph for draft HTML only
7. **Memory:** Memory Manager only; Mongo SoR; async remember; optional Qdrant adapter
8. **Conversation Intelligence:** pre-orchestrator; interpret only; retire graph understand
9. **Retire over phases:** dual-brain; writer-embedded research; Review skill id; direct updateMemory from graph; understand node

---

## Related product docs (do not duplicate)

- [`docs/project-timeline.md`](../../project-timeline.md) — **execution tracker (read before coding)**
- [`docs/architecture-decisions.md`](../../architecture-decisions.md) — **ADR log**
- [`docs/PRD_CONTENT_OPTIMIZATION.md`](../../PRD_CONTENT_OPTIMIZATION.md)
- [`docs/PRD_MEMORY_SYSTEM.md`](../../PRD_MEMORY_SYSTEM.md)
- [`docs/PRD_CONVERSATION_INTELLIGENCE.md`](../../PRD_CONVERSATION_INTELLIGENCE.md)
- [`docs/FEATURE_GAPS.md`](../../FEATURE_GAPS.md)
- [`docs/BLOG_REVIEW_IMPLEMENTATION_SPEC.md`](../../BLOG_REVIEW_IMPLEMENTATION_SPEC.md) (legacy review path)
- [`docs/PRD_BLOGS_AND_PUBLIC_API.md`](../../PRD_BLOGS_AND_PUBLIC_API.md)
- [`backend/src/modules/cognition/domain/knowledge/KNOWLEDGE.md`](../../../backend/src/modules/cognition/domain/knowledge/KNOWLEDGE.md)

---

## Versioning

| Version | Meaning |
|---------|---------|
| v0.5 | Architecture freeze candidate; prompt drafts for review; implementation not started |
| v0.5 Research Package | Design deepened: Research Package + Evidence Graph |
| v0.5 Content Optimization | Review replaced by Content Optimization Skill |
| v0.5 Memory Manager | Memory Manager KMS |
| v0.5 Conversation Intelligence | Conversation Intelligence |
| v0.5 Architecture Freeze | Hygiene + MVP locks + ICP doc (this revision) |
| v0.6+ | Updated after first LangGraph orchestrator flag ships |

When implementation diverges, update these docs in the same PR as the code change.
