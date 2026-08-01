"use client";

import Link from "next/link";
import { FOOTER_TAGLINE, LANDING_CTAS } from "@/lib/landing/landing-copy";
import { useAuthStore } from "@/lib/store/auth.store";

export function LandingFooter() {
  const { isAuthenticated } = useAuthStore();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-800 py-12 sm:py-16 px-6 lg:px-8 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10 sm:mb-12">
          <div className="sm:col-span-2 md:col-span-1">
            <h3 className="text-xl font-display tracking-[0.08em] text-primary mb-4">Bloggr</h3>
            <p className="text-gray-400 text-sm max-w-xs">{FOOTER_TAGLINE}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-white">Product</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/#how-it-works" className="hover:text-white transition-colors">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/#why-bloggr" className="hover:text-white transition-colors">
                  Why Bloggr
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-white transition-colors">
                  Docs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-white">Company</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/about" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-white">Account</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link
                  href={isAuthenticated ? "/dashboard" : "/auth/signup"}
                  className="hover:text-white transition-colors"
                >
                  {isAuthenticated ? LANDING_CTAS.dashboard : LANDING_CTAS.startFree}
                </Link>
              </li>
              {!isAuthenticated && (
                <li>
                  <Link href="/auth/login" className="hover:text-white transition-colors">
                    {LANDING_CTAS.logIn}
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            &copy; {year} Bloggr. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
