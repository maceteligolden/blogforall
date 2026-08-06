import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Research feature — sources converging into a cited brief. */
export function IllustrationResearch({
  className = "",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <IllustrationShell className={className} animated={animated} wide>
      <svg viewBox="0 0 320 200" className="h-full w-full" fill="none" aria-hidden>
        {/* Source nodes */}
        {[
          { x: 36, y: 36, label: "Web" },
          { x: 36, y: 96, label: "Docs" },
          { x: 36, y: 156, label: "Video" },
        ].map((src) => (
          <g key={src.label}>
            <rect x={src.x} y={src.y - 16} width="64" height="32" rx="10" className="fill-white/[0.06] stroke-white/15" strokeWidth="1" />
            <circle cx={src.x + 16} cy={src.y} r="5" className="fill-primary/70" />
            <text x={src.x + 28} y={src.y + 3} className="fill-white/50" fontSize="8" fontFamily="system-ui">
              {src.label}
            </text>
            <path
              d={`M${src.x + 64} ${src.y} C140 ${src.y} 150 100 168 100`}
              className={cn("stroke-primary/35", animated && "motion-safe:animate-landing-dash-flow")}
              strokeWidth="1.5"
              fill="none"
            />
          </g>
        ))}

        {/* Synthesis hub */}
        <circle
          cx="188"
          cy="100"
          r="22"
          className={cn("fill-primary/20 stroke-primary", animated && "motion-safe:animate-landing-pulse-soft")}
          strokeWidth="1.5"
        />
        <text x="188" y="104" textAnchor="middle" className="fill-white" fontSize="9" fontFamily="system-ui" fontWeight="700">
          AI
        </text>

        <path
          d="M210 100 H230"
          className={cn("stroke-primary/70", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Cited brief */}
        <rect x="236" y="40" width="72" height="120" rx="12" className="fill-white/[0.06] stroke-primary/30" strokeWidth="1" />
        <rect x="248" y="56" width="40" height="3" rx="1.5" className="fill-white/30" />
        <rect x="248" y="70" width="48" height="2.5" rx="1" className="fill-white/15" />
        <rect x="248" y="80" width="36" height="2.5" rx="1" className="fill-white/12" />
        <rect x="248" y="100" width="48" height="18" rx="6" className="fill-primary/15 stroke-primary/40" strokeWidth="1" />
        <text x="272" y="112" textAnchor="middle" className="fill-primary/90" fontSize="7" fontFamily="system-ui">
          3 sources
        </text>
        <rect x="248" y="130" width="40" height="2.5" rx="1" className="fill-white/12" />
        <rect x="248" y="140" width="32" height="2.5" rx="1" className="fill-white/10" />
      </svg>
    </IllustrationShell>
  );
}
