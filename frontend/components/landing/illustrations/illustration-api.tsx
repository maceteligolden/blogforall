import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** API — content brain feeding your frontend. */
export function IllustrationApi({
  className = "",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <IllustrationShell className={className} animated={animated} wide>
      <svg viewBox="0 0 320 200" className="h-full w-full" fill="none" aria-hidden>
        <rect x="20" y="40" width="112" height="120" rx="14" className="fill-white/[0.05] stroke-primary/30" strokeWidth="1" />
        <text x="76" y="68" textAnchor="middle" className="fill-primary/90" fontSize="9" fontFamily="system-ui" fontWeight="700">
          Bloggr API
        </text>
        <rect x="36" y="84" width="80" height="18" rx="6" className="fill-black/40 stroke-white/10" strokeWidth="1" />
        <text x="44" y="96" className="fill-primary" fontSize="8" fontFamily="ui-monospace, monospace">
          GET /blogs
        </text>
        <rect x="36" y="112" width="80" height="10" rx="3" className="fill-white/10" />
        <rect x="36" y="128" width="56" height="10" rx="3" className="fill-white/10" />

        <path
          d="M132 100 H168"
          className={cn("stroke-primary/70", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M166 94 L176 100 L166 106" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        <rect x="184" y="40" width="116" height="120" rx="14" className="fill-white/[0.04] stroke-white/12" strokeWidth="1" />
        <text x="242" y="68" textAnchor="middle" className="fill-white/50" fontSize="9" fontFamily="system-ui">
          Your frontend
        </text>
        <rect x="200" y="84" width="84" height="56" rx="10" className="fill-white/[0.06] stroke-white/10" strokeWidth="1" />
        <rect
          x="212"
          y="98"
          width="48"
          height="3"
          rx="1.5"
          className={cn("fill-white/25", animated && "motion-safe:animate-landing-type-sweep")}
        />
        <rect x="212" y="108" width="60" height="2.5" rx="1" className="fill-white/15" />
        <rect x="212" y="118" width="40" height="2.5" rx="1" className="fill-white/12" />
      </svg>
    </IllustrationShell>
  );
}
