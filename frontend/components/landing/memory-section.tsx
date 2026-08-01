import { Reveal } from "./reveal";
import { ProductMock } from "./product-mock";
import { MEMORY } from "@/lib/landing/landing-copy";

export function MemorySection() {
  return (
    <section id="memory" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
        <Reveal>
          <span className="landing-eyebrow mb-3 block">{MEMORY.eyebrow}</span>
          <h2 className="landing-section-title text-white mb-4">{MEMORY.h2}</h2>
          <p className="landing-body mb-6">{MEMORY.body}</p>
          <ul className="space-y-3">
            {MEMORY.bullets.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-gray-300">
                <span className="text-primary shrink-0">+</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delayMs={60}>
          <ProductMock
            variant="memory"
            alt="Business memory showing remembered audience, USP, and objections"
            annotation={MEMORY.annotation}
          />
        </Reveal>
      </div>
    </section>
  );
}
