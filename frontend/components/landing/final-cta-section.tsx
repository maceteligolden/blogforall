import Link from "next/link";
import { Atmosphere } from "./atmosphere";
import { StartFreeButton } from "./start-free-button";
import { FINAL_CTA, LANDING_CTAS } from "@/lib/landing/landing-copy";

export function FinalCtaSection() {
  return (
    <section className="relative py-16 sm:py-20 lg:py-28 px-6 lg:px-8 overflow-hidden">
      <Atmosphere />
      <div className="relative max-w-2xl mx-auto text-center">
        <h2 className="landing-section-title text-white mb-4">{FINAL_CTA.h2}</h2>
        <p className="landing-body mb-8">{FINAL_CTA.body}</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
          <StartFreeButton size="lg" label={LANDING_CTAS.getEarlyAccess} />
          <Link
            href="/contact"
            className="inline-flex items-center justify-center min-h-[48px] px-8 rounded-lg border border-gray-700 text-white text-base font-medium hover:bg-gray-900 transition-colors"
          >
            {LANDING_CTAS.contact}
          </Link>
        </div>
        <p className="landing-caption mt-6">{FINAL_CTA.trust}</p>
      </div>
    </section>
  );
}
