import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Draft — document composing with AI assist and a live cursor. */
export function IllustrationDraft({ className = "", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <IllustrationShell className={className} animated={animated}>
      <svg viewBox="0 0 240 176" className="h-full w-full" fill="none" aria-hidden>
        {/* Document */}
        <rect
          x="28"
          y="14"
          width="140"
          height="148"
          rx="12"
          className="fill-white/[0.06] stroke-white/15"
          strokeWidth="1"
        />
        <rect x="44" y="30" width="72" height="5" rx="2" className="fill-white/35" />
        <rect x="44" y="44" width="96" height="3" rx="1.5" className="fill-white/18" />
        <rect x="44" y="52" width="88" height="3" rx="1.5" className="fill-white/12" />

        {/* Typing lines */}
        <rect
          x="44"
          y="72"
          width="100"
          height="3"
          rx="1.5"
          className={cn("fill-white/22", animated && "motion-safe:animate-landing-type-sweep")}
        />
        <rect
          x="44"
          y="82"
          width="86"
          height="3"
          rx="1.5"
          className={cn("fill-white/16", animated && "motion-safe:animate-landing-type-sweep")}
          style={animated ? { animationDelay: "0.35s" } : undefined}
        />
        <rect
          x="44"
          y="92"
          width="72"
          height="3"
          rx="1.5"
          className={cn("fill-white/12", animated && "motion-safe:animate-landing-type-sweep")}
          style={animated ? { animationDelay: "0.7s" } : undefined}
        />

        {/* Cursor */}
        <rect
          x="118"
          y="90"
          width="1.5"
          height="10"
          className={cn("fill-primary", animated && "motion-safe:animate-landing-glow-breathe")}
        />

        <rect x="44" y="112" width="64" height="3" rx="1.5" className="fill-white/10" />
        <rect x="44" y="122" width="80" height="3" rx="1.5" className="fill-white/10" />

        {/* AI assist chip */}
        <g transform="translate(156 36)">
          <rect width="60" height="72" rx="12" className="fill-primary/15 stroke-primary/40" strokeWidth="1.2" />
          <circle cx="18" cy="20" r="7" className="fill-primary/80" />
          <path
            d="M18 16.5l1.2 3.2 3.3.3-2.5 2.2.8 3.3L18 23.5l-2.8 1.9.8-3.3-2.5-2.2 3.3-.3L18 16.5z"
            className="fill-white"
          />
          <rect x="30" y="16" width="20" height="3" rx="1.5" className="fill-white/35" />
          <rect x="12" y="36" width="36" height="2.5" rx="1" className="fill-white/20" />
          <rect x="12" y="44" width="28" height="2.5" rx="1" className="fill-white/15" />
          <rect x="12" y="52" width="32" height="8" rx="4" className="fill-primary/70" />
        </g>

        {/* Score badge */}
        <g transform="translate(156 120)">
          <rect width="60" height="28" rx="8" className="fill-white/[0.06] stroke-white/12" strokeWidth="1" />
          <text x="12" y="18" className="fill-white/40" fontSize="8" fontFamily="system-ui">
            Score
          </text>
          <text
            x="48"
            y="18"
            textAnchor="end"
            className="fill-primary"
            fontSize="11"
            fontFamily="system-ui"
            fontWeight="700"
          >
            81
          </text>
        </g>
      </svg>
    </IllustrationShell>
  );
}
