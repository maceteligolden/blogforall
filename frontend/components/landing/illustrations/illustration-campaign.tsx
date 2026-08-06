import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Campaigns — messaging lanes feeding a shared publish timeline. */
export function IllustrationCampaign({ className = "", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <IllustrationShell className={className} animated={animated} wide>
      <svg viewBox="0 0 320 200" className="h-full w-full" fill="none" aria-hidden>
        <text x="16" y="22" className="fill-white/40" fontSize="9" fontFamily="system-ui" fontWeight="600">
          Campaign lanes
        </text>

        {/* Lanes */}
        {[
          { y: 40, label: "Evergreen", fill: "fill-primary/20 stroke-primary/40", bar: "fill-primary/80" },
          { y: 84, label: "Launch", fill: "fill-white/[0.06] stroke-white/15", bar: "fill-primary/50" },
          { y: 128, label: "Series", fill: "fill-white/[0.06] stroke-white/15", bar: "fill-white/35" },
        ].map((lane, i) => (
          <g key={lane.label}>
            <rect x="16" y={lane.y} width="188" height="36" rx="10" className={`${lane.fill}`} strokeWidth="1" />
            <text x="28" y={lane.y + 14} className="fill-white/55" fontSize="8" fontFamily="system-ui">
              {lane.label}
            </text>
            <rect
              x="28"
              y={lane.y + 20}
              width={70 + i * 18}
              height="8"
              rx="4"
              className={cn(lane.bar, animated && i === 0 && "motion-safe:animate-landing-type-sweep")}
            />
            <path
              d={`M204 ${lane.y + 18} H236`}
              className={cn("stroke-primary/40", animated && "motion-safe:animate-landing-dash-flow")}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* Timeline rail */}
        <rect
          x="244"
          y="32"
          width="60"
          height="148"
          rx="12"
          className="fill-white/[0.05] stroke-primary/30"
          strokeWidth="1"
        />
        <text x="274" y="52" textAnchor="middle" className="fill-white/50" fontSize="8" fontFamily="system-ui">
          Calendar
        </text>
        <line x1="258" y1="64" x2="290" y2="64" className="stroke-white/10" strokeWidth="1" />

        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i} transform={`translate(256 ${76 + i * 20})`}>
            <circle cx="6" cy="6" r="4" className={i < 3 ? "fill-primary" : "fill-white/20"} />
            {i < 4 && <path d="M6 10 V20" className="stroke-white/15" strokeWidth="1" />}
            <rect
              x="16"
              y="3"
              width={i === 1 ? 28 : 22}
              height="6"
              rx="3"
              className={i < 3 ? "fill-primary/50" : "fill-white/10"}
            />
          </g>
        ))}

        <circle
          cx="262"
          cy="102"
          r="9"
          className={cn("stroke-primary/50", animated && "motion-safe:animate-landing-pulse-soft")}
          strokeWidth="1"
          fill="none"
        />
      </svg>
    </IllustrationShell>
  );
}
