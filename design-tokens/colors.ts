/**
 * Bloggr product color tokens — single source of truth.
 * Consumed by Tailwind preset, CSS variables, and documentation.
 */

export const brand = {
  primary: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    950: "#172554",
    DEFAULT: "#1e40af",
    foreground: "#ffffff",
  },
  /** AI / orchestrator highlights — distinct from primary CTAs */
  accent: {
    50: "#ecfeff",
    100: "#cffafe",
    200: "#a5f3fc",
    300: "#67e8f9",
    400: "#22d3ee",
    500: "#06b6d4",
    600: "#0891b2",
    700: "#0e7490",
    800: "#155e75",
    900: "#164e63",
    DEFAULT: "#22d3ee",
    foreground: "#042f2e",
  },
  /** Secondary actions, links, paused states */
  secondary: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
    DEFAULT: "#6366f1",
    foreground: "#ffffff",
  },
} as const;

export const semantic = {
  success: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
    DEFAULT: "#10b981",
    foreground: "#ffffff",
    /** Dark UI: badges, toasts, status chips */
    muted: "#14532d",
    border: "#166534",
    text: "#4ade80",
  },
  warning: {
    50: "#fffbeb",
    100: "#fef3c7",
    200: "#fde68a",
    300: "#fcd34d",
    400: "#fbbf24",
    500: "#f59e0b",
    600: "#d97706",
    700: "#b45309",
    800: "#92400e",
    900: "#78350f",
    DEFAULT: "#f59e0b",
    foreground: "#1c1917",
    muted: "#422006",
    border: "#854d0e",
    text: "#facc15",
  },
  error: {
    50: "#fef2f2",
    100: "#fee2e2",
    200: "#fecaca",
    300: "#fca5a5",
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
    700: "#b91c1c",
    800: "#991b1b",
    900: "#7f1d1d",
    DEFAULT: "#ef4444",
    foreground: "#ffffff",
    muted: "#450a0a",
    border: "#991b1b",
    text: "#f87171",
  },
  info: {
    50: "#eff6ff",
    100: "#dbeafe",
    200: "#bfdbfe",
    300: "#93c5fd",
    400: "#60a5fa",
    500: "#3b82f6",
    600: "#2563eb",
    700: "#1d4ed8",
    800: "#1e40af",
    900: "#1e3a8a",
    DEFAULT: "#3b82f6",
    foreground: "#ffffff",
    muted: "#172554",
    border: "#1e40af",
    text: "#60a5fa",
  },
} as const;

/** Dark-first surfaces (matches bg-black / gray-* usage across the app) */
export const surface = {
  canvas: "#000000",
  DEFAULT: "#111827",
  raised: "#1f2937",
  overlay: "#374151",
  sunken: "#030712",
  border: {
    DEFAULT: "#1f2937",
    subtle: "#374151",
    strong: "#4b5563",
  },
} as const;

export const text = {
  primary: "#ffffff",
  secondary: "#9ca3af",
  muted: "#6b7280",
  disabled: "#4b5563",
  inverse: "#111827",
  link: brand.primary[400],
  linkHover: brand.primary[300],
} as const;

export const neutral = {
  50: "#f9fafb",
  100: "#f3f4f6",
  200: "#e5e7eb",
  300: "#d1d5db",
  400: "#9ca3af",
  500: "#6b7280",
  600: "#4b5563",
  700: "#374151",
  800: "#1f2937",
  900: "#111827",
  950: "#030712",
} as const;

/** Campaign / blog / post status — maps to semantic dark-ui tokens */
export const status = {
  active: semantic.success,
  published: semantic.success,
  draft: semantic.warning,
  pending: semantic.warning,
  paused: semantic.info,
  failed: semantic.error,
  archived: { muted: neutral[800], border: neutral[700], text: neutral[400] },
} as const;

/** shadcn-compatible HSL tuples (no hsl() wrapper) for CSS variables */
export const hsl = {
  light: {
    background: "0 0% 100%",
    foreground: "222.2 84% 4.9%",
    card: "0 0% 100%",
    cardForeground: "222.2 84% 4.9%",
    popover: "0 0% 100%",
    popoverForeground: "222.2 84% 4.9%",
    muted: "210 40% 96.1%",
    mutedForeground: "215.4 16.3% 46.9%",
    border: "214.3 31.8% 91.4%",
    input: "214.3 31.8% 91.4%",
    ring: "221.2 83.2% 53.3%",
    destructive: "0 84.2% 60.2%",
    destructiveForeground: "210 40% 98%",
  },
  /** Product default — cinematic dark UI */
  dark: {
    background: "0 0% 0%",
    foreground: "0 0% 100%",
    card: "222.2 47.4% 11.2%",
    cardForeground: "210 40% 98%",
    popover: "222.2 47.4% 11.2%",
    popoverForeground: "210 40% 98%",
    muted: "217.2 32.6% 17.5%",
    mutedForeground: "215 20.2% 65.1%",
    border: "217.2 32.6% 17.5%",
    input: "217.2 32.6% 17.5%",
    ring: "224.3 76.3% 48%",
    destructive: "0 62.8% 50.6%",
    destructiveForeground: "210 40% 98%",
  },
} as const;

export const colors = {
  brand,
  semantic,
  surface,
  text,
  neutral,
  status,
  hsl,
} as const;

export type BrandColor = keyof typeof brand;
export type SemanticColor = keyof typeof semantic;
