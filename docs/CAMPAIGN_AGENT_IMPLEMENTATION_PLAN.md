# Campaign Agent: Chat-Based AI Campaign Manager — Implementation Plan

## 1. Vision Summary

Replace (or augment) the current form-based campaign manager with an **internal AI agent** that:

- **Chats** with the user in a conversational UI to understand the campaign they want.
- Uses the **existing Hugging Face** integration (same token/config as blog review and blog generation).
- Has **guardrails** so the conversation stays on **campaign/marketing** only.
- Acts as a **veteran campaigner**: understands goals, audience, schedule, and content strategy; can infer a full campaign from minimal input.
- **Executes** for a blog platform: creates the campaign, schedules posts, and can **generate blog content** that aligns with campaign goals and meets the platform’s **review standard** (readability, SEO, grammar, structure, style, engagement).

---

## 2. Current System (Relevant Parts)

| Component | Purpose |
|-----------|--------|
| **Campaign** | name, goal, target_audience, start_date, end_date, posting_frequency, timezone, total_posts_planned, success_metrics. |
| **ScheduledPost** | blog_id (optional), campaign_id (optional), title, scheduled_at, timezone, auto_generate, generation_prompt, metadata (campaign_goal, target_audience, content_theme). |
| **BlogGenerationService** | analyzePrompt(prompt) → topic/domain/audience/purpose; generateBlogContent(prompt, analysis) → title, content, excerpt. Uses HF; has content-safety and retry. |
| **BlogReviewService** | reviewBlog(...) → scores (readability, seo, grammar, structure, fact_check, style, engagement), suggestions, improved_content/title/excerpt. |
| **PostSchedulerService** | Cron runs scheduled posts: if blog_id exists, publish; else if auto_generate + generation_prompt, generate then create blog and publish. |

The agent will **extract** campaign + scheduled-post intent from chat, then **create** Campaign and ScheduledPost records and optionally trigger or prepare content that meets review criteria.

---

## 3. Clarifications & Open Questions

### 3.1 Scope and UX

- **Replace vs augment**
  - **Option A:** Replace the current campaign creation flow (e.g. “New campaign” opens the chat agent instead of forms).
  - **Option B:** Add a new “Campaign Agent” / “Chat with campaign manager” entry point; keep existing forms for users who prefer them.
  - **Recommendation:** Start with **Option B** (add chat as an alternative) so existing flows keep working; we can later make chat the default.

- **Chat context**
  - One conversation per **site**? Per **campaign** (e.g. “continue planning this campaign”)? Or one global “campaign assistant” that can start a new campaign or refine an existing one?
  - **Recommendation:** One **session** per “campaign planning” intent: user can say “I want to run a product launch” and the agent drives to a single campaign + scheduled posts; optionally “start another” for a new campaign. Session can be keyed by site_id + optional campaign_id.

- **Where the chat lives**
  - Dedicated page: e.g. `/dashboard/campaigns/agent` or `/dashboard/agent`.
  - Or embedded in campaign create/edit: e.g. “Chat to set up” tab alongside “Manual setup”.
  - **Recommendation:** Dedicated `/dashboard/campaigns/agent` (or `/dashboard/agent`) so the agent has a clear, focused UI and we can add “Start campaign from chat” and “Open in campaign editor” links.

### 3.2 Guardrails

- **In-scope:** Campaign goals, target audience, dates, frequency, number of posts, content themes, blog topics/titles, SEO and readability goals, scheduling.
- **Out-of-scope:** Support requests, off-topic chitchat, non-marketing content, harmful or policy-breaking content.
- **Implementation:**
  - **System prompt** that states the agent is a “campaign marketing assistant for a blog platform” and must refuse off-topic or non-campaign requests politely.
  - Optional **pre-step**: before calling the main model, a small HF call (or regex/keyword check) to classify user message as campaign-related; if not, return a short “I can only help with campaign and content planning for your blog.”
  - **Content safety:** Reuse or mirror the existing blog-generation content-safety check for user messages so we don’t send unsafe input to the model.

- **Clarification:** Should the agent ever answer non-campaign questions with a redirect only (e.g. “I can only help with campaigns; for X try …”) or strictly refuse without suggestions?

### 3.3 “Veteran campaigner” behavior

- **Extract from minimal info:** User might say “we’re launching the new API next month, 3 posts a week.” Agent should infer: goal = product launch, end_date ≈ next month, posting_frequency = weekly with 3 posts, and ask only for missing critical bits (e.g. start date, audience, or “should I schedule these for Mon/Wed/Fri?”).
- **Ask for clarity:** When something is ambiguous (e.g. “more traffic” — clarify SEO vs ads vs social), agent asks one or two short questions.
- **Execute for blog platform:** Agent output should map to:
  - **Campaign**: name, goal, target_audience, start_date, end_date, posting_frequency, timezone, total_posts_planned.
  - **ScheduledPost** (per planned post): title (or topic), scheduled_at, timezone, auto_generate=true, generation_prompt (and metadata from campaign) so the existing cron + BlogGenerationService produce content.

- **Clarification:** Should the agent **create** the campaign and scheduled posts automatically when it has “enough” information (and confirm with the user), or only **propose** a JSON/config and let the user click “Create campaign” to persist? **Recommendation:** Agent proposes; user confirms; then backend creates Campaign + ScheduledPosts (and optionally pre-generates drafts). This avoids creating half-baked campaigns from a misunderstanding.

### 3.4 Generated content and “review standard”

- **Review standard** today: BlogReviewService scores posts on readability, SEO, grammar, structure, fact-check, style, engagement and returns suggestions. “Meeting review standard” can mean: generate content that is written with those criteria in mind so it scores well, and/or run review after generation and only publish (or suggest edits) if above a threshold.
- **Agent’s role:**
  - When the agent decides on “blog posts” for the campaign, it produces **generation_prompt** (and metadata) for each ScheduledPost. Existing **BlogGenerationService** already takes prompt + analysis (topic, audience, purpose). We can **extend the generation prompt** (in the agent or in BlogGenerationService) to include “write for readability, SEO, and engagement” so generated content is aligned with review criteria.
  - Optional: after generation, run **BlogReviewService** on the draft; if score is below threshold, either re-prompt generation or flag for the user. This can be a later phase.

- **Clarification:** Should the agent only **schedule** posts (with generation_prompt) and let the cron generate on publish time, or also support “pre-generate drafts now” so the user can review/edit before schedule? **Recommendation:** Start with “schedule with generation_prompt” (current behavior); add “pre-generate drafts” as a follow-up so users can review and run blog review before publish.

### 3.5 Technical: Hugging Face and chat

- **HF usage:** Reuse the same pattern as blog review: **chat completion** (conversational) with the HF router, using the same token and model strategy (e.g. `:hf-inference` and a model that supports chat). The agent is a **multi-turn chat**: backend keeps a **conversation history** (e.g. last N messages) per session and sends them as `messages` to HF each time.
- **Session storage:** Conversation history can be stored in memory (per server instance) keyed by session_id, or in DB (e.g. a `campaign_agent_sessions` collection with messages array). DB is better for “resume later” and multi-device.
- **Structured output:** When the agent has “enough” info to propose a campaign, we need a **structured** proposal (campaign fields + list of scheduled posts). Options:
  - **A:** Ask the model to output a JSON block in its reply; parse it and validate.
  - **B:** Separate “summarize and propose” API call that uses a prompt + few-shot to return only JSON (no free text).
  - **Recommendation:** A for simplicity: system prompt instructs the model to output a markdown code block with JSON when proposing; backend parses and validates, then returns “Proposal ready” + summary to the user and a “Create campaign” action.

---

## 4. Implementation Plan (Phases)

### Phase 1: Backend — Agent service and guardrails

- **1.1** Add **CampaignAgentService** (or similar) that:
  - Accepts `session_id`, `site_id`, `user_id`, and `message` (user turn).
  - Loads or creates conversation history for that session (in-memory or DB).
  - Applies **guardrails**: if message is clearly off-topic (keyword/list or a tiny classifier), return a short refusal without calling the main model.
  - Builds **system prompt**: role = “veteran campaign manager for a blog platform”; rules = only campaign/marketing; extract goal, audience, dates, frequency, content themes from minimal info; ask for clarity when needed; when ready, output a JSON proposal (campaign + scheduled posts) in a markdown code block.
  - Calls **HF chat completion** (reuse router + token; same pattern as blog-review) with `messages = [system, ...history, user_message]`.
  - Appends user and assistant messages to history; returns assistant reply (and optionally parsed proposal if present).
- **1.2** **Content safety:** Run the same (or a similar) content-safety check as blog generation on the user message before adding to history and calling the model.
- **1.3** **Structured proposal parsing:** When the assistant message contains a fenced JSON block, parse it; validate against Campaign + ScheduledPost shapes; return a **proposal** object (campaign + posts) in the API response so the frontend can show “Create campaign” with a summary.

**Deliverables:** Agent service; guardrails; HF chat integration; proposal parsing and validation.

### Phase 2: Backend — Chat API and “create from proposal”

- **2.1** **Routes:** e.g.  
  - `POST /api/v1/campaigns/agent/chat` — body: `{ session_id?, message, site_id? }`; returns `{ reply, proposal?, session_id }`.  
  - `POST /api/v1/campaigns/agent/create-from-proposal` — body: `{ session_id, proposal, site_id }`; creates Campaign + ScheduledPosts (with auto_generate + generation_prompt); returns campaign and scheduled posts.
- **2.2** Session store: either in-memory (session_id = uuid) or DB. If DB: store messages and optional proposal; TTL or cleanup for old sessions.
- **2.3** **Create-from-proposal** logic: validate proposal; create Campaign; for each post in proposal, create ScheduledPost (title, scheduled_at, timezone, campaign_id, auto_generate=true, generation_prompt and metadata from campaign goal/audience/theme). Reuse existing CampaignRepository and ScheduledPostRepository.

**Deliverables:** Chat endpoint; create-from-proposal endpoint; session handling.

### Phase 3: Frontend — Chat UI

- **3.1** **Page:** e.g. `/dashboard/campaigns/agent` (or `/dashboard/agent`) with a chat layout: message list + input. Use existing auth and site context (e.g. `currentSiteId`).
- **3.2** **API client:** `POST /campaigns/agent/chat` with `message`, `session_id` (optional), `site_id`; display `reply` in the thread; if `proposal` is present, show a summary card and a “Create campaign” button.
- **3.3** **Create campaign:** On “Create campaign”, call `POST /campaigns/agent/create-from-proposal` with the proposal and session_id; on success, redirect to campaign detail or scheduled posts list and show success toast.

**Deliverables:** Chat page; message list; input; proposal card; create-from-proposal flow.

### Phase 4: Generation quality and review alignment (optional / later)

- **4.1** **Prompt enrichment:** When building `generation_prompt` for scheduled posts (in the agent or in PostSchedulerService), include instructions for readability, SEO, and engagement so generated content is closer to review criteria.
- **4.2** **Post-generation review (optional):** After BlogGenerationService generates a post, run BlogReviewService; if overall_score &lt; threshold, either retry with a refined prompt or save as draft and flag for the user. Can be a later iteration.

---

## 5. Out of Scope (for this plan)

- Replacing or removing the existing campaign/scheduled-post forms (we add chat as an alternative).
- Running the agent on a different provider than Hugging Face (same HF connection as today).
- Full “pre-generate all drafts now” before schedule (can be added after Phase 3).
- Editing an existing campaign via chat (could be Phase 5).

---

## 6. Decisions to Confirm

1. **Chat entry point:** New page only (e.g. `/dashboard/campaigns/agent`) vs also embedding in “New campaign”?
2. **Session:** In-memory vs DB for conversation history? (DB recommended if we want “resume later”.)
3. **Proposal → Create:** User must click “Create campaign” after agent proposes (recommended), or allow agent to create automatically when it “decides” enough info is present?
4. **Guardrails:** Refuse off-topic with a short message only, or also suggest where to go (e.g. “For billing, go to Settings”)?
5. **Pre-generate drafts:** Include in Phase 1–3 or defer?

Once these are confirmed, implementation can proceed phase by phase with the existing Hugging Face connection and campaign/scheduled-post/blog-generation pipeline.
