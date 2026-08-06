import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Ship — draft moves onto the calendar and marks ready. */
export function IllustrationShip({
  className = "",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <IllustrationShell className={className} animated={animated}>
      <svg viewBox="0 0 240 176" className="h-full w-full" fill="none" aria-hidden>
        {/* Draft card sliding in */}
        <g className={animated ? "motion-safe:animate-landing-float" : undefined}>
          <rect x="16" y="52" width="72" height="56" rx="10" className="fill-white/[0.07] stroke-white/15" strokeWidth="1" />
          <rect x="28" y="66" width="40" height="3" rx="1.5" className="fill-white/30" />
          <rect x="28" y="74" width="48" height="2.5" rx="1" className="fill-white/15" />
          <rect x="28" y="82" width="36" height="2.5" rx="1" className="fill-white/10" />
          <rect x="28" y="92" width="28" height="8" rx="4" className="fill-primary/60" />
        </g>

        <path
          d="M96 80 H118"
          className={cn("stroke-primary/70", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M116 74 L126 80 L116 86" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Calendar */}
        <rect x="132" y="24" width="92" height="128" rx="12" className="fill-white/[0.05] stroke-primary/30" strokeWidth="1" />
        <rect x="132" y="24" width="92" height="28" rx="12" className="fill-primary/20" />
        <rect x="132" y="40" width="92" height="12" className="fill-primary/20" />
        <text x="178" y="42" textAnchor="middle" className="fill-white/70" fontSize="9" fontFamily="system-ui" fontWeight="600">
          August
        </text>

        {[0, 1, 2, 3].flatMap((row) =>
          [0, 1, 2, 3].map((col) => {
            const active = row === 1 && col === 2;
            const scheduled = row === 2 && col === 0;
            return (
              <rect
                key={`${row}-${col}`}
                x={144 + col * 18}
                y={64 + row * 20}
                width="14"
                height="14"
                rx="3"
                className={
                  active
                    ? "fill-primary stroke-primary"
                    : scheduled
                      ? "fill-primary/30 stroke-primary/60"
                      : "fill-white/[0.04] stroke-white/10"
                }
                strokeWidth="1"
              />
            );
          })
        )}

        <circle
          cx="187"
          cy="91"
          r="8"
          className={cn("fill-primary", animated && "motion-safe:animate-landing-pulse-soft")}
        />
        <path d="M183 91l2.5 2.5 5-5" className="stroke-white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </IllustrationShell>
  );
}
