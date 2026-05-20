# PostHog Event Taxonomy

Event naming: **`[object] [action]`** (lowercase, space-separated). All captures go through `captureEvent()` in `lib/analytics/posthog.ts`.

## Base properties (every event)

| Property | Source |
|----------|--------|
| `user_id` | PostHog distinct_id after identify |
| `workspace_id` | `useAuthStore.currentSiteId` |
| `session_id` | `getOrCreateSessionId()` |
| `plan_type` | User/subscription plan |
| `environment` | `NEXT_PUBLIC_APP_ENV` or `NODE_ENV` |

## Funnels (configure in PostHog UI)

### Funnel 1: Signup → activation

`signup started` → `signup completed` → `login success` → `workspace onboarding completed` → `generation success`

### Funnel 2: Account setup (free plan)

`onboarding started` → `user onboarding completed` → `workspace creation started`

### Funnel 3: Workspace setup

`workspace creation started` → `workspace created` → `onboarding step completed` (≥1) → `workspace onboarding completed`

### Funnel 4: Generation (core)

`generation flow viewed` → `generation started` → `generation confirmed` → `generation success` → `blog published`

## Daily metrics checklist

| Metric | Definition |
|--------|------------|
| Signup → login rate | `login success` / `signup completed` within 24h |
| Onboarding completion | `workspace onboarding completed` / `workspace created` |
| Activation rate | Users with ≥1 `generation success` / new signups (7d) |
| Time to first generation | Median: `signup completed` → first `generation success` |
| Generation success rate | `generation success` / `generation started` |
| Generation failures | Breakdown of `generation failed` by `error_code` |
| Token limit friction | `error_code: TOKEN_LIMIT_EXCEEDED` count |
| Orchestrator adoption | % with `orchestrator message sent` |

## Session replay

- Sample rate: `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE` (default 0.1 prod, 1.0 dev)
- Priority routes: `/onboarding/*`, `/dashboard/blogs/new`, `/auth/signup`
- All inputs masked; add `data-ph-mask` to mask additional text

## Privacy

Never send: passwords, JWTs, raw prompts, full blog content. Use `prompt_length` only.
