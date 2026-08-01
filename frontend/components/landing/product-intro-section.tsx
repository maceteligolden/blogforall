import { Reveal } from "./reveal";
import { ProductMock } from "./product-mock";
import { PRODUCT_INTRO } from "@/lib/landing/landing-copy";

export function ProductIntroSection() {
  return (
    <section id="product" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10 lg:mb-14">
            <span className="landing-eyebrow mb-3 block">{PRODUCT_INTRO.eyebrow}</span>
            <h2 className="landing-section-title text-white mb-4">{PRODUCT_INTRO.h2}</h2>
            <p className="landing-body">{PRODUCT_INTRO.body}</p>
          </div>
        </Reveal>
        <Reveal delayMs={60}>
          <ProductMock variant="workspace" alt="Bloggr workspace showing a conversation and a draft panel" />
        </Reveal>
      </div>
    </section>
  );
}
