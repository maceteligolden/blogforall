import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Business memory — layered context that stays loaded. */
export function IllustrationMemory({ className = "", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <IllustrationShell className={className} animated={animated}>
      <svg viewBox="0 0 240 176" className="h-full w-full" fill="none" aria-hidden>
        {/* Stacked memory cards */}
        <rect
          x="48"
          y="28"
          width="144"
          height="100"
          rx="14"
          className="fill-white/[0.03] stroke-white/10"
          strokeWidth="1"
          transform="rotate(-6 120 78)"
        />
        <rect
          x="48"
          y="36"
          width="144"
          height="100"
          rx="14"
          className="fill-white/[0.05] stroke-white/12"
          strokeWidth="1"
          transform="rotate(3 120 86)"
        />
        <rect
          x="48"
          y="44"
          width="144"
          height="108"
          rx="14"
          className="fill-white/[0.08] stroke-primary/30"
          strokeWidth="1.2"
        />

        <circle cx="72" cy="68" r="10" className="fill-primary/70" />
        <rect x="90" y="62" width="56" height="3.5" rx="1.5" className="fill-white/35" />
        <rect x="90" y="70" width="36" height="2.5" rx="1" className="fill-white/15" />

        {[
          { y: 96, label: "Audience", w: 70 },
          { y: 116, label: "Voice", w: 54 },
          { y: 136, label: "Offers", w: 62 },
        ].map((row, i) => (
          <g key={row.label}>
            <rect
              x="64"
              y={row.y}
              width="112"
              height="14"
              rx="5"
              className="fill-white/[0.05] stroke-white/10"
              strokeWidth="1"
            />
            <text x="72" y={row.y + 10} className="fill-primary/70" fontSize="7" fontFamily="system-ui">
              {row.label}
            </text>
            <rect
              x={120}
              y={row.y + 5}
              width={row.w / 2}
              height="3"
              rx="1.5"
              className={cn("fill-white/20", animated && i === 0 && "motion-safe:animate-landing-type-sweep")}
            />
          </g>
        ))}
      </svg>
    </IllustrationShell>
  );
}
