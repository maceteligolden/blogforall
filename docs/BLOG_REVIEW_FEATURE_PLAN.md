# Blog Review Feature: Plan & Design

This document explains the **review process**, proposes a **GitHub-style / in-context adjustment UX**, defines **review criteria** (grammar, winning post, SEO, etc.), and covers **reliability** and **UX** for both success and failure.

---

## 1. Current Review Process (As-Is)

### 1.1 Flow

1. **Trigger**  
   User is on the **draft** blog edit page (`/dashboard/blogs/[id]`). They click a “Review” (or similar) action.

2. **Request**  
   Frontend sends current **title**, **content** (HTML or derived from `content_blocks`), **excerpt**, and optional **category** to:
   - `POST /api/v1/blogs/:blogId/review` (with body)  
   Only draft posts can be reviewed; backend enforces auth, site, and ownership.

3. **Backend**  
   - **BlogReviewService** strips HTML to plain text (keeping structure hints), counts words.  
   - Builds a **single prompt** asking the AI (HuggingFace, e.g. Mistral) for:
     - `overall_score` (0–100)
     - `scores` per category: readability, seo, grammar, structure, fact_check, style
     - `suggestions[]`: type, priority, optional line/section, **original**, **suggestion**, **explanation**
     - **improved_content**, **improved_title**, **improved_excerpt** (full replacement text)
     - **summary**
   - Response is parsed as JSON; on parse failure a safe fallback result is returned.

4. **Frontend**  
   - Shows **BlogReviewCard**: overall + category scores, summary, list of suggestions (with original / suggestion / explanation).  
   - User can:
     - **Select suggestions** (checkboxes) and “Apply X selected” — but **implementation currently applies the full improved_content/title/excerpt** for both “selected” and “apply all” (TODO in code).  
     - **“Apply All AI Improvements”** — applies full improved_content, improved_title, improved_excerpt.  
   - **“View Comparison”** opens **BlogReviewComparison** modal: side-by-side original vs improved (title / content / excerpt) with simple line-level diff (same line = no highlight; different = red/green). Apply All from there also applies full improved content.

5. **Apply**  
   - **Apply review** calls `POST /api/v1/blogs/:blogId/apply-review` with `improved_content`, `improved_title`, `improved_excerpt`.  
   - Backend pushes current version to `version_history`, then updates blog.  
   - Frontend then updates form state (and currently does a full page reload).

### 1.2 Current Limitations

- **No per-suggestion apply**: “Apply selected” still applies the whole improved content; suggestions are not applied one-by-one in the editor.
- **No in-context highlighting**: Suggestions are listed in a separate card; the post body is not annotated with highlights and “Apply” CTAs where each suggestion lives.
- **Line numbers** from the AI are relative to plain text, not blocks or HTML — so “line” is fuzzy for block-based editor.
- **Criteria** are already broad (readability, SEO, grammar, structure, fact-check, style) but the prompt doesn’t explicitly call out “winning post” or a formal checklist; we can tighten and extend.
- **Failure UX**: Toast on error; no retry, no partial result, no “save review result for later.”

---

## 2. Target: In-Context Adjustments (GitHub-Like + Highlights + CTA)

### 2.1 Desired UX

- **In-context highlights**  
  Where a suggestion applies (e.g. a sentence in a paragraph block, or the title, or the excerpt), that span is **visually highlighted** in the editor/preview (e.g. yellow/amber for “suggestion here”), with a clear **anchor** (e.g. suggestion id or index).

- **Per-suggestion CTA**  
  Each highlighted region has a small **“Apply”** (or “Accept”) control. Clicking it:
  - Applies **only that suggestion** (replaces that span with the suggested text).
  - Updates editor state (and optionally re-runs a lightweight “re-index” of suggestions so remaining highlights stay correct).
  - No full-page reload; no “apply all” unless the user chooses it.

- **Suggestion list stays in sync**  
  The existing suggestion list (card or sidebar) can:
  - Show which suggestions are **already applied** (e.g. greyed out, “Applied” badge).
  - “Apply” in the list could apply that suggestion in the document (same as clicking in-context).
  - “Apply all” remains: apply every unapplied suggestion in order (or apply the full improved_content once).

- **GitHub-like feel**  
  Think: PR review comments on a line/snippet, with “Apply” per comment. We stop short of full diff view for the whole doc; we keep the current “single post view” and add highlights + per-suggestion apply.

### 2.2 Data Model for In-Context Apply

- Each **suggestion** needs a **stable identity** (e.g. `suggestion_id` or index) and a way to **locate** it in the document:
  - **Title** / **excerpt**: single field each; one suggestion can target “title” or “excerpt.”
  - **Content**: we need a **span** in the current content. Options:
    - **By offset**: `start_offset`, `end_offset` in the **plain text** used for review (so we have to map plain-text offset back to block + inline position).
    - **By “original” text**: store `original` and **find first occurrence** in content (fragile if same phrase appears twice).
    - **By block + offset**: AI returns `block_index` (or block id) and optional `start/end` within that block’s text (requires AI to output block-aware positions; we’d need to send block structure in the prompt).
- **Recommendation (v1)**:  
  - Keep **original** and **suggestion** per suggestion.  
  - **Locate** by searching for `original` in (title, excerpt, or content text). If we use blocks, we can search within each block’s text and attach suggestion to that block + character range.  
  - Store **suggestion_id** (e.g. index or UUID) so we can mark “applied” and only apply that one when user clicks “Apply.”

### 2.3 Backend Changes for Per-Suggestion Apply

- **Option A – Frontend-only apply**  
  Applying one suggestion only changes the draft in the editor (title/excerpt/content_blocks). User saves the post as usual. No new API for “apply one suggestion.”  
  - **Pros**: Simple, no backend change.  
  - **Cons**: “Apply 3 suggestions” means 3 in-memory edits; “Apply all” still needs to send full content once (e.g. improved_content or rebuilt from applied suggestions).

- **Option B – API accepts “apply suggestion by id”**  
  e.g. `POST apply-review` with `{ applied_suggestion_ids: [0,2], improved_content?, improved_title?, improved_excerpt? }`. Backend recomputes content from suggestions or uses improved_* when “apply all.”  
  - More flexible for future “save review, apply later” but more complex.

- **Recommendation**: Start with **Option A** (all apply logic in frontend; persist via normal blog update). Add **Option B** later if we want “apply suggestions” without sending full content in one shot.

---

## 3. Review Criteria and Standards

### 3.1 Existing (Keep and Clarify)

- **Grammar & spelling**  
  Correctness, punctuation, tense consistency, subject–verb agreement.

- **Readability**  
  Sentence length, paragraph length, clarity, transition between paragraphs.

- **SEO**  
  Keyword usage, meta (title/excerpt) length and clarity, heading hierarchy (H1 → H2 → H3), internal/external linking opportunities, image alt text.

- **Structure**  
  Heading hierarchy, use of lists, subheadings, logical flow.

- **Style**  
  Tone, voice consistency, engagement (hooks, questions, clear CTA where appropriate).

- **Fact-check**  
  Flag unsupported or potentially inaccurate claims (with explanation).

### 3.2 “Winning Post” Standards (Add)

Define “winning” as: **likely to achieve the author’s goal** (traffic, shares, signups, authority). Criteria we can add to the prompt:

- **Clear goal and audience**  
  Does the intro state or imply who it’s for and what they’ll get?

- **Strong opening**  
  First 1–2 sentences hook the reader (question, stat, story, or bold claim).

- **Scannability**  
  Subheadings, short paragraphs, bullets/numbers where helpful.

- **Action or takeaway**  
  Conclusion or CTA that gives the reader a next step or a clear takeaway.

- **Completeness**  
  No obvious gaps (e.g. “we’ll cover X, Y, Z” and then one is missing).

We can add a **seventh score**: e.g. `engagement` or `winning_post` (0–100) and ask the model to output suggestions tagged with type `engagement` or a new type.

### 3.3 SEO-Friendly Checklist (Make Explicit in Prompt)

- Title length (e.g. 50–60 chars) and keyword placement.
- Excerpt/meta description length (e.g. 150–160 chars) and clarity.
- One H1 (title), then H2/H3 hierarchy.
- Keyword in first paragraph.
- Image alt text present and descriptive (we can pass image blocks/captions to the review).

### 3.4 Other Standards (Optional)

- **Accessibility**  
  Suggest “add alt text” for images; avoid “click here” without context.  
- **Inclusivity**  
  Neutral, inclusive language.  
- **Brand/voice**  
  If we ever have “site voice” or “brand guidelines,” we could pass a short note into the prompt.

We can add types like `accessibility`, `inclusivity` and keep `other` for the rest.

---

## 4. Review Process (End-to-End, Target State)

1. **User** clicks “Review” on a draft post (title + content + optional excerpt/category).
2. **Frontend** validates (title and content required), then calls `POST /api/v1/blogs/:blogId/review` with that payload.
3. **Backend**  
   - Validates auth, site, draft status, ownership.  
   - Converts content to plain text (preserving structure), counts words.  
   - Builds a **single** prompt that includes:
     - Instructions to return JSON with scores, suggestions (with **original**, **suggestion**, **explanation**, **type**, **priority**, optional **section** / **line**).
     - Explicit criteria: grammar, readability, SEO (with checklist), structure, fact-check, style, **winning post / engagement** (and optionally accessibility/inclusivity).
     - Request to output **improved_content**, **improved_title**, **improved_excerpt** for “apply all.”
   - Calls HuggingFace (or configured model); parses JSON; on failure returns a safe fallback (scores 70, empty suggestions, original text as “improved”).
4. **Backend** returns the same **BlogReviewResult** shape (we can add fields such as `suggestion_id` or `engagement` score).
5. **Frontend**  
   - Stores `reviewResult` and **maps each suggestion to a location** (title, excerpt, or content block + span) by matching `original` in the current text.  
   - Renders **highlights** in the editor (or in a read-only “review mode” panel) with **“Apply”** per suggestion.  
   - Suggestion list shows each item with “Applied” or “Apply” and syncs with in-context apply.  
   - “Apply all” replaces title/excerpt/content with improved_* and syncs to blocks if needed.
6. **Apply one**  
   - User clicks “Apply” on one suggestion → frontend replaces that span in title/excerpt/content_blocks, marks suggestion applied, re-renders highlights.  
   - No API call until user saves the post (or we add an optional “Save draft” after apply).
7. **Apply all**  
   - Same as today: send improved_content, improved_title, improved_excerpt to apply-review (or build from applied suggestions + improved_* for the rest). Backend saves and pushes to version_history.

---

## 5. Reliability

- **Validation**  
  - Backend: title + content required; max content length; draft-only; auth/site/ownership.  
  - Frontend: same checks before calling review; disable “Review” while `isReviewing`.

- **AI failures**  
  - **Timeout**: use `BLOG_REVIEW_API_TIMEOUT` (e.g. 60s); return a clear error (“Review took too long; try again”).  
  - **Parse failure**: keep current fallback (generic score, no suggestions, original as “improved”) and surface a short message (“Review completed with limitations; some suggestions could not be loaded”).  
  - **API/network error**: return 4xx/5xx with a clear message; frontend shows toast and optionally “Retry.”

- **Idempotency / rate limiting**  
  - Optional: per-user or per-blog rate limit on review to avoid abuse and cost.  
  - “Apply review” is not idempotent (version_history grows); that’s acceptable.

- **Content length**  
  - Enforce `MAX_CONTENT_LENGTH`; if exceeded, return clear error and suggest shortening or splitting.

- **Mapping suggestions to document**  
  - If `original` is not found (e.g. AI changed wording), show the suggestion only in the list (no in-context highlight); still allow “Apply” from list by inserting/replacing at a chosen position or skipping.

---

## 6. User Experience

### 6.1 When Review Succeeds

- **Clear outcome**  
  Show overall score and category scores at a glance (current card is good).  
  Short summary + “X suggestions” so the user knows what to do next.

- **In-context highlights**  
  User sees exactly where each suggestion is; one click “Apply” per suggestion; list and highlights stay in sync; “Apply all” for the impatient.

- **No surprise overwrites**  
  “Apply” one suggestion only changes that span. “Apply all” should be explicit (e.g. “Replace entire content with AI-improved version”) and optionally show a short confirmation.

- **Draft saved**  
  After “Apply all” via API, show success toast and update form state without full reload if possible (remove `window.location.reload()` and refetch or set state from response).

### 6.2 When Review Fails

- **Network / server error**  
  Toast: “Review failed: [message]. Please try again.”  
  Keep the draft unchanged; show “Retry” on the review card or near the Review button.

- **Timeout**  
  “Review is taking longer than usual. You can try again or continue editing.”  
  Offer “Retry” and “Cancel.”

- **Parse / partial failure**  
  “Review completed, but some details couldn’t be loaded. You can still use the summary and apply improvements below.”  
  Show what we have (scores, summary, improved_* if present); allow “Apply all” if we have improved_content.

- **Validation**  
  Before calling API: “Title and content are required for review.”  
  “Only draft posts can be reviewed.”  
  “Content is too long for review (max X characters).”  
  Show these in the UI (inline or toast) and do not call the API.

### 6.3 Accessibility and Performance

- **Loading state**  
  Disable “Review” and show spinner or skeleton while `isReviewing`.  
  Optional: “Review can take 30–60 seconds for long posts.”

- **Keyboard / screen readers**  
  Highlights and “Apply” buttons should be focusable and announced (e.g. “Suggestion: [original]. Apply suggestion.”).

- **Mobile**  
  In-context highlights and CTAs should be tappable and not too small; suggestion list can be collapsible or in a drawer.

---

## 7. Implementation Phases (Suggested)

- **Phase 1 – Criteria and prompt**  
  - Extend backend prompt with “winning post”/engagement, SEO checklist, optional accessibility/inclusivity.  
  - Add engagement (or winning_post) score and type in response.  
  - No UI change yet.

- **Phase 2 – Per-suggestion apply in frontend**  
  - Map suggestions to locations (title, excerpt, blocks) by matching `original`.  
  - In-context highlights + “Apply” button per suggestion; apply only that suggestion in state; mark as applied.  
  - “Apply selected” in list = apply those suggestions in order in the document.  
  - “Apply all” still sends improved_* to API; after apply, update form state without full reload.

- **Phase 3 – Polish and failure UX**  
  - Retry on failure; clear messages for timeout/parse/validation.  
  - Optional confirmation for “Apply all.”  
  - Optional rate limit and timeout configuration in env.

---

## 8. Decisions (Locked)

1. **Block-aware suggestions** — **Yes.** AI returns block index or block id so we can highlight and apply inside a specific block. Backend receives block structure and returns suggestions with block reference (block id or index + optional offset).

2. **Review mode vs inline in editor** — **Review mode.** Highlights and “Apply” live in a **separate “Review mode”** view (read-only copy of the post with highlights and CTAs). User toggles into review mode to see suggestions in context; apply updates draft and version history; undo = restore previous version.

3. **“Winning post” definition** — **Decided: engagement-focused.** Use an **engagement** score (opens, shares, clicks, readability, strong opening, scannability, clear takeaway). We can add conversion-oriented criteria (signups, CTAs) later as an optional dimension; for v1 the extra score is **engagement**.

4. **Apply one suggestion – save immediately?** — **Auto-save, with undo via version history.** When user applies a single suggestion we PATCH the blog (auto-save). Before applying, push current state to `version_history` so the user can **undo** by restoring the previous version. UI can expose “Undo last apply” that calls restore to the prior version.

5. **Rate limits** — **None for now.** No per-user or per-blog rate limit on review. Can add later if needed.

6. **Content_blocks in review** — **Decided: accept content_blocks and return block-aware suggestions.** Review API accepts optional `content_blocks` (in addition to or instead of `content` HTML). When blocks are provided, backend uses them in the prompt and returns suggestions with `blockId` or `blockIndex` and optional `startOffset`/`endOffset` for precise placement. Frontend can then highlight and apply in the correct block. If only HTML is sent, backend falls back to “original” text matching.

---

## 9. See Also

- **[BLOG_REVIEW_IMPLEMENTATION_SPEC.md](./BLOG_REVIEW_IMPLEMENTATION_SPEC.md)** — Pages to work on, components (with behavior), APIs (routes, request/response), API logic design (controller → orchestrator → pipeline), backend/frontend code design, and **review pipeline architecture** (prompt chaining, parallel stages, synthesis) for scalable, quality review sessions.
