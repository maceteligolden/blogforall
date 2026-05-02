## BlogsForAll – Blogs & Public API

High-level product and API documentation for the Blogs module: blog structure, categories, scheduled posts, AI review, and the public blog APIs secured by API keys.

---

### Sidebar

- **Overview**
  - [What is a blog in BlogsForAll?](#what-is-a-blog-in-blogsforall)
  - [Data model at a glance](#data-model-at-a-glance)
- **Authentication & Authorization**
  - [Dashboard vs Public API](#dashboard-vs-public-api)
  - [API key authentication](#api-key-authentication)
  - [Authorization rules](#authorization-rules)
- **Blog Concepts**
  - [Blog lifecycle](#blog-lifecycle)
  - [Categories](#categories)
  - [Scheduled posts](#scheduled-posts)
  - [AI blog review](#ai-blog-review)
- **Public Blog API (API key)**
  - [Base URL & headers](#base-url--headers)
  - [List published blogs](#get-published-blogs)
  - [Get a single blog by id](#get-published-blog-by-id)
  - [Get a single blog by slug](#get-published-blog-by-slug)
  - [List categories](#get-categories)
  - [List blogs by category](#get-blogs-by-category)
  - [Errors & limits](#errors--limits)
- **Deep Dives & Related Docs**
  - [Blog editor implementation](#blog-editor-implementation-deep-dive)
  - [AI blog review spec](#ai-blog-review-deep-dive)
  - [Auth & API keys PRDs](#auth-and-api-keys-related-prds)

---

### What is a blog in BlogsForAll?

A **blog** in BlogsForAll is a content item that belongs to a **site/workspace**, created and managed in the dashboard, and optionally exposed through the **public API** for external websites or apps.

Key ideas:

- Blogs are **site-scoped**: every post belongs to a specific `site_id`.
- Blogs have both:
  - A **rendered body** (`content`, usually HTML) for simple consumers.
  - An optional **block representation** (`content_blocks`) for rich editors and advanced layouts.
- Blogs move through a **lifecycle**: `draft → published → (optionally) unpublished`, and can be **scheduled** for future publication.

---

### Data model at a glance

Conceptual fields (subset of the full schema):

- **Identity & ownership**
  - `id` – unique identifier.
  - `slug` – URL-safe, unique per site.
  - `site_id` – which site/workspace the blog belongs to.
  - `author` – internal user id of the creator.
- **Content**
  - `title` – main title.
  - `content_type` – `"html"` \| `"markdown"`.
  - `content` – rendered body (HTML or markdown).
  - `content_blocks?` – structured blocks for editors and rich layouts:
    - `id: string`
    - `type: "paragraph" | "heading" | "list" | "image" | "blockquote" | "code"`
    - `data: { text?, level?, items?, listType?, url?, caption?, language? }`
- **Summaries & media**
  - `excerpt?` – short plain-text summary.
    - If not provided, generated from the first text in the body.
  - `featured_image?` – primary image URL.
  - `images?` – additional image URLs.
- **Taxonomy & status**
  - `status` – `"draft" | "published" | "unpublished"`.
  - `category?` – category id.
- **Engagement & timing**
  - `likes`, `views`.
  - `published_at?` – when it became published.
- **Meta & history**
  - `meta?` – SEO metadata (`description`, `keywords`).
  - `version_history?` – previous versions used by the AI review “undo” flow.

Public APIs expose a safe subset of this, focusing on published content.

---

### Blog editor implementation (deep dive)

For implementation details of the block-based editor (how `content_blocks` are created, edited, and converted to HTML), see:

- `BLOG_EDITOR_IMPLEMENTATION.md`

This PRD page treats the editor as a producer of `content` and `content_blocks`; the deep-dive doc covers component structure, UX, and migration from legacy HTML.

---

### AI blog review (deep dive)

For the full pipeline, UX, and prompt design of the AI review feature, see:

- `BLOG_REVIEW_FEATURE_PLAN.md` – product behavior and UX plan.
- `BLOG_REVIEW_IMPLEMENTATION_SPEC.md` – APIs, prompt, and orchestration details.

This PRD page focuses on how review fits into the overall blogs feature set and how it is **not** exposed via the public API.

---

### Auth and API keys (related PRDs)

For broader context on authentication, workspaces, and API key management:

- `PRD_AUTHENTICATION.md` – user authentication flows and JWT-based access.
- `PRD_WORKSPACE_AND_USER_ACCESS.md` – workspaces, site access, and roles.
- `PRD_NOTIFICATION_SERVICE.md` – how system emails and notifications behave (useful when blogs trigger notifications).

These documents describe the platform-wide auth model that this blogs + public API PRD plugs into.

---

### Dashboard vs Public API

- **Dashboard APIs (JWT auth)**
  - Used by the internal app at `app/dashboard/...`.
  - Protected by `Authorization: Bearer <JWT>`.
  - Full CRUD on blogs, categories, scheduling, AI review, etc.
- **Public Blog APIs (API key auth)**
  - Used by external consumers (e.g. a marketing website, headless CMS usage).
  - Read-only access to **published** blogs and categories for a given site.
  - Protected by API keys via special headers:
    - `x-access-key-id`
    - `x-secret-key`

---

### API key authentication

**How it works:**

- API keys are created per user in the dashboard (via the API key module).
- Each key pair consists of:
  - `accessKeyId`
  - `secretKey` (only shown once on creation; stored as a hash).
- To call the public blog API:

```http
GET /api/public/v1/blogs?site_id=<SITE_ID> HTTP/1.1
Host: api.bloggr.com
x-access-key-id: <ACCESS_KEY_ID>
x-secret-key: <SECRET_KEY>
```

- The `apiKeyAuthMiddleware`:
  - Validates both headers are present.
  - Looks up the key, checks it is active.
  - Validates the `secretKey` against the stored hash.
  - On success attaches `req.user = { userId }` and `(req as any).accessKeyId = accessKeyId`.

If validation fails, the API returns `401`/`403` with a generic “Invalid API credentials” or “Missing API credentials” message (no secret details are leaked).

---

### Authorization rules

- An API key **belongs to a user**, not directly to a site.
- Current implementation:
  - Public blog endpoints require:
    - A **valid API key**.
    - An explicit `site_id` query parameter.
  - There is no additional per-site permission layer yet; the assumption is that a given key is issued to a trusted integration.
- Ownership & status:
  - Only **published** blogs are ever returned by the public blog APIs.
  - Draft and unpublished posts remain dashboard-only.

Future evolution may tie keys to specific sites or roles; this doc reflects the current behavior.

---

### Blog lifecycle

1. **Draft**
   - Created in the dashboard.
   - Editable content, categories, images, SEO meta.
   - AI review feature is restricted to draft posts.
2. **Published**
   - Marked via the dashboard publish action.
   - `status = "published"`, `published_at` set.
   - Visible via the public APIs (for the correct `site_id`).
3. **Unpublished**
   - Post was previously published but is now taken down.
   - `status = "unpublished"`.
   - Not visible via the public APIs.
4. **Scheduled**
   - A separate scheduled-post record links a blog to a future `scheduled_at` time.
   - A scheduler service promotes the blog to `published` at the scheduled time.

---

### Categories

Categories allow grouping blogs under logical topics.

- Each category has:
  - `id`
  - `name`
  - Optional hierarchy (parent/child) for trees.
  - `is_active` flag.
- Categories are **site-scoped** (each site has its own set).
- In blogs:
  - `category` field stores the category id.
  - Public APIs can filter blogs by category.
- Through the API key–protected public endpoints:
  - Consumers can fetch all categories for the authenticated user/site.
  - Consumers can fetch blogs for a specific category id.

---

### Scheduled posts

Scheduling lets authors plan when a draft will be published.

- Internal concepts:
  - A **ScheduledPost** ties:
    - `blog_id`
    - `site_id`
    - `scheduled_at`
    - `status` (pending, executed, etc.).
  - The **PostSchedulerService** runs in the backend and:
    - Finds pending scheduled posts whose time has passed.
    - Updates the blog’s `status` to `published` and sets `published_at`.
- Dashboard APIs:
  - `POST /api/v1/blogs/:id/schedule`
  - `GET /api/v1/blogs/:id/schedule`
  - `DELETE /api/v1/blogs/:id/schedule`
- Public APIs:
  - Do **not** expose scheduling directly.
  - They only see the result: if the blog is published at or after the scheduled time, it appears in the public list/detail endpoints.

---

### AI blog review

The AI review feature helps authors improve drafts before publishing.

**Key pieces:**

- `BlogReviewService`:
  - Uses a Hugging Face chat completion model.
  - Takes title + content (and optionally `excerpt`, `category`, `content_blocks`).
  - Enforces:
    - Token/length limits.
    - Basic validation (title and content required).
  - Returns a structured `BlogReviewResult`:
    - `overall_score` (0–100).
    - Per-dimension scores: `readability`, `seo`, `grammar`, `structure`, `fact_check`, `style`, `engagement`.
    - `suggestions[]` with:
      - `type`, `priority`, `target` (`title` | `excerpt` | `content`), `original`, `suggestion`, `explanation`.
      - Optional location data (`blockIndex`, `blockId`, offsets) when `content_blocks` are provided.
    - Optional `improved_content`, `improved_title`, `improved_excerpt`.
- `BlogReviewController`:
  - Guards review operations:
    - Only **authenticated users**.
    - Only **draft** posts.
    - Only **owners** of the blog.
  - Endpoints (dashboard/JWT):
    - `POST /api/v1/blogs/:blogId/review`
    - `POST /api/v1/blogs/review` (no `blogId`, e.g. for unsaved content).
    - `POST /api/v1/blogs/:blogId/review/apply`
    - `POST /api/v1/blogs/:blogId/review/apply-one`
    - `POST /api/v1/blogs/:blogId/restore/:version`
- Version history:
  - Before applying suggestions, the current version is pushed into `version_history`.
  - “Apply all” and “Apply one” both support “undo” via restoring a previous version.

The AI review APIs are **not** exposed via API keys; they are dashboard-only.

---

### Base URL & headers

Assuming a base like:

- **Base URL**: `https://api.bloggr.com`
- **Prefix**: `/api/public/v1`

Every public blog API call must include:

- `x-access-key-id: <ACCESS_KEY_ID>`
- `x-secret-key: <SECRET_KEY>`
- `site_id` query parameter to scope results:
  - `GET /api/public/v1/blogs?site_id=<SITE_ID>`

---

### Get published blogs

- **Method**: `GET`
- **Path**: `/api/public/v1/blogs`
- **Auth**: API key headers **required**.
- **Query parameters**:
  - `site_id` (required) – which site’s blogs to fetch.
  - `status` (optional) – ignored/forced to `published` internally.
  - `search` (optional) – full-text search across title, excerpt, content.
  - `category` (optional) – filter by category id.
  - `page` (optional, default `1`), `limit` (optional, default `10`, max `100`).

**Response (200)**:

```json
{
  "data": {
    "data": [
      {
        "_id": "blog_id",
        "site_id": "site_id",
        "slug": "my-first-blog",
        "title": "My first blog",
        "excerpt": "Short summary…",
        "featured_image": "https://cdn.bloggr.com/uploads/cover.jpg",
        "status": "published",
        "category": "category_id",
        "published_at": "2026-02-10T12:34:56.000Z",
        "views": 123,
        "meta": {
          "description": "SEO description",
          "keywords": ["blog", "example"]
        },
        "created_at": "2026-02-01T10:00:00.000Z",
        "updated_at": "2026-02-10T12:34:56.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 37,
      "totalPages": 4
    }
  }
}
```

> Note: For efficiency, `content` and `content_blocks` are typically **not** included in the list response; clients fetch the full blog via detail APIs.

---

### Get published blog by id

- **Method**: `GET`
- **Path**: `/api/public/v1/blogs/:id`
- **Auth**: API key.
- **Query parameters**:
  - `site_id` (required) – must match the blog’s `site_id`.

If the blog exists and `status === "published"`, returns full blog data:

- `id`, `slug`, `title`, `content_type`, `content`, `content_blocks?`, `excerpt`, `featured_image`, `images?`, `category?`, `views`, `published_at`, `meta?`, timestamps.

If the blog is not found or not published, returns **400/404** with a message like “Blog not found or not published”.

---

### Get published blog by slug

- **Method**: `GET`
- **Path**: `/api/public/v1/blogs/slug/:slug`
- **Auth**: API key.
- **Query parameters**:
  - `site_id` (required).

Behavior and response shape are the same as “Get published blog by id”, but the lookup is via slug + site.

---

### Get categories

- **Method**: `GET`
- **Path**: `/api/public/v1/blogs/categories`
- **Auth**: API key.
- **Query parameters**:
  - `tree` (optional) – if `"true"`, return categories in a tree structure.
  - `include_inactive` (optional) – if `"true"`, include inactive categories.

**Use cases:**

- Build a public-facing blog navigation menu.
- Show category filters on a blog listing page.

---

### Get blogs by category

- **Method**: `GET`
- **Path**: `/api/public/v1/blogs/categories/:categoryId`
- **Auth**: API key.
- **Query parameters**:
  - `site_id` (required).
  - `page`, `limit`, `search` (optional, same as list endpoint).

Returns a paginated list of **published** blogs that belong to the given category id.

---

### Errors & limits

- **Authentication errors**
  - Missing headers → `401` with “Missing API credentials (x-access-key-id, x-secret-key)”.
  - Invalid or inactive key → `403` with “Invalid API credentials” or “API key is inactive”.
- **Validation errors**
  - Missing `site_id` or invalid query params → `400` with a detailed validation message.
- **Not found / not published**
  - Blog exists but is not published → `400`/`404` with “Blog not found or not published”.

Current implementation does **not** enforce explicit rate limits on the public API, but integrations are expected to behave reasonably. Rate limiting and per-key quotas can be added later and documented here.

