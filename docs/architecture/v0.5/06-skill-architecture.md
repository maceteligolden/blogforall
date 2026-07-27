# 06 — Skill Architecture

## 1. What a skill is

A **skill** is an independent domain capability invoked by the orchestrator.

- May use one or more LLM calls + deterministic logic
- Calls tools for side effects and external I/O
- Returns a `SkillResult` with a structured `state_patch`
- Does **not** call other skills
- Does **not** own conversation orchestration

**Conversation Intelligence is not a skill.** It runs before the LangGraph Orchestrator and produces `ConversationContext`. See [19](./19-conversation-intelligence.md).

Memory is **not** a skill. Skills use `MemoryManager` (retrieve / getArtifact). Belief persistence goes through `remember` / async pipeline — skills do not write Mongo belief stores directly.

---

## 2. Skill contract

```typescript
export interface SkillContext {
  state: OrchestratorState;
  args: Record<string, unknown>;
  tools: ToolInvoker;           // typed wrapper over registry
  memory: MemoryManager;           // retrieve / getArtifact / rememberAsync
  /** @deprecated direct ports — migrate to MemoryManager */
  llm: LlmFactory;              // multi-provider
  signal?: AbortSignal;
  onProgress: (event: ProgressEvent) => void;
}

export interface Skill {
  id: SkillId;
  description: string;          // for plan-node manifest
  inputSchema: ZodTypeAny;
  run(ctx: SkillContext): Promise<SkillResult>;
}
```

**Registration:** `SkillRegistry.register(skill)` at bootstrap.  
**Discovery:** plan node sees a manifest of `{ id, description, when_to_use }`.

---

## 3. Initial skills

### 3.1 Conversation

Reply-only partner skill (clarify / guide / summarize / explain / warn). Honors `conversation_context.response_style` when composing.

**Must not:** run SEO, research the web, write full articles, publish, or classify communicative intent (that is CI).

**Input**

```typescript
{
  purpose: "clarify" | "guide" | "summarize" | "explain" | "warn";
  question?: string;
  facts?: string[];            // grounded skill summaries (incl. research coverage)
}
```

**Output patch:** `reply`, optional `pending_question`, optional session summary.

**LLM:** yes — see [11](./11-prompts-and-context.md).

---

### 3.2 Content Strategy

Turns user intent into **what should be written** before any Writing begins.

Outputs (structured):

- business objective
- target audience
- search intent
- keyword clusters
- content angle
- funnel stage
- topical authority opportunities
- CTA
- content structure

**Must not:** write prose articles, run the Research pipeline, publish.

May read workspace memory / learning preferences. Heavy web research belongs to Research.

**Input**

```typescript
{
  topic: string;
  user_notes?: string;
  use_workspace_memory: boolean; // default true
}
```

**Output patch:** `strategy: ContentStrategyArtifact`

**LLM:** structured output only.

---

### 3.3 Research

Builds a **Research Package** (knowledge package with provenance) — not a search-result summary.

Canonical design: [16-research-pipeline.md](./16-research-pipeline.md) (14-phase nested LangGraph).

**Must not:** draft the post, invent citations, finalize SEO scores, call Writing.

**Input**

```typescript
{
  topic: string;
  strategy_ref?: "state";
  depth: "lite" | "full";      // quick_draft → lite; strategist → full
  max_sources?: number;
}
```

**Output patch:**

```typescript
{
  research_package_id: string;
  research_summary: ResearchPackageSummary;
  // optional same-turn hydrate:
  research_package?: ResearchPackage;
}
```

**Deps:** nested research graph; `search.web`; Content Memory; knowledge reads.

**Degrade:** partial package + `degraded` + disclosure; honest `coverage_score`.

---

### 3.4 Writing

Consumes **strategy + Research Package**. Never performs research.

Focus exclusively on:

- outlining
- drafting
- rewriting / expanding / shortening
- improving flow
- tone adaptation
- readability
- structure

**Must not:**

- call `search.web` or any discovery tool
- invent strategy or SEO strategy
- invent unsupported facts (use package claims; disclose gaps)
- run Content Optimization (orchestrator schedules `content_optimization`)

**Input**

```typescript
{
  action: "outline" | "draft" | "revise";
  feedback?: string;
  /** From Optimization Planner writing_brief / Critical+High items */
  optimization_plan?: OptimizationPlan;
  research_package_id?: string;  // required for strategist; required after lite research for quick_draft
}
```

**Output patch:** `outline` and/or `draft`

**Deps:** blog generation graph **without** embedded web research for new paths; ContextAssembler `write_full` profile (package slices + brand).

**Retired:** Writing `oneshot` with embedded Tavily + editorial review. Quick draft = Research `lite` → Writing `draft` → Content Optimization.

---

### 3.5 Content Optimization

**Replaces Review.** Unified skill for search + AI-retrieval quality — not an SEO checker.

Canonical design: [17-content-optimization.md](./17-content-optimization.md).

Internally composed of validators/generators + Optimization Planner (nested pipeline). Orchestrator invokes **only** this skill — never individual validators.

Responsible for:

- search intent, semantic coverage, structure
- SEO + **GAO** scorecards
- authority (E-E-A-T), readability, UX
- metadata / JSON-LD generation
- internal/external link recommendations
- prioritized **Optimization Plan** (no silent rewrite)

**Input**

```typescript
{
  blog_id?: string;
  research_package_id?: string;
  depth?: "full" | "lite";     // lite skips/reduces UX + linking depth
}
```

**Output patch:**

```typescript
{
  optimization_report_id: string;
  optimization_plan: OptimizationPlan;
  quality_gate_passed: boolean;
  metadata?: ContentMetadata;
}
```

**Orchestrator rule:** if `!quality_gate_passed` and `optimize_count < 2` → Writing `revise` with plan → Content Optimization again.

**PRD:** [`docs/PRD_CONTENT_OPTIMIZATION.md`](../../PRD_CONTENT_OPTIMIZATION.md)

---

### 3.6 Publishing

Formatting, CMS publish/unpublish, scheduling, **apply metadata artifact**, preview URLs, future image uploads.

**LLM:** minimal. Confirmation via orchestrator `await_human`. Does not regenerate metadata unless asked.

---

### 3.7 Analytics

Performance monitoring, declining content, recommendations, CTR/impressions/gaps as data allows.

**MVP:** `blogs.statistics` + heuristics. Optional light LLM summarize.

---

## 4. Skill selection matrix (plan node guidance)

| User goal | Skill sequence |
|-----------|----------------|
| Vague “write something” | Conversation clarify → Strategy… |
| “Write a high-quality post about X” | Strategy → Research `full` → Writing outline/draft → Content Optimization |
| “Quick draft about X” | Research `lite` → Writing draft → Content Optimization |
| “Research X for later” | Research `full` → Conversation summarize package |
| “Improve SEO / AI readiness on this draft” | Content Optimization → Writing revise |
| “Publish this” | await_human → Publishing |
| “How are posts performing?” | Analytics → Conversation |

---

## 5. Progress events

```typescript
{ phase: string; message: string; percent?: number; skill_id: SkillId }
```

Client phases: `strategy`, `research_*` (see 16), `outline`, `draft`, `optimize` (see 17).

---

## 6. Testing skills

- Mock `ToolInvoker` and MemoryManager
- Assert Zod output shapes (esp. Research Package provenance invariants)
- Assert Writing tool allowlist excludes `search.web`
- No live LLM in default CI (see [13](./13-testing-strategy.md))

---

## Next

- Research pipeline detail: [16-research-pipeline.md](./16-research-pipeline.md)
- Tools: [07-tool-architecture.md](./07-tool-architecture.md)
