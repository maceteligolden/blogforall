# Bloggr – Feature Gaps (Standard vs Current)

This document lists standard features for blog/CMS SaaS that Bloggr currently lacks or only partially implements. It includes workspace management, subscriptions, onboarding, invitations/roles, and in-app notifications as requested.

---

## 1. Workspace (Site) Management

| Feature | Status | Notes |
|--------|--------|--------|
| **Create workspace** | ✅ Present | Backend + frontend (site switcher, create-site dialog, onboarding create-site page). |
| **Edit workspace** | ⚠️ Backend only | `PATCH /api/v1/sites/:id` exists; **no frontend UI** to edit site name/description/settings. |
| **Delete workspace** | ⚠️ Backend only | `DELETE /api/v1/sites/:id` exists; **no frontend UI** to delete a site (e.g. from site switcher or a site settings page). |
| **Workspace list / settings page** | ❌ Missing | No dedicated dashboard page to list all workspaces and manage them (edit, delete, see members). Members exist at `/dashboard/sites/members` but only for current site; no “Sites” or “Workspace settings” page. |

**Summary:** Users can only **create** workspaces in the UI. They **cannot edit or delete** workspaces from the app. Backend supports both; frontend needs a workspace list/settings experience (e.g. from site switcher or a “Sites” section) with edit + delete.

---

## 2. Subscription Use Cases

| Feature | Status | Notes |
|--------|--------|--------|
| **Plans & billing** | ✅ Present | Plans, Stripe, onboarding plan selection, free tier, billing routes. |
| **Enforce plan limits** | ⚠️ Partial | **Sites:** `maxSitesAllowed` is checked when creating a site. **Blog posts:** `plan.limits.blogPosts` exists in schema/seed but **not enforced** on blog create. **API calls:** `plan.limits.apiCallsPerMonth` not enforced on public API. |
| **Usage visibility** | ❌ Missing | No dashboard showing current usage (e.g. posts used vs limit, API calls this month, storage). |
| **Upgrade / limit prompts** | ❌ Missing | No in-app prompts when approaching or hitting limits (e.g. “Upgrade to add more posts”). |
| **Plan change / downgrade** | ⚠️ Unclear | Subscription service has upgrade/downgrade logic; UX for changing plan (e.g. from billing page) not verified. |
| **Grace period / dunning** | ✅ Present | Past-due and grace period handling in subscription service. |

**Summary:** Subscription use cases are only partly covered: plan limits (blog posts, API calls) are not enforced, and users don’t see usage or upgrade prompts.

---

## 3. Onboarding Flow

| Feature | Status | Notes |
|--------|--------|--------|
| **Plan selection** | ✅ Present | Onboarding page with plan cards, optional card entry for paid plans, complete/skip. |
| **Create first workspace** | ⚠️ Mandatory, not optional | After complete/skip, if user has 0 sites they are **redirected** to `/onboarding/create-site`. There is no “Skip for now” to go straight to dashboard; creating a first workspace is effectively required. |
| **Optional “create first workspace” step** | ❌ Missing | No explicit optional step in onboarding (e.g. “Create your first site (optional – you can do this later)” with a **Skip** that goes to dashboard). |

**Summary:** Onboarding should be updated so that **creating the first workspace is optional**: user can skip and land on dashboard, and create a site later from the app.

---

## 4. Invitations & Workspace Roles

| Feature | Status | Notes |
|--------|--------|--------|
| **Invite by email** | ✅ Present | Backend + frontend (invite-member dialog); email with link sent. |
| **Invitee has account** | ✅ Supported | Accept flow: user must be logged in and email must match invitation. |
| **Invitee has no account** | ❌ Missing | No “invite-to-signup” flow: invite link assumes existing user. Invitees without an account cannot sign up via the invitation link and then join; they must register first elsewhere then use the same email to accept. |
| **Roles (owner, admin, editor, viewer)** | ✅ Present | Backend: `SiteMemberRole` (owner, admin, editor, viewer). Frontend: members page shows roles, invite dialog allows admin/editor/viewer. |
| **Moderator role** | ❌ Missing | No `moderator` role (e.g. for comment moderation). Only owner, admin, editor, viewer exist. |
| **Role-based permissions** | ⚠️ Partial | Backend has `site-access` middleware (e.g. owner/admin for some actions). Fine-grained permission checks (e.g. editor can create posts, moderator can approve comments) not fully verified across all routes. |

**Summary:** Invitations work for existing users. Gaps: **invite users who don’t have an account** (sign-up-from-invitation flow) and a **moderator** role for workspace-level moderation (e.g. comments).

---

## 5. In-App Notifications

| Feature | Status | Notes |
|--------|--------|--------|
| **Notification UI** | ⚠️ Shell only | `NotificationProvider` + notification bell exist; types: `like`, `comment`. Notifications are **in-memory only** (client state); nothing persists and nothing is pushed from the server. |
| **Backend notification model** | ❌ Missing | No notification entity, no API to list/fetch notifications, no “mark as read” or “delete” persisted. |
| **Server-driven events** | ❌ Missing | No logic to create notifications when events happen (e.g. new comment on my post, new like, invitation accepted, post published, mention). |
| **Real-time / polling** | ❌ Missing | No polling or WebSocket to refresh notifications; bell is empty unless something locally calls `addNotification`. |

**Summary:** In-app notifications are **not implemented end-to-end**. The UI exists but notifications are never created from server events and don’t persist; this significantly hurts experience (no feedback for comments, likes, invites, etc.). Delivering server-driven, persistent in-app notifications should be a priority.

---

## 6. Authentication & Account

| Feature | Status | Notes |
|--------|--------|--------|
| **Forgot password / reset password** | ❌ Missing | No flow and no email-based reset. |
| **Email verification** | ❌ Missing | Signup does not verify email; no verification link. |
| **Two-factor auth (2FA/MFA)** | ❌ Missing | No TOTP, backup codes, or SMS. |
| **OAuth / social login** | ❌ Missing | No Google, GitHub, etc. |
| **Account deletion / GDPR** | Unclear | No visible self-service delete or data export in the flows checked. |

---

## 7. Content & Discovery

| Feature | Status | Notes |
|--------|--------|--------|
| **Tags** | ❌ Missing | Only categories; no tags or tag-based filtering. |
| **Full-text search** | ⚠️ Partial | Search is regex on title/excerpt/content (no proper full-text index or ranking). |
| **RSS feed** | ❌ Missing | No `/feed` or RSS endpoint. |
| **Sitemap** | ❌ Missing | No XML sitemap for SEO (e.g. `/sitemap.xml`). |
| **Canonical URL** | ❌ Missing | No `canonical` field or meta tag. |
| **Open Graph / Twitter cards** | Unclear | `meta` has description/keywords only; no explicit `og:*` / `twitter:*` in schema. |

---

## 8. SEO & Distribution

| Feature | Status | Notes |
|--------|--------|--------|
| **Structured data (JSON-LD)** | ❌ Missing | No Article/BlogPosting schema. |
| **Robots.txt** | Unclear | Not visible in backend; would live in frontend/hosting. |
| **Per-post SEO overrides** | ⚠️ Partial | Only generic `meta.description` and `meta.keywords`; no slug override, focus keyword, or dedicated social image. |

---

## 9. Comments & Community

| Feature | Status | Notes |
|--------|--------|--------|
| **Comment moderation** | ⚠️ Partial | `is_approved` exists but defaults to `true` (auto-approve); no approve/reject queue or UI. |
| **Spam/abuse handling** | ❌ Missing | No spam check, reporting, or blocking. |
| **Notify author on new comment** | ❌ Missing | Email service not used for comment notifications. |
| **Comment threading** | ✅ Present | Replies via `parent_comment`. |

---

## 10. Notifications & Engagement (Email / Product)

| Feature | Status | Notes |
|--------|--------|--------|
| **Email newsletter / subscriptions** | ❌ Missing | No “subscribe to blog” or email digests. |
| **In-app notifications** | ❌ Missing (see §5) | No server-driven, persistent in-app notifications; only client shell. |
| **Notify on publish** | ❌ Missing | No webhook or email when a post goes live. |

---

## 11. Analytics & Insights

| Feature | Status | Notes |
|--------|--------|--------|
| **Built-in analytics** | ❌ Missing | No dashboard for views, likes, top posts, referrers. |
| **View counting** | ✅ Present | `views` incremented; no breakdown (e.g. by day, by post). |
| **Export content** | ❌ Missing | No export (e.g. JSON/Markdown/WordPress XML) for backup or migration. |

---

## 12. Media & Assets

| Feature | Status | Notes |
|--------|--------|--------|
| **Media library** | ❌ Missing | Uploads are per-post; no central library or reuse. |
| **Image optimization** | ❌ Missing | No resizing, WebP, or CDN. |
| **Alt text / accessibility** | ⚠️ Partial | Image blocks have caption; no dedicated alt field in schema. |

---

## 13. Multi-Author & Workflow

| Feature | Status | Notes |
|--------|--------|--------|
| **Roles & permissions** | ⚠️ Partial | Sites/members/invitations and roles exist; fine-grained roles (e.g. moderator) and permission checks across all actions need consolidation. |
| **Content workflow** | ⚠️ Partial | Draft → Publish and scheduling exist; no “pending review” or approval workflow. |
| **Audit log** | ❌ Missing | No log of who changed what and when. |

---

## 14. API & Developer Experience

| Feature | Status | Notes |
|--------|--------|--------|
| **GraphQL** | ❌ Missing | REST only. |
| **Webhooks** | ❌ Missing | No outbound webhooks (e.g. on publish/update). |
| **API versioning** | ⚠️ Partial | `/api/v1` exists; no versioning policy or deprecation. |
| **Rate limiting** | Unclear | Not visible in routes/middleware checked. |
| **OpenAPI/Swagger docs** | ❌ Missing | No machine-readable API spec. |

---

## Priority Overview (Including New Areas)

**High impact (experience / safety):**

1. **In-app notifications (end-to-end)** – Server-driven, persistent notifications for comments, likes, invites, etc.
2. **Workspace management UI** – Edit and delete site from frontend; optional “Sites”/settings page.
3. **Onboarding: optional first workspace** – Allow “Skip” so user can go to dashboard and create a site later.
4. **Invite users without accounts** – Sign-up-from-invitation flow (invite link → register → join workspace).
5. **Workspace roles** – Add **moderator** role and align permissions (e.g. comment moderation).

**Subscription use cases:**

6. **Enforce plan limits** – Blog post limit and API call limit when creating posts and calling public API.
7. **Usage in dashboard** – Show usage vs limits (posts, API calls, storage) and upgrade/limit prompts.

**Quick wins (from original list):**

8. Forgot password / reset password.  
9. RSS feed.  
10. Sitemap.  
11. Comment moderation UI (approve/reject queue, use `is_approved`).  
12. Content export (e.g. JSON/Markdown).

---

*Last updated from codebase review: workspace (site) management, subscriptions, onboarding, invitations/roles, and in-app notifications.*
