import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type OnboardingChatLayoutProps = {
  firstName: string;
  children: ReactNode;
};

export function OnboardingChatLayout({ firstName, children }: OnboardingChatLayoutProps) {
  const greeting = firstName.trim() || "there";

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-black text-white lg:grid lg:grid-cols-2">
      <div className="relative flex shrink-0 flex-col justify-center overflow-hidden bg-[#0a0a0a] px-6 py-6 sm:px-8 lg:min-h-0 lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_20%,rgba(30,64,175,0.2),transparent_70%)]" />
        <div className="relative z-10 max-w-md space-y-3 lg:space-y-4">
          <p className="text-sm font-medium text-primary/80">Workspace setup</p>
          <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-white sm:text-[28px] lg:text-[36px]">
            Hey {greeting}, let&apos;s talk about your business.
          </h1>
          <p className="text-sm leading-relaxed text-white/50 sm:text-[15px]">
            What do you do? Share a sentence or two — I&apos;ll ask follow-ups to tailor content for your audience and
            voice.
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
