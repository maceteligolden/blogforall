import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Editorial calendar — month grid with scheduled posts and detail rail. */
export function IllustrationCalendar({ className = "", animated = true }: { className?: string; animated?: boolean }) {
  return (
    <IllustrationShell className={className} animated={animated} wide>
      <svg viewBox="0 0 320 200" className="h-full w-full" fill="none" aria-hidden>
        <rect
          x="12"
          y="12"
          width="196"
          height="176"
          rx="14"
          className="fill-white/[0.04] stroke-white/12"
          strokeWidth="1"
        />
        <rect x="12" y="12" width="196" height="32" rx="14" className="fill-primary/15" />
        <rect x="12" y="32" width="196" height="12" className="fill-primary/15" />
        <text
          x="110"
          y="32"
          textAnchor="middle"
          className="fill-white/75"
          fontSize="11"
          fontFamily="system-ui"
          fontWeight="600"
        >
          Content calendar
        </text>

        {/* Weekday labels */}
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <text
            key={`${d}-${i}`}
            x={32 + i * 24}
            y="58"
            textAnchor="middle"
            className="fill-white/30"
            fontSize="7"
            fontFamily="system-ui"
          >
            {d}
          </text>
        ))}

        {/* Days */}
        {Array.from({ length: 28 }).map((_, i) => {
          const col = i % 7;
          const row = Math.floor(i / 7);
          const selected = i === 10;
          const hasPost = i === 10 || i === 17 || i === 22;
          return (
            <g key={i} transform={`translate(${20 + col * 24} ${68 + row * 26})`}>
              <rect
                width="20"
                height="20"
                rx="5"
                className={selected ? "fill-primary/25 stroke-primary" : "fill-white/[0.03] stroke-white/10"}
                strokeWidth="1"
              />
              <text x="10" y="13" textAnchor="middle" className="fill-white/45" fontSize="7" fontFamily="system-ui">
                {i + 1}
              </text>
              {hasPost && (
                <circle
                  cx="10"
                  cy="17"
                  r="1.6"
                  className={cn("fill-primary", selected && animated && "motion-safe:animate-landing-pulse-soft")}
                />
              )}
            </g>
          );
        })}

        {/* Detail panel */}
        <rect
          x="220"
          y="12"
          width="88"
          height="176"
          rx="14"
          className="fill-white/[0.05] stroke-primary/25"
          strokeWidth="1"
        />
        <text x="264" y="36" textAnchor="middle" className="fill-white/50" fontSize="8" fontFamily="system-ui">
          Aug 11
        </text>
        <rect
          x="232"
          y="48"
          width="64"
          height="52"
          rx="10"
          className="fill-primary/15 stroke-primary/40"
          strokeWidth="1"
        />
        <rect x="242" y="60" width="28" height="6" rx="3" className="fill-primary/80" />
        <rect x="242" y="72" width="44" height="3" rx="1.5" className="fill-white/35" />
        <rect x="242" y="80" width="36" height="2.5" rx="1" className="fill-white/15" />
        <text x="242" y="96" className="fill-white/40" fontSize="7" fontFamily="system-ui">
          5:00 PM
        </text>

        <rect
          x="232"
          y="112"
          width="64"
          height="40"
          rx="10"
          className="fill-white/[0.04] stroke-white/10"
          strokeWidth="1"
        />
        <rect x="242" y="124" width="36" height="3" rx="1.5" className="fill-white/20" />
        <rect x="242" y="132" width="28" height="2.5" rx="1" className="fill-white/10" />

        <path
          d="M208 90 H220"
          className={cn("stroke-primary/60", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </IllustrationShell>
  );
}
