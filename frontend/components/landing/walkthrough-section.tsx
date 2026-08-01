"use client";

import { useEffect, useRef, useState } from "react";
import { ProductMock } from "./product-mock";
import { StartFreeButton } from "./start-free-button";
import { LANDING_CTAS, WALKTHROUGH } from "@/lib/landing/landing-copy";
import { cn } from "@/lib/utils/cn";

const STAGE_VARIANTS = ["goal", "context", "research", "draft", "calendar"] as const;

export function WalkthroughSection() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const observers: IntersectionObserver[] = [];
    stepRefs.current.forEach((el, index) => {
      if (!el) return;
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) setActive(index);
        },
        { threshold: 0.55, rootMargin: "-20% 0px -35% 0px" }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const variant = STAGE_VARIANTS[active] ?? "goal";
  const step = WALKTHROUGH.steps[active];

  return (
    <section id="walkthrough" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <h2 className="landing-section-title text-white text-center mb-12 lg:mb-16 max-w-3xl mx-auto">
          {WALKTHROUGH.h2}
        </h2>

        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 lg:items-start">
          <ol className="space-y-8 lg:space-y-0 lg:sticky lg:top-28">
            {WALKTHROUGH.steps.map((s, index) => (
              <li
                key={s.id}
                ref={(el) => {
                  stepRefs.current[index] = el;
                }}
                className={cn(
                  "lg:py-6 border-l-2 pl-4 transition-colors duration-300",
                  active === index ? "border-primary" : "border-gray-800"
                )}
              >
                <button
                  type="button"
                  onClick={() => setActive(index)}
                  className="text-left w-full"
                  aria-current={active === index ? "step" : undefined}
                >
                  <span className="text-xs font-medium text-primary/90 mb-1 block">{s.number}</span>
                  <h3
                    className={cn(
                      "landing-card-title mb-2 transition-colors",
                      active === index ? "text-white" : "text-gray-500"
                    )}
                  >
                    {s.title}
                  </h3>
                  <p className={cn("landing-body text-sm", active === index ? "text-gray-400" : "text-gray-600")}>
                    {s.body}
                  </p>
                </button>

                <div className="lg:hidden mt-4">
                  <ProductMock
                    variant={STAGE_VARIANTS[index]}
                    alt={`Walkthrough step ${s.number}: ${s.title}`}
                    annotation={s.title}
                  />
                </div>
              </li>
            ))}
          </ol>

          <div className="hidden lg:block lg:sticky lg:top-28">
            <ProductMock
              key={variant}
              variant={variant}
              alt={step ? `Walkthrough: ${step.title}` : "Product walkthrough"}
              annotation={step?.title}
              className="motion-safe:animate-[landing-fade_0.35s_ease-out]"
            />
          </div>
        </div>

        <div className="mt-12 lg:mt-16 flex flex-col sm:flex-row items-center justify-center gap-3">
          <StartFreeButton size="lg" />
          <a
            href="#product"
            className="text-sm text-gray-400 hover:text-white transition-colors underline-offset-4 hover:underline"
          >
            {LANDING_CTAS.watchOverview}
          </a>
        </div>
      </div>
    </section>
  );
}
