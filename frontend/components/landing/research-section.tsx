import { Reveal } from "./reveal";
import { ProductMock } from "./product-mock";
import { RESEARCH } from "@/lib/landing/landing-copy";

export function ResearchSection() {
  return (
    <section id="research" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <Reveal className="lg:order-2">
          <span className="landing-eyebrow mb-3 block">{RESEARCH.eyebrow}</span>
          <h2 className="landing-section-title text-white mb-4">{RESEARCH.h2}</h2>
          <p className="landing-body mb-6">{RESEARCH.body}</p>
          <ul className="space-y-2 mb-6">
            {RESEARCH.dual.map((line) => (
              <li key={line} className="text-sm text-gray-300 border-l-2 border-primary/50 pl-3">
                {line}
              </li>
            ))}
          </ul>
          <p className="landing-caption">{RESEARCH.footnote}</p>
        </Reveal>
        <Reveal delayMs={60} className="lg:order-1">
          <ProductMock
            variant="research"
            alt="Research sources panel with cited references"
            annotation={RESEARCH.annotation}
          />
        </Reveal>
      </div>
    </section>
  );
}
