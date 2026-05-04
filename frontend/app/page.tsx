"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { FileEdit, CheckCircle2, CalendarClock } from "lucide-react";

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
          <p className="text-sm font-medium text-primary mb-4 tracking-wide uppercase">
            14-day free trial · No credit card
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-5 leading-[1.12]">
            Ship better blog content,
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">
              faster
            </span>
            .
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Write with blocks, tighten posts with AI review, and schedule campaigns—one workspace, full control.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center flex-wrap">
            {!isAuthenticated && (
              <>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold rounded-lg shadow-lg shadow-primary/20">
                    Start free trial
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button
                    variant="outline"
                    className="border border-gray-600 text-gray-300 hover:bg-gray-800/80 hover:text-white px-8 py-6 text-base font-medium rounded-lg"
                  >
                    View plans
                  </Button>
                </Link>
                <Link
                  href="/auth/login"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors sm:ml-1"
                >
                  Sign in
                </Link>
              </>
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

      <section className="py-12 lg:py-16 px-6 border-y border-gray-800/80">
        <p className="text-center text-gray-500 text-sm max-w-lg mx-auto">
          Built for teams who want impact without tool sprawl.
        </p>
      </section>

      <section id="features" className="py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">From idea to execution, in one workflow</h2>
            <p className="text-gray-500 text-base max-w-2xl mx-auto">
              Generate content, sharpen quality with AI review, and run campaigns with less friction-so your team ships
              faster without losing standards.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <article className="h-full rounded-2xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-primary/90 mb-3">Content</span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <FileEdit className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Blog generation</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                Move from idea to structured drafts quickly with reusable blocks and cleaner first-pass writing.
              </p>
              <a href="/auth/signup" className="mt-5 text-sm text-primary/90 hover:text-primary transition-colors">
                Explore generation {"->"}
              </a>
            </article>

            <article className="h-full rounded-2xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-primary/90 mb-3">AI Review</span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Quality checks</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                Tighten readability, SEO clarity, and message quality before publishing with practical suggestions.
              </p>
              <a href="/auth/signup" className="mt-5 text-sm text-primary/90 hover:text-primary transition-colors">
                Explore review {"->"}
              </a>
            </article>

            <article className="h-full rounded-2xl border border-gray-800 bg-gray-900/40 p-6 flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wide text-primary/90 mb-3">Campaigns</span>
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <CalendarClock className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Execution flow</h3>
              <p className="text-sm text-gray-400 leading-relaxed flex-1">
                Plan content calendars and campaign timelines so your strategy ships with fewer handoff delays.
              </p>
              <a href="/auth/signup" className="mt-5 text-sm text-primary/90 hover:text-primary transition-colors">
                Explore campaigns {"->"}
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Why use Bloggr</h2>
            <p className="text-gray-500 text-base max-w-2xl mx-auto">
              Publish with more confidence and less operational drag across your full content workflow.
            </p>
          </div>
          <ul className="max-w-4xl mx-auto border-y border-gray-800/80 divide-y divide-gray-800/80">
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">01</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Proper SEO support</h3>
                <p className="text-sm text-gray-400">
                  Improve structure, readability, and optimization signals before every post goes live.
                </p>
              </div>
            </li>
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">02</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Fact-checking workflow</h3>
                <p className="text-sm text-gray-400">
                  Catch weak claims early and refine content for stronger credibility and trust.
                </p>
              </div>
            </li>
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">03</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Faster writing</h3>
                <p className="text-sm text-gray-400">
                  Move from prompt to polished draft quickly while keeping editorial standards intact.
                </p>
              </div>
            </li>
            <li className="py-6 sm:py-7 grid grid-cols-[auto_1fr] gap-4 sm:gap-6 items-start">
              <span className="text-xs sm:text-sm font-medium text-primary mt-1">04</span>
              <div>
                <h3 className="text-lg font-semibold text-white mb-1.5">Smoother strategy execution</h3>
                <p className="text-sm text-gray-400">
                  Align writing, review, and campaign scheduling so your team executes with less friction.
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
          <p className="text-xs sm:text-sm font-medium text-primary tracking-wide uppercase mb-3">
            14-day free trial · No credit card
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Try it free and publish with confidence</h2>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto mb-7">
            Start with a focused workflow for generation, review, and campaign execution. Upgrade only when you are
            ready.
          </p>
          {!isAuthenticated ? (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/auth/signup">
                <Button className="bg-primary hover:bg-primary/90 text-white px-7 py-5 text-sm font-semibold rounded-lg shadow-lg shadow-primary/25 w-full sm:w-auto">
                  Start free trial
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  variant="outline"
                  className="border border-gray-600 text-gray-300 hover:bg-gray-800/80 hover:text-white px-7 py-5 text-sm rounded-lg w-full sm:w-auto"
                >
                  See pricing
                </Button>
              </Link>
            </div>
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
