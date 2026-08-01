"use client";

import Link from "next/link";
import { Atmosphere } from "./atmosphere";
import { ProductMock } from "./product-mock";
import { StartFreeButton } from "./start-free-button";
import { HERO, LANDING_CTAS } from "@/lib/landing/landing-copy";

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative min-h-0 lg:min-h-[78vh] flex items-center justify-center px-6 lg:px-8 py-16 lg:py-24 overflow-hidden scroll-mt-20"
    >
      <Atmosphere />
      <div
        className="absolute inset-x-0 bottom-0 h-[42%] opacity-30 pointer-events-none [mask-image:linear-gradient(to_bottom,transparent,black_35%,transparent)]"
        aria-hidden
      >
        <div className="max-w-5xl mx-auto px-8 translate-y-10">
          <ProductMock variant="workspace" decorative className="scale-[0.95] origin-top" />
        </div>
      </div>

      <div className="relative max-w-3xl mx-auto text-center z-10">
        <p className="landing-eyebrow mb-4 font-display text-sm tracking-[0.2em]">{HERO.eyebrow}</p>
        <h1 className="landing-hero-title text-white mb-5 font-display tracking-[0.04em] motion-safe:animate-[landing-hero-in_0.8s_ease-out]">
          {HERO.h1}
        </h1>
        <p className="landing-lead text-gray-300 max-w-xl mx-auto mb-10">{HERO.subhead}</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <StartFreeButton size="lg" />
          <Link
            href="/#how-it-works"
            className="inline-flex items-center justify-center min-h-[48px] px-8 rounded-lg border border-gray-700 text-white text-base font-medium hover:bg-gray-900 hover:border-gray-600 transition-colors"
          >
            {LANDING_CTAS.seeHow}
          </Link>
        </div>
        <p className="landing-caption text-gray-400 mt-6">{LANDING_CTAS.trustLine}</p>
      </div>
    </section>
  );
}
