# Bloggr — Landing Page Requirements Document (LPRD)

**Status:** Canonical  
**Product:** Bloggr (codebase: `blogforall`)  
**Page:** Homepage `/`  
**Version:** 1.0  
**Date:** 2026-08-01  
**Supersedes:** [`LANDING_PAGE_REDESIGN_PLAN.md`](./LANDING_PAGE_REDESIGN_PLAN.md) (CEO-minimal / waitlist-era approach) and the live waitlist homepage composition in `frontend/components/landing/waitlist/`

**Conversion lock:** Open signup → Free plan with **full product access**. No waitlist. No “trial” language.

**Implementation note:** This document is the single source of truth for building the homepage. Do not invent copy, CTAs, integrations, or social proof not specified here. Do not generate landing code from this doc until an implementation task explicitly requests it.

---

## 0. Document control

| Field | Value |
|-------|--------|
| Product brand | **Bloggr** (never “Blogforall” or “BlogsForAll” on the page) |
| Primary ICP | Solo founders, online businesses / SMBs, startup marketers |
| Secondary ICP | Agencies / marketers managing client brands (expansion story — not hero) |
| Primary conversion | Account signup → Free plan → onboarding → first strategist conversation |
| Secondary conversion | “See how it works” scroll / optional 90s product video; Contact for custom needs |
| Explicitly out of scope | Waitlist forms, early-access scarcity, 14-day trial CTAs, WordPress/Webflow/Ghost/social CMS logos not shipped, fake customer logos, analytics BI showcase |

### Related sources (research basis)

- [`architecture/v0.5/README.md`](./architecture/v0.5/README.md) — product vision  
- [`architecture/v0.5/20-go-to-market-architecture.md`](./architecture/v0.5/20-go-to-market-architecture.md) — ICP / promise  
- [`architecture/v0.5/21-strategic-intelligence.md`](./architecture/v0.5/21-strategic-intelligence.md) — strategy → campaign → content  
- [`PRD_MEMORY_SYSTEM.md`](./PRD_MEMORY_SYSTEM.md), [`PRD_CONTENT_OPTIMIZATION.md`](./PRD_CONTENT_OPTIMIZATION.md), [`PRD_CONVERSATION_INTELLIGENCE.md`](./PRD_CONVERSATION_INTELLIGENCE.md)  
- Live waitlist copy (reuse selectively; retire waitlist CTAs): `frontend/components/landing/waitlist/`  
- Plans: `backend/src/shared/utils/seed-plans.util.ts`  

---

## 1. Product truth

### 1.1 What Bloggr is

An AI **content strategist workspace**. Brief the business once, then get researched, on-brand blog content through natural conversation—plan, draft, optimize for search and AI answers, schedule, publish, and improve—from one place.

**Go-to promise (internal north star):**  
Bloggr turns a messy brief into researched, on-brand, search- and AI-retrieval-ready content—with a package you can defend to a client or cofounder.

### 1.2 What Bloggr is not

- A ChatGPT wrapper / prompt playground  
- A generic headless CMS marketed as the hero  
- An SEO keyword-score tool  
- A social network posting suite  
- A multi-agent swarm or “AI employees” fantasy  

### 1.3 Outcomes users care about (sell these)

| # | Outcome | Landing language cue |
|---|---------|----------------------|
| 1 | Stop re-briefing AI every post | Brief once. Every post starts informed. |
| 2 | Talk about the business → usable drafts | Conversation, not prompts. |
| 3 | Research with sources you can defend | Claims come with sources. |
| 4 | Content for Google **and** AI answers | Ready for search and AI answers. |
| 5 | Campaign + calendar thinking | A plan, not a pile of drafts. |
| 6 | Draft → review → schedule → publish | One workspace. No tool-hopping. |
| 7 | Team control when needed | Roles and approvals before risky actions. |
| 8 | Publish to your own site | Your frontend. Bloggr content. (API) |

### 1.4 Technical features that stay invisible

Do **not** name or explain on the landing page:

LangGraph, Conversation Intelligence pipeline internals, Research Package algorithms, `coverage_min`, Memory Manager layers, BullMQ workers, token ledger, SEO/GAO gate thresholds as architecture, tsyringe, Mongo schemas, supervisor fallback, checkpoint / HITL graph nodes.

**Soft-visible (outcome language only):**

- “Remembers your business”  
- “Shows sources”  
- “Search + AI-answer ready”  
- “Gets sharper from what you publish” — do **not** overclaim a full analytics / BI platform (dashboard analytics are thin; closed-loop intelligence is evolving)

### 1.5 Honest integration claims

| Claim | Allowed? | Reality |
|-------|----------|---------|
| Public REST API + API keys | Yes | Documented; Settings → Developer |
| Google Drive → Library | Yes | Connect flow exists |
| In-app draft, schedule, publish | Yes | Core product |
| Dropbox / OneDrive | Soft “coming soon” only if shown at all | UI stubs — prefer omit on homepage |
| WordPress / Webflow / Ghost / social publish | **No** | Not shipped |
| “No CMS hop” | Yes, with precision | Means Bloggr workspace + API to *your* frontend—not a plugin marketplace |

---

## 2. Customer model

### 2.1 Primary audience

Founders, creators, and SMB marketers who need consistent SEO / authority content without hiring a full-time content strategist.

### 2.2 Secondary audience

- Startup content owners who need product truth in every draft  
- Agencies / marketers managing multiple brands (workspace isolation as credibility—**not** the hero story until agency pack is the GTM focus)

### 2.3 Goals

- Ship on a schedule  
- Stay on-brand without re-prompting  
- Rank and get cited (search + AI answers)  
- Defend quality to a cofounder or client  
- Spend less than an agency for a strategist-quality loop  

### 2.4 Pain points & current workflow

**Today’s grind:** ChatGPT → Google Docs → email/Slack review → CMS → spreadsheet calendar.

**Frustrations:** Re-explaining brand voice; generic AI output; no campaign sequencing; context lost between tools; prompt engineering instead of strategy; fear of publishing unsupported claims.

### 2.5 Objections and counters

| Objection | Counter on page |
|-----------|-----------------|
| “AI blogs are generic / hallucinate” | Research + sources; you steer; approve before publish |
| “Another tool to learn” | Conversation-first; onboard once |
| “It will forget my brand” | Business memory as a core pillar |
| “I already have ChatGPT” | ChatGPT answers questions; Bloggr runs the content operation |
| “Too early / incomplete” | Full Free access—use the real product today |
| “Where does content live?” | Bloggr workspace + API to your site |
| “Will it post without me?” | You stay in control; destructive actions ask for confirmation |

### 2.6 Why they buy immediately

- Prompt fatigue is acute  
- They need a month of content, not one clever paragraph  
- They want one place for plan + draft + publish  
- Free full access removes purchase anxiety  

### 2.7 Why they switch from competitors

- Generators start at the blank page; Bloggr starts at the business  
- Memory that persists across posts  
- Research you can show  
- Campaigns + calendar, not isolated drafts  
- Publish path included (workspace + API)  

---

## 3. Competitive positioning

### 3.1 What every AI writing product says (avoid)

- “Write 10x faster”  
- “Brand Voice™” as the entire story  
- Template grids and feature bingo  
- Purple-to-indigo AI gradients  
- Fake logo walls  
- “ChatGPT but for marketing”  
- Empty automation claims (“content that runs itself”)  

### 3.2 Bloggr wedge

| Dimension | Position |
|-----------|----------|
| **Category** | AI content strategist (not AI writer) |
| **Contrast** | Generators start at the blank page. Bloggr starts at the business. |
| **Proof artifacts** | Remembered context chips; sources/research; dual readiness (search + AI answers); campaign → calendar → draft; conversational steer |
| **Vs ChatGPT** | Conversation + memory + research → write → optimize → publish |
| **Vs Jasper / Writesonic** | Strategist loop + research provenance + Free full access; not enterprise template theater |
| **Vs Surfer / Frase** | Optimization is inside the strategist pipeline, not a bolted score editor |

### 3.3 Category-default bets (from GTM — surface as outcomes)

1. Research with sources as a visible product moment  
2. Workspace = brand brain  
3. Search + AI-answer readiness (without dumping score math)  
4. Conversation that starts work (not passive acknowledgements)  
5. Calendar → draft → publish replacing three tools  

---

## 4. Core messaging system

| Asset | Locked copy |
|-------|-------------|
| **Primary value proposition** | Bloggr is the content strategist that already knows your business. |
| **Supporting VP 1** | Brief once, converse forever. |
| **Supporting VP 2** | Researched drafts you can defend. |
| **Supporting VP 3** | Strategy → campaign → publish in one workspace. |
| **Supporting VP 4** | Ready for search and AI answers. |
| **Brand promise** | On-brand content from conversation—not prompts. |
| **Mission** | Replace the ChatGPT → Docs → CMS grind with a strategist that remembers, researches, and ships. |
| **One-sentence elevator** | Talk about your business; Bloggr turns that into researched, on-brand posts—planned, drafted, and published from one place. |
| **Emotional positioning** | Relief from the prompt treadmill; confidence you’re not publishing vibes. |
| **Logical positioning** | Memory + research + optimize + calendar beats disconnected tools. |
| **Transformation statement** | From “I write prompts” → “I run a content strategy.” |
| **Before Bloggr** | Blank page, re-briefing, scattered tools, generic drafts, no plan. |
| **After Bloggr** | Durable business context, conversational planning, sourced drafts, calendar shipping, one workspace. |

### 4.1 Hero messaging (locked)

| Element | Copy |
|---------|------|
| Brand signal | **Bloggr** (hero-level, not nav-only) |
| **H1** | Talk about your business. Ship content that sounds like you. |
| **Subhead** | Bloggr remembers your positioning, researches with sources, and turns natural conversation into on-brand posts—planned, drafted, and ready to publish. |
| **Primary CTA** | Start free → `/auth/signup` |
| **Secondary CTA** | See how it works → `#how-it-works` |
| **Trust microcopy** | Full access on Free. No waitlist. No credit card. |

### 4.2 Rejected / weak lines (do not use)

- “Content that runs itself”  
- “Publish more. Worry less.” (too generic)  
- “Get early access” / “Join the waitlist” / “mid July 2026” / “Join 400+ marketers already on the waitlist”  
- “14-day free trial” / “Start your free trial”  
- About-page CMS boilerplate (“powerful, flexible blog management platform”) as homepage voice  
- “AI-powered blogging SaaS” without strategist framing  

---

## 5. Conversion strategy

### 5.1 Funnel

```
Landing → /auth/signup → Email verify → Company role → Create workspace
  → Free plan continue → Optional invite → /dashboard (setup seed)
  → First strategist conversation
```

### 5.2 CTA matrix

| ID | Placement | Primary text | Secondary text | Goal | Psychological trigger | Expected intent |
|----|-----------|--------------|----------------|------|----------------------|-----------------|
| CTA-NAV | Sticky header | Start free | Log in | Signup | Persistent availability | Ready or returning |
| CTA-H1 | Hero | Start free | See how it works | Signup | Ambition + zero friction | “I want this” |
| CTA-DEMO | After walkthrough | Start free | Watch 90s overview | Signup after understanding | Desire | Understood product |
| CTA-MID | After memory / research / campaigns cluster | Start free | — | Mid-page conversion | Momentum | Convinced on pillars |
| CTA-COMPARE | After comparison table | Switch to Bloggr | — | Competitive close | Contrast | Rejecting ChatGPT grind |
| CTA-PRICE | Pricing teaser | Start free | Compare plans | Signup | Value clarity | Checking cost |
| CTA-FINAL | Pre-footer | Start free — full access | Contact | Final conversion | Commitment | End of story |
| CTA-FOOTER | Footer | Start free | Docs · Contact | Residual | Utility | Late click |

**Banned CTA copy:** Get early access · Join waitlist · Start trial · Try free for 14 days · Request demo (as primary) · Get early access pricing  

**Demo policy:** Optional muted click-to-play (or muted autoplay with controls) 90s product video. Human demo via `/contact` only—not hero-primary.

### 5.3 Auth-aware CTA behavior

| State | Primary header / hero CTA | Secondary |
|-------|---------------------------|-----------|
| Logged out | Start free → `/auth/signup` | Log in → `/auth/login` |
| Logged in | Go to Dashboard → `/dashboard` | — |

---

## 6. Information architecture

### 6.1 Scroll story (emotion arc)

| Phase | Emotion | Sections |
|-------|---------|----------|
| Open | Curiosity | Header, Hero |
| Recognize | Frustration → relief preview | Proof strip, Problem + hidden cost |
| Understand | Clarity | Product intro, Interactive walkthrough, How it works |
| Desire | Excitement | Memory, Research, Campaigns, Publish |
| Trust | Confidence | Why different, Comparison, Audience, Social proof, Pricing, FAQ |
| Act | Urgency without scarcity theater | Final CTA, Footer |

The page must feel like **one continuous story**, not a feature catalog.

### 6.2 Section order

```
S0  Header
S1  Hero
S2  Proof strip
S3  Problem + hidden cost
S4  Product introduction
S5  Interactive product walkthrough
S6  How it works
S7  Business memory
S8  Research & quality
S9  Campaigns & calendar
S10 Publishing & API
S11 Why Bloggr is different
S12 Comparison vs alternatives
S13 Who it’s for
S14 Social proof (honest placeholders)
S15 Pricing teaser
S16 FAQ
S17 Final CTA
S18 Footer
```

### 6.3 Intentionally omitted sections

- Customer logo wall (no real assets yet)  
- Heavy security / compliance theater  
- Analytics BI showcase  
- Integrations logo salad  
- Founder novella  
- Launch timeline / waitlist perks / founding-member lifetime access pitch  
- Dense feature comparison with 20 rows  

---

## 7. Section specifications

Every section below is implementation-complete: purpose, goal, message, layout, hierarchy, copy, conversion, interaction, animation, media placeholders, responsive, accessibility.

---

### S0 — Header

| Field | Spec |
|-------|------|
| **Purpose** | Orient and convert without stealing hero attention |
| **Goal** | Always-available Start free; jump links for scanners |
| **Key message** | Bloggr is the product; Start free is the action |
| **Layout** | Single sticky row: logo left · nav center/left · CTAs right. Max width aligned to page grid (~1120–1200px) |
| **Visual hierarchy** | Logo/wordmark → Primary CTA → Nav links → Log in |
| **Copy** | Logo text: `Bloggr`. Nav: `Product` (`#product`), `How it works` (`#how-it-works`), `Why Bloggr` (`#why-bloggr`), `Pricing` (`#pricing`), `Docs` (`/docs`), `Contact` (`/contact`). Primary: `Start free`. Secondary: `Log in` |
| **Conversion objective** | CTA-NAV signup |
| **Interactions** | Smooth-scroll to anchors; mobile hamburger or sheet; CTA hover lift |
| **Animations** | On scroll past hero: backdrop blur + hairline border appears. No layout jump |
| **Media** | None |
| **Responsive** | Collapse nav under menu &lt;768px; keep Start free visible |
| **Accessibility** | `header` landmark; skip link “Skip to content”; focus-visible rings; `aria-expanded` on menu |

---

### S1 — Hero

| Field | Spec |
|-------|------|
| **Purpose** | Create immediate understanding + conversion |
| **Goal** | Visitor names what Bloggr is and clicks Start free in &lt;15s |
| **Key message** | Talk about your business → on-brand content that ships |
| **Layout** | Full-bleed atmospheric plane. Centered column max ~720px for type. Optional product silhouette as **edge-to-edge background**, not an inset card. CTA group under subhead. Trust line under buttons. **First viewport budget:** brand, H1, subhead, CTA group, dominant atmosphere only—no stats, logos, or feature chips |
| **Visual hierarchy** | Brand/eyebrow → H1 → Subhead → Primary CTA → Secondary → Trust microcopy |
| **Copy** | Eyebrow (optional): `AI content strategist`. H1: `Talk about your business. Ship content that sounds like you.` Subhead: `Bloggr remembers your positioning, researches with sources, and turns natural conversation into on-brand posts—planned, drafted, and ready to publish.` Primary: `Start free`. Secondary: `See how it works`. Trust: `Full access on Free. No waitlist. No credit card.` |
| **Conversion objective** | CTA-H1 |
| **Interactions** | Primary navigates to signup; secondary smooth-scrolls to `#how-it-works` |
| **Animations** | H1 word/line reveal once; ambient grid breathe; CTA hover +2px translate. `prefers-reduced-motion`: static text, no breathe |
| **Screenshot placeholder** | **SH-HERO** — see §10 |
| **Video placeholder** | None in hero (keep LCP clean) |
| **Illustration** | Soft primary radial + faint grid mask (existing waitlist aesthetic language). No characters, no purple glow |
| **Responsive** | Stack CTAs full-width on mobile; reduce H1 size; atmosphere opacity may lower on small screens for readability |
| **Accessibility** | Single `h1`; contrast AA on text; CTAs are real links/buttons |

---

### S2 — Proof strip

| Field | Spec |
|-------|------|
| **Purpose** | Lightweight trust without inventing social proof |
| **Goal** | Reinforce ICP fit in one glance |
| **Key message** | Built for people done with prompting |
| **Layout** | Thin full-width band; single centered line; hairline top/bottom optional |
| **Visual hierarchy** | One caption-level line |
| **Copy** | `Built for founders and marketers who are done prompting.` |
| **Conversion objective** | Soften skepticism before problem section |
| **Interactions** | None |
| **Animations** | Fade-in on enter |
| **Media** | None. **Do not** invent logos or “400+ waitlist” |
| **Responsive** | Allow wrap; keep centered |
| **Accessibility** | Not a heading; plain `p` |

---

### S3 — Problem + hidden cost

| Field | Spec |
|-------|------|
| **Purpose** | Name the pain so the product feels necessary |
| **Goal** | Visitor thinks “that’s my workflow” |
| **Key message** | Generators make drafts. They don’t run content. |
| **Layout** | Two columns on desktop: left “The prompt treadmill”, right “The hidden cost”. Mobile stacked |
| **Visual hierarchy** | Section H2 → two H3s → short bullets |
| **Copy** | **H2:** `The blank page isn’t the problem. The workflow is.` **Lead:** `ChatGPT can write a paragraph. It can’t remember your business, plan the month, or ship the post.` **Left H3:** `The prompt treadmill` Bullets: `Re-brief your brand for every post.` · `Jump between chat, docs, and your CMS.` · `Generic drafts that need hours of cleanup.` · `No campaign. No calendar. No memory.` **Right H3:** `The hidden cost` Bullets: `Brand drift across posts.` · `Strategy replaced by prompt engineering.` · `Missed publish dates.` · `Content you can’t defend to a cofounder or client.` |
| **Conversion objective** | Create readiness for product reveal |
| **Interactions** | Optional hover highlight on columns—no cards required |
| **Animations** | Staggered bullet fade/rise |
| **Media** | Optional simple before-flow illustration (chat → docs → CMS icons as line art)—not cartoonish |
| **Responsive** | Stack; keep bullets scannable |
| **Accessibility** | Lists as `ul`; H2/H3 order intact |

---

### S4 — Product introduction

| Field | Spec |
|-------|------|
| **id** | `product` |
| **Purpose** | Introduce Bloggr as the strategist workspace |
| **Goal** | Connect pain to a tangible UI |
| **Key message** | Meet the strategist that stays briefed |
| **Layout** | Short copy block above a large product stage (chat + artifact panel). Not a card collage |
| **Visual hierarchy** | Eyebrow → H2 → one sentence → product frame |
| **Copy** | Eyebrow: `The product`. H2: `Meet the strategist that stays briefed.` Body: `One conversation surface. Your business context stays loaded. Drafts, sources, and next steps appear beside the chat—so strategy and execution never split apart.` |
| **Conversion objective** | Increase desire before interactive walkthrough |
| **Interactions** | Optional subtle mouse-parallax on frame glow only |
| **Animations** | Frame fade-up; soft rim-light pulse once |
| **Screenshot placeholder** | **SH-PRODUCT** — orchestrator chat + artifact/draft panel, desktop, straight-on or slight 3/4. Highlight composer + AI reply. Annotation: none (clean hero product) |
| **Responsive** | Frame scales; horizontal pan or cropped focal region on mobile |
| **Accessibility** | Image `alt`: `Bloggr workspace showing a conversation and a draft panel` |

---

### S5 — Interactive product walkthrough

| Field | Spec |
|-------|------|
| **id** | `walkthrough` |
| **Purpose** | Teach the product story through scroll |
| **Goal** | Visitor can narrate how Bloggr works without reading docs |
| **Key message** | Say the goal → memory → research → draft → calendar |
| **Layout** | **Desktop:** sticky left narrative (steps 1–5); right product stage swaps. **Mobile:** stacked step + screenshot pairs |
| **Visual hierarchy** | Step number → step title → one sentence → stage UI |
| **Copy** | **H2:** `From a sentence about your business to a publish plan.` **Steps:** **01 Say the goal** — `“We’re targeting early-stage founders. Explain payment infrastructure this month.”` **02 Context loads** — `Voice, audience, and offers stay attached—no re-brief.` **03 Research with sources** — `Bloggr gathers evidence before it writes. You can see what informed the draft.` **04 Draft you can steer** — `On-brand HTML ready to refine in conversation—not a dump of generic paragraphs.` **05 Put it on the calendar** — `Series and dates live next to the work, so shipping isn’t a separate project.` Mid CTA after step 05: Primary `Start free` · Secondary `Watch 90s overview` |
| **Conversion objective** | CTA-DEMO |
| **Interactions** | Scroll-linked step active state; click step to jump stage; typing simulation in stage 01 composer (cosmetic) |
| **Animations** | Stage crossfade 200–300ms; chips animate in on step 02; source list staggers on 03; calendar cells ink-in on 05. Reduced motion: instant swap |
| **Screenshot placeholders** | **SH-WALK-1** … **SH-WALK-5** — see §10 |
| **Video placeholder** | **VID-90** — optional modal/inline 16:9, captions required, no audio autoplay |
| **Responsive** | Disable sticky below `lg`; use vertical timeline |
| **Accessibility** | Steps as ordered list; `aria-current` on active step; video has captions + transcript link |

---

### S6 — How it works

| Field | Spec |
|-------|------|
| **id** | `how-it-works` |
| **Purpose** | Simple linear mental model |
| **Goal** | Four-step recall |
| **Key message** | Onboard once → converse → draft with sources → ship |
| **Layout** | 2×2 grid desktop; 1-col mobile. Prefer numbered blocks with hairline borders—not heavy cards |
| **Visual hierarchy** | H2 → numbered items (title + body) |
| **Copy** | **H2:** `How Bloggr works` **01 Onboard once** — `Tell Bloggr your positioning, voice, and audience. It remembers.` **02 Plan in conversation** — `Describe the month. Bloggr proposes angles, a series, and where posts fit.` **03 Draft with sources** — `Because context stays loaded, you talk like a teammate—not a prompt engineer—and get researched drafts back.` **04 Ship from one place** — `Draft, review, schedule, and publish without hopping ChatGPT → Docs → CMS.` |
| **Conversion objective** | Reduce cognitive load; prepare for deep pillars |
| **Interactions** | Hover border brighten |
| **Animations** | Staggered entry |
| **Media** | Optional small icons (message, calendar, file-text, rocket)—stroke, primary accent |
| **Responsive** | Single column |
| **Accessibility** | Headings per step as `h3` |

---

### S7 — Business memory

| Field | Spec |
|-------|------|
| **id** | `memory` |
| **Purpose** | Sell the moat: durable business context |
| **Goal** | Visitor believes they won’t re-explain brand voice |
| **Key message** | Brief once. Every post starts informed. |
| **Layout** | Split: copy left, screenshot right (reverse on alternate rhythm) |
| **Visual hierarchy** | Eyebrow → H2 → body → 3 bullets → annotation on screenshot |
| **Copy** | Eyebrow: `Business memory`. H2: `Brief once. Every post starts informed.` Body: `Audience, offers, voice, and objections don’t vanish after one chat. Bloggr keeps your business loaded so the next draft stays consistent without another brief.` Bullets: `Positioning and voice that persist.` · `Preferences that stick (“shorter, more casual”).` · `Per-workspace isolation—brands don’t bleed.` |
| **Conversion objective** | Differentiate from ChatGPT memory theater |
| **Interactions** | Annotation highlight on hover |
| **Animations** | “Remembered” chips fade in on scroll into view |
| **Screenshot placeholder** | **SH-MEMORY** |
| **Responsive** | Stack; image below copy |
| **Accessibility** | Decorative chips `aria-hidden` if duplicated in text |

---

### S8 — Research & quality

| Field | Spec |
|-------|------|
| **id** | `research` |
| **Purpose** | Trust for AI content quality |
| **Goal** | Counter hallucination / “generic AI” objection |
| **Key message** | Not vibes—evidence. Ready for search and AI answers. |
| **Layout** | Split reverse of S7 |
| **Visual hierarchy** | H2 → body → dual metaphor (Search readiness · AI-answer readiness) without numeric score dumps |
| **Copy** | Eyebrow: `Research & quality`. H2: `Not vibes—evidence.` Body: `Before Bloggr writes, it researches. Sources and coverage show up with the draft so you can defend claims to a cofounder or client.` Dual lines: `Built to earn attention in search.` · `Structured to be citable in AI answers.` Footnote-style microcopy: `You steer. You approve before anything destructive publishes.` |
| **Conversion objective** | Trust → desire |
| **Interactions** | Source row hover |
| **Animations** | Source list stagger |
| **Screenshot placeholder** | **SH-RESEARCH** |
| **Responsive** | Stack |
| **Accessibility** | Don’t rely on color alone for “ready” state—use labels |

---

### S9 — Campaigns & calendar

| Field | Spec |
|-------|------|
| **id** | `campaigns` |
| **Purpose** | Show Bloggr thinks in programs, not one-offs |
| **Goal** | Desire for operational calm |
| **Key message** | This month has a plan—not a pile of drafts |
| **Layout** | Copy + calendar/timeline visual |
| **Visual hierarchy** | H2 → body → calendar screenshot |
| **Copy** | Eyebrow: `Campaigns & calendar`. H2: `This month has a plan—not a pile of drafts.` Body: `Campaigns carry messaging and goals. The calendar shows what ships when. Bloggr knows what you published last week and what you’re targeting next.` Bullets: `Default evergreen plus focused campaigns.` · `Schedule and prepare posts in one view.` · `Approvals when the team needs a gate.` |
| **Conversion objective** | CTA-MID (`Start free`) directly under this section or after S10 cluster |
| **Interactions** | Timeline expand on scroll (cosmetic chaptering) |
| **Animations** | Calendar cells ink-in; reduced-motion = static |
| **Screenshot placeholder** | **SH-CAL** |
| **Responsive** | Crop calendar to current week on mobile |
| **Accessibility** | Table/calendar image gets descriptive `alt` |

---

### S10 — Publishing & API

| Field | Spec |
|-------|------|
| **id** | `publish` |
| **Purpose** | Close the loop: content leaves the chat |
| **Goal** | Answer “where does content live?” |
| **Key message** | Publish in Bloggr. Deliver on your site via API. |
| **Layout** | Two honest pillars: In-app publishing · Headless API. No fake CMS logos |
| **Visual hierarchy** | H2 → two subheads → docs link |
| **Copy** | H2: `Ship without the tool hop.` Body: `Draft, review, schedule, and publish inside Bloggr—or pull content into your own frontend with the API.` Pillar A title: `In-app publishing` — `Schedule posts, review from email when needed, keep the calendar honest.` Pillar B title: `Your site, your frontend` — `API keys and docs so Bloggr is the content brain and your site stays yours.` Link: `Read the docs →` `/docs`. Microcopy: `Google Drive can feed your Library with brand docs. Native WordPress or social connectors aren’t the story—honesty is.` |
| **Conversion objective** | Developer-curious secondary path to Docs; primary still signup |
| **Interactions** | Docs link |
| **Animations** | Subtle code-snippet fade |
| **Screenshot placeholder** | **SH-API** |
| **Responsive** | Stack pillars |
| **Accessibility** | Code sample in `pre` with copy button labeled |

---

### S11 — Why Bloggr is different

| Field | Spec |
|-------|------|
| **id** | `why-bloggr` |
| **Purpose** | Compress the wedge into three pillars |
| **Goal** | Memorable differentiation |
| **Key message** | Conversation OS · Business memory · Strategist pipeline |
| **Layout** | Three columns; light dividers; avoid card grid heaviness |
| **Visual hierarchy** | H2 → 3× (title + one sentence) |
| **Copy** | H2: `Why Bloggr is different` **Conversation OS** — `You talk about the business. Bloggr starts the work—not another chat that waits for the perfect prompt.` **Business memory** — `Context stays loaded across posts, campaigns, and teammates in the workspace.` **Strategist pipeline** — `Research → draft → quality → calendar → publish. One loop. One place.` |
| **Conversion objective** | Setup for comparison table |
| **Interactions** | None required |
| **Animations** | Stagger |
| **Media** | Optional minimal icons |
| **Responsive** | Stack |
| **Accessibility** | `h3` per pillar |

---

### S12 — Comparison vs alternatives

| Field | Spec |
|-------|------|
| **id** | `compare` |
| **Purpose** | Make ChatGPT / AI-writer contrast concrete |
| **Goal** | Competitive close without trash-talk |
| **Key message** | Bloggr is the content operation; others are generators |
| **Layout** | Compact comparison table |
| **Visual hierarchy** | H2 → table → CTA |
| **Copy** | H2: `ChatGPT writes. Bloggr runs content.` Intro: `Use the best model when you need an answer. Use Bloggr when you need a content system.` |

**Table content:**

| Capability | ChatGPT | Typical AI writer | Bloggr |
|------------|---------|-------------------|--------|
| Remembers your business across posts | Session-bound | Brand voice profile | Workspace business memory |
| Research with visible sources before writing | You paste links | Sometimes | Built into the draft loop |
| Campaign + publishing calendar | No | Partial | Yes |
| Draft → schedule → publish in one place | No | Export elsewhere | Yes |
| You steer in natural conversation | Prompt craft | Templates + chat | Collaborative strategist |
| Full access to start | Paid plans | Trials / paid | Free plan, full product |

CTA after table: `Switch to Bloggr` → `/auth/signup` (CTA-COMPARE)

| Field | Spec |
|-------|------|
| **Interactions** | Row hover |
| **Animations** | Table fade-in |
| **Media** | None |
| **Responsive** | Horizontal scroll table with sticky first column **or** stacked definition lists per capability |
| **Accessibility** | Real `table` with `th` scope; caption |

---

### S13 — Who it’s for

| Field | Spec |
|-------|------|
| **id** | `audience` |
| **Purpose** | Help visitors self-select |
| **Goal** | “This is for me” |
| **Key message** | Founders, marketers, agencies who’d rather talk strategy than fight prompts |
| **Layout** | Three short persona blocks |
| **Visual hierarchy** | H2 → persona title → one sentence |
| **Copy** | H2: `Who Bloggr is for` **Founders & creators** — `Ship consistent, on-brand posts without a content hire.` **Marketers on small teams** — `Turn a messy brief into a month you can defend—and publish.` **Agencies** — `Keep each client’s voice and knowledge isolated in its own workspace.` Closing line: `If you’d rather talk about the business than wrestle a blank doc, you’re in the right place.` |
| **Conversion objective** | Affinity → signup |
| **Interactions** | None |
| **Animations** | Stagger |
| **Media** | None |
| **Responsive** | Stack |
| **Accessibility** | `h3` per persona |

---

### S14 — Social proof

| Field | Spec |
|-------|------|
| **Purpose** | Trust without fabrication |
| **Goal** | Placeholder structure ready for real quotes |
| **Key message** | Principles over fake avatars |
| **Layout** | Until real testimonials exist: 2–3 “product principles” quotes styled as pull quotes—clearly product voice, not fake customers. When real quotes arrive, swap in name, role, company |
| **Visual hierarchy** | H2 → quotes |
| **Copy (interim)** | H2: `What we’re optimizing for` Quote 1: `“A strategist that already knows the business—not another blank chat.”` Quote 2: `“If the UI only shows the draft, we look like every other writer. Sources and memory have to stay visible.”` Quote 3: `“Full access on Free. Earn the upgrade when the work compounds.”` Attribution interim: `— Bloggr product principles` |
| **Conversion objective** | Trust |
| **Rules** | **Never** invent customer names, logos, metrics, or “400+ marketers” |
| **Animations** | Fade |
| **Responsive** | Stack |
| **Accessibility** | `blockquote` + `footer` attribution |

---

### S15 — Pricing teaser

| Field | Spec |
|-------|------|
| **id** | `pricing` |
| **Purpose** | Remove price anxiety; highlight Free full access |
| **Goal** | Start free click |
| **Key message** | Full product on Free. Upgrade when you outgrow limits. |
| **Layout** | 4 tiers on large screens (Free featured), or Free + 3 paid. Free visually emphasized (border/primary), **not** “Most popular” on Pro if Free is the acquisition wedge—label Free as `Full access` badge. Pro may use `Most popular` for paid upgrades |
| **Visual hierarchy** | H2 → subhead → plan cards → CTA |
| **Copy** | H2: `Simple pricing. Full access to start.` Subhead: `Full product on Free. Upgrade when you outgrow limits.` |

**Plan cards (align with seed plans):**

| Plan | Price | Badge | Bullets (landing) | CTA |
|------|-------|-------|-------------------|-----|
| Free | $0 | Full access | Up to 3 blog posts · 1 site · API access · AI strategist workspace · No credit card | Start free |
| Starter | $5/mo | — | Up to 10 posts · AI generation & review · 1 site · Basic campaigns · API access | Start free |
| Professional | $10/mo | Most popular (paid) | Up to 50 posts · 3 sites · Unlimited campaigns · Team collaboration · Campaign templates | Start free |
| Enterprise | $20/mo | — | Unlimited posts & sites · Advanced API · Unlimited members · Priority support | Start free |

All CTAs → `/auth/signup` (or billing upgrade if logged in on paid intent—default signup for logged-out).

**Do not** say “14-day free trial” anywhere.

| Field | Spec |
|-------|------|
| **Conversion objective** | CTA-PRICE |
| **Interactions** | Card hover border |
| **Animations** | Light scale on featured Free only (subtle) |
| **Media** | None |
| **Responsive** | Horizontal snap scroll or 1-col stack |
| **Accessibility** | Price with month in text; don’t rely on color for “recommended” |

---

### S16 — FAQ

| Field | Spec |
|-------|------|
| **id** | `faq` |
| **Purpose** | Handle last objections |
| **Goal** | Reduce support anxiety; SEO FAQ schema |
| **Key message** | Clear, honest answers |
| **Layout** | Accordion; one question open at a time optional |
| **Visual hierarchy** | H2 → questions as buttons → answers |
| **Copy** | H2: `Questions` |

| Question | Answer |
|----------|--------|
| Is this just ChatGPT with a UI? | No. Bloggr remembers your business, researches before it writes, plans in campaigns, and publishes from one workspace. |
| Do I need a credit card? | No. Start on Free with full product access. Upgrade when you need higher limits. |
| Will it publish without my approval? | Destructive publish actions ask for confirmation. You stay in control of what goes live. |
| How is this different from Jasper or other AI writers? | Those tools optimize for generating assets. Bloggr optimizes for running a content strategy—memory, research, campaigns, calendar, and publish—in one loop. |
| Can I use my own site? | Yes. Publish and manage in Bloggr, and deliver to your frontend with the public API. |
| What does Bloggr remember? | Business context for your workspace—audience, voice, offers, and preferences—so you don’t re-brief every post. Memory stays scoped to the workspace. |
| What if the AI gets something wrong? | You steer in conversation, review sources with the draft, and approve before publish. Treat it like a strategist on your team—not an autopilot. |
| Is there a waitlist? | No. Full access is open—create an account and start. |
| Can my team join? | Yes. Invite teammates with roles. Approvals help when you want a gate on risky actions. |
| Who owns my content? | You do. Your workspace content remains yours. |

| Field | Spec |
|-------|------|
| **Conversion objective** | Remove final blockers |
| **Interactions** | Accordion keyboard support |
| **Animations** | Height animate open; reduced-motion instant |
| **Media** | None |
| **Responsive** | Full width readable measure (~720px) |
| **Accessibility** | `aria-expanded`, `aria-controls`; heading level for each question |

---

### S17 — Final CTA

| Field | Spec |
|-------|------|
| **Purpose** | Close the story |
| **Goal** | Maximum signup conversion |
| **Key message** | Full access. Brief once. Start now. |
| **Layout** | Centered band with atmospheric glow (match hero language) |
| **Visual hierarchy** | H2 → one line → primary CTA → secondary contact |
| **Copy** | H2: `Start with full access. Brief your business once.` Body: `Your business, already briefed—every draft after that gets easier.` Primary: `Start free — full access` → `/auth/signup`. Secondary: `Contact us` → `/contact`. Trust: `No waitlist. No credit card.` |
| **Conversion objective** | CTA-FINAL |
| **Interactions** | Strong primary button |
| **Animations** | Gentle glow; respect reduced motion |
| **Media** | Atmosphere only |
| **Responsive** | Full-width button |
| **Accessibility** | H2; don’t trap focus |

---

### S18 — Footer

| Field | Spec |
|-------|------|
| **Purpose** | Utility navigation + brand close |
| **Goal** | Residual conversion + legal/nav |
| **Key message** | Tagline reinforces category |
| **Layout** | 3–4 columns: Brand · Product · Company · Account |
| **Visual hierarchy** | Logo → tagline → links → copyright |
| **Copy** | Brand: `Bloggr`. Tagline: `Context-aware blog posts from conversation, not prompts.` Product links: How it works, Why Bloggr, Pricing, Docs. Company: About, Contact. Account: Start free, Log in. Copyright: `© {year} Bloggr. All rights reserved.` |
| **Conversion objective** | CTA-FOOTER |
| **Note** | About page currently uses outdated CMS positioning—rewrite is a **follow-up** outside this homepage build; footer may still link to `/about` |
| **Interactions** | Standard links |
| **Animations** | None |
| **Responsive** | Stack columns |
| **Accessibility** | `footer` landmark; nav lists labeled |

---

## 8. Full copy bank (quick reference)

### 8.1 Global

| Slot | Copy |
|------|------|
| Brand | Bloggr |
| Footer tagline | Context-aware blog posts from conversation, not prompts. |
| Primary CTA (default) | Start free |
| Secondary CTA (default) | See how it works |
| Trust line | Full access on Free. No waitlist. No credit card. |

### 8.2 Section headlines

| Section | Headline |
|---------|----------|
| Hero H1 | Talk about your business. Ship content that sounds like you. |
| Problem | The blank page isn’t the problem. The workflow is. |
| Product | Meet the strategist that stays briefed. |
| Walkthrough | From a sentence about your business to a publish plan. |
| How it works | How Bloggr works |
| Memory | Brief once. Every post starts informed. |
| Research | Not vibes—evidence. |
| Campaigns | This month has a plan—not a pile of drafts. |
| Publish | Ship without the tool hop. |
| Why different | Why Bloggr is different |
| Compare | ChatGPT writes. Bloggr runs content. |
| Audience | Who Bloggr is for |
| Social | What we’re optimizing for |
| Pricing | Simple pricing. Full access to start. |
| FAQ | Questions |
| Final CTA | Start with full access. Brief your business once. |

### 8.3 Microcopy

| Slot | Copy |
|------|------|
| Free badge | Full access |
| Docs link | Read the docs → |
| Compare CTA | Switch to Bloggr |
| Final primary | Start free — full access |
| Logged-in primary | Go to Dashboard |

---

## 9. Visual design requirements

### 9.1 Foundations

| Token | Guidance |
|-------|----------|
| **Canvas** | Continuous black (`#000`); avoid gray section banding |
| **Accent** | Existing primary blue `hsl(var(--primary))` — **not** purple-indigo AI cliché |
| **Avoid** | Warm cream + terracotta “AI brochure” look; broadsheet dense columns; glow spam; emoji |
| **Type** | Display for brand/H1 (`font-display` if present); tight tracking; body `text-gray-400`; max ~60–65ch for long lines |
| **Grid** | Content max-width ~1120–1200px; 8px spacing scale |
| **Section padding** | Mobile 64 · Tablet 80 · Desktop 112 (`py-16/20/28` language) |
| **Cards** | Default: no cards. Hero: never cards. Elsewhere: hairline `border-gray-800` surfaces only when interaction needs containment |
| **Depth** | Radial primary glows + faint grid masks (reuse waitlist hero language) |
| **Screenshots** | Floating UI, soft shadow, primary rim light; annotated callouts; device chrome optional |
| **Iconography** | Lucide (or existing) stroke icons; primary accent; no skeuomorphism |
| **Illustration style** | Abstract atmospheric only; no mascots |

### 9.2 Visual rhythm

Alternate copy/media splits (left/right) for S7–S10. Dense table (S12) and pricing (S15) as resting “utility” beats before FAQ and final CTA.

### 9.3 Glassmorphism

Use sparingly if at all—header blur on scroll is enough. Do not frost every panel.

### 9.4 Dark mode

Homepage is dark-first (matches product). Ensure AA contrast for gray-400 on black; bump to gray-300 for small text if needed.

---

## 10. Screenshot & media placeholder catalog

| ID | Purpose | Expected UI | Camera angle | Highlight | Annotation | Frame | Device |
|----|---------|-------------|--------------|-----------|------------|-------|--------|
| SH-HERO | Hero atmosphere | Chat + draft split | Soft 3/4 or faded full-bleed | Composer + reply | None | Edge-to-edge plane | Desktop |
| SH-PRODUCT | Product intro | Orchestrator + artifact panel | Straight-on | Active thread | None | Floating UI | Desktop |
| SH-WALK-1 | Walkthrough | Composer with typed goal | Crop UI | Input text | `01 Goal` | Stage | Desktop |
| SH-WALK-2 | Walkthrough | Context / remembered chips | Crop UI | Chips | `Loaded context` | Stage | Desktop |
| SH-WALK-3 | Walkthrough | Sources / research panel | Crop UI | Source list | `Sources` | Stage | Desktop |
| SH-WALK-4 | Walkthrough | Draft HTML + readiness labels | Crop UI | Draft body | `Ready to steer` | Stage | Desktop |
| SH-WALK-5 | Walkthrough | Calendar with series | Crop UI | Scheduled items | `On the calendar` | Stage | Desktop |
| SH-MEMORY | Memory pillar | Memory / strategy / remembered facts UI | Straight-on | Fact rows | `Stays loaded across every post` | Floating | Desktop |
| SH-RESEARCH | Research pillar | Sources + readiness | Straight-on | Source list | `Defend every claim` | Floating | Desktop |
| SH-CAL | Campaigns | Calendar month | Straight-on | Series cluster | `A plan, not a pile` | Floating | Desktop |
| SH-API | Publish | API key / docs snippet | Straight-on | Create key | `Your frontend, Bloggr content` | Floating | Desktop + mobile crop |
| VID-90 | Optional overview | Recorded product pass following walkthrough steps | 16:9 | Full loop | Captions required | Inline/modal | — |

**Capture notes:** Use a demo workspace with realistic but non-sensitive content (e.g. fictional payments startup). Match production UI chrome. Export 2x PNG/WebP. Provide mobile crops for SH-PRODUCT and SH-CAL.

---

## 11. Interactive demonstrations & scroll storytelling

### 11.1 Allowed interactions (educate + excite)

- Sticky storytelling walkthrough (S5)  
- Typing simulation in walkthrough step 01  
- Memory chips appearing on scroll (S7)  
- Source list progressive disclosure (S8)  
- Calendar cells ink-in (S9)  
- Accordion FAQ  
- Auth-aware CTAs  

### 11.2 Disallowed gimmicks

- Cursor-following blobs that obscure copy  
- Auto-playing loud video  
- Particle networks / constellation AI clichés  
- Fake live customer counters  
- Infinite logo marquees without real logos  
- Scroll-jacking the entire page  

### 11.3 Scroll discovery map

| Scroll depth | Discover | Feel |
|--------------|----------|------|
| 0–20% | What it is; Start free | Curiosity |
| 20–35% | Pain of current tools | Recognition |
| 35–55% | How a real session flows | Clarity / excitement |
| 55–75% | Memory, research, campaigns, publish | Desire |
| 75–90% | Differentiation, pricing, FAQ | Trust |
| 90–100% | Final Start free | Action |

---

## 12. Animation requirements

### 12.1 Global rules

| Type | Spec |
|------|------|
| Entry | Fade + rise 12–16px; stagger children 40–80ms |
| Scroll | IntersectionObserver / ScrollTimeline for walkthrough stages |
| Hover | Buttons translateY(-1–2px) + border brighten; 150–200ms ease |
| Text | H1 split or blur-in once per session |
| Loading | Skeleton for lazy screenshots |
| Image transitions | Crossfade 200–300ms between walkthrough stages |
| Progress | Active step indicator in walkthrough (line or number state) |
| Parallax | Atmospheric layers ≤4px only; disabled when reduced motion |
| Performance | GPU-friendly transforms/opacity; no layout thrash; lazy below-fold images |
| Reduced motion | `prefers-reduced-motion: reduce` → instant swaps, no breathe/parallax/typing |

### 12.2 Per-section animation summary

| Section | Entry | Scroll | Hover |
|---------|-------|--------|-------|
| Header | — | Blur + border | CTA lift |
| Hero | Text reveal | Ambient grid | CTA |
| Proof | Fade | — | — |
| Problem | Stagger bullets | — | Column border |
| Product | Frame rise | — | — |
| Walkthrough | — | Stage sync | Step select |
| How it works | Stagger | — | Border |
| Memory–Publish | Split rise | Chip/source/calendar motifs | Annotation |
| Compare | Fade | — | Row |
| Pricing | Stagger cards | — | Border |
| FAQ | — | — | Row |
| Final CTA | Glow (optional) | — | CTA |

---

## 13. Trust building

| Signal | How it appears |
|--------|----------------|
| Human control | Copy on research + FAQ: approve destructive publish |
| Workspace isolation | Memory pillar + agency persona |
| Honesty | No fake logos; honest API/Drive integrations; Free limits stated |
| AI transparency | Sources visible; steer in conversation |
| Privacy | FAQ: memory scoped to workspace |
| Professionalism | Linear/Stripe-level restraint; no hype counters |
| Roadmap | Do not put unfinished agency pack as a promise; soft persona only |
| Founder story | Omit on homepage unless a crisp one-liner is approved later |

---

## 14. SEO requirements

| Element | Spec |
|---------|------|
| **Title** | Bloggr — AI content strategist that knows your business |
| **Meta description** | Plan, research, write, and publish on-brand blog content through conversation—not endless prompts. Full access free. |
| **Canonical** | Production homepage URL |
| **H1** | Exactly one: hero H1 |
| **H2** | Section titles as specified |
| **Open Graph** | Title + description + `SH-PRODUCT` or branded OG image (1200×630) |
| **Twitter card** | `summary_large_image` |
| **JSON-LD** | `Organization` + `SoftwareApplication` (name Bloggr, applicationCategory BusinessApplication, offers Free) + `FAQPage` from S16 |
| **Internal links** | `/docs`, `/contact`, `/about`, `/auth/signup`, `/auth/login`, in-page anchors |
| **Keyword themes** | AI content strategist; business memory for content; AI blog workspace; campaign content calendar; conversation not prompts |
| **Avoid** | “Best AI writer 2026” spam; keyword stuffing; cloaking waitlist messaging |

### Semantic structure

`header` → `main` (sections with `aria-labelledby`) → `footer`. FAQ accordion still exposes Q&A in DOM for crawlers (not client-only empty).

---

## 15. Implementation guidance (for future build)

### 15.1 Recommended component structure

```
frontend/app/page.tsx
frontend/components/layout/landing-header.tsx   # update nav + CTAs
frontend/components/layout/landing-footer.tsx   # tagline retained
frontend/components/landing/
  hero-section.tsx
  proof-strip.tsx
  problem-section.tsx
  product-intro-section.tsx
  walkthrough-section.tsx
  how-it-works-section.tsx
  memory-section.tsx
  research-section.tsx
  campaigns-section.tsx
  publish-section.tsx
  why-different-section.tsx
  compare-section.tsx
  audience-section.tsx
  social-proof-section.tsx
  pricing-teaser-section.tsx
  faq-section.tsx
  final-cta-section.tsx
  media/   # placeholders → real assets
waitlist/  # retire from homepage; keep API only if needed elsewhere
```

### 15.2 Libraries

- Prefer CSS + IntersectionObserver; add Framer Motion only if scroll/sticky complexity needs it  
- `next/image` for screenshots  
- Existing Button / design tokens / `landing-*` typography classes  

### 15.3 Performance

- LCP = hero text (not image)  
- Lazy-load below-fold screenshots  
- Video poster first; no autoplay audio  
- Avoid shipping waitlist form JS on homepage  

### 15.4 Accessibility

- Landmarks, skip link, focus rings, AA contrast  
- Captioned video + transcript  
- Reduced motion paths  
- Keyboard accordion and mobile nav  

### 15.5 Maintainability

- Copy constants in a single `landing-copy.ts` module  
- Section components dumb + presentational  
- Analytics: CTA id from §5.2 (`cta_nav`, `cta_h1`, …), section impression events  

### 15.6 Acceptance criteria

- [ ] Visitor understands Bloggr ≠ ChatGPT in &lt;15 seconds  
- [ ] Start free is obvious and repeated ≥4 times  
- [ ] Zero waitlist / trial language  
- [ ] Moats visible as outcomes (memory, research, campaigns, publish)  
- [ ] No false integration logos  
- [ ] Auth-aware header CTAs  
- [ ] FAQ JSON-LD valid  
- [ ] `prefers-reduced-motion` respected  
- [ ] Lint + build green after implementation  

### 15.7 Out of scope for homepage implementation task

- Rewriting `/about` and root README (flagged follow-ups)  
- Building WordPress connectors  
- Inventing testimonials  
- Changing plan limits in Stripe/seed (landing must match seed)  

---

## 16. Appendix A — Deprecated messaging (do not use)

### A.1 Live waitlist homepage (retire)

| Source | Deprecated copy / pattern |
|--------|---------------------------|
| `waitlist-hero.tsx` | Waitlist email form as primary CTA; “Join 400+ marketers already on the waitlist.” |
| `launch-section.tsx` | “We launch by mid July 2026.”; founding-member / private beta / lifetime access waitlist perks |
| `WaitlistEmailForm` | “Get early access” style conversion |
| Header waitlist-era anchors | Fine to reuse labels; not waitlist CTA |

**Reusable ideas (rewrite into full-access framing):** brief once; plan in conversation; draft stays on-brand; ship from one place; vs generic AI (prompting, no context, isolation, lose steerability); footer tagline.

### A.2 `LANDING_PAGE_REDESIGN_PLAN.md` (superseded)

Do not implement:

- Ultra-minimal 30-second CEO page that **strips** strategist storytelling  
- Hero options “Content that runs itself” / “Publish more. Worry less.”  
- Features as icon+label only with no product story  
- Any implication that waitlist-era constraints still apply  

### A.3 About page (misaligned — follow-up rewrite)

Avoid pulling onto homepage:

- “Powerful, flexible blog management platform”  
- Community comments/likes as a primary offer  
- Generic CMS mission language without strategist positioning  

### A.4 Root README (stale)

Do not market from README lines that describe a generic “blog SaaS + Netflix dashboard.” Product narrative is the strategist loop in architecture v0.5 + this LPRD.

### A.5 Pricing component debt

`frontend/components/landing/pricing-plans.tsx` may still mention trials or omit Free. On implementation, align to §S15 (Free full access, no trial). `/pricing` currently redirects to `/`—homepage `#pricing` is the source of truth until a dedicated pricing page is restored.

### A.6 Onboarding copy watchpoint

Onboarding plans UI may say paid plans are “coming soon.” Homepage must **not** contradict full Free access. If onboarding still blocks paid, homepage still sells Free full access as the conversion path.

---

## 17. Appendix B — Banned phrases checklist

Implementers must reject any PR that introduces:

- waitlist, early access, private beta invite (as homepage CTA)  
- “400+ marketers” or any unverified metric  
- “14-day free trial” / “start your trial”  
- “Content that runs itself”  
- “ChatGPT for blogging”  
- WordPress / Webflow / Ghost / LinkedIn / Twitter as shipped integrations  
- LangGraph, GAO score, coverage_min, Memory Manager, BullMQ in user-facing copy  
- Fake testimonials or logos  
- Purple AI gradient theme as brand  
- Blogforall as customer-facing name  

---

## 18. Appendix C — Feature inventory: sell vs hide

| User-facing outcome | Sell on landing? | Hide / soft |
|---------------------|------------------|-------------|
| Talk, don’t prompt | **Yes — hero** | CI / orchestrator internals |
| Remembers business | **Yes — pillar** | Memory layers, Mongo |
| Plan in conversation | **Yes** | Strategy skill id |
| Researched drafts + sources | **Yes** | 14-phase research graph |
| Search + AI-answer readiness | **Yes — soft** | Score thresholds, validators |
| Campaigns + calendar | **Yes** | Campaign intelligence cache fields |
| Approvals + roles | Soft (teams) | HITL graph nodes |
| Email review for scheduled posts | Soft / omit if space-tight | Token review routes |
| Library + Google Drive | Soft in publish section | Dropbox/OneDrive soon |
| Public API | **Yes** | API implementation details |
| Voice conversation mode | Omit or tiny footnote | Orb UI |
| Referrals | Omit | — |
| Comments / likes | Omit on homepage | Legacy CMS |
| Analytics BI | **Omit** | Architecture skill only |
| Strategic decision engine | Soft (“knows what to do next”) | Engine name |

---

## 19. Document history

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-08-01 | Initial canonical LPRD. Conversion = full Free access. Supersedes waitlist homepage + redesign plan. |

---

**End of Landing Page Requirements Document.**  
An engineer or AI can implement the homepage from this file without additional product questions. If product reality changes (new integrations, real testimonials, plan limits), update this document in the same PR as the landing change.
