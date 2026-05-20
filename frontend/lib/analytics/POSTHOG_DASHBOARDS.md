# PostHog Dashboard Setup

Configure these in the PostHog project UI after deploying with valid keys.

## Environment

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_POSTHOG_KEY` | Frontend | Client SDK |
| `NEXT_PUBLIC_POSTHOG_HOST` | Frontend | API host (e.g. `https://us.i.posthog.com`) |
| `NEXT_PUBLIC_POSTHOG_ENABLED` | Frontend | Set `false` to disable |
| `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE` | Frontend | `0.1` prod, `1.0` dev |
| `POSTHOG_API_KEY` | Backend | Server events |
| `POSTHOG_HOST` | Backend | Server API host |
| `POSTHOG_ENABLED` | Backend | Set `false` to disable |

## Session replay

Configured in `lib/analytics/posthog.ts`:

- `maskAllInputs: true`
- Sample rate from `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY_SAMPLE_RATE`
- Priority routes: `/onboarding/*`, `/dashboard/blogs/new`, `/auth/signup`

Add `data-ph-mask` on elements that should mask text (editor content, etc.).

## Funnels to create

See `EVENT_TAXONOMY.md` for step lists. Recommended insight names:

1. **Signup → activation** — signup through first `generation success`
2. **User billing onboarding** — plan gate through `user onboarding completed`
3. **Workspace setup** — creation through `workspace onboarding completed`
4. **Generation core** — viewed through `blog published`
5. **Free → paid** — billing viewed through paid `plan changed`

## Retention

- **Weekly retention** on event `generation success`
- **Cohort**: users with `workspace onboarding completed` in week 0

## Daily metrics checklist

| Metric | PostHog approach |
|--------|------------------|
| Signup → login (24h) | Funnel or formula: `login success` / `signup completed` |
| Onboarding completion | `workspace onboarding completed` / `workspace created` |
| Activation (7d) | Unique users with `generation success` / signups |
| Time to first generation | Time between `signup completed` and first `generation success` |
| Generation success rate | `generation success` / `generation started` (stage: generate) |
| Failure breakdown | Trends on `generation failed` by `error_code` |
| Token limit friction | Filter `error_code = TOKEN_LIMIT_EXCEEDED` |
| Paid conversion | `plan changed` where `new_plan` ≠ Free |
| Orchestrator adoption | % users with `orchestrator message sent` |

## Live verification

1. Enable keys in `.env.local` (frontend) and backend `.env`
2. Open **Live events** in PostHog
3. Sign up → create site → generate blog
4. Confirm `distinct_id`, `workspace_id`, `session_id` on events
5. Log out and confirm `reset()` clears identity
