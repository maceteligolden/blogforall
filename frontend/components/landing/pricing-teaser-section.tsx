"use client";

import { Reveal } from "./reveal";
import { StartFreeButton } from "./start-free-button";
import { PRICING } from "@/lib/landing/landing-copy";
import { cn } from "@/lib/utils/cn";

export function PricingTeaserSection() {
  return (
    <section id="pricing" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-12 lg:mb-14">
            <h2 className="landing-section-title text-white mb-3">{PRICING.h2}</h2>
            <p className="landing-body max-w-xl mx-auto">{PRICING.subhead}</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
          {PRICING.plans.map((plan, i) => (
            <Reveal key={plan.name} delayMs={i * 40}>
              <article
                className={cn(
                  "relative h-full rounded-2xl border p-6 flex flex-col transition-colors",
                  plan.featured
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                    : "border-gray-800 bg-gray-900/20 hover:border-gray-700"
                )}
              >
                {plan.badge && (
                  <span
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap",
                      plan.featured ? "bg-primary text-white" : "bg-gray-800 text-gray-200 border border-gray-700"
                    )}
                  >
                    {plan.badge}
                  </span>
                )}
                <h3 className="text-xl font-bold text-white mb-1 mt-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-gray-500 text-sm">{plan.period}</span>}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-sm text-gray-300">
                      <span className="text-primary shrink-0" aria-hidden>
                        ✓
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <StartFreeButton
                  fullWidth
                  variant={plan.featured ? "primary" : "secondary"}
                  className={!plan.featured ? "border-gray-700" : undefined}
                />
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
