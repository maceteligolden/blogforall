const REASONS = [
  {
    number: "01",
    title: "They're designed for prompting, not conversation",
    body: "ChatGPT is good at answering questions. It's exhausting for generating a month's worth of blog content. Every post requires a detailed prompt. You end up writing a brief for every single post. Bloggr reverses this. You brief once. Then you converse.",
  },
  {
    number: "02",
    title: "They don't retain context",
    body: "You explain your audience, your positioning, your voice, and then it's gone after one blog post. Next conversation, you explain it again. With Bloggr, that context stays loaded. Posts stay consistent without you having to repeat yourself.",
  },
  {
    number: "03",
    title: "They generate in isolation",
    body: "Generic AI doesn't see the big picture. No campaign thinking. No audience sequencing. No publishing strategy. Bloggr thinks in campaigns. It knows what you posted last week and what you're targeting next.",
  },
  {
    number: "04",
    title: "You lose the ability to steer",
    body: "You either prompt-engineer forever or let the AI run wild. Bloggr is collaborative. The AI proposes. You course-correct. You stay in control of your voice and your publishing calendar.",
  },
] as const;

export function GenericAiSection() {
  return (
    <section
      id="why-not-generic"
      className="py-16 sm:py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/60 scroll-mt-20"
    >
      <div className="max-w-6xl mx-auto">
        <h2 className="landing-section-title text-white mb-2 text-center">Why generic AI tools fall short.</h2>
        <p className="landing-body text-gray-500 max-w-2xl mx-auto text-center mb-12 lg:mb-14">
          Built for Q&amp;A, not for a month of on-brand content.
        </p>

        <ul className="max-w-4xl mx-auto border-y border-gray-800/80 divide-y divide-gray-800/80">
          {REASONS.map((reason) => (
            <li key={reason.number} className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">{reason.number}</span>
              <div>
                <h3 className="landing-card-title text-white mb-1.5">{reason.title}</h3>
                <p className="landing-body text-gray-400">{reason.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
