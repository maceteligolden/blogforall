import { WaitlistEmailForm } from "./waitlist-email-form";

export function WaitlistHero() {
  return (
    <section
      id="waitlist-hero"
      className="relative min-h-0 lg:min-h-[70vh] flex items-center justify-center px-6 lg:px-8 py-16 lg:py-24 overflow-hidden scroll-mt-20"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_30%,rgba(30,64,175,0.12),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black_30%,transparent_100%)] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center">
        <h1 className="landing-hero-title text-white mb-5">
          Get context-aware blog posts by talking about your business.
        </h1>
        <p className="landing-lead text-gray-400 max-w-xl mx-auto mb-10">
          For founders, marketers, creators, and agencies who&apos;d rather talk about their business than wrestle
          with a blank doc.
        </p>
        <WaitlistEmailForm inputId="waitlist-email-hero" />
        <p className="landing-caption text-gray-500 mt-6">Join 400+ marketers already on the waitlist.</p>
      </div>
    </section>
  );
}
