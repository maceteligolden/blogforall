# Frontend deployment (Next.js)

## Netlify

This app is set up for Netlify with `@netlify/plugin-nextjs`.

- **Base directory:** If the app lives in `frontend/`, set Netlify **Base directory** to `frontend` and **Build command** to `yarn build` (or `npm run build`). **Publish directory** is usually managed by the plugin (e.g. `frontend/.next` or as per plugin).
- **Redirects:** `frontend/public/_redirects` must **not** send `/_next/*` to `index.html`. A rule `/_next/*  200` is placed **before** any `/*  /index.html  200` so static chunks are served as files, not as the SPA shell.
- **MIME types:** If JS chunks are served as `text/plain`, the browser will refuse to run them. We set correct types via:
  - **netlify.toml** `[[headers]]` for `/_next/static/chunks/*` → `Content-Type: application/javascript` and `/_next/static/css/*` → `text/css`.
  - **frontend/public/_headers** as a fallback so `_next/static` gets the right types and cache headers.
- **Clear cache after deploy:** If users still see chunk errors after a deploy, they may have cached old HTML. The in-app **ChunkErrorHandler** triggers one reload to fetch fresh chunks; you can also ask users to hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or clear site data for the domain.

## Chunk load errors (MIME type / 404)

If users see errors like:

- **"Refused to execute script ... because its MIME type ('text/plain') is not executable"**
- **"ChunkLoadError: Loading chunk ... failed"**
- **404** on `_next/static/chunks/*.js`

then the **server or reverse proxy** in front of the Next app is misconfigured.

### Cause

1. **Wrong MIME type**  
   `.js` files under `_next/static/` must be served with  
   `Content-Type: application/javascript` (or `text/javascript`).  
   If they are served as `text/plain` or `text/html`, the browser will not execute them.

2. **404 on chunks**  
   Either:
   - Static files are not served from the correct path (e.g. `_next/static` not available), or
   - The user has an old cached HTML that references chunk filenames from a previous build; after a new deploy those chunks no longer exist.

### Fix on the server / reverse proxy

- **Nginx**  
  - Serve `_next/static` from the same origin (or correct path).  
  - For `_next/static`, set:
    - `add_header Content-Type application/javascript;` for `*.js` (or use a `map`/`location` that matches `.js` under `_next/static`).  
  - Do **not** send chunk URLs to the SPA fallback (e.g. `try_files` to `index.html` for `_next/static`); those requests must return the actual static file or 404.

- **Node (standalone)**  
  - Next.js `output: "standalone"` serves its own static files.  
  - If you put another server (Nginx, Caddy, etc.) in front, that proxy must:
    - Proxy `/_next/static/*` to the Node app (or serve the same files with correct headers), and  
    - Not override `Content-Type` for `.js` to `text/plain`.

- **Vercel / similar**  
  - Usually correct by default. If you use a custom proxy in front, apply the same rules (correct path and MIME type for `_next/static`).

### Client-side mitigation (this app)

A **ChunkErrorHandler** is included: on **ChunkLoadError** or failed chunk fetch it triggers **one full page reload** so the user gets a fresh HTML and new chunk URLs. This helps when the problem is stale cache after a deploy; it does not fix wrong MIME type or missing static files on the server.

### Checklist

- [ ] Requests to `https://your-domain/_next/static/chunks/*.js` return **200** and body is JavaScript.
- [ ] Response header `Content-Type` for those `.js` requests is **`application/javascript`** (or `text/javascript`).
- [ ] No proxy/CDN is rewriting chunk URLs or returning an HTML/plain error page for `_next/static` paths.
