import { Reveal } from "./reveal";
import { AUDIENCE } from "@/lib/landing/landing-copy";

export function AudienceSection() {
  return (
    <section id="audience" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <Reveal>
          <h2 className="landing-section-title text-white text-center mb-12">{AUDIENCE.h2}</h2>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          {AUDIENCE.personas.map((p, i) => (
            <Reveal key={p.title} delayMs={i * 40}>
              <div className="border-t border-gray-800 pt-5">
                <h3 className="landing-card-title text-white mb-2">{p.title}</h3>
                <p className="landing-body text-sm">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <blockquote className="max-w-2xl mx-auto border-l-2 border-primary pl-6 sm:pl-8">
            <p className="landing-lead text-gray-300">{AUDIENCE.closing}</p>
          </blockquote>
        </Reveal>
      </div>
    </section>
  );
}
