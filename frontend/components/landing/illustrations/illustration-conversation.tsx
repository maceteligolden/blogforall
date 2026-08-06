import { cn } from "@/lib/utils/cn";
import { IllustrationShell } from "./illustration-shell";

/** Conversation OS — natural dialogue becoming structured work. */
export function IllustrationConversation({
  className = "",
  animated = true,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <IllustrationShell className={className} animated={animated}>
      <svg viewBox="0 0 240 176" className="h-full w-full" fill="none" aria-hidden>
        <rect x="20" y="28" width="70" height="30" rx="14" className="fill-primary/75" />
        <rect x="32" y="38" width="40" height="3" rx="1.5" className="fill-white/45" />
        <rect x="32" y="45" width="28" height="2.5" rx="1" className="fill-white/30" />

        <rect
          x="70"
          y="72"
          width="96"
          height="40"
          rx="14"
          className="fill-white/[0.08] stroke-white/15"
          strokeWidth="1"
        />
        <rect x="84" y="84" width="56" height="3" rx="1.5" className="fill-white/30" />
        <rect x="84" y="92" width="68" height="2.5" rx="1" className="fill-white/15" />
        <rect x="84" y="100" width="44" height="2.5" rx="1" className="fill-white/12" />

        <path
          d="M166 92 C190 92 198 56 214 48"
          className={cn("stroke-primary/50", animated && "motion-safe:animate-landing-dash-flow")}
          strokeWidth="1.75"
          fill="none"
        />

        <rect
          x="176"
          y="20"
          width="48"
          height="56"
          rx="10"
          className="fill-primary/15 stroke-primary/40"
          strokeWidth="1"
        />
        <rect x="186" y="32" width="28" height="3" rx="1.5" className="fill-white/35" />
        <rect x="186" y="40" width="20" height="2.5" rx="1" className="fill-white/15" />
        <rect x="186" y="52" width="24" height="12" rx="4" className="fill-primary/70" />

        <circle
          cx="120"
          cy="92"
          r="4"
          className={cn("fill-primary", animated && "motion-safe:animate-landing-pulse-soft")}
        />
      </svg>
    </IllustrationShell>
  );
}
