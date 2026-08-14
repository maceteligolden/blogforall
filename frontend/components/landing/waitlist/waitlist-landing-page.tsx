"use client";

import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { WaitlistHero } from "./waitlist-hero";
import { WhyBloggrSection } from "./why-bloggr-section";
import { HowItWorksSection } from "./how-it-works-section";
import { DifferenceSection } from "./difference-section";
import { GenericAiSection } from "./generic-ai-section";
import { AudienceSection } from "./audience-section";
import { LaunchSection } from "./launch-section";

export function WaitlistLandingPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-clip">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-white focus:px-4 focus:py-2 focus:rounded-lg"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="main-content">
        <WaitlistHero />
        <WhyBloggrSection />
        <HowItWorksSection />
        <DifferenceSection />
        <GenericAiSection />
        <AudienceSection />
        <LaunchSection />
      </main>
      <LandingFooter />
    </div>
  );
}
