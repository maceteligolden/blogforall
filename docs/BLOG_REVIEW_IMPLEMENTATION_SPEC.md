# Blog Review: Implementation Spec

**Pages, components, APIs, API logic, code design, and review pipeline (prompt chaining / pipeline architecture).**

**Locked decisions** (see [BLOG_REVIEW_FEATURE_PLAN.md](./BLOG_REVIEW_FEATURE_PLAN.md#8-decisions-locked)): block-aware suggestions **yes**; **review mode** (not in-editor); **engagement** score for “winning post”; **auto-save on apply-one** with **undo** via version history; **no rate limits** for now; API accepts **content_blocks** and returns block-aware suggestions.

---

## 1. Pages to Be Worked On

| Route | Page / Purpose | Changes |
|-------|----------------|--------|
| **`/dashboard/blogs/[id]`** | Edit blog (existing) | Primary surface for review: add review entry point, review panel/sidebar, in-context highlights in editor (or review mode), and apply flows. |
| **`/dashboard/blogs/new`** | Create blog | Optional: allow “Review” before first save (review without `blogId`; apply would copy to form only). Same components as edit. |

No new top-level routes. Review is a **feature on the edit (and optionally create) page**, not a separate page.

---

## 2. Components: Inventory and Behavior

### 2.1 Page-Level (Edit Blog)

| Component | Location | Responsibility |
|-----------|----------|----------------|
| **EditBlogPage** | `app/dashboard/blogs/[id]/page.tsx` | Load blog, form state (title, content_blocks, excerpt, etc.), toolbar with “Review” button, **Review mode** toggle; in edit mode render form; in review mode render ReviewModeView. Handle apply one (auto-save + push to version_history for undo), apply selected, apply all. |
| **CreateBlogPage** | `app/dashboard/blogs/new/page.tsx` | Same as edit for review: “Review” sends current form to `POST /blogs/review` (no blogId); apply only updates local form until user saves (no version history until first save). |

### 2.2 Shared / Reusable

| Component | Responsibility | How It Works |
|-----------|----------------|---------------|
| **BlogReviewCard** | Scores, summary, list of suggestions, apply CTAs | Receives `BlogReviewResult`; shows overall + category scores, summary, suggestion list with checkboxes; “Apply selected” / “Apply all”; “View comparison”; emits `onApplyReview(selectedIds, applyAll)` and `onViewComparison()`. |
| **BlogReviewComparison** | Side-by-side diff (title / content / excerpt) | Modal: tabs for title/content/excerpt; line-by-line diff (original vs improved); “Close” and “Apply all”; receives `original`, `reviewResult`, `onClose`, `onApplyAll`. |
| **BlogReviewHighlights** (new) | In-context highlights + per-suggestion “Apply” | Used inside ReviewModeView. For each suggestion with a **location** (target: `title` \| `excerpt` \| `block`, blockId?, startOffset?, endOffset?), renders a highlight and an “Apply” button. On “Apply”, calls `onApplySuggestion(suggestionId)` → backend auto-saves and pushes to version_history (undo = restore). Uses **suggestion locations** from backend block-aware output or `mapSuggestionsToLocations(reviewResult, formData)`. |
| **BlogReviewSidebar** (new, optional) | Compact list of suggestions next to editor | Scrollable list of suggestions with type/priority badge, “Apply” per row; in review mode, highlights in content scroll-into-view when item focused. Reuses same `onApplySuggestion`. |
| **ReviewModeView** (new) | Read-only post view with highlights — **primary UX** | Renders title + excerpt + blocks (read-only) with `BlogReviewHighlights`. User applies suggestions from here; each apply auto-saves and adds to version_history so “Undo” (restore previous version) works. Toggle back to edit mode to continue editing. |

### 2.3 Editor Integration

| Component | Responsibility | How It Works |
|-----------|----------------|---------------|
| **BlockEditor** (existing) | Editable blocks | Not used in review mode. Review mode uses **ReviewModeView** (read-only block render + highlights). |
| **SuggestionLocationResolver** (util) | Map suggestions to locations | When backend returns block-aware suggestions (blockId/blockIndex + offset), use them directly. Otherwise `mapSuggestionsToLocations(reviewResult, { title, excerpt, content_blocks })`: for each suggestion, use backend `blockId`/`blockIndex` or fallback to searching `original` in title, excerpt, or block text; return `{ suggestionId, target, blockId?, startOffset?, endOffset? }`. Used by BlogReviewHighlights in ReviewModeView. |

### 2.4 Data Flow (Components)

- **EditBlogPage** holds: `formData`, `reviewResult`, `appliedSuggestionIds`, `showReview`, `showComparison`.
- User clicks **Review** → `reviewBlogAsync({ blogId, data })` → store `reviewResult`; run `mapSuggestionsToLocations(reviewResult, formData)` → set `suggestionLocations`; set `showReview = true`, `appliedSuggestionIds = []`.
- **BlogReviewCard** and **BlogReviewHighlights** both receive `reviewResult`, `appliedSuggestionIds`, `suggestionLocations`. Card shows “Applied” for ids in `appliedSuggestionIds`; Highlights only render non-applied with a location.
- **Apply one**: `onApplySuggestion(id)` → replace text at that location in formData; **PATCH blog** (auto-save) with updated content; **push current version to version_history** before applying so user can **undo** via “Restore previous version”. Then add `id` to `appliedSuggestionIds`, refresh suggestion locations.
- **Apply all**: call `applyReviewAsync({ blogId, data: { improved_content, improved_title, improved_excerpt } })`; backend already pushes to version_history then updates; on success, set formData from response or from improved_* and `htmlToBlocks(improved_content)`; set `showReview = false` and no full reload.
- **Undo (after apply one)**: User restores previous version via version history UI; same restore API as today.

---

## 3. APIs They Will Need

### 3.1 Current (Keep)

| Method | Route | Purpose | Request | Response |
|--------|-------|---------|---------|----------|
| POST | `/api/v1/blogs/:blogId/review` | Run review for draft | Body: `{ title, content, excerpt?, category?, content_blocks? }` — when `content_blocks` sent, backend returns block-aware suggestions (blockId/blockIndex + offset). | `{ data: BlogReviewResult }` |
| POST | `/api/v1/blogs/review` | Review without blogId (e.g. new post) | Same body | Same |
| POST | `/api/v1/blogs/:blogId/review/apply` | Apply all improved content | Body: `{ improved_content?, improved_title?, improved_excerpt? }`; backend pushes current to version_history then updates. | `{ data: Blog }` |
| POST | `/api/v1/blogs/:blogId/review/apply-one` | Apply a single suggestion (auto-save + undo via version history) | Body: `{ suggestion_id, target, blockId?, blockIndex?, startOffset?, endOffset?, original, suggestion }`; backend pushes current to version_history then applies the one replacement. | `{ data: Blog }` |
| POST | `/api/v1/blogs/:blogId/restore/:version` | Restore version (e.g. Undo after apply-one) | - | `{ data: Blog }` |

### 3.2 Optional Additions (Later)

| Method | Route | Purpose | Request | Response |
|--------|-------|---------|---------|----------|
| GET | `/api/v1/blogs/:blogId/review/last` | Get last review result (if we persist it) | - | `{ data: BlogReviewResult }` or 404 |
| POST | `/api/v1/blogs/:blogId/review/apply-suggestions` | Apply only selected suggestion ids | `{ suggestion_ids: string[], improved_content?, ... }` | `{ data: Blog }` |

### 3.3 When Each API Is Called

- **Review**: When user clicks “Review”; frontend sends title, content, excerpt?, category?, and **content_blocks** when available so backend can return block-aware suggestions.
- **Apply one**: When user clicks “Apply” on a suggestion in review mode; frontend calls **POST .../review/apply-one** (or PUT blog with updated content after backend supports version push on update); backend pushes current to version_history then applies single suggestion so undo = restore.
- **Apply review (all)**: When user clicks “Apply all”; frontend sends improved_content, improved_title, improved_excerpt to existing apply endpoint.
- **Restore version**: When user chooses a version from version history (e.g. “Undo” after apply-one) and confirms restore.

---

## 4. API Logic Design (Backend)

### 4.1 Controller Layer

- **BlogReviewController** (existing)
  - **reviewBlog**: Validate auth, site, draft (if blogId), ownership; read title, content, excerpt, category from body (or from blog if blogId); call **BlogReviewOrchestrator.runReview(...)**; return result.
  - **applyReview**: Validate auth, blogId, draft, ownership; push current to version_history; update blog with improved_content/title/excerpt; return updated blog.
  - **restoreVersion**: Validate auth, blogId, version in history; push current to history; restore target version; return updated blog.

Controllers stay thin: validation + delegation to service/orchestrator.

### 4.2 Service / Orchestrator Layer

- **BlogReviewOrchestrator** (new)
  - Single entry: `runReview(title, content, excerpt?, category?): Promise<BlogReviewResult>`.
  - Responsibilities: normalize input (strip HTML to plain text, word count), run **review pipeline** (see below), merge pipeline outputs into one **BlogReviewResult**, handle timeouts and partial failures.

- **Review pipeline** (see Section 6)
  - Implemented as a **pipeline of stages** (prompt chaining). Each stage has: input, output type, prompt builder, model call, output parser.
  - Orchestrator runs stages in sequence (or some in parallel), then a **synthesis** stage that produces `BlogReviewResult` (scores, suggestions[], improved_content, improved_title, improved_excerpt, summary).

### 4.3 Where the “AI” Lives

- **ReviewPipeline** (or **ReviewStages**): each stage uses a **PromptRunner** (or **LLMAdapter**) abstraction that calls HuggingFace (or, later, another provider). Same token/timeout config as today.
- **BlogReviewService** (existing) can be refactored into: (1) **BlogReviewOrchestrator** + (2) **ReviewPipeline** + (3) stage-specific **prompt builders** and **parsers**. We keep a single public API: `reviewBlog(...)` implemented by the orchestrator.

---

## 5. Code Design (Backend)

### 5.1 Folder Structure (Proposed)

```
backend/src/modules/blog/
├── controllers/
│   ├── blog-review.controller.ts   # unchanged surface; calls orchestrator
│   └── ...
├── services/
│   ├── blog-review.service.ts     # optional: keep for simple fallback or remove
│   └── blog-review/
│       ├── blog-review.orchestrator.ts   # runReview() → pipeline.run()
│       ├── review-pipeline.ts            # pipeline definition, run stages
│       ├── stages/
│       │   ├── types.ts                   # input/output types per stage
│       │   ├── extract-and-grammar.stage.ts
│       │   ├── seo.stage.ts
│       │   ├── structure.stage.ts
│       │   ├── engagement.stage.ts
│       │   └── synthesis.stage.ts
│       ├── prompts/
│       │   ├── grammar.prompt.ts
│       │   ├── seo.prompt.ts
│       │   ├── structure.prompt.ts
│       │   ├── engagement.prompt.ts
│       │   └── synthesis.prompt.ts
│       └── llm/
│           ├── llm-adapter.interface.ts
│           └── huggingface.adapter.ts
```

### 5.2 Key Interfaces

```ts
// Shared result type (existing, extend if needed)
interface BlogReviewResult {
  overall_score: number;
  scores: Record<ReviewScoreCategory, number>;
  suggestions: ReviewSuggestion[];
  improved_content?: string;
  improved_title?: string;
  improved_excerpt?: string;
  summary: string;
}

interface ReviewSuggestion {
  id?: string;           // optional stable id (index or UUID)
  type: SuggestionType;
  priority: Priority;
  line?: number;
  section?: string;
  original: string;
  suggestion: string;
  explanation: string;
  target?: "title" | "excerpt" | "content";  // for frontend location
}

// Pipeline stage contract
interface ReviewStageInput {
  title: string;
  plainText: string;
  excerpt?: string;
  category?: string;
  wordCount: number;
  // Optional: previous stage outputs for context
  grammarResult?: GrammarStageOutput;
  seoResult?: SEOStageOutput;
  // ...
}

interface ReviewStageOutput {
  // Stage-specific; synthesis stage produces BlogReviewResult
}

interface IReviewStage {
  name: string;
  run(input: ReviewStageInput): Promise<ReviewStageOutput>;
}
```

### 5.3 Orchestrator Pseudocode

```ts
class BlogReviewOrchestrator {
  constructor(
    private pipeline: ReviewPipeline,
    private config: BlogReviewConfig
  ) {}

  async runReview(title: string, content: string, excerpt?: string, category?: string): Promise<BlogReviewResult> {
    const plainText = stripHtmlToPlainText(content);
    const wordCount = countWords(plainText);
    if (plainText.length > this.config.MAX_CONTENT_LENGTH) throw new BadRequestError("Content too long");

    const input: ReviewStageInput = { title, plainText, excerpt, category, wordCount };
    const result = await this.pipeline.run(input);  // runs all stages, returns BlogReviewResult
    return result;
  }
}
```

### 5.4 Pipeline Pseudocode

```ts
class ReviewPipeline {
  constructor(
    private stages: IReviewStage[],
    private synthesis: SynthesisStage
  ) {}

  async run(initialInput: ReviewStageInput): Promise<BlogReviewResult> {
    let context = { ...initialInput };
    for (const stage of this.stages) {
      const out = await stage.run(context);
      context = { ...context, [stage.name]: out };
    }
    return this.synthesis.run(context);
  }
}
```

Synthesis stage takes all stage outputs and: (1) merges suggestions with stable ids, (2) computes overall/category scores (e.g. average or weighted), (3) asks one final small prompt for `improved_content` / `improved_title` / `improved_excerpt` from merged suggestions, or uses a single “apply all suggestions” pass. See Section 6.

---

## 6. Review Pipeline: Scalable, Quality-Oriented Design

### 6.1 Why Prompt Chaining (Pipeline) Instead of One Big Prompt

- **Single monolithic prompt**: Hard to scale (token limit, quality drop on long content), hard to tune (changing one criterion affects others), and one parse failure loses everything.
- **Prompt chaining (pipeline)**: Each stage is a focused task with a small prompt and a structured output. We can add criteria by adding a stage, tune per stage, run some stages in parallel, and use different models per stage later (e.g. smaller model for grammar, larger for synthesis).

### 6.2 Why Not a Full “Agent” (Yet)

- An **agent** that chooses which tools to call and in what order is flexible but adds latency, cost, and unpredictability. For a **deterministic** review (always grammar, SEO, structure, engagement, then merge), a **fixed pipeline** is simpler and more reliable.
- We can later add an “optional deep review” agent that runs after the pipeline and adds extra checks for selected sections; for v1 we stick to the pipeline.

### 6.3 Pipeline Architecture: Stages

| Stage | Input | Output | Purpose |
|-------|--------|--------|---------|
| **Extract & Grammar** | title, plainText, excerpt, wordCount | GrammarStageOutput: `{ grammarScore, suggestions[] }` (type grammar, original, suggestion, explanation) | Spelling, punctuation, tense, agreement. Lightweight; can use smaller model. |
| **SEO** | title, plainText, excerpt, category, wordCount | SEOStageOutput: `{ seoScore, suggestions[] }` (type seo) | Title length, excerpt length, keyword in first paragraph, heading hierarchy, alt text. |
| **Structure** | plainText, wordCount, optional headings list | StructureStageOutput: `{ structureScore, suggestions[] }` | Heading hierarchy, paragraph length, lists, flow. |
| **Engagement / Winning post** | title, plainText, excerpt | EngagementStageOutput: `{ engagementScore, suggestions[] }` | Hook in opening, clear audience, scannability, takeaway/CTA, completeness. |
| **Synthesis** | All stage outputs + original title, plainText, excerpt | **BlogReviewResult** | Merge suggestions (dedupe by original text), assign scores to BlogReviewResult.scores, compute overall_score; generate improved_content, improved_title, improved_excerpt (one synthesis prompt that “applies” all suggestions to produce full text). |

### 6.4 Parallelization

- **Extract & Grammar**, **SEO**, **Structure**, **Engagement** do **not** depend on each other. They can run **in parallel** (e.g. `Promise.all([grammarStage.run(input), seoStage.run(input), ...])`) to reduce latency.
- **Synthesis** runs after all four, with all outputs as input.

### 6.5 Per-Stage Prompt Design (Principles)

- **Strict JSON output**: Each stage prompt ends with “Return ONLY valid JSON of the form: { ... }.”
- **Short context**: Send only the text needed (e.g. for SEO send title + excerpt + first N chars of content + heading list).
- **Idempotent and deterministic**: Same input → same output shape; use low temperature (e.g. 0.2–0.3).
- **Stable suggestion shape**: Every suggestion has `type`, `priority`, `original`, `suggestion`, `explanation`; optional `section` or `line` for display.

### 6.6 Synthesis Stage Logic

- **Merge suggestions**: Concatenate all stage suggestions; optionally dedupe by normalizing `original` (e.g. trim, collapse spaces).
- **Scores**: `BlogReviewResult.scores` = { grammar, seo, structure, engagement, readability?, style?, fact_check? }. Readability/style/fact_check can come from a dedicated stage or be derived (e.g. average of grammar+structure for readability).
- **Overall score**: Weighted average of category scores (e.g. 0.25 grammar, 0.25 seo, 0.25 structure, 0.25 engagement).
- **improved_content / improved_title / improved_excerpt**: One **synthesis prompt** that receives original title, content, excerpt and the list of suggestions, and outputs the three improved strings (apply all suggestions in order). This keeps a single source of truth for “full improved version” and avoids merging HTML ourselves.

### 6.7 Reliability in the Pipeline

- **Timeout per stage**: Each stage has a timeout (e.g. 20s); on timeout return empty suggestions and a default score (e.g. 70) for that stage so the rest of the pipeline can continue.
- **Parse failure**: If a stage’s JSON parse fails, use fallback for that stage (default score, empty suggestions) and log; synthesis still runs with other stages’ outputs.
- **Rate limit**: Optional per-user or per-IP rate limit on `POST .../review` (e.g. 10/hour) to control cost and abuse.

---

## 7. Frontend Code Design (Summary)

- **Hooks**: `useBlogReview()` (existing) — reviewBlog, applyReviewAsync, reviewResult, isReviewing; extend with `applySuggestionLocally(suggestionId)` that updates formData and appliedSuggestionIds (no API).
- **Utils**: `mapSuggestionsToLocations(reviewResult, formData)` → `SuggestionLocation[]`; `applySuggestionToFormData(formData, suggestion, location)` → new formData.
- **State**: Review state (reviewResult, appliedSuggestionIds, suggestionLocations, showReview, showComparison) can live in EditBlogPage or in a small **useReviewState** hook.

---

## 8. Implementation Order (Recap)

1. **Backend pipeline**: Add `blog-review/` folder; implement stages (extract+grammar, seo, structure, engagement) and synthesis; orchestrator runs pipeline (parallel stages then synthesis); wire controller to orchestrator.
2. **Backend prompts**: Implement per-stage prompts and parsers; add engagement/winning-post criteria; keep response shapes typed.
3. **Frontend location mapping**: Implement `mapSuggestionsToLocations` and `applySuggestionToFormData`; add `suggestion_id` or index in API response if needed.
4. **Frontend apply one**: BlogReviewCard and (when built) BlogReviewHighlights call `onApplySuggestion(id)`; page updates formData and appliedSuggestionIds; no reload.
5. **Frontend apply all**: Use existing apply API; update form state from response without full page reload.
6. **In-context highlights**: Add BlogReviewHighlights (or ReviewModeView) and wire suggestion locations; optional sidebar.
7. **Failure UX**: Retry, timeouts, and clear messages (as in BLOG_REVIEW_FEATURE_PLAN.md).

This spec gives you the **pages**, **components**, **APIs**, **API logic**, **code design**, and **scalable review pipeline** (prompt chaining with optional parallel stages and a synthesis step) for a reliable, high-quality review feature.
