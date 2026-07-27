# 13 — Testing Strategy

## 1. Principles

- Default CI: no live LLM / Tavily
- Schema + policy + provenance + quality-gate + memory pipeline + **Conversation Intelligence** tests
- Live smoke behind env flag

---

## 2. Layers

### Conversation Intelligence

- Fixture utterances → expected `communicative_category` / `suggested_next_action`
- Soft suggestion → action/planning (not idle)
- Clear create with topic → `action_required` and no unnecessary clarify
- Preference → `emit_memory_candidate`
- Casual joke → no workflow
- Urgency cues raise `urgency`

### Orchestrator

- Turn entry calls CI then graph with `conversation_context`
- `plan` does not re-NLU; honors `requires_clarification`
- Clear CI action → does not compose passive "start writing" ack

### Memory Manager / Research / Optimization / Writing

- Unchanged invariants from prior revisions

### Graph integration

CI → load → plan → strategy → research → write → optimize → compose → rememberAsync

---

## 3. Rubrics

- CI: action vs explain vs casual accuracy on golden set
- Memory / Research / Optimization: as in 18/16/17

---

## Next

- [14-mvp-and-roadmap.md](./14-mvp-and-roadmap.md)
