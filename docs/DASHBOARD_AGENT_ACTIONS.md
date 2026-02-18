# Dashboard Agent — Initial Actions

This document defines the **first set of actions** the dashboard/site agent can perform. The AI has no direct database access; it triggers these actions by calling existing backend services with the authenticated user’s context (`userId`, `siteId`).

---

## 1. Create category

**Action id:** `create_category`

**Purpose:** Let the user create a category by chat (e.g. “Add a category called Tech” or “Create a category named Product Updates with description …”).

**Backend:** `CategoryService.createCategory(siteId, input)`

**Parameters:**

| Parameter     | Type   | Required | Notes                          |
|---------------|--------|----------|--------------------------------|
| `name`        | string | Yes      | Category name                  |
| `description` | string | No       | Optional description           |
| `parent`      | string | No       | Parent category ID for nesting |
| `color`       | string | No       | Optional color (e.g. hex)      |

**Example:** User says “Create a category called Announcements.”  
→ Agent outputs action `{ "action": "create_category", "name": "Announcements" }`  
→ Backend calls `categoryService.createCategory(siteId, { name: "Announcements" })`  
→ Reply: “Created category **Announcements**.”

---

## 2. Create draft blog post

**Action id:** `create_draft_post`

**Purpose:** Create a new blog post in **draft** status so the user can edit and publish later (e.g. “Draft a post titled X about Y”).

**Backend:** `BlogService.createBlog(authorId, siteId, input)` with `status: "draft"`.

**Parameters:**

| Parameter  | Type   | Required | Notes                                      |
|------------|--------|----------|--------------------------------------------|
| `title`    | string | Yes      | Post title                                 |
| `content`  | string | Yes      | Body (HTML or plain text; store as HTML)   |
| `excerpt`  | string | No       | Short summary                              |
| `category` | string | No       | Category ID (from list_categories)         |

**Example:** User says “Draft a blog post called ‘Welcome to our blog’ with a short intro paragraph.”  
→ Agent outputs `{ "action": "create_draft_post", "title": "Welcome to our blog", "content": "<p>...</p>" }`  
→ Backend calls `blogService.createBlog(userId, siteId, { title, content, excerpt?, category?, status: BlogStatus.DRAFT })`  
→ Reply: “Created draft **Welcome to our blog**. You can edit and publish it from Blogs.”

---

## 3. Create campaign from proposal

**Action id:** `create_campaign_from_proposal`

**Purpose:** Already implemented in the campaign agent. When the AI has a full campaign + scheduled posts proposal, create the campaign and scheduled posts.

**Backend:** `CampaignAgentService.createFromProposal(userId, siteId, proposal)` (existing).

**Parameters:** Same as current proposal shape: `{ campaign: { name, goal, ... }, scheduled_posts: [ ... ] }`.

**Example:** User finishes the campaign conversation; agent returns a proposal; user says “Create it.”  
→ Backend runs `createFromProposal` with the stored/returned proposal.  
→ Reply: “Campaign **…** and N scheduled posts created.”

---

## 4. List categories (read-only)

**Action id:** `list_categories`

**Purpose:** So the agent can say “You have categories: X, Y, Z” or “I’ll put this in the **Tech** category” and pass a real `category` id when creating a draft.

**Backend:** `CategoryService.getSiteCategories(siteId)` (or getSiteCategoriesTree if you want hierarchy).

**Parameters:** None (uses `siteId` from context).

**Returns:** List of `{ _id, name, slug, description? }` (or tree). Backend injects this into the conversation (e.g. as a short system or tool-result message) so the model can reference it.

**Example:** User says “What categories do I have?”  
→ Backend calls `categoryService.getSiteCategories(siteId)`, then sends reply: “You have: Tech, Announcements, Product Updates.”

---

## 5. List my drafts (read-only)

**Action id:** `list_my_drafts`

**Purpose:** Let the user ask “What drafts do I have?” so the agent can list them or suggest editing one.

**Backend:** Use existing blog list API filtered by `authorId` and `status: "draft"` (e.g. `BlogService` / repository method that returns drafts for the user).

**Parameters:** Optional `limit` (e.g. 10).

**Returns:** List of `{ _id, title, slug, updated_at? }`. Injected into context for the model’s reply.

**Example:** User says “Show my drafts.”  
→ Backend fetches drafts, agent replies: “You have 3 drafts: **Post A**, **Post B**, **Post C**.”

---

## Summary table

| Action                      | Type     | Service / method used                          |
|-----------------------------|----------|-----------------------------------------------|
| `create_category`           | Mutation | CategoryService.createCategory                |
| `create_draft_post`         | Mutation | BlogService.createBlog (status: draft)        |
| `create_campaign_from_proposal` | Mutation | CampaignAgentService.createFromProposal   |
| `list_categories`           | Read     | CategoryService.getSiteCategories             |
| `list_my_drafts`            | Read     | Blog list filtered by author + status draft   |

---

## Implementation notes

- **Auth:** Every action runs with `userId` and `siteId` from the authenticated session (same as current campaign agent).
- **Parsing:** The model’s reply can include a structured block (e.g. JSON) with `action` and parameters; the backend parses it, validates, calls the right service, then returns a short confirmation (or error) in natural language.
- **Confirmation:** For these first actions, auto-execute and confirm in chat (“Created category X”). Optional: for create_draft_post, you could add a “Create draft?” step later.
- **Out of scope for v1:** Delete, publish, update post, invite members, billing. Add in a later phase with explicit confirmation where needed.
