const STEPS = [
  {
    number: "01",
    title: "Onboard once",
    body: "Tell Bloggr about your positioning, voice, and audience. The AI remembers.",
  },
  {
    number: "02",
    title: "Plan in conversation",
    body: '"We\'re targeting early-stage founders. I want to explain payment infrastructure this month." Bloggr proposes a post series, angles, and a publishing calendar.',
  },
  {
    number: "03",
    title: "Draft stays on-brand",
    body: "Because Bloggr knows your voice, you don't have to prompt it endlessly. You talk like you're talking to a friend, and posts come back polished, consistent, ready to publish.",
  },
  {
    number: "04",
    title: "Ship from one place",
    body: "Draft, review, schedule, and publish from one place. No jumping between ChatGPT and your CMS. No copy-pasting. No context loss.",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 lg:mb-14">
          <h2 className="landing-section-title text-white mb-2">How Bloggr works</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {STEPS.map((step) => (
            <article
              key={step.number}
              className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6 lg:p-8"
            >
              <span className="text-xs font-medium text-primary/90 mb-3 block">{step.number}</span>
              <h3 className="landing-card-title text-white mb-3">{step.title}</h3>
              <p className="landing-body text-gray-400">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
