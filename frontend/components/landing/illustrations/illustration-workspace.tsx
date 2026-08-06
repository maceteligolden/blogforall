import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Product intro — conversation surface beside a living draft panel. */
export function IllustrationWorkspace({
  className = "",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <IllustrationShell className={className} animated={animated} wide>
      <svg viewBox="0 0 320 200" className="h-full w-full" fill="none" aria-hidden>
        {/* Chat pane */}
        <rect x="12" y="12" width="140" height="176" rx="14" className="fill-white/[0.04] stroke-white/12" strokeWidth="1" />
        <text x="28" y="36" className="fill-white/40" fontSize="8" fontFamily="system-ui">
          Orchestrator
        </text>
        <rect x="56" y="48" width="80" height="28" rx="12" className="fill-primary/75" />
        <rect x="68" y="58" width="48" height="3" rx="1.5" className="fill-white/45" />
        <rect x="68" y="65" width="32" height="2.5" rx="1" className="fill-white/30" />
        <rect x="24" y="88" width="100" height="44" rx="12" className="fill-white/[0.07] stroke-white/12" strokeWidth="1" />
        <rect x="36" y="100" width="64" height="3" rx="1.5" className="fill-white/25" />
        <rect x="36" y="108" width="76" height="2.5" rx="1" className="fill-white/15" />
        <rect x="36" y="116" width="52" height="2.5" rx="1" className="fill-white/12" />
        <rect x="24" y="152" width="116" height="24" rx="10" className="fill-white/[0.05] stroke-white/10" strokeWidth="1" />

        {/* Connector */}
        <path
          d="M152 100 H172"
          className={cn("stroke-primary/70", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M170 94 L180 100 L170 106" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Draft pane */}
        <rect x="180" y="12" width="128" height="176" rx="14" className="fill-white/[0.05] stroke-primary/30" strokeWidth="1" />
        <rect x="196" y="28" width="64" height="4" rx="2" className="fill-white/30" />
        <rect
          x="196"
          y="48"
          width="96"
          height="3"
          rx="1.5"
          className={cn("fill-white/18", animated && "motion-safe:animate-landing-type-sweep")}
        />
        <rect
          x="196"
          y="58"
          width="84"
          height="3"
          rx="1.5"
          className={cn("fill-white/14", animated && "motion-safe:animate-landing-type-sweep")}
          style={animated ? { animationDelay: "0.4s" } : undefined}
        />
        <rect x="196" y="68" width="72" height="3" rx="1.5" className="fill-white/10" />
        <rect x="196" y="88" width="40" height="40" rx="8" className="fill-primary/15 stroke-primary/35" strokeWidth="1" />
        <rect x="244" y="88" width="48" height="16" rx="4" className="fill-white/10" />
        <rect x="244" y="112" width="48" height="16" rx="4" className="fill-white/10" />
        <rect x="196" y="148" width="96" height="24" rx="8" className="fill-primary/20 stroke-primary/40" strokeWidth="1" />
        <text x="244" y="163" textAnchor="middle" className="fill-primary" fontSize="8" fontFamily="system-ui" fontWeight="600">
          Draft ready
        </text>
      </svg>
    </IllustrationShell>
  );
}
