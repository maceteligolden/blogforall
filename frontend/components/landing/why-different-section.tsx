import { Reveal } from "./reveal";
import { WHY_DIFFERENT } from "@/lib/landing/landing-copy";

export function WhyDifferentSection() {
  return (
    <section id="why-bloggr" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="landing-section-title text-white text-center mb-12 lg:mb-14">{WHY_DIFFERENT.h2}</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 md:divide-x md:divide-gray-800">
          {WHY_DIFFERENT.pillars.map((pillar, i) => (
            <Reveal key={pillar.title} delayMs={i * 50}>
              <div className="md:px-8 first:md:pl-0 last:md:pr-0">
                <h3 className="landing-card-title text-white mb-3">{pillar.title}</h3>
                <p className="landing-body text-sm">{pillar.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
