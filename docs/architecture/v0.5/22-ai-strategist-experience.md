# 22 — AI Strategist Experience

**Status:** Canonical experience contract (M7 AI Strategist Experience)  
**Date:** 2026-08-06  
**Companion:** [19](./19-conversation-intelligence.md), [21](./21-strategic-intelligence.md), [09](./09-execution-flow.md), product requirements [`docs/REQUIREMENTS_STRATEGIST_AND_FRAMER_PUBLISH.md`](../../REQUIREMENTS_STRATEGIST_AND_FRAMER_PUBLISH.md)  
**Supersedes (UX personality):** [`docs/DASHBOARD_AGENT_UX_PERSONALITY.md`](../../DASHBOARD_AGENT_UX_PERSONALITY.md)

Product lock for Framer publish surfaces, research HITL (approve before research; chat after findings), and wiring Conversation Intelligence onto v2 lives in that requirements file. This document remains the experience contract; where §4 / §4.1 conflict with that file (post-research HITL, outline HITL), the requirements file wins.

---

## 1. Philosophy

The AI is the user’s **content strategist** and primary interface to Bloggr — not a chatbot or draft generator with a chat skin.

It understands the workspace, business profile, strategies, campaigns, drafts, approvals, and pending work. Every turn should feel like speaking with an experienced teammate.

---

## 2. Tone and dialogue

- Warm, concise, collaborative; no corporate filler.
- **One question per turn** when asking.
- Reference prior thread context naturally; do not restate known workspace facts.
- Guide; do not interrogate.
- Discuss / brainstorm / explain are not write requests.

---

## 3. Single message lifecycle

- Exactly one assistant chat bubble per completed turn.
- Phase / stage status is UI-only (`livePhase` / stage rail), never a second persisted assistant message.
- Optimistic messages must reconcile with persisted history (clear or replace on success).

---

## 4. Intent before write (HITL)

| Intent | Behavior |
|--------|----------|
| Discuss / explain / brainstorm | Conversation skill only |
| Soft create (topic, no clear write verb) | One confirmation: draft vs keep exploring |
| Explicit write / draft / generate | Guided pipeline with HITL pauses after research and outline |
| `quick_draft` | Same HITL checkpoints; lite research depth |

Writing stages (research → outline → draft → review checks) show as progressive UI (`livePhase` / stage rail). Draft generation runs only after outline approval.

### 4.1 HITL writing checkpoints

On create / strategist paths the graph **pauses for human review** after:

1. **Research** — assistant reply stays short (“Research is ready — review the findings below.”); an in-chat **research findings card** shows facts, definitions, stats, and sources. Actions: Approve Research | Revise Research | Continue (phrases the plan policy recognizes).
2. **Outline** — same pattern with an **outline approval card** (title + section headings). Actions: Approve Outline | Modify Outline | Continue → then draft + optimize.

Checkpoints are recovered across turns from assistant `tool_calls` (`research` / `writing.outline`) plus dialogue slots `research_approved` / `outline_approved`. Voice uses the same checkpoints (full parity).

---

## 5. Proactive opener

Empty threads get a contextual first assistant message (idempotent), priority:

1. Unfinished onboarding  
2. Pending approvals  
3. Drafts awaiting review  
4. Campaign deadline / risk  
5. Strategy / knowledge gap  
6. Welcome-back + suggested next step  

Never a generic capability dump.

---

## 6. Conversation isolation

- **Thread transcript:** scoped to the conversation.  
- **Workspace knowledge:** site-shared (strategy, campaigns, beliefs).  
- Do not inject other threads’ chat digests into generation unless the user references them.

---

## 7. Composer stubs

- Chat file upload: **hidden**.  
- Knowledge control in chat: visible as **Coming soon** (non-functional).  
- Library page knowledge UX may remain.

---

## 8. Call mode (full parity)

- Same strategist capabilities as text: create, edit, publish, schedule, campaigns, strategy, approvals, and writing HITL checkpoints.  
- Spoken replies stay short (2–4 sentences); long artifacts stay in the results panel / workflow cards.  
- SSE reply stream + sentence-boundary **ElevenLabs** TTS (voice id `bitB3zPqF1vZmMnmEMcw`; `ELEVENLABS_API_KEY` server-side).  
- Browser `speechSynthesis` fallback only.  
- User may toggle transcript visibility (`bloggr.voice.showTranscript`).

---

## 9. Strategy and campaign awareness

Replies after draft/review should briefly narrate campaign/strategy fit (goal, audience, CTA), not only inject context into prompts.

---

## 10. Results panel ownership

| Surface | Owns |
|---------|------|
| **Chat transcript** | Strategist dialogue, clarifications, workflow stage rail, research/outline HITL cards, destructive confirmation chips |
| **Results panel** | Entity artifacts with stable ids — drafts (`blogs.*`), campaigns (`campaigns.get/create/update`), strategy (`strategy.get/update`) |
| **Workflow cards (in-chat)** | Research package findings, outline approval — **do not** auto-open the panel |

Rule of thumb: if removing a border/shadow would not hurt interaction, it is not a panel entity. Research and outline stay in the thread.

---

## 11. Conversational entity pattern

For campaigns (and similarly strategy / schedule when collecting fields):

1. **Collect** — one required field per turn (`campaign_draft` slots / Conversation skill).  
2. **Confirm** — summarize the payload and ask explicit confirmation.  
3. **Execute** — `campaigns.create` (or the relevant tool) only after confirm.  
4. **Sync** — emit `tool_calls` / artifacts so the results panel and workspace state stay aligned.

Never auto-run Research for `create_campaign` / `learn_campaign` unless the user asks for research. Cap research loops on campaign intents.
