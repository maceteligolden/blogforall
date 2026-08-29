export const PUBLIC_API_BASE = "https://api.bloggr.com/api/v1";

export const API_GUIDE_ENDPOINTS = [
  { method: "GET", path: "/public/blogs", description: "List published posts (paginated)" },
  { method: "GET", path: "/public/blogs/slug/:slug", description: "One published post by slug" },
  { method: "GET", path: "/public/blogs/:id", description: "One published post by ID" },
  { method: "GET", path: "/public/blogs/categories", description: "List categories" },
] as const;

export const HTML_TAGS_SNIPPET = `<!-- Render posts your server already fetched. Do not put API secrets in HTML. -->
<section class="blog-index">
  <article class="blog-card">
    <img src="/uploads/feature.jpg" alt="How we plan content" />
    <h2>
      <a href="/blog/how-we-plan-content">How we plan content</a>
    </h2>
    <time datetime="2026-03-12">March 12, 2026</time>
    <p>A short excerpt from the post so visitors can decide to read more.</p>
    <a href="/blog/how-we-plan-content">Read more</a>
  </article>
</section>

<article class="blog-post">
  <header>
    <h1>How we plan content</h1>
    <time datetime="2026-03-12">March 12, 2026</time>
  </header>
  <img src="/uploads/feature.jpg" alt="" />
  <div class="blog-body">
    <!-- Insert post.content when content_type is html. Sanitize first. -->
  </div>
</article>`;

export const HTML_PROXY_SNIPPET = `<!-- Load JSON from YOUR origin, then render the tags above. -->
<script>
  async function loadPosts() {
    const response = await fetch("/api/posts?page=1&limit=10");
    const payload = await response.json();
    // payload.data is the list your Node/Python proxy returned
    console.log(payload.data);
  }

  loadPosts();
</script>`;

export const REACT_COMPONENTS_SNIPPET = `function BlogCard({ post }) {
  return (
    <article className="blog-card">
      {post.featured_image ? (
        <img src={post.featured_image} alt="" />
      ) : null}
      <h2>
        <a href={\`/blog/\${post.slug}\`}>{post.title}</a>
      </h2>
      {post.published_at ? (
        <time dateTime={post.published_at}>
          {new Date(post.published_at).toLocaleDateString()}
        </time>
      ) : null}
      {post.excerpt ? <p>{post.excerpt}</p> : null}
    </article>
  );
}

function BlogPost({ post }) {
  return (
    <article className="blog-post">
      <h1>{post.title}</h1>
      {post.content_type === "html" ? (
        <div dangerouslySetInnerHTML={{ __html: post.content }} />
      ) : (
        <pre>{post.content}</pre>
      )}
    </article>
  );
}

function BlogList({ posts }) {
  return (
    <section className="blog-index">
      {posts.map((post) => (
        <BlogCard key={post.id} post={post} />
      ))}
    </section>
  );
}`;

export const REACT_HOOK_SNIPPET = `import { useEffect, useState } from "react";

export function usePosts({ page = 1, limit = 10 } = {}) {
  const [posts, setPosts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        const response = await fetch(\`/api/posts?\${params}\`);
        if (!response.ok) throw new Error("Failed to load posts");
        const payload = await response.json();
        if (!cancelled) {
          setPosts(payload.data);
          setPagination(payload.pagination);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, limit]);

  return { posts, pagination, loading, error };
}`;

export const NODE_FETCH_SNIPPET = `const API_BASE = process.env.BLOGGR_API_URL; // e.g. ${PUBLIC_API_BASE}

async function bloggrGet(path) {
  const response = await fetch(\`\${API_BASE}\${path}\`, {
    headers: {
      "x-access-key-id": process.env.BLOGGR_ACCESS_KEY_ID,
      "x-secret-key": process.env.BLOGGR_SECRET_KEY,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(\`Bloggr request failed (\${response.status}): \${body}\`);
  }

  return response.json();
}

export async function listPublishedPosts({ page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  const payload = await bloggrGet(\`/public/blogs?\${params}\`);
  return payload.data; // { data: Post[], pagination }
}

export async function getPostBySlug(slug) {
  const payload = await bloggrGet(\`/public/blogs/slug/\${encodeURIComponent(slug)}\`);
  return payload.data;
}`;

export const NODE_PROXY_SNIPPET = `// Express example: keep secrets on the server, expose a same-origin route.
import express from "express";
import { listPublishedPosts, getPostBySlug } from "./bloggr.js";

const app = express();

app.get("/api/posts", async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await listPublishedPosts({ page, limit });
  res.json({ data: result.data, pagination: result.pagination });
});

app.get("/api/posts/:slug", async (req, res) => {
  const post = await getPostBySlug(req.params.slug);
  res.json({ data: post });
});`;

export const PYTHON_FETCH_SNIPPET = `import os
from urllib.parse import urlencode

import requests

API_BASE = os.environ["BLOGGR_API_URL"]  # e.g. ${PUBLIC_API_BASE}


def bloggr_get(path: str, params: dict | None = None):
    response = requests.get(
        f"{API_BASE}{path}",
        params=params,
        headers={
            "x-access-key-id": os.environ["BLOGGR_ACCESS_KEY_ID"],
            "x-secret-key": os.environ["BLOGGR_SECRET_KEY"],
        },
        timeout=15,
    )
    response.raise_for_status()
    return response.json()


def list_published_posts(page: int = 1, limit: int = 10):
    payload = bloggr_get("/public/blogs", {"page": page, "limit": limit})
    return payload["data"]  # { "data": [...], "pagination": {...} }


def get_post_by_slug(slug: str):
    payload = bloggr_get(f"/public/blogs/slug/{slug}")
    return payload["data"]`;

export const PYTHON_PROXY_SNIPPET = `# FastAPI example: keep secrets on the server, expose a same-origin route.
from fastapi import FastAPI

from bloggr import get_post_by_slug, list_published_posts

app = FastAPI()


@app.get("/api/posts")
def api_posts(page: int = 1, limit: int = 10):
    result = list_published_posts(page=page, limit=limit)
    return {"data": result["data"], "pagination": result["pagination"]}


@app.get("/api/posts/{slug}")
def api_post(slug: str):
    return {"data": get_post_by_slug(slug)}`;

export const ENV_SNIPPET = `BLOGGR_API_URL=${PUBLIC_API_BASE}
BLOGGR_ACCESS_KEY_ID=bfa_your_access_key_id
BLOGGR_SECRET_KEY=your_secret_key`;
