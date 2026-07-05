const WITH_BLOGGR = [
  "One onboarding. Then have conversations. Posts stay on-brand from draft one.",
  "Plan, generate, and publish in one workspace. Your strategy and execution live together.",
  "Talk naturally about your business. Bloggr fills in the gaps. It gets faster the more you talk.",
];

const WITHOUT_BLOGGR = [
  "Brief ChatGPT, get generic output, spend hours revising. Next post, start over. Brief again.",
  "Jump between ChatGPT, Google Docs, email drafts, and your CMS. Everything's scattered.",
  "You're writing prompts, not having conversations. Every prompt has to be perfect. Shorter, you get worse output. Longer, it's exhausting.",
];

export function DifferenceSection() {
  return (
    <section id="difference" className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/60 scroll-mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 lg:mb-12">
          <span className="landing-eyebrow mb-3 block">The difference</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          <div className="order-1 md:order-2 rounded-2xl border border-primary/30 bg-primary/5 p-6 lg:p-8">
            <h3 className="landing-card-title text-white mb-4">With Bloggr</h3>
            <ul className="space-y-3">
              {WITH_BLOGGR.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-gray-300 leading-relaxed">
                  <span className="text-primary shrink-0">+</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="order-2 md:order-1 rounded-2xl border border-gray-800 bg-gray-900/30 p-6 lg:p-8">
            <h3 className="landing-card-title text-gray-400 mb-4">Without Bloggr</h3>
            <ul className="space-y-3">
              {WITHOUT_BLOGGR.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-gray-500 leading-relaxed">
                  <span className="text-gray-600 shrink-0">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
