"use client";

import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { HeroSection } from "./hero-section";
import { ProofStrip } from "./proof-strip";
import { ProblemSection } from "./problem-section";
import { ProductIntroSection } from "./product-intro-section";
import { WalkthroughSection } from "./walkthrough-section";
import { HowItWorksSection } from "./how-it-works-section";
import { MemorySection } from "./memory-section";
import { ResearchSection } from "./research-section";
import { CampaignsSection } from "./campaigns-section";
import { PublishSection } from "./publish-section";
import { WhyDifferentSection } from "./why-different-section";
import { CompareSection } from "./compare-section";
import { AudienceSection } from "./audience-section";
import { SocialProofSection } from "./social-proof-section";
import { PricingTeaserSection } from "./pricing-teaser-section";
import { FaqSection } from "./faq-section";
import { FinalCtaSection } from "./final-cta-section";

export function LandingPage() {
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
        <HeroSection />
        <ProofStrip />
        <ProblemSection />
        <ProductIntroSection />
        <WalkthroughSection />
        <HowItWorksSection />
        <MemorySection />
        <ResearchSection />
        <CampaignsSection />
        <PublishSection />
        <WhyDifferentSection />
        <CompareSection />
        <AudienceSection />
        <SocialProofSection />
        <PricingTeaserSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <LandingFooter />
    </div>
  );
}
