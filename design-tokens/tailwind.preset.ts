import type { Config } from "tailwindcss";
import { brand, neutral, semantic, surface, text } from "./colors";

const preset: Config = {
  theme: {
    extend: {
      colors: {
        primary: brand.primary,
        accent: brand.accent,
        secondary: brand.secondary,
        success: semantic.success,
        warning: semantic.warning,
        error: semantic.error,
        info: semantic.info,
        destructive: {
          DEFAULT: semantic.error.DEFAULT,
          foreground: semantic.error.foreground,
        },
        surface: {
          DEFAULT: surface.DEFAULT,
          canvas: surface.canvas,
          raised: surface.raised,
          overlay: surface.overlay,
          sunken: surface.sunken,
          border: surface.border,
        },
        neutral,
        "text-primary": text.primary,
        "text-secondary": text.secondary,
        "text-muted": text.muted,
        "text-disabled": text.disabled,
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      boxShadow: {
        "primary-glow": "0 10px 40px -10px rgba(30, 64, 175, 0.35)",
        "accent-glow": "0 10px 40px -10px rgba(34, 211, 238, 0.25)",
      },
    },
  },
};

export default preset;
