# PRD — Content Optimization

**Status:** Draft  
**Product:** Bloggr  
**Engineering design:** [`architecture/v0.5/17-content-optimization.md`](./architecture/v0.5/17-content-optimization.md)  
**Date:** 2026-07-27

---

## 1. Problem

Traditional “SEO checkers” score keyword usage and miss what matters for Bloggr:

- content that fails search **intent**
- weak **topical authority** and AI-retrieval readiness (GAO)
- unsupported claims despite having research
- no prioritized improvement plan — only vague scores
- optimization bolted on as an afterthought, or buried inside a rewrite

Users need an intelligent optimization engine for **humans + search engines + AI answer engines**.

---

## 2. Goals

1. Every strategist / quick-draft article passes through **Content Optimization** before publish recommendation.
2. Produce explainable **SEO + GAO scorecards** and an **Optimization Plan** (Critical → Low).
3. Iterate: optimize → Writing revise → revalidate → **quality gate** (bounded loops).
4. Generate publish-ready **metadata + structured data** suggestions.
5. Prefer deterministic checks; use LLM only for semantic judgments.

---

## 3. Non-goals (MVP)

- Separate SEO and GAO orchestrator skills
- Auto-publishing when gate fails
- Full accessibility / legal / localization validators
- Automatic insertion of internal links without Writing apply
- Replacing Research or Writing skills

---

## 4. Users and jobs

| User | Job |
|------|-----|
| Workspace operator | Ship authoritative posts that rank and are citable by AI systems |
| Editor | See clear Critical/High issues and accept a revise pass |
| System (orchestrator) | Gate quality before suggesting publish |

---

## 5. Product requirements

| ID | Requirement |
|----|-------------|
| CO-1 | Unified Content Optimization Skill invoked by orchestrator (not peer SEO/GAO skills) |
| CO-2 | Validators for intent, semantic coverage, structure, authority, readability, GAO; **UX thin/heuristic only in MVP** (full UX post-MVP) |
| CO-3 | Generators for metadata, JSON-LD, internal/external link recommendations |
| CO-4 | Optimization Planner merges and prioritizes recommendations |
| CO-5 | Overall quality score with documented weights; gate `overall >= 72` and no Critical items |
| CO-6 | Max 2 optimize→revise loops per article generation |
| CO-7 | Reports persisted and visible in chat/UI (scores + top issues + plan) |
| CO-8 | Writing applies plan; Optimization does not silently rewrite |
| CO-9 | Factual checks ground in Research Package when present |
| CO-10 | Extensible validator interface for future compliance/a11y/etc. |

---

## 6. Success metrics

- % of drafts reaching quality gate within 2 loops
- Mean overall / SEO / GAO scores on published posts
- Critical issue reopen rate after revise
- Latency of one optimize pass (p50/p95)
- User acceptance rate of Critical/High recommendations

---

## 7. UX expectations (MVP)

After draft + optimize, the assistant surfaces:

- Overall / SEO / GAO scores
- Critical and High plan items (actionable)
- Metadata preview (title, description, slug)
- Internal/external link suggestions (capped)
- Clear statement if gate failed and another revise will run (or max loops reached)

**Note:** Deep UX scoring (pacing, visual opportunities, CTA craft) is **post-MVP**; MVP may include a thin heuristic UX pass that does not block the gate alone.

---

## 8. Dependencies

- Research Package architecture ([`architecture/v0.5/16-research-pipeline.md`](./architecture/v0.5/16-research-pipeline.md))
- Writing skill revise path
- Publishing applies metadata artifact
- Existing blog review runner as transitional adapter only

---

## 9. Legacy

[`BLOG_REVIEW_IMPLEMENTATION_SPEC.md`](./BLOG_REVIEW_IMPLEMENTATION_SPEC.md) and the Review skill describe the **legacy** review path. New orchestrator paths use Content Optimization per doc 17.

---

## 10. Rollout

Aligned with architecture milestones: contracts → skill pipeline → orchestrator `optimize` stage → retire Review skill id → richer linking/UX validators.
