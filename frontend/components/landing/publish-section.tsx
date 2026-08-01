import Link from "next/link";
import { Reveal } from "./reveal";
import { ProductMock } from "./product-mock";
import { LANDING_CTAS, PUBLISH } from "@/lib/landing/landing-copy";

export function PublishSection() {
  return (
    <section id="publish" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="landing-section-title text-white mb-4">{PUBLISH.h2}</h2>
            <p className="landing-body">{PUBLISH.body}</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-8">
          <Reveal>
            <div className="border border-gray-800 rounded-2xl p-6 lg:p-8 h-full">
              <h3 className="landing-card-title text-white mb-3">{PUBLISH.pillarA.title}</h3>
              <p className="landing-body text-sm mb-6">{PUBLISH.pillarA.body}</p>
              <ProductMock variant="calendar" alt="In-app publishing calendar" />
            </div>
          </Reveal>
          <Reveal delayMs={60}>
            <div className="border border-gray-800 rounded-2xl p-6 lg:p-8 h-full">
              <h3 className="landing-card-title text-white mb-3">{PUBLISH.pillarB.title}</h3>
              <p className="landing-body text-sm mb-6">{PUBLISH.pillarB.body}</p>
              <ProductMock
                variant="api"
                alt="API key and public blogs endpoint example"
                annotation="Your frontend, Bloggr content"
              />
              <Link
                href="/docs"
                className="inline-block mt-4 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                {LANDING_CTAS.readDocs}
              </Link>
            </div>
          </Reveal>
        </div>

        <p className="landing-caption text-center max-w-2xl mx-auto">{PUBLISH.microcopy}</p>
      </div>
    </section>
  );
}
