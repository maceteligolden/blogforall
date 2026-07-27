# PRD — Memory System

**Status:** Draft  
**Product:** Bloggr  
**Engineering design:** [`architecture/v0.5/18-memory-manager.md`](./architecture/v0.5/18-memory-manager.md)  
**Date:** 2026-07-27

---

## 1. Problem

Without a disciplined memory system, Bloggr behaves like a **stateless chatbot**:

- re-asks known business facts
- forgets user preferences
- cannot learn from edits or content performance
- dumps unbounded history into prompts

Memory must feel like a long-term **content strategist**, not a transcript cache.

---

## 2. Goals

1. Introduce a **Memory Manager** so the orchestrator never owns storage/index/merge logic.
2. Support layered memories: Session, Workspace, User Preference, Knowledge, Learning, **Content Intelligence**.
3. Evaluate candidates (classify → importance → dedupe → conflict) before persistence.
4. Process remembers **asynchronously** after replies (sync only for onboarding requirements).
5. Retrieve **contextual** slices only — never all memories.
6. Summarize long threads to control tokens.
7. Use **MongoDB** as MVP system of record; keep structured data structured.

---

## 3. Non-goals (MVP)

- Memory as a user-facing “skill” peer with Writing
- Requiring a new vector DB to ship (optional Qdrant adapter only)
- Treating every blog/HTML draft as a belief memory (artifacts stay separate)
- Perfect real-time consistency of preference updates mid-SSE stream

---

## 4. Users and jobs

| User / system | Job |
|---------------|-----|
| Workspace operator | Stop repeating brand/audience facts |
| Individual editor | Preferences and edit patterns personalize output |
| Orchestrator | retrieve → act → enqueue remember |
| Analytics/content loop | Content Intelligence informs future headlines/CTAs/structures |

---

## 5. Requirements

| ID | Requirement |
|----|-------------|
| MEM-1 | Public API: remember / retrieve / update / forget / summarize |
| MEM-2 | Six belief layers + Content Artifact Store |
| MEM-3 | Async evaluation pipeline with importance thresholds |
| MEM-4 | Conflict supersede with history |
| MEM-5 | Retrieval profiles per workflow (chat/strategy/research/write/optimize) |
| MEM-6 | Thread summarization every N messages or token budget |
| MEM-7 | Idempotent background jobs; never block reply |
| MEM-8 | Content Intelligence MVP from publish/stats signals |
| MEM-9 | Observability: retrieve latency, store/ignore rates, job failures |
| MEM-10 | Extensible storage adapters (Mongo now; vector/KG later) |

---

## 6. Success metrics

- % turns with successful contextual retrieve under budget
- Repeat question rate for known workspace fields (should fall)
- Memory ignore rate (noise control)
- Preference application rate in Writing (sampled)
- Job success / DLQ rate
- Summary compression ratio vs raw tokens

---

## 7. Dependencies

- Existing WorkspaceMemory + digests / extraction services (wrap as adapters)
- Research Package → Knowledge candidates
- Content Optimization / edit acceptance → Learning candidates
- `blogs.statistics` → Content Intelligence (thin)

---

## 8. Rollout

Aligned with architecture milestones: Memory Manager facade → async pipeline → preference split → Knowledge/Learning writes → Content Intelligence closed loop.
