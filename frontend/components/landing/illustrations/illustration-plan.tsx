import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Plan in conversation — chat intent flowing into a structured outline. */
export function IllustrationPlan({
  className = "",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <IllustrationShell className={className} animated={animated}>
      <svg viewBox="0 0 240 176" className="h-full w-full" fill="none" aria-hidden>
        {/* Chat column */}
        <rect x="12" y="16" width="88" height="144" rx="12" className="fill-white/[0.04] stroke-white/10" strokeWidth="1" />
        <rect x="24" y="32" width="52" height="22" rx="10" className="fill-primary/70" />
        <rect x="30" y="39" width="28" height="3" rx="1.5" className="fill-white/50" />
        <rect x="30" y="45" width="18" height="2.5" rx="1" className="fill-white/30" />
        <rect x="24" y="64" width="64" height="28" rx="10" className="fill-white/[0.08] stroke-white/12" strokeWidth="1" />
        <rect x="32" y="72" width="40" height="2.5" rx="1" className="fill-white/25" />
        <rect x="32" y="78" width="48" height="2.5" rx="1" className="fill-white/15" />
        <rect x="32" y="84" width="32" height="2.5" rx="1" className="fill-white/12" />

        {/* Flow arrow */}
        <path
          d="M108 78 H128"
          className={cn("stroke-primary/70", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M126 72 L136 78 L126 84" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Outline column */}
        <rect x="140" y="16" width="88" height="144" rx="12" className="fill-white/[0.05] stroke-primary/25" strokeWidth="1" />
        <rect x="152" y="28" width="40" height="3" rx="1.5" className="fill-white/30" />

        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(0 ${48 + i * 26})`}>
            <circle
              cx="160"
              cy="0"
              r="7"
              className={i < 3 ? "fill-primary/25 stroke-primary/70" : "fill-white/[0.06] stroke-white/20"}
              strokeWidth="1.2"
            />
            <text
              x="160"
              y="3"
              textAnchor="middle"
              className={i < 3 ? "fill-primary" : "fill-white/40"}
              fontSize="8"
              fontFamily="system-ui"
              fontWeight="600"
            >
              {i + 1}
            </text>
            {i < 3 && (
              <path d="M160 7 V19" className="stroke-primary/35" strokeWidth="1.2" strokeDasharray="2 3" />
            )}
            <rect
              x="174"
              y="-4"
              width={i === 1 ? 40 : 48}
              height="3"
              rx="1.5"
              className={cn(i < 2 ? "fill-white/30" : "fill-white/15", animated && i === 1 && "motion-safe:animate-landing-type-sweep")}
            />
            <rect x="174" y="4" width={32 + i * 4} height="2.5" rx="1" className="fill-white/10" />
          </g>
        ))}
      </svg>
    </IllustrationShell>
  );
}
