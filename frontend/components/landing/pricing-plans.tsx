"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PricingPlans() {
  const { isAuthenticated } = useAuthStore();

  return (
    <section className="py-20 lg:py-28 px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">Pricing</h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">Simple plans. All include AI and API.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 relative hover:border-primary/50 transition-all duration-300">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Starter</h2>
              <p className="text-gray-400 text-sm mb-6">Perfect for personal blogs</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$5</span>
                <span className="text-gray-400">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Up to 10 blog posts</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">AI blog generation</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">AI content review</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">1 site</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Basic campaigns</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
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

          <div className="bg-gradient-to-br from-primary/10 via-gray-900 to-black rounded-2xl border-2 border-primary p-8 relative transform scale-105 hover:scale-110 transition-all duration-300 shadow-xl shadow-primary/20">
            <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
              <span className="bg-primary text-white px-4 py-1 rounded-full text-sm font-semibold">Most Popular</span>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Professional</h2>
              <p className="text-gray-400 text-sm mb-6">For growing blogs</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$10</span>
                <span className="text-gray-400">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Up to 50 blog posts</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Advanced AI features</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">3 sites</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Unlimited campaigns</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Team collaboration</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Campaign templates</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
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

          <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl border border-gray-800 p-8 relative hover:border-primary/50 transition-all duration-300">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Enterprise</h2>
              <p className="text-gray-400 text-sm mb-6">For power users & businesses</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold">$20</span>
                <span className="text-gray-400">/month</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Unlimited blog posts</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">All AI features</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Unlimited sites</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Advanced API features</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Unlimited team members</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-gray-300">Custom integrations</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckIcon />
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
  );
}
