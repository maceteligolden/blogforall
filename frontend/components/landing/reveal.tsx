"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface RevealProps {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}

/**
 * Scroll enhancement only — content must remain readable if IO never fires.
 */
export function Reveal({ children, className, delayMs = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setEnhanced(true);
      return;
    }

    const revealNow = () => setEnhanced(true);

    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    if (inView) {
      revealNow();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          revealNow();
          observer.disconnect();
        }
      },
      { threshold: 0.01, rootMargin: "0px 0px -4% 0px" }
    );

    observer.observe(el);
    const fallback = window.setTimeout(revealNow, 2500);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "opacity-100",
        enhanced && !delayMs && "motion-safe:animate-[landing-fade_0.45s_ease-out]",
        className
      )}
      style={
        enhanced && delayMs
          ? {
              animation: "landing-fade 0.45s ease-out both",
              animationDelay: `${delayMs}ms`,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
