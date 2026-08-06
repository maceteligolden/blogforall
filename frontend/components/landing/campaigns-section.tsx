import { Reveal } from "./reveal";
import { IllustrationCampaign } from "./illustrations";
import { StartFreeButton } from "./start-free-button";
import { CAMPAIGNS } from "@/lib/landing/landing-copy";

export function CampaignsSection() {
  return (
    <section id="campaigns" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <Reveal>
            <span className="landing-eyebrow mb-3 block">{CAMPAIGNS.eyebrow}</span>
            <h2 className="landing-section-title text-white mb-4">{CAMPAIGNS.h2}</h2>
            <p className="landing-body mb-6">{CAMPAIGNS.body}</p>
            <ul className="space-y-3 mb-8">
              {CAMPAIGNS.bullets.map((b) => (
                <li key={b} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-primary shrink-0">+</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <StartFreeButton size="lg" />
          </Reveal>
          <Reveal delayMs={60}>
            <div>
              <IllustrationCampaign className="max-w-md mx-auto lg:ml-auto" />
              <p className="mt-3 text-center lg:text-right text-xs text-primary/90">{CAMPAIGNS.annotation}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
