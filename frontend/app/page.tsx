"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { Calendar, Users, Target, Wand2, FileEdit, CheckCircle2, CalendarClock } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      {/* Hero — Strapi-inspired: one clear value prop, one subline, primary CTA + secondary link */}
      <section className="relative min-h-[78vh] flex items-center justify-center px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_30%,rgba(30,64,175,0.12),transparent_55%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black_30%,transparent_100%)] pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.15]">
            The blog platform for
            <br />
            <span className="bg-gradient-to-r from-primary via-blue-400 to-primary bg-clip-text text-transparent">AI-powered content</span>
            <br />
            and campaigns.
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Design your posts, get AI review and suggestions, and schedule or publish on a calendar—with full control of your content and workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!isAuthenticated && (
              <>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold rounded-lg shadow-lg shadow-primary/20">
                    Start free
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" className="border border-gray-600 text-gray-300 hover:bg-gray-800/80 hover:text-white px-8 py-6 text-base font-medium rounded-lg">
                    Sign in
                  </Button>
                </Link>
                <a href="#features" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-primary transition-colors sm:ml-1">
                  See how it works
                  <span aria-hidden>→</span>
                </a>
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

      {/* Proof strip */}
      <section className="py-8 px-6 border-y border-gray-800/80">
        <p className="text-center text-gray-500 text-sm max-w-2xl mx-auto">
          From idea to published post in one place. Trusted by teams to ship content on schedule.
        </p>
      </section>

      {/* Features — Strapi-style: section title + subtitle, then feature cards with category labels */}
      <section id="features" className="py-20 lg:py-28 px-6 lg:px-8 border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Bloggr Features</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Every feature you need to create, review, and publish your blog.
            </p>
          </div>
          <div className="space-y-20 lg:space-y-24">
            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-4">
                  Content
                </span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <FileEdit className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">Design your blog your way</h3>
                <p className="text-gray-400 leading-relaxed">
                  Build posts with a rich block editor: headings, paragraphs, lists, images, and code. Format once, publish everywhere. No coding required.
                </p>
              </div>
              <div className="h-44 lg:h-52 rounded-2xl bg-gray-900/90 border border-gray-800 flex items-center justify-center">
                <p className="text-gray-600 text-sm">Editor preview</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div className="order-2 lg:order-1 h-44 lg:h-52 rounded-2xl bg-gray-900/90 border border-gray-800 flex items-center justify-center">
                <p className="text-gray-600 text-sm">Review dashboard</p>
              </div>
              <div className="order-1 lg:order-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-4">
                  AI
                </span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">AI blog review</h3>
                <p className="text-gray-400 leading-relaxed">
                  Get readability, SEO, and style scores plus line-by-line suggestions. Apply improvements in one click so every post is ready before it goes live.
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <div>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 mb-4">
                  Publishing
                </span>
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <CalendarClock className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-3">Schedule & publish on autopilot</h3>
                <p className="text-gray-400 leading-relaxed">
                  Plan campaigns, set dates in a calendar, and let posts go out automatically. Schedule one-off posts or full campaigns—no manual publishing.
                </p>
              </div>
              <div className="h-44 lg:h-52 rounded-2xl bg-gray-900/90 border border-gray-800 flex items-center justify-center">
                <p className="text-gray-600 text-sm">Calendar view</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities — Strapi-style pill row + grid */}
      <section className="py-16 lg:py-20 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-500 text-sm font-medium mb-8">Capabilities</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <Wand2 className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-white">AI content</p>
              <p className="text-xs text-gray-500 mt-0.5">Generate & review posts</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-white">Campaigns</p>
              <p className="text-xs text-gray-500 mt-0.5">Plan & run marketing</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-white">Scheduling</p>
              <p className="text-xs text-gray-500 mt-0.5">Calendar & auto-publish</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-white">Teams</p>
              <p className="text-xs text-gray-500 mt-0.5">Multi-site & roles</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — Strapi-style section title + subtitle */}
      <section id="pricing" className="py-20 lg:py-28 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pricing</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">Simple plans. All include AI and API.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Starter Plan */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 relative hover:border-primary/50 transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Starter</h3>
                <p className="text-gray-400 text-sm mb-6">Perfect for personal blogs</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$5</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Up to 10 blog posts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">AI blog generation</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">AI content review</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">1 site</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Basic campaigns</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">API access</span>
                </li>
              </ul>

              {!isAuthenticated ? (
                <Link href="/auth/signup">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Get Started
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Current Plan
                  </Button>
                </Link>
              )}
            </div>

            {/* Professional Plan */}
            <div className="bg-gradient-to-br from-primary/10 via-gray-900 to-black rounded-2xl border-2 border-primary p-8 relative transform scale-105 hover:scale-110 transition-all duration-300 shadow-xl shadow-primary/20">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </span>
              </div>
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Professional</h3>
                <p className="text-gray-400 text-sm mb-6">For growing blogs</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$10</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Up to 50 blog posts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Advanced AI features</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">3 sites</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited campaigns</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Team collaboration</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Campaign templates</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Priority support</span>
                </li>
              </ul>

              {!isAuthenticated ? (
                <Link href="/auth/signup">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/50">
                    Get Started
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button className="w-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/50">
                    Upgrade Now
                  </Button>
                </Link>
              )}
            </div>

            {/* Enterprise Plan */}
            <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 relative hover:border-primary/50 transition-all duration-300">
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
                <p className="text-gray-400 text-sm mb-6">For power users & businesses</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">$20</span>
                  <span className="text-gray-400">/month</span>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited blog posts</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">All AI features</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited sites</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Advanced API features</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Unlimited team members</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Custom integrations</span>
                </li>
                <li className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">24/7 priority support</span>
                </li>
              </ul>

              {!isAuthenticated ? (
                <Link href="/auth/signup">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Get Started
                  </Button>
                </Link>
              ) : (
                <Link href="/dashboard">
                  <Button className="w-full bg-gray-800 hover:bg-gray-700 text-white border border-gray-700">
                    Upgrade Now
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <div className="mt-10 text-center">
            <p className="text-gray-500 text-sm">14-day free trial. No credit card required. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* Final CTA — Strapi-style single focus */}
      <section className="py-20 lg:py-28 px-6 border-t border-gray-800/80">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3">Ready to ship content without the chaos?</h2>
          <p className="text-gray-400 mb-8">Join teams who create, review, and schedule in one place.</p>
          {!isAuthenticated && (
            <Link href="/auth/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold rounded-lg shadow-lg shadow-primary/20">
                Start free
              </Button>
            </Link>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
