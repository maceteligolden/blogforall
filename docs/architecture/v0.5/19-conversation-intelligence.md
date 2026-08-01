# 19 — Conversation Intelligence Architecture

**Status:** Canonical design (v0.5 Conversation Intelligence revision)  
**Product PRD:** [`docs/PRD_CONVERSATION_INTELLIGENCE.md`](../../PRD_CONVERSATION_INTELLIGENCE.md)  
**Implementation (2026-07-28):** `ci.analyze.v1` is LLM-primary via `ConversationIntelligenceService` (`ai/prompts/ci.analyze.ts` + `pipeline/analyze-llm.ts`); deterministic regex is offline/API-failure fallback. Clarify / casual / explain / strategy-summarize replies use the Conversation skill (`skill.conversation.v1`); compose formats artifacts when a skill reply is already present. Open-draft section edits and storytelling overrides are documented in §5 and §8.

---

## 1. Core philosophy

**Conversation Intelligence interprets communication. It does not execute work.**

Bloggr must feel like a human content strategist: it understands intent, implied meaning, tone, humor, urgency, and appropriate next actions — not only literal commands.

```
User Message
  ↓
Conversation Intelligence Layer
  ↓
Structured ConversationContext
  ↓
LangGraph Orchestrator (plan → skills → tools)
```

| Layer | Owns | Does not own |
|-------|------|--------------|
| **Conversation Intelligence** | Intent, action, affect, ambiguity, mode, initiative, style | Skills, tools, workflows, Mongo belief writes |
| **LangGraph Orchestrator** | Plan, skill select, recovery, human interrupts | Raw NLU / re-classifying communicative intent from scratch |
| **Memory Manager** | Retrieve / remember / summarize | Interpreting user jokes or urgency |
| **Skills** | Domain execution | Conversation orchestration |

**Rejected**

| Approach | Why |
|----------|-----|
| CI as a LangGraph skill peer | Skills execute domain work; CI is infrastructure NLU |
| Intent only inside `plan` | Collapses understanding with workflow policy |
| CI invokes Research/Writing/Optimize | Breaks boundary; CI must only interpret |
| Graph `understand` as sole NLU | Underspecifies communicative vs literal meaning |

---

## 2. High-level architecture

```mermaid
flowchart TB
  User --> OrchSvc[OrchestratorService]
  OrchSvc -->|"retrieve chat_light"| MM[MemoryManager]
  OrchSvc --> CI[ConversationIntelligence]
  CI -->|"analyze"| Ctx[ConversationContext]
  Ctx --> LG[LangGraphOrchestrator]
  LG --> Plan[plan]
  Plan --> Skills[Skills]
  Skills --> Tools[Tools]
  LG -->|"remember candidates"| MM
```

**Turn sequence**

```
User message (+ optional selectionContext.blog_id from results panel)
  → MemoryManager.retrieve(chat_light)     // for CI context resolution
  → ConversationIntelligence.analyze(..., open_artifacts.draft_id from selection)
  → OrchestratorV05GraphService seeds draft/metadata/slots.selection from BlogService when selection present
  → LangGraph.invoke({ conversation_context, draft?, recent_messages, ... })
      load_context (enrich **only if** profile ≠ chat_light)
      → plan (consumes ConversationContext; no re-NLU)
      → invoke_skill | compose | await_human | end
      → persist (+ rememberAsync only when preference memory_candidates exist)
```

**Retrieve policy:** do not double-fetch identical `chat_light`. See [14](./14-mvp-and-roadmap.md) §2.

The graph **`understand` node is retired**. Clarification is **plan → Conversation skill → compose** when `requires_clarification` or `suggested_next_action=clarify`.

---

## 3. Public API

```typescript
interface ConversationIntelligence {
  analyze(input: ConversationIntelligenceInput): Promise<ConversationContext>;
}

interface ConversationIntelligenceInput {
  message: string;
  recent_messages?: Array<{ role: "user" | "assistant"; content: string }>;
  conversation_summary?: string;
  memory_views?: MemoryViews;           // chat_light from Memory Manager
  open_artifacts?: {
    draft_id?: string;
    research_package_id?: string;
    optimization_report_id?: string;
  };
  prior_context?: ConversationContext;  // mid-workflow continuity
  workspace_id: string;
  user_id: string;
  thread_id: string;
}
```

Internal stages (not skills): intent classify → action detect → entity/reference resolve → ambiguity → affect (emotion/tone/humor/urgency) → mode → initiative / style.

MVP: **one** structured LLM call (`ci.analyze.v1`) producing the full `ConversationContext`. Post-MVP may split stages.

---

## 4. Communicative categories

| Category | User examples | Expected behavior |
|----------|---------------|-------------------|
| `ask_information` | "How does SEO work?" | Explain; no content workflow |
| `request_action` | "Write a blog post about AI agents." | Start correct workflow; **do not** over-confirm |
| `brainstorm` | "I want to write something about AI." | Start ideation / planning (`strategy`) |
| `provide_feedback` | "This introduction feels boring." / "Rewrite the conclusion" | User-directed Writing revise on open draft (skip Content Optimization first) |
| `update_preferences` | "I prefer shorter articles." | Emit memory candidate; no blog workflow |
| `casual` | Jokes, greetings | Natural reply; no workflow |
| `unknown` | Unclear | Clarify only if blocking |

**Storytelling (implemented):** personal anecdotes / “I want to talk about…” without an explicit draft/research ask → `explain` or `casual_reply`, `action_required=false`. Do **not** auto-start create/strategy/research until the user asks to write, draft, or research.

### Mapping to workflow `Intent`

| Communicative category | Typical `workflow_intent` |
|------------------------|---------------------------|
| `ask_information` | `explain` |
| `request_action` (create) | `create_content` |
| `request_action` (improve) | `optimize_content` / `update_content` |
| `request_action` (research) | `research` |
| `brainstorm` | `strategy` |
| `provide_feedback` | `update_content` |
| `update_preferences` | `update_memory` |
| `casual` | `casual` |
| `unknown` | `unknown` |

Existing `Intent` union remains the skill/workflow routing vocabulary. CI owns communicative meaning and **maps** into `workflow_intent`.

---

## 5. Communicative intent vs literal meaning

Users rarely speak in exact commands. CI must resolve **implied** intent.

| User | Literal | Communicative | System action |
|------|---------|---------------|---------------|
| "We should probably write something about AI agents." | Soft suggestion | Start content planning / create | `request_action` or `brainstorm` → `start_planning` / `start_content_workflow` |
| "This article feels too robotic." | Observation | Rewrite more human | `provide_feedback` → `revise_current_artifact` |
| "I need something for my client presentation tomorrow." | Information | Fast, professional deliverable | Raise `urgency=high`; prefer `quick_draft`; `tone_preference=professional` |
| "Write a blog post about AI agents." | Request | Create blog | `request_action` → start workflow (**not** "you can start writing now") |
| "Haha that headline is wild 😂" | Humor | Casual | `casual`; no workflow |

### Resolution rules

1. Prefer **communicative** over literal when signals conflict.
2. Soft modality ("should", "probably", "maybe we…") + concrete topic + no open question → treat as action/planning, not idle chat.
3. Critique language about an **open draft** → feedback/revise, not a new unrelated create.
4. Deadline / client / presentation cues → raise urgency and prefer shorter paths.
5. Preference language → memory candidates only; do not start Research/Writing.
6. Humor/greeting with no task → casual reply; do not force a workflow.
7. `requires_clarification=true` **only** when a **blocking** slot is missing for an action. Clear action + topic → proceed.
8. **Section / structural edits** with open draft (`open_artifacts.draft_id` or results-panel selection): phrases like “rewrite the introduction/conclusion”, “add/remove a section”, “try another approach for only the conclusion”, “draft update …” → `provide_feedback` + `update_content` + `revise_current_artifact` (editing). Never clarify when the draft is open and the user is directing a section edit.
9. Storytelling / lived experience without an explicit write/draft/research ask → engage conversationally (`explain` / `casual`); do not dump Content Strategy.

---

## 6. ConversationContext model

Canonical TypeScript (also in [05-state-schema.md](./05-state-schema.md)):

```typescript
type CommunicativeCategory =
  | "ask_information"
  | "request_action"
  | "brainstorm"
  | "provide_feedback"
  | "update_preferences"
  | "casual"
  | "unknown";

type ConversationMode =
  | "information"
  | "creation"
  | "planning"
  | "editing"
  | "feedback"
  | "casual";

type SuggestedNextAction =
  | "explain"
  | "start_content_workflow"
  | "start_planning"
  | "revise_current_artifact"
  | "emit_memory_candidate"
  | "casual_reply"
  | "clarify";

interface ConversationEntity {
  type: "topic" | "blog_id" | "url" | "audience" | "channel" | "other";
  value: string;
  confidence: number;
}

interface ConversationContext {
  communicative_category: CommunicativeCategory;
  workflow_intent: Intent; // existing Intent union
  confidence: number;
  action_required: boolean;
  conversation_mode: ConversationMode;
  emotional_state?: string;
  humor_detected: boolean;
  tone_preference: "casual" | "professional" | "technical" | "friendly";
  urgency?: "low" | "normal" | "high";
  entities: ConversationEntity[];
  references_previous_context: boolean;
  requires_clarification: boolean;
  clarification_question?: string;
  suggested_next_action: SuggestedNextAction;
  response_style: {
    brevity: "short" | "normal" | "detailed";
    formality: "casual" | "neutral" | "formal";
    initiative: "passive" | "suggest" | "lead";
  };
  slots_patch: Partial<DialogueSlots>;
  literal_interpretation?: string;
  communicative_rationale?: string;
}
```

### Deprecation

`UnderstandResult` is **absorbed**. During migration, adapters may map `ConversationContext` → legacy `UnderstandResult` shape. New code reads `conversation_context` only.

---

## 7. Initiative and response style

| Situation | `initiative` | Behavior |
|-----------|--------------|----------|
| Clear create request with topic | `lead` | Start workflow; brief acknowledgment |
| Vague brainstorm | `suggest` | Offer angles; start Strategy |
| Casual joke | `passive` | Match tone; no upsell of workflows |
| High urgency | `lead` + `brevity=short` | Prefer quick_draft; less ceremony |
| Preference update | `suggest` | Confirm preference; enqueue memory candidate |

Compose / Conversation skill must honor `response_style` and `tone_preference`.

---

## 8. Orchestrator handoff

`plan` **consumes** `ConversationContext` and applies policies:

| `suggested_next_action` | Plan tendency |
|-------------------------|---------------|
| `explain` / `casual_reply` | `invoke_skill` Conversation (`purpose=explain|casual`) then compose |
| `clarify` | `invoke_skill` Conversation (`purpose=clarify`) then compose |
| `start_content_workflow` | Pipeline or quick_draft skills |
| `start_planning` | ContentStrategy; when strategy artifact exists → Conversation `summarize` (do not dump raw strategy) |
| `revise_current_artifact` + `update_content` / feedback | **User-directed:** Writing `revise` with user message as feedback on seeded draft. Skip Content Optimization first. Emit full draft (`blogs.update` / `blogs.generateDraft`) to results panel. |
| `revise_current_artifact` + `optimize_content` | **Optimize path:** Content Optimization first, then Writing revise from `OptimizationPlan` (bounded loop). |
| `emit_memory_candidate` | Compose ack + enqueue `memory_candidates` (**preferences only** in MVP) |

Plan must **not** re-run full communicative classification. It may adjust skill choice for policy (destructive confirm, optimize loop caps) using CI fields as priors.

**Selection seeding (required for revise):** When the client sends `selection_context.blog_id`, turn entry loads that blog into graph `draft` + `metadata.blog_id` + `slots.selection` before plan. Without this, revise cannot run (each turn starts with empty draft state). Peek CI also receives `open_artifacts.draft_id` so section-edit language classifies correctly.

---

## 9. Memory interaction

- CI calls `MemoryManager.retrieve(chat_light)` (via turn entry or injected views) for brand/prefs/open refs.
- `update_preferences` / durable preference language → candidates for Memory Manager (`rememberAsync`).
- CI **never** writes Mongo beliefs or calls `workspace.updateMemory` directly.
- **MVP gap (intentional):** storytelling, strategy discussion, and blog narrative facts are **not** auto-enqueued as long-term memory. Thread short-term history covers in-thread recall; blog bodies persist in the blogs Content Artifact Store; cross-thread “what did we talk about?” requires future episodic/content-intelligence remember paths. See [18](./18-memory-manager.md) §MVP belief writes.

See [18-memory-manager.md](./18-memory-manager.md).

---

## 10. Folder structure

```
orchestrator/ai/conversation-intelligence/
  conversation-intelligence.ts       # public analyze API (LLM-primary)
  pipeline/
    analyze-llm.ts                    # ci.analyze.v1 structured call
    analyze-deterministic.ts          # offline / API-failure fallback
  models/conversation-context.ts      # contracts live under ai/contracts/
```

Prompts: `ai/prompts/ci.analyze.ts` (`ci.analyze.v1`); Conversation skill: `ai/prompts/skill.conversation.ts` + `ai/skills/conversation/`. See [11](./11-prompts-and-context.md).

**Migration:** cognition ConversationService absorbed into CI — not a parallel NLU brain.

---

## 11. Prompts

| Id | Role |
|----|------|
| `ci.analyze.v1` | Primary structured output → `ConversationContext` |
| `ci.affect.v1` | Post-MVP optional split |
| `ci.initiative.v1` | Post-MVP optional split |

`orchestrator.understand.v1` → **absorbed**; thin shim during migration only.

---

## 12. Observability

Events: `ci.analyze` with `communicative_category`, `workflow_intent`, `confidence`, `suggested_next_action`, `requires_clarification`, latency.

Do not log full message bodies with PII by default in production.

---

## 13. MVP vs post-MVP

**MVP**

- Single structured `analyze`
- Communicative categories + Intent mapping
- Humor / urgency / tone / response_style fields
- Action vs casual vs clarify rules
- Replace graph `understand` in architecture
- Plan prompts consume `ConversationContext`

**Post-MVP**

- Multi-stage CI pipeline
- Richer affect models
- Proactive initiative (calendars, content gaps)
- Voice-specific CI profiles

---

## 14. Trade-offs

| Choice | Trade-off |
|--------|-----------|
| CI before graph | Extra LLM call per turn; clearer separation |
| One analyze call (MVP) | Simpler; less specialized affect accuracy |
| Keep Intent mapping | Dual vocabulary; avoids rewriting all skill routers |

---

## Related

- PRD: [`PRD_CONVERSATION_INTELLIGENCE.md`](../../PRD_CONVERSATION_INTELLIGENCE.md)
- Graph: [04-langgraph-workflow.md](./04-langgraph-workflow.md)
- State: [05-state-schema.md](./05-state-schema.md)
- Prompts: [11-prompts-and-context.md](./11-prompts-and-context.md)
- Memory: [18-memory-manager.md](./18-memory-manager.md)
