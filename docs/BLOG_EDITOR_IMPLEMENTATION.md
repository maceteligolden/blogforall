# Blog Editor: Implementation Plan, Pages, User Flows & UX

This doc covers **which pages to work on**, **implementation order**, **user flows**, and **UX considerations** for the block-based blog editor (blogforall).

---

## 1. Pages & Surfaces to Work On

### 1.1 Pages (routes) to change or add

| Route | Purpose | Change |
|------|--------|--------|
| **`/dashboard/blogs/new`** | Create new blog | Replace Quill with block editor; new layout (Medium-like); sidebar stays but simplified; add block menu, image block with caption + background upload; validation (block save if image missing caption or upload pending/failed). |
| **`/dashboard/blogs/[id]`** | Edit existing blog | Same as create: block editor, load `content_blocks` or migrate HTML→blocks on first edit; same validation and image UX. |
| **`/dashboard/blogs/[id]/view`** | View (read-only) post | If we have a dedicated view: ensure it can render both `content_blocks` and legacy `content` (HTML). May only need to switch render path (blocks → component, HTML → sanitized div). |
| **`/dashboard/blogs`** | List blogs | No editor changes. Optionally show a small “content type” badge (blocks vs legacy) if useful for support; not required for v1. |

### 1.2 New components to build

| Component | Responsibility |
|-----------|----------------|
| **BlockEditor** | Main editor: block list, block menu (“+” / “/”), selection toolbar, keyboard (Enter, Backspace, arrows). Wraps TipTap or custom block layer. |
| **BlockMenu** | Shown on empty block or “+”: list of block types (Paragraph, Heading 1–3, List, Image, Blockquote, Code). Insert at current position. |
| **ParagraphBlock** | Editable paragraph with inline formatting (bold, italic, link). |
| **HeadingBlock** | Editable heading (level 1–3). |
| **ListBlock** | Bullet or ordered list. |
| **ImageBlock** | Image + caption. Renders blob or final URL; shows upload progress/error; caption required; “Replace image” / “Edit caption” in selection toolbar. |
| **BlockquoteBlock** | Editable quote. |
| **CodeBlock** | Editable code (optional language). |
| **BlockToolbar** | Floating toolbar when a block (or text) is selected: format options for text blocks; for Image block: Replace image, Edit caption. |
| **BlogEditorShell** | Layout for create/edit: title at top, then BlockEditor (full width or centered column), minimal chrome; sidebar (status, category, excerpt, featured image) can stay right or move below on small screens. |

### 1.3 Components to replace or retire

| Current | Replacement |
|---------|-------------|
| **RichTextEditor** (Quill) | **BlockEditor** + block components above. |
| **image-with-caption** (Quill blot) | **ImageBlock** (React component, not Quill). |

### 1.4 Backend / API surfaces

| Surface | Change |
|---------|--------|
| **Blog schema** | Add `content_blocks` (JSON). Keep `content` (HTML) for backward compatibility; can be generated from blocks on save. |
| **Create/Update blog** | Accept `content_blocks`; if present, validate (e.g. image blocks have caption, no blob URLs); generate and store `content` from blocks. |
| **GET blog (single)** | Return both `content_blocks` and `content` so editor can prefer blocks, public/headless can use either. |
| **Image upload** | Existing `POST /blogs/images/upload`; frontend uses it for background upload (no change to API contract). |
| **HTML→blocks migration** | Server-side or client-side: when loading a post that has only `content` (HTML), run converter and (on first save) write `content_blocks` and keep `content` in sync. |

---

## 2. Implementation Plan (order of work)

### Phase 1 – Foundation (backend + data model)

1. **Schema & API**
   - Add `content_blocks` to blog schema (JSON, optional).
   - Update create/update validation: if `content_blocks` is sent, validate structure; ensure no blob URLs; ensure every image block has non-empty caption.
   - On save when `content_blocks` is present: generate HTML from blocks (one-way) and set `content` so existing consumers keep working.
   - GET single blog: return both `content_blocks` and `content`.

2. **HTML→blocks migration**
   - Implement a converter (HTML string → block JSON). Use a simple strategy: one block per paragraph/heading/list/figure; images from `<figure class="ql-image-with-caption">` or `<img>`.
   - On edit: if blog has no `content_blocks` but has `content`, run converter once and treat result as initial state; on save persist `content_blocks` (and updated `content`).

### Phase 2 – Block editor core (no images yet)

3. **BlockEditor + block list**
   - Introduce BlockEditor: state = list of blocks (paragraph, heading, list, blockquote, code). Each block has `id`, `type`, `data`.
   - Implement ParagraphBlock, HeadingBlock, ListBlock, BlockquoteBlock, CodeBlock (no ImageBlock yet).
   - Block menu: empty block or “+” → show BlockMenu; insert chosen type at index.
   - Keyboard: Enter creates new block; Backspace at start of block merges or deletes block.
   - BlockToolbar: when text block selected, show format (bold, italic, link). No image options yet.

4. **Serialization**
   - Editor state ↔ `content_blocks` JSON (save/load). Define minimal block schema (e.g. `{ type, id, data }`).

### Phase 3 – Image block & upload UX

5. **ImageBlock**
   - Image block: `{ type: 'image', id, data: { url, caption } }`. `url` can be blob URL (pending) or final URL.
   - UI: show image (from url); below, editable caption (required). If url is blob, show “Uploading…” or spinner; on failure show “Upload failed – Retry” and retry button.
   - Insert: from BlockMenu choose “Image” → file picker (or drop/paste). On file select: create ImageBlock with blob URL, start background upload; on success replace url in block; on failure set error state.

6. **Validation & save**
   - Before save: ensure no block has `url` that is a blob URL; ensure every image block has non-empty caption. If not, block save and show inline errors (e.g. “Add a caption” under image, “Upload in progress” in toolbar).
   - Featured image: unchanged; caption optional.

### Phase 4 – Create/Edit pages & layout

7. **Create blog page**
   - Replace RichTextEditor with BlockEditor in `/dashboard/blogs/new`.
   - New layout: BlogEditorShell – title at top, BlockEditor below (Medium-like: no heavy borders, generous padding, optional centered column). Sidebar (status, category, excerpt, featured image) right or collapsible.
   - Wire form state to `content_blocks` (and derived `content` if needed for legacy). Submit sends `content_blocks`; backend generates `content`.

8. **Edit blog page**
   - Same BlockEditor and layout in `/dashboard/blogs/[id]`.
   - Load: if `content_blocks` exists use it; else run HTML→blocks and use result (and set a “migrated” flag so we save blocks on submit).
   - Keep existing “Review with AI” and other actions; they can work on generated `content` or on blocks (your choice for v1).

9. **View page**
   - `/dashboard/blogs/[id]/view`: if `content_blocks` present, render with a block renderer (read-only); else render `content` (sanitized HTML).

### Phase 5 – Polish & headless

10. **Public/headless API**
    - Document that GET blog returns `content_blocks` (preferred for headless) and `content_html`. Add short “Rendering on your site” guide: sanitize HTML or render from blocks.

11. **Observability & limits**
    - Image upload: enforce 5 MB, JPEG/PNG/WebP; log upload success/failure. Optional: log migration success/failure for HTML→blocks.

---

## 3. User Flows

### 3.1 Create a new blog

1. User goes to **Dashboard → Blogs → Create new blog**.
2. User enters **title** at top.
3. User sees first empty block (paragraph). Cursor in block.
4. User types; formatting via BlockToolbar (bold, italic, etc.).
5. User presses **Enter** → new paragraph block.
6. User clicks **“+”** on empty block (or types “/”) → **Block menu** opens.
7. User chooses **Image** → file picker opens → selects file.
8. **Image block** appears immediately (blob preview); caption field below; upload runs in background.
9. User types **caption** (required). When upload finishes, blob is replaced by final URL.
10. User continues adding blocks (paragraph, heading, list, blockquote, code) via “+” or by typing.
11. User fills **sidebar**: status (draft), category, excerpt, featured image (optional caption).
12. User clicks **Save** (draft):
    - If any image has no caption or upload still pending/failed → save is **blocked**; errors shown (e.g. “Add a caption”, “Upload failed – Retry”).
    - Otherwise → save succeeds; user stays on edit or is redirected to list (your choice).
13. User can click **Publish** later from list or edit; same validation (no draft-only bypass).

### 3.2 Edit an existing blog

1. User goes to **Dashboard → Blogs** → clicks a blog (or “Edit”).
2. User lands on **Edit** page (`/dashboard/blogs/[id]`).
3. If post has **blocks**: BlockEditor loads `content_blocks`.
4. If post is **legacy (HTML only)**: backend or frontend runs **HTML→blocks** once; editor shows blocks; on first save we persist `content_blocks` and updated `content`.
5. User edits as in create: add/remove/edit blocks, add images (with caption), use block menu and toolbar.
6. Save/Publish: same validation (all images have caption, no pending/failed uploads).

### 3.3 Add an image (detailed)

1. User places cursor in a block or focuses an empty block.
2. **Option A**: User clicks “+” (or “/”) → Block menu → **Image** → file picker.
3. **Option B**: User pastes image from clipboard → treat as “insert image block” with pasted file (then same flow).
4. **Option C**: User drags file onto editor → insert image block at drop position.
5. Image block appears with **blob URL** (instant). Caption field is empty; placeholder “Add a caption (required)”.
6. Background upload starts. UI shows subtle “Uploading…” (e.g. on the block or in toolbar).
7. On **success**: blob replaced by final URL; “Uploading…” disappears.
8. On **failure**: show “Upload failed – Retry” and retry button; blob remains so user doesn’t lose the image.
9. User **must** fill caption before save; if they try to save without it, block save and focus/inline error on that image block.

### 3.4 Save and publish

- **Save draft**: Same validation as publish (all image blocks have caption; no blob or failed URLs). No “half-saved” state with blob URLs.
- **Publish**: Same checks. Status changes to published when valid.
- **Validation errors**: Shown inline (e.g. under image “Caption required”) and optionally in a toast or banner (“Fix 2 issues to save”).

---

## 4. UX Considerations

### 4.1 Inline WYSIWYG (no split preview)

- The **editor is the preview**: blocks render in a read-like style (heading sizes, paragraph spacing, image + caption below image). No separate “Preview” panel in v1 to avoid layout noise and keep the Medium-like feel.

### 4.2 Minimal, non-rigid layout

- **No heavy borders** around the editor; use spacing and subtle dividers if needed.
- **Generous padding** and max-width for the content column so it feels like a canvas, not a form.
- **Floating block toolbar** only when a block is selected; hide when not needed.
- **Block menu** appears on demand (“+” or “/”); compact list of block types with optional icons.

### 4.3 Image experience

- **Instant feedback**: image shows immediately (blob) so the user never waits to “see” the image before continuing.
- **Caption always visible** below the image in the block; placeholder “Add a caption (required)” so the requirement is obvious.
- **Upload state**: “Uploading…” and “Upload failed – Retry” are clear but not alarming; retry is one click.
- **No blocking**: typing and adding other blocks are never blocked by upload; only save is blocked until all uploads succeed and captions are filled.

### 4.4 Block menu and discoverability

- **“+”** on empty block or between blocks: primary way to add blocks. **“/”** (slash command) can open the same menu for keyboard users.
- **Block type list**: Paragraph, Heading 1–3, Bullet list, Numbered list, Image, Blockquote, Code. Keep the list short so Image is easy to find.

### 4.5 Selection toolbar

- When a **text block** is selected: show formatting (bold, italic, link). Keep it minimal.
- When an **image block** is selected: show “Replace image” and “Edit caption” (focus caption field). No need for right-click context menu in v1.

### 4.6 Validation and errors

- **Inline first**: e.g. under an image without caption, show “Caption required” in red; on the block with failed upload show “Upload failed – Retry”.
- **Save button**: if validation fails, block submit and optionally scroll to first error. Toast or banner can summarize (“Add captions to 2 images”).
- **Draft autosave** (if you add it later): only save when validation passes; otherwise keep state in memory/local and show that “Draft has errors”.

### 4.7 Keyboard and focus

- **Enter**: new block (same type as current, or paragraph by default).
- **Backspace** at start of empty block: remove block and focus previous block.
- **Tab / Shift+Tab**: optional for list indent or for moving focus between blocks (can be v2).
- **Slash “/”**: open block menu (optional but recommended).

### 4.8 Loading and migration

- When **loading edit** for a legacy post: show a short “Preparing editor…” while HTML→blocks runs; then show blocks. Avoid flashing raw HTML.
- **First save after migration**: user doesn’t need to know “migration” happened; just save as usual.

### 4.9 Accessibility

- Block menu and toolbar **keyboard accessible** (focus, Enter to select, Escape to close).
- Image block: **alt** from caption or “Image” until caption exists; caption input has a visible label.
- **Required caption** announced to screen readers (e.g. aria-required and aria-invalid when empty on save).

---

## 5. Summary

| What | Where |
|------|--------|
| **Pages to work on** | `blogs/new`, `blogs/[id]` (edit), optionally `blogs/[id]/view`; list page unchanged. |
| **New components** | BlockEditor, BlockMenu, Paragraph/Heading/List/Image/Blockquote/Code blocks, BlockToolbar, BlogEditorShell. |
| **Implementation order** | (1) Backend schema + API + HTML→blocks, (2) Block editor core (no images), (3) Image block + upload + validation, (4) Create/Edit/View pages + layout, (5) Headless doc + observability. |
| **User flows** | Create: title → blocks (text + image with caption) → sidebar → save (blocked if captions missing or uploads pending/failed). Edit: load blocks or migrate HTML → same flow. Image: “+” → Image → file → blob then final URL, caption required. |
| **UX** | Inline WYSIWYG, minimal layout, instant image display, background upload, inline validation, block menu + selection toolbar, keyboard-friendly. |

This gives a full plan for implementation; development can follow the phases and components above.
