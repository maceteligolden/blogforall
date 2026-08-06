import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

type AuthGlassFrameProps = {
  children: ReactNode;
  className?: string;
  animated?: boolean;
};

/** Shared auth-style glass stack + ambient glow for landing motifs. */
export function AuthGlassFrame({ children, className, animated = true }: AuthGlassFrameProps) {
  return (
    <div className={cn("relative mx-auto w-full max-w-[220px] aspect-[5/4]", className)} aria-hidden>
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[48px]",
          animated && "motion-safe:animate-landing-glow-breathe"
        )}
      />

      <div
        className="absolute inset-x-5 top-[18%] h-[62%] rounded-2xl border border-white/[0.06] bg-white/[0.03] shadow-2xl shadow-black/40"
        style={{ transform: "rotate(-5deg) translateY(10px) scale(0.92)" }}
      />
      <div
        className="absolute inset-x-3 top-[12%] h-[66%] rounded-2xl border border-white/[0.08] bg-white/[0.05] shadow-2xl shadow-black/50"
        style={{ transform: "rotate(2.5deg) translateY(5px) scale(0.96)" }}
      />

      <div
        className={cn(
          "absolute inset-x-0 top-[6%] h-[72%] rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.12] to-white/[0.04] p-4 shadow-2xl shadow-black/60 backdrop-blur-xl overflow-hidden",
          animated && "motion-safe:animate-landing-float"
        )}
      >
        {children}
      </div>
    </div>
  );
}
