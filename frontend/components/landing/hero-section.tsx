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
      className="relative flex flex-col items-center justify-center px-6 lg:px-8 pt-16 lg:pt-24 pb-12 lg:pb-20 overflow-hidden scroll-mt-20"
    >
      <Atmosphere />

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

      <div className="relative z-10 w-full max-w-5xl mx-auto mt-12 lg:mt-16">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[72px] motion-safe:animate-landing-glow-breathe" />
        <ProductMock
          variant="workspace"
          alt="Bloggr workspace showing a conversation and a draft panel"
          priority
          className="motion-safe:animate-[landing-fade_0.45s_ease-out]"
        />
      </div>
    </section>
  );
}
