import { Gift, Rocket, Users } from "lucide-react";
import { WaitlistEmailForm } from "./waitlist-email-form";

const PERKS = [
  {
    icon: Gift,
    label: "Founding-member pricing",
  },
  {
    icon: Rocket,
    label: "Private beta invite",
  },
  {
    icon: Users,
    label: "Lifetime access when you share with your team",
  },
] as const;

export function LaunchSection() {
  return (
    <section id="launch" className="relative py-16 sm:py-20 lg:py-28 px-6 lg:px-8 overflow-hidden scroll-mt-20">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_35%,rgba(30,64,175,0.12),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black_20%,transparent_100%)] pointer-events-none" />

      <div className="relative max-w-3xl mx-auto text-center">
        <span className="landing-eyebrow mb-4 block">Launch timeline</span>
        <h2 className="landing-section-title text-white mb-4">We launch by mid July 2026.</h2>
        <p className="landing-body text-gray-400 max-w-xl mx-auto mb-8">
          Early access gets you founding-member pricing, a private beta invite, and a shot at lifetime access when you
          share Bloggr with your team.
        </p>

        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 mb-10">
          {PERKS.map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 text-sm text-gray-300 border border-gray-800 rounded-full px-4 py-2 bg-gray-900/40"
            >
              <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden />
              {label}
            </span>
          ))}
        </div>

        <WaitlistEmailForm inputId="waitlist-email-launch" />
        <p className="landing-caption text-gray-500 mt-6">Join 400+ marketers already on the waitlist.</p>
      </div>
    </section>
  );
}
