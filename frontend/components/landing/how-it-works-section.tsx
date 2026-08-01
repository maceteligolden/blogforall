import { Reveal } from "./reveal";
import { HOW_IT_WORKS } from "@/lib/landing/landing-copy";

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20"
    >
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="landing-section-title text-white text-center mb-12 lg:mb-14">{HOW_IT_WORKS.h2}</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {HOW_IT_WORKS.steps.map((step, i) => (
            <Reveal key={step.number} delayMs={i * 40}>
              <article className="rounded-2xl border border-gray-800 bg-gray-900/20 p-6 lg:p-8 hover:border-gray-700 transition-colors">
                <span className="text-xs font-medium text-primary/90 mb-3 block">{step.number}</span>
                <h3 className="landing-card-title text-white mb-3">{step.title}</h3>
                <p className="landing-body text-gray-400">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
