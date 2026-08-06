import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Strategist pipeline — research → draft → quality → publish loop. */
export function IllustrationPipeline({
  className = "",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  const steps = [
    { x: 28, label: "Research" },
    { x: 84, label: "Draft" },
    { x: 140, label: "Quality" },
    { x: 196, label: "Publish" },
  ];

  return (
    <IllustrationShell className={className} animated={animated}>
      <svg viewBox="0 0 240 176" className="h-full w-full" fill="none" aria-hidden>
        <path
          d="M40 72 H200"
          className={cn("stroke-primary/30", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M200 72 C220 72 220 120 120 128 C40 136 28 100 40 72"
          className={cn("stroke-primary/25", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="1.5"
          fill="none"
        />

        {steps.map((step, i) => (
          <g key={step.label} transform={`translate(${step.x} 52)`}>
            <circle
              cx="12"
              cy="20"
              r="16"
              className={i < 3 ? "fill-primary/20 stroke-primary" : "fill-white/[0.06] stroke-white/20"}
              strokeWidth="1.5"
            />
            <text
              x="12"
              y="24"
              textAnchor="middle"
              className={i < 3 ? "fill-primary" : "fill-white/50"}
              fontSize="9"
              fontFamily="system-ui"
              fontWeight="700"
            >
              {i + 1}
            </text>
            <text x="12" y="52" textAnchor="middle" className="fill-white/45" fontSize="7" fontFamily="system-ui">
              {step.label}
            </text>
          </g>
        ))}

        <circle
          cx="120"
          cy="128"
          r="6"
          className={cn("fill-primary", animated && "motion-safe:animate-landing-pulse-soft")}
        />
        <text x="120" y="150" textAnchor="middle" className="fill-primary/80" fontSize="8" fontFamily="system-ui" fontWeight="600">
          One loop
        </text>
      </svg>
    </IllustrationShell>
  );
}
