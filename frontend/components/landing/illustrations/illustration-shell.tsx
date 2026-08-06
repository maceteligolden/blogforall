import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type IllustrationShellProps = {
  children: ReactNode;
  className?: string;
  animated?: boolean;
  /** Wider compositions for feature sections */
  wide?: boolean;
};

/** Premium glass stage for landing motifs — ambient glow + soft float. */
export function IllustrationShell({ children, className, animated = true, wide = false }: IllustrationShellProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full",
        wide ? "max-w-md aspect-[16/11]" : "max-w-[280px] aspect-[5/4]",
        className
      )}
      aria-hidden
    >
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 top-[42%] h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[56px]",
          animated && "motion-safe:animate-landing-glow-breathe"
        )}
      />
      <div
        className={cn(
          "relative h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_24px_48px_-20px_rgba(0,0,0,0.75)] backdrop-blur-xl",
          animated && "motion-safe:animate-landing-float"
        )}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(30,64,175,0.22),transparent_70%)]" />
        <div className="relative h-full w-full p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
