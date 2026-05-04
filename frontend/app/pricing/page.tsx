import type { Metadata } from "next";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { PricingPlans } from "@/components/landing/pricing-plans";

export const metadata: Metadata = {
  title: "Pricing — Bloggr",
  description: "Simple plans for AI-powered blogging, campaigns, and scheduling. Start with a 14-day free trial.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />
      <PricingPlans />
      <LandingFooter />
    </div>
  );
}
