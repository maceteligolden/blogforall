"use client";

import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import {
  WaitlistHero,
  WhyBloggrSection,
  HowItWorksSection,
  DifferenceSection,
  GenericAiSection,
  AudienceSection,
  LaunchSection,
} from "@/components/landing/waitlist";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <LandingHeader />

      <WaitlistHero />
      <WhyBloggrSection />
      <HowItWorksSection />
      <DifferenceSection />
      <GenericAiSection />
      <AudienceSection />
      <LaunchSection />

      <LandingFooter />
    </div>
  );
}
