# PRD — Conversation Intelligence

**Status:** Draft  
**Product:** Bloggr  
**Engineering design:** [`architecture/v0.5/19-conversation-intelligence.md`](./architecture/v0.5/19-conversation-intelligence.md)  
**Date:** 2026-07-27

---

## 1. Problem

Without Conversation Intelligence, Bloggr behaves too literally:

- Treats soft suggestions as idle chat ("Sure, you can start writing…") instead of starting work
- Misses implied rewrite requests ("This feels robotic")
- Ignores urgency, tone, and humor
- Over-clarifies clear action requests
- Forces workflows into casual conversation

Users expect a **human content strategist**, not a command parser.

---

## 2. Goals

1. Introduce a **Conversation Intelligence** layer **before** the LangGraph Orchestrator.
2. Interpret communicative intent (not only literal wording).
3. Detect action vs information vs brainstorm vs feedback vs preferences vs casual.
4. Produce a structured **ConversationContext** for planning (intent, confidence, mode, affect, urgency, initiative, style).
5. Start the correct workflow for clear action requests **without unnecessary confirmation**.
6. Respond naturally to casual turns without forcing content pipelines.
7. Emit memory candidates for preference updates (Memory Manager owns persistence).

---

## 3. Non-goals (MVP)

- Conversation Intelligence executing Research / Writing / Optimize / Publish
- CI as a user-facing skill peer with Writing
- Perfect emotion recognition
- Replacing Memory Manager or skill policies
- Multi-agent debate about intent

---

## 4. Acceptance criteria

| # | Criterion |
|---|-----------|
| A1 | "Write a blog post about AI agents." → action required; workflow starts (or plan selects create path); **not** passive "you can start writing" |
| A2 | "How does SEO work?" → explain; no create workflow |
| A3 | "I want to write something about AI." → brainstorm/planning path |
| A4 | "This introduction feels boring." (with open draft) → revise/feedback path |
| A5 | "I prefer shorter articles." → preference / memory candidate; no blog create |
| A6 | Joke/greeting alone → casual reply; no workflow |
| A7 | Soft suggestion ("We should probably write about…") → communicative action/planning, not idle |
| A8 | "Client presentation tomorrow" cues raise urgency and prefer faster path |
| A9 | CI never calls Skills/Tools directly |
| A10 | Clarification only when blocking slots missing |

---

## 5. Example behaviors

### Action request

**User:** Write a blog post about AI agents.  
**CI:** `request_action`, `create_content`, `start_content_workflow`, `action_required=true`  
**Orch:** Plan → Strategy/Research/Writing path (per mode)

### Implied feedback

**User:** This article feels too robotic.  
**CI:** `provide_feedback`, `revise_current_artifact`, tone toward friendly/human  
**Orch:** Writing revise or Content Optimization with feedback slots

### Preference

**User:** Use a more conversational tone.  
**CI:** `update_preferences`, `emit_memory_candidate`  
**Orch:** Ack + Memory Manager rememberAsync

---

## 6. Success metrics (product)

- Drop in "passive ack instead of action" incidents on create-like utterances
- Clarification rate only when slots truly missing
- Casual turns do not open strategist pipelines
- Preference utterances produce memory candidates

---

## Related

- Architecture: [19-conversation-intelligence.md](./architecture/v0.5/19-conversation-intelligence.md)
- Memory: [PRD_MEMORY_SYSTEM.md](./PRD_MEMORY_SYSTEM.md)
- Orchestrator graph: [04-langgraph-workflow.md](./architecture/v0.5/04-langgraph-workflow.md)
