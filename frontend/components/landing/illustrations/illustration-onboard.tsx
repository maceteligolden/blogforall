import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Onboarding as a flowing setup process: URL → scan → brand memory. */
export function IllustrationOnboard({ className = "", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <IllustrationShell className={className} animated={animated}>
      <svg viewBox="0 0 240 176" className="h-full w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="ob-flow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="rgb(59 130 246)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Flow path */}
        <path
          d="M36 48 H88 C104 48 112 72 128 88 C144 104 152 128 168 128 H204"
          className={cn("stroke-primary/40", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M36 48 H88 C104 48 112 72 128 88 C144 104 152 128 168 128 H204"
          stroke="url(#ob-flow)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.35"
        />

        {/* Step 1 — URL */}
        <g>
          <rect
            x="16"
            y="28"
            width="56"
            height="40"
            rx="10"
            className="fill-white/[0.06] stroke-white/15"
            strokeWidth="1"
          />
          <circle cx="30" cy="40" r="5" className="fill-primary/80" />
          <rect x="40" y="37" width="22" height="3" rx="1.5" className="fill-white/35" />
          <rect x="26" y="50" width="36" height="2.5" rx="1" className="fill-white/15" />
          <rect x="26" y="56" width="24" height="2.5" rx="1" className="fill-white/10" />
          <text x="44" y="80" textAnchor="middle" className="fill-white/45" fontSize="8" fontFamily="system-ui">
            URL
          </text>
        </g>

        {/* Step 2 — Scan */}
        <g>
          <rect
            x="96"
            y="68"
            width="56"
            height="40"
            rx="10"
            className="fill-white/[0.07] stroke-primary/35"
            strokeWidth="1"
          />
          <rect
            x="108"
            y="80"
            width="32"
            height="16"
            rx="3"
            className="stroke-primary/50"
            strokeWidth="1.2"
            fill="rgb(30 58 138 / 0.25)"
          />
          <path
            d="M112 88h24"
            className={cn("stroke-primary", animated && "motion-safe:animate-landing-line-draw")}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle
            cx="124"
            cy="88"
            r="10"
            className={cn("stroke-primary/40", animated && "motion-safe:animate-landing-pulse-soft")}
            strokeWidth="1"
            fill="none"
          />
          <text x="124" y="122" textAnchor="middle" className="fill-primary/70" fontSize="8" fontFamily="system-ui">
            Scan
          </text>
        </g>

        {/* Step 3 — Brand memory */}
        <g>
          <rect
            x="168"
            y="108"
            width="56"
            height="44"
            rx="10"
            className="fill-white/[0.08] stroke-white/20"
            strokeWidth="1"
          />
          <rect x="178" y="118" width="28" height="3" rx="1.5" className="fill-primary/60" />
          <rect x="178" y="126" width="36" height="2.5" rx="1" className="fill-white/20" />
          <rect x="178" y="132" width="30" height="2.5" rx="1" className="fill-white/15" />
          <rect x="178" y="138" width="22" height="2.5" rx="1" className="fill-white/10" />
          <text x="196" y="168" textAnchor="middle" className="fill-white/45" fontSize="8" fontFamily="system-ui">
            Memory
          </text>
        </g>

        {/* Moving pulse on path */}
        <circle
          cx="128"
          cy="88"
          r="3.5"
          className={cn("fill-primary", animated && "motion-safe:animate-landing-pulse-soft")}
        />
      </svg>
    </IllustrationShell>
  );
}
