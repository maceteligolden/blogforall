# 20 — Go-to-Market Architecture (ICP Fit)

**Status:** Product–architecture guidance (v0.5 Architecture Freeze revision)  
**Audience:** Solo entrepreneurs, online businesses, startups, marketers managing client accounts  
**Companion:** [14-mvp-and-roadmap.md](./14-mvp-and-roadmap.md)

This doc does **not** invent a second AI brain. It constrains how v0.5 capabilities should show up so Bloggr becomes the default strategist for small teams — not another ChatGPT wrapper.

---

## 1. Market thesis

Competitors win on “generate a blog.” Bloggr wins if it feels like **hiring a content strategist who already knows the business** and can prove claims.

ICP jobs-to-be-done:

| ICP | Primary job | Failure mode today |
|-----|-------------|-------------------|
| Solo founder / creator | Ship consistent SEO content alone | Blank page; no research discipline; brand drift |
| Online business / SMB | Own niche topical authority | Generic AI copy; no memory of offers/audience |
| Startup | Move fast without a content hire | Slow agencies; tools that don’t know the product |
| Marketer / agency (client accounts) | Run many brands without mixing voice | Context bleed; no per-client evidence trail |

**Go-to promise (one sentence):**  
Bloggr turns a messy brief into researched, on-brand, search- and AI-retrieval-ready content — with a package you can defend to a client or cofounder.

---

## 2. Differentiators that must stay visible in product

Architecture already supports these; product must surface them or the moat is invisible.

| Differentiator | Architecture source | Product surface (must ship) |
|----------------|--------------------|-----------------------------|
| Provenanced research | Research Package / Evidence Graph | “Sources & coverage” panel on every draft |
| Communicative understanding | Conversation Intelligence | Clear actions start work; no passive acks |
| Brand/business memory | Memory Manager layers | Onboarding → durable prefs; “remembered” chips |
| Search + AI answer readiness | Content Optimization SEO+GAO | Dual scorecards + Critical plan in chat |
| Client-safe tenancy | workspace_id (+ future client pack) | Hard isolation; never cross-brand retrieve |

If the UI only shows the HTML draft, Bloggr looks like every other writer.

---

## 3. Architecture implications by ICP

### 3.1 Solo / online business (primary MVP ICP)

**Optimize for:** time-to-first-good-draft, low ceremony, high trust.

| Need | Architectural response |
|------|------------------------|
| Fast path when urgent | CI `urgency` → `quick_draft` (Research lite) |
| Don’t re-ask brand voice | Preference + Workspace memory; CI `update_preferences` |
| Trust claims | Writing must consume Package slices; disclose `degraded` |
| Cheap enough | Model routing tiers in [14](./14-mvp-and-roadmap.md); source caps |

**Do not build for MVP:** multi-seat approvals, white-label portals, complex campaign calendars.

### 3.2 Startup

**Optimize for:** product truth + speed.

| Need | Architectural response |
|------|------------------------|
| Product facts stay correct | Knowledge Memory from docs + high-confidence package facts |
| Founders brainstorm then ship | CI `brainstorm` → Strategy; then full/lite create |
| Iterate from feedback | Learning Memory on accept/reject of revise plans |

**Post-MVP:** upload product docs as Knowledge **sources** (cognition KNOWLEDGE.md pattern) → extracted facts into Knowledge Memory.

### 3.3 Marketer managing client accounts (agency pack — post-MVP start M6)

**Optimize for:** multi-brand isolation + explainability to clients.

| Need | Architectural response |
|------|------------------------|
| One marketer, many brands | **Workspace = brand/client**; never share memory across workspaces |
| Switch context without bleed | Session bound to workspace; retrieve always scoped |
| Defend work in client review | Exportable Research Package summary + Optimization report |
| Approvals | `await_human` kinds extended for client-facing publish |
| Billing / usage | Per-workspace cost attribution on turn traces |

**Architectural rule (lock now, implement later):**  
All Memory Manager and artifact queries are `workspace_id`-scoped. Cross-workspace Knowledge is **explicitly forbidden** until a tenancy review.

**MVP stub:** campaigns may bind to workspace; do not build full agency console yet — but do not design state that mixes brands in one thread.

---

## 4. Product experience principles (constrain UX + orch)

1. **One commitment per turn** — CI + plan should start work or ask one blocking question, not lecture.
2. **Show the strategist work** — coverage_score, contradictions, SEO/GAO, Critical plan items in the same thread as the draft.
3. **Modes match money** — `quick_draft` for speed; `strategist_pipeline` when they pay for quality (SEO/authority language).
4. **Preferences are sticky** — “shorter, more casual” must affect the next draft without a settings hunt.
5. **Client-ready artifacts** — Package + Optimization report are first-class exports, not debug logs.

---

## 5. What would make Bloggr the category default

Opinionated bets (build toward these; sequence after MVP vertical slice):

| Bet | Why it wins the ICP | Depends on |
|-----|---------------------|------------|
| **Research Package as the product** | Agencies and startups buy evidence, not vibes | 16 + UI panel |
| **Workspace = brand brain** | Solo + agency both need durable context | 18 Preference/Workspace |
| **Dual SEO+GAO scores** | “Works in Google *and* AI answers” is a crisp claim | 17 |
| **CI that starts work** | Removes ChatGPT-assistant friction | 19 + plan policies |
| **Client switcher without bleed** | Unlocks agency seat expansion | Tenancy + workspace UX |
| **Content Intelligence loop** | “Gets better from your posts’ CTR” | Post-MVP 18 Intelligence |
| **Calendar → draft → publish** | Replaces 3 tools for solos | Strategy calendar + Publishing |

**Anti-bets (do not chase early):** multi-agent swarms, social network posting suite, full DAM, enterprise SSO-first.

---

## 6. Recommended sequencing for market fit

```
MVP vertical slice (solo/SMB)
  → Surface Package + scores in UI
  → Preference memory reliability
  → Startup: Knowledge from uploads
  → Agency pack: multi-workspace switcher + export reports + usage
  → Intelligence closed loop
```

---

## 7. Success metrics (product)

| Metric | ICP signal |
|--------|------------|
| Time to first published post after onboarding | Solo activation |
| Re-ask rate for brand voice / audience | Memory quality |
| % drafts with coverage_score ≥ 0.55 (full) | Research moat live |
| Gate pass rate within 2 optimize loops | Optimization usefulness |
| Workspaces per agency seat (post pack) | Multi-client adoption |
| Preference application on next create | “Remembers me” |

---

## Related

- MVP locks: [14](./14-mvp-and-roadmap.md)
- Research: [16](./16-research-pipeline.md)
- Optimize: [17](./17-content-optimization.md)
- Memory: [18](./18-memory-manager.md)
- Conversation: [19](./19-conversation-intelligence.md)
- Workspace access PRD: [`PRD_WORKSPACE_AND_USER_ACCESS.md`](../../PRD_WORKSPACE_AND_USER_ACCESS.md)
