import { Reveal } from "./reveal";
import { PROBLEM } from "@/lib/landing/landing-copy";

export function ProblemSection() {
  return (
    <section className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="landing-section-title text-white text-center mb-4">{PROBLEM.h2}</h2>
          <p className="landing-body text-center max-w-2xl mx-auto mb-12 lg:mb-14">{PROBLEM.lead}</p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <Reveal delayMs={40}>
            <div className="border-t border-gray-800 pt-6">
              <h3 className="landing-card-title text-white mb-4">{PROBLEM.leftTitle}</h3>
              <ul className="space-y-3">
                {PROBLEM.leftBullets.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-gray-400 leading-relaxed">
                    <span className="text-gray-600 shrink-0">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div className="border-t border-primary/40 pt-6">
              <h3 className="landing-card-title text-white mb-4">{PROBLEM.rightTitle}</h3>
              <ul className="space-y-3">
                {PROBLEM.rightBullets.map((item) => (
                  <li key={item} className="flex gap-2 text-sm text-gray-300 leading-relaxed">
                    <span className="text-primary shrink-0">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
