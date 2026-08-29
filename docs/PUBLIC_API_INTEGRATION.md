# Public API integration

How to consume published Bloggr posts from your own site or app.

Keys live in the dashboard at **Integrations → Bloggr API** (`/dashboard/integrations/api`). In-app snippets are generated from `frontend/lib/integrations/api-guide-snippets.ts`.

## Mental model

- **Framer / CMS integrations** publish *out* of Bloggr.
- **Bloggr API** lets your site read published posts *from* Bloggr.
- API keys are workspace-scoped. The workspace is inferred from the key. Do not pass `site_id` on public blog routes.

## Where to create keys

1. Open **Integrations**.
2. If the workspace has no keys, click **Configure** on the Bloggr API card and name the key.
3. If at least one key exists, click **Manage keys**.
4. Copy **Access Key ID** and **Secret Key**. Store them in server environment variables.

Legacy URLs redirect here:

- `/dashboard/profile?tab=developer`
- `/dashboard/api-keys`
- `/dashboard/developer`

## Authentication

All `/api/v1/public/blogs` routes require:

```http
x-access-key-id: bfa_…
x-secret-key: <64-char hex>
```

Create keys with a dashboard session (JWT), not with an API key:

```http
POST /api/v1/sites/{siteId}/api-keys
Authorization: Bearer {jwt}
{ "name": "Production" }
```

## Server vs browser

Call Bloggr from **Node, Python, or another backend**. Do not put the secret in HTML, React, or any other client bundle.

Reasons:

- The secret would be visible in the page source.
- CORS only allows the Bloggr frontend origin. Browser calls from your site will fail.

Pattern:

1. Server fetches Bloggr with the key headers.
2. Server exposes a same-origin route such as `GET /api/posts`.
3. HTML or React loads that route and renders tags/components.

## Endpoints

Base: `{API_HOST}/api/v1` (example: `https://api.bloggr.com/api/v1`).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/public/blogs` | List published posts (`page`, `limit` max 100, `search`, `category`) |
| `GET` | `/public/blogs/slug/:slug` | One published post by slug |
| `GET` | `/public/blogs/:id` | One published post by ID |
| `GET` | `/public/blogs/categories` | List categories |
| `GET` | `/public/blogs/categories/:categoryId` | Published posts in a category |

Success envelope:

```json
{
  "message": "Published blogs retrieved successfully",
  "data": {
    "data": [],
    "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 }
  }
}
```

Detail routes return the post on `data` (not wrapped in another `data` array).

Useful post fields: `id`, `title`, `slug`, `excerpt`, `featured_image`, `content`, `content_type` (`html` \| `markdown`), `published_at`.

## Four-step flow

1. **Create a key** in Integrations → Bloggr API.
2. **Store credentials** as `BLOGGR_API_URL`, `BLOGGR_ACCESS_KEY_ID`, `BLOGGR_SECRET_KEY`.
3. **Fetch** published posts from the server using the headers above.
4. **Render** with HTML tags or React components that consume your proxy JSON.

Copy-paste samples for HTML, React, Node.js, and Python are on the Guides tab and in `frontend/lib/integrations/api-guide-snippets.ts`.

## Topics not fully covered in the snippets

These in-app “learn more” links go to placeholder pages until longer docs exist:

- `/docs/learn/cors`
- `/docs/learn/pagination`
- `/docs/learn/categories`
- `/docs/learn/content-types`
- `/docs/learn/rate-limits`
- `/docs/learn/errors`
- `/docs/learn/comments`
- `/docs/learn/webhooks`

Comments are public today and are not API-key gated. Webhooks are not built yet.
