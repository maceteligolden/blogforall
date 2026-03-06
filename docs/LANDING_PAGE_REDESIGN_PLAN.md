# Landing Page Redesign Plan — Slick, Minimal, Conversion-Focused

**Goal:** A non-technical CEO can scan the page and make a business decision in under 30 seconds. Less copy, clearer outcomes, one primary path to signup.

---

## 1. Layout (Top to Bottom)

| Section | Purpose | Height / Density |
|--------|---------|------------------|
| **Header** | Logo + minimal nav (Pricing, Docs, Contact) + primary CTA (Start free / Dashboard) | Sticky, single row |
| **Hero** | One outcome headline, one short line, one CTA | ~60–70vh, centered |
| **Proof strip** | Single metric or one-line trust (e.g. “Publish more. Stress less.”) | One line, thin |
| **Features** | 3–4 icons + one-line labels only (no paragraphs) | Compact row or 2x2 grid |
| **Pricing** | 3 tiers, recommended highlighted, one CTA per card | Dense, scannable |
| **Final CTA** | One headline + one button | Short section |
| **Footer** | Logo, 3–4 links, copyright | Minimal |

**Removed for minimalism:** Long “AI-Powered Features”, “Campaign Management Showcase”, “Multi-Site & Collaboration” paragraphs, “Everything You Need” grid, “Use Cases” grid, “Feature Comparison Table”. Replace with the compact sections above.

---

## 2. Content (CEO-Friendly, Outcome-Led)

### Hero
- **Headline (one line):**  
  “Content that runs itself.”  
  Or: “Publish more. Worry less.”  
  Or: “Blogs, campaigns, and scheduling — one place.”
- **Subline (one short sentence):**  
  “AI-powered content, campaigns, and scheduling so your team can focus on strategy.”
- **CTA:**  
  Primary: “Start free” → `/auth/signup`  
  Secondary (optional): “See pricing” → scroll to #pricing or `/auth/signup` (pricing section).

### Proof strip
- One of:
  - “Trusted by teams to ship content on schedule.”
  - “From idea to published post in one place.”
- Or a single metric if available: “X posts scheduled this month” / “X teams onboarded”.

### Features (labels only, no body copy)
- **AI content** — Generate and review posts with AI  
- **Campaigns** — Plan and run marketing campaigns  
- **Scheduling** — Calendar and auto-publish  
- **Teams** — Multi-site, roles, collaboration  

Keep to 4 items max; icon + label only.

### Pricing
- Keep 3 tiers: Starter ($5), Professional ($10, “Most popular”), Enterprise ($20).
- One-line tagline per tier.
- 4–5 bullet points per tier (no long sentences).
- Single CTA per card: “Get started” or “Current plan”.

### Final CTA
- **Headline:** “Ready to simplify your content?”
- **Button:** “Start free trial” → `/auth/signup`.

---

## 3. Visuals (Slick & Minimal)

### Colors & gradients
- **Background:** Black (`#000`) base; avoid gray bands between sections for a continuous feel.
- **Hero:** Single subtle gradient:
  - Radial: soft blue/primary glow at center (e.g. `rgba(30,64,175,0.12)` at 50% 50%, fade to transparent).
  - Optional: very soft gradient from top (e.g. primary/10) to black bottom.
- **No:** Multiple overlapping gradients, purple/green mix, or busy patterns.

### Illustrations
- **Preferred:** No custom illustrations. Use:
  - One subtle **grid** (e.g. fine lines or dots) behind hero text for depth, or
  - One **gradient orb/blob** (primary/20, blurred) as a soft focal point.
- **If illustration needed:** Single abstract shape (e.g. rounded rectangle or soft blob) in brand color at low opacity; no characters or complex scenes.

### Typography
- **Headline:** Large, bold, tight tracking. One line if possible.
- **Subline:** One size down, `text-gray-400`, max ~60ch width.
- **Sections:** Short section titles; no long intros.

### Spacing & motion
- Generous vertical padding on hero; compact padding on proof and features.
- No auto-playing carousels or heavy animation; optional subtle fade-in on scroll for sections.

---

## 4. Implementation Sub-tasks (Hero First)

1. **Hero – Structure & gradient**  
   Markup and background only: section, container, gradient layer(s), no copy/CTA.

2. **Hero – Headline & subline**  
   Add minimal headline and subline; typography and spacing.

3. **Hero – CTA**  
   Add primary (and optional secondary) button; auth-aware (Start free / Go to Dashboard).

4. **Landing – Proof strip**  
   One-line proof/trust below hero.

5. **Landing – Features row**  
   4 items, icon + label only, no paragraphs.

6. **Landing – Pricing**  
   Keep 3-column pricing; tighten copy; ensure one CTA per card.

7. **Landing – Final CTA**  
   One headline + one button.

8. **Landing – Remove**  
   Delete or collapse long sections (AI features, Campaign showcase, Multi-site, Feature grid, Use cases, Comparison table) into the minimal structure above.

---

## 5. Acceptance (CEO Test)

- [ ] Can read the main value prop in &lt; 10 seconds.
- [ ] One obvious “Start free” path.
- [ ] No long paragraphs; only short lines and bullets.
- [ ] Page feels “slick” and minimal (no visual clutter).
- [ ] Pricing and “what we do” are scannable in one scroll.
