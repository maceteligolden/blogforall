"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { Sparkles } from "lucide-react";
import {
  IllustrationEditor,
  IllustrationReview,
  IllustrationCalendar,
} from "@/components/landing/illustrations";

const ORCHESTRATOR_PROMPTS = [
  "Draft a post about our Q2 launch",
  "Plan a 4-week campaign for developers",
  "What drafts are waiting for review?",
];

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      <section className="relative min-h-[68vh] lg:min-h-[78vh] flex items-center justify-center px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_30%,rgba(30,64,175,0.12),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black_30%,transparent_100%)] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5 leading-[1.12]">
            Your blog workspace,
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              run by conversation
            </span>
            .
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            An AI that remembers your business—drafts posts, plans campaigns, and schedules content. You steer with
            plain language, not essay-length prompts.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center flex-wrap">
            {!isAuthenticated && (
              <Link href="/auth/signup">
                <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold rounded-lg shadow-lg shadow-primary/20">
                  Start free
                </Button>
              </Link>
            )}
            {isAuthenticated && (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold rounded-lg">
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      <section id="orchestrator" className="py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-primary/90 mb-3 block">
              Workspace orchestrator
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">One AI oversees your entire workspace</h2>
            <p className="text-gray-400 text-base leading-relaxed mb-4">
              Open Ask AI and tell it what you need in everyday language. The workspace orchestrator can draft posts,
              plan campaigns, add categories, and schedule publishing—always scoped to your site and always asking before
              it changes anything important.
            </p>
            <p className="text-gray-500 text-sm leading-relaxed">
              It builds on workspace memory from onboarding and past chats, so you are not re-explaining your product
              every session.
            </p>
            <div className="flex flex-wrap gap-2 mt-8">
              {ORCHESTRATOR_PROMPTS.map((prompt) => (
                <span
                  key={prompt}
                  className="text-xs text-gray-300 border border-gray-700 rounded-full px-3 py-1.5 bg-gray-900/60"
                >
                  &ldquo;{prompt}&rdquo;
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/40 bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-white">Ask AI</p>
                <p className="text-xs text-gray-500">Workspace orchestrator</p>
              </div>
            </div>
            <div className="rounded-lg border border-gray-800 bg-black/40 px-4 py-3 mb-3">
              <p className="text-xs text-gray-500 mb-1">You</p>
              <p className="text-sm text-gray-200">
                Plan a launch campaign for our new API—four posts over three weeks.
              </p>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 mb-4">
              <p className="text-xs text-primary/80 mb-1">Orchestrator</p>
              <p className="text-sm text-gray-300">
                I will propose a campaign with goals, audience, and a post schedule. Confirm when you are ready and I
                will create the drafts.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] uppercase tracking-wide text-primary/90 border border-primary/30 rounded px-2 py-1">
                create_campaign
              </span>
              <span className="text-[10px] uppercase tracking-wide text-primary/90 border border-primary/30 rounded px-2 py-1">
                schedule_posts
              </span>
              <span className="text-[10px] uppercase tracking-wide text-gray-500 border border-gray-700 rounded px-2 py-1">
                await_confirm
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Generation, strategy, and execution—in one workspace
            </h2>
            <p className="text-gray-500 text-base max-w-2xl mx-auto">
              Blog generation, campaign planning, and review/scheduling share the same context so your content strategy
              stays coherent from first draft to publish.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <article className="h-full rounded-2xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-primary/90 mb-3">Blog generation</span>
              <IllustrationEditor className="w-full h-24 mb-4 opacity-90" />
              <h3 className="text-xl font-semibold text-white mb-3">Context-aware drafts</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                Generate posts grounded in workspace memory and your niche—shorter prompts, on-brand first drafts
                without re-stating who you are every time.
              </p>
              <Link href="/auth/signup" className="mt-5 text-sm text-primary/90 hover:text-primary transition-colors">
                Explore generation {"->"}
              </Link>
            </article>

            <article className="h-full rounded-2xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-primary/90 mb-3">
                Campaigns &amp; strategy
              </span>
              <IllustrationCalendar className="w-full h-24 mb-4 opacity-90" />
              <h3 className="text-xl font-semibold text-white mb-3">Plan before you publish</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                Chat through campaign goals, audience, and calendars. The AI proposes scheduled posts aligned to your
                strategy—not a disconnected content calendar.
              </p>
              <Link href="/auth/signup" className="mt-5 text-sm text-primary/90 hover:text-primary transition-colors">
                Explore campaigns {"->"}
              </Link>
            </article>

            <article className="h-full rounded-2xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-primary/90 mb-3">
                Review &amp; execution
              </span>
              <IllustrationReview className="w-full h-24 mb-4 opacity-90" />
              <h3 className="text-xl font-semibold text-white mb-3">Ship with confidence</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                AI review tightens readability and SEO signals. Scheduling and approvals turn strategy into published
                posts without losing editorial control.
              </p>
              <Link href="/auth/signup" className="mt-5 text-sm text-primary/90 hover:text-primary transition-colors">
                Explore review {"->"}
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/60 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Less prompting. More publishing.</h2>
            <p className="text-gray-500 text-base max-w-2xl mx-auto">
              Bloggr remembers what matters about your business so you can move at the speed of a conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-6 lg:p-8">
              <h3 className="text-lg font-semibold text-gray-400 mb-4">Without Bloggr</h3>
              <ul className="space-y-3 text-sm text-gray-500">
                <li className="flex gap-2">
                  <span className="text-gray-600 shrink-0">—</span>
                  <span>Repeat positioning, audience, and tone in every new prompt</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-600 shrink-0">—</span>
                  <span>Context lost between generation, planning, and scheduling tools</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-gray-600 shrink-0">—</span>
                  <span>Long briefs before the AI can produce anything useful</span>
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 lg:p-8">
              <h3 className="text-lg font-semibold text-white mb-4">With Bloggr</h3>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">+</span>
                  <span>Onboarding plus workspace memory that builds over time</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">+</span>
                  <span>Say &ldquo;write a post on our new API&rdquo;—the AI already knows your product and voice</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-primary shrink-0">+</span>
                  <span>One orchestrator handles drafts, campaigns, and schedules in the same workspace</span>
                </li>
              </ul>
            </div>
          </div>
          <p className="text-center mt-10">
            <span className="inline-block text-sm font-medium text-primary border border-primary/30 rounded-full px-4 py-2 bg-primary/10">
              Less prompting. More publishing.
            </span>
          </p>
        </div>
      </section>

      <section className="py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 text-center">Why use Bloggr</h2>
          <p className="text-gray-500 text-base max-w-2xl mx-auto text-center mb-14">
            A content workspace built around AI that knows your business—not another blank editor.
          </p>
          <ul className="max-w-4xl mx-auto border-y border-gray-800/80 divide-y divide-gray-800/80">
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">01</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">AI that knows your workspace</h3>
                <p className="text-sm text-gray-400">
                  Workspace memory carries context across chats and tools—your positioning, topics, and habits stay
                  available when you generate or plan.
                </p>
              </div>
            </li>
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">02</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Control by conversation</h3>
                <p className="text-sm text-gray-400">
                  Create drafts, plan campaigns, and schedule posts through natural language. The orchestrator confirms
                  before meaningful changes land in your workspace.
                </p>
              </div>
            </li>
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">03</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Faster first drafts</h3>
                <p className="text-sm text-gray-400">
                  Generation is grounded in your business and editorial standards—not generic templates that ignore what
                  you sell and who you serve.
                </p>
              </div>
            </li>
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">04</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Strategy that ships</h3>
                <p className="text-sm text-gray-400">
                  Move from campaign idea to scheduled posts, review, and publish in one flow—so strategy does not stall
                  in spreadsheets.
                </p>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="relative py-20 lg:py-28 px-6 border-t border-gray-800/80 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_65%_at_50%_35%,rgba(30,64,175,0.12),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_35%,black_20%,transparent_100%)] pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            Start free—set up your workspace and talk to your AI in minutes
          </h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-7">
            Create your workspace, share what you publish about, and let the orchestrator handle the rest through
            conversation.
          </p>
          {!isAuthenticated ? (
            <Link href="/auth/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white px-7 py-5 text-sm font-semibold rounded-lg shadow-lg shadow-primary/25 w-full sm:w-auto">
                Start free
              </Button>
            </Link>
          ) : (
            <Link href="/dashboard">
              <Button className="bg-primary hover:bg-primary/90 text-white px-7 py-5 text-sm font-semibold rounded-lg shadow-lg shadow-primary/25">
                Dashboard
              </Button>
            </Link>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
