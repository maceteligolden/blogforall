# 08 — Memory Architecture (Index)

**Canonical design:** [18-memory-manager.md](./18-memory-manager.md)  
**Product PRD:** [`docs/PRD_MEMORY_SYSTEM.md`](../../PRD_MEMORY_SYSTEM.md)

This file is a **short index**. Do not treat it as a second source of truth.

---

## 1. Philosophy

Memory is a **Knowledge Management System**, not a database and not a skill.

```
Orchestrator → Memory Manager → Pipeline / Retrieval / Summarization → Storage adapters → MongoDB (MVP)
```

The orchestrator only **retrieves** context and emits **remember candidates**. It never indexes, merges, or writes Mongo directly.

---

## 2. Layers (summary)

| Layer | Role |
|-------|------|
| Session | Current thread workflow + checkpoint refs |
| Workspace | Persistent business / brand context |
| User Preference | Per-user interaction and style prefs |
| Knowledge | Reusable facts (from research / docs) |
| Learning | Edit outcomes and behavioral patterns |
| Content Intelligence | Performance insights for future generation |
| Content Artifact Store | Blogs, Research Packages, Optimization reports (not beliefs) |

---

## 3. Key flows

| Moment | Memory Manager call |
|--------|---------------------|
| `load_context` | `retrieve(profile)` |
| After reply | `rememberAsync(candidates)` (background) |
| Onboarding required fields | `remember` sync |
| Long thread | `summarize(thread)` on checkpoint policy |
| Skills need package/report | `getArtifact(ref)` |

---

## 4. MVP storage

- **Required:** MongoDB system of record  
- **Optional:** existing Qdrant as RetrievalIndex adapter behind the manager  
- Structured memories stay structured  

---

## 5. Related

- Evaluation pipeline, models, trade-offs, folder layout → **[18](./18-memory-manager.md)**
- Skills consume `MemoryManager` → [06-skill-architecture.md](./06-skill-architecture.md)
- State `memory_views` / candidates → [05-state-schema.md](./05-state-schema.md)
