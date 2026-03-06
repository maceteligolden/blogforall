"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";
import { Calendar, Users, Target, Wand2 } from "lucide-react";

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      {/* Hero — minimal, conversion-focused */}
      <section className="relative min-h-[70vh] flex items-center justify-center px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(30,64,175,0.12),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6">
            Content that runs itself.
          </h1>
          <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            AI-powered content, campaigns, and scheduling so your team can focus on strategy.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isAuthenticated && (
              <>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
                    Start free
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline" className="border border-gray-600 text-gray-300 hover:bg-gray-800/80 hover:text-white px-8 py-6 text-base font-medium">
                    Sign in
                  </Button>
                </Link>
              </>
            )}
            {isAuthenticated && (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
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

      {/* Features — icon + label only */}
      <section className="py-16 lg:py-20 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
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

      {/* Pricing */}
      <section id="pricing" className="py-20 lg:py-24 px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-2">Pricing</h2>
            <p className="text-gray-400 text-sm">Simple plans. All include AI and API.</p>
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

      {/* Final CTA */}
      <section className="py-20 lg:py-24 px-6 border-t border-gray-800/80">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to simplify your content?</h2>
          {!isAuthenticated && (
            <Link href="/auth/signup">
              <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-base font-semibold">
                Start free trial
              </Button>
            </Link>
          )}
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
