import { Reveal } from "./reveal";
import { SOCIAL_PROOF } from "@/lib/landing/landing-copy";

export function SocialProofSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="landing-section-title text-white text-center mb-12">{SOCIAL_PROOF.h2}</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {SOCIAL_PROOF.quotes.map((quote, i) => (
            <Reveal key={quote} delayMs={i * 50}>
              <blockquote className="border border-gray-800 rounded-2xl p-6 h-full flex flex-col">
                <p className="text-gray-300 text-sm leading-relaxed flex-1">&ldquo;{quote}&rdquo;</p>
                <footer className="mt-4 text-xs text-gray-500">{SOCIAL_PROOF.attribution}</footer>
              </blockquote>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
