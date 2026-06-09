# Bloggr product colors

Single source of truth: [`colors.ts`](./colors.ts) · Tailwind: [`tailwind.preset.ts`](./tailwind.preset.ts) · CSS: [`colors.css`](./colors.css)

## Brand

| Token | Hex | Usage |
|-------|-----|--------|
| `primary` / `primary-800` | `#1e40af` | CTAs, logo, links, focus rings |
| `primary-400` | `#60a5fa` | Gradients, link hover |
| `primary-500` | `#3b82f6` | Email buttons, info accents |
| `accent` / `accent-400` | `#22d3ee` | AI / orchestrator highlights (optional) |
| `secondary` / `secondary-500` | `#6366f1` | Secondary actions, paused campaign state |

### Primary scale

| Step | Hex |
|------|-----|
| 50 | `#eff6ff` |
| 100 | `#dbeafe` |
| 200 | `#bfdbfe` |
| 300 | `#93c5fd` |
| 400 | `#60a5fa` |
| 500 | `#3b82f6` |
| 600 | `#2563eb` |
| 700 | `#1d4ed8` |
| 800 | `#1e40af` ← **DEFAULT** |
| 900 | `#1e3a8a` |
| 950 | `#172554` |

## Surfaces (dark UI)

| Token | Hex | Tailwind equivalent |
|-------|-----|---------------------|
| `surface-canvas` | `#000000` | `bg-black` |
| `surface` | `#111827` | `bg-gray-900` |
| `surface-raised` | `#1f2937` | `bg-gray-800` |
| `surface-overlay` | `#374151` | `bg-gray-700` |
| `surface-border` | `#1f2937` | `border-gray-800` |
| `surface-border-subtle` | `#374151` | `border-gray-700` |

## Text

| Token | Hex |
|-------|-----|
| `text-primary` | `#ffffff` |
| `text-secondary` | `#9ca3af` |
| `text-muted` | `#6b7280` |
| `text-disabled` | `#4b5563` |
| `text-link` | `#60a5fa` |

## Semantic

| Role | DEFAULT | Muted bg | Border | Text (dark UI) |
|------|---------|----------|--------|----------------|
| Success | `#10b981` | `#14532d` | `#166534` | `#4ade80` |
| Warning | `#f59e0b` | `#422006` | `#854d0e` | `#facc15` |
| Error | `#ef4444` | `#450a0a` | `#991b1b` | `#f87171` |
| Info | `#3b82f6` | `#172554` | `#1e40af` | `#60a5fa` |

## Status mapping

| Status | Semantic |
|--------|----------|
| `active`, `published` | success |
| `draft`, `pending` | warning |
| `paused` | info |
| `failed` | error |
| `archived` | neutral 700–800 |

## Tailwind usage

```tsx
// Brand
<button className="bg-primary hover:bg-primary/90 text-white" />
<span className="text-primary border-primary/30 bg-primary/10" />

// Surfaces
<div className="bg-surface-canvas text-text-primary" />
<div className="bg-surface border border-surface-border" />

// Semantic chips (dark UI)
<span className="bg-success-muted text-success-text border-success-border" />
<span className="bg-error-muted/20 text-error-text border-error-border" />
```

## CSS variables

Import in `globals.css`:

```css
@import "../../design-tokens/colors.css";
```

Use `var(--color-primary)`, `var(--color-surface)`, etc., or shadcn-style `hsl(var(--background))`.
