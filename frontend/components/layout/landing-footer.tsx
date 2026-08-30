"use client";

import Link from "next/link";
import { LandingWordmark } from "@/components/brand/landing-wordmark";
import { landingTracker } from "@/lib/analytics/flows/landing.tracker";
import { FOOTER_TAGLINE, LANDING_CTAS } from "@/lib/landing/landing-copy";
import { IS_WAITLIST_MODE } from "@/lib/landing/waitlist-mode";
import { useAuthStore } from "@/lib/store/auth.store";

export function LandingFooter() {
  const { isAuthenticated } = useAuthStore();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-800 py-12 sm:py-16 px-6 lg:px-8 bg-black">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-10 sm:mb-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-4 hover:opacity-90 transition-opacity" aria-label="Bloggr home">
              <LandingWordmark className="h-7" />
            </Link>
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
              {IS_WAITLIST_MODE ? (
                <li>
                  <Link href="/#launch" className="hover:text-white transition-colors">
                    Early access
                  </Link>
                </li>
              ) : (
                <>
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
                </>
              )}
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
            <h4 className="font-semibold mb-4 text-white">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="hover:text-white transition-colors">
                  Cookies
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-white">Account</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              {isAuthenticated ? (
                <li>
                  <Link href="/dashboard" className="hover:text-white transition-colors">
                    {LANDING_CTAS.dashboard}
                  </Link>
                </li>
              ) : IS_WAITLIST_MODE ? (
                <>
                  <li>
                    <Link
                      href="/#waitlist-hero"
                      className="hover:text-white transition-colors"
                      onClick={() =>
                        landingTracker.ctaClicked({
                          placement: "footer",
                          cta_label: LANDING_CTAS.getEarlyAccess,
                          href: "/#waitlist-hero",
                        })
                      }
                    >
                      {LANDING_CTAS.getEarlyAccess}
                    </Link>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link
                      href="/auth/signup"
                      className="hover:text-white transition-colors"
                      onClick={() =>
                        landingTracker.ctaClicked({
                          placement: "footer",
                          cta_label: LANDING_CTAS.getEarlyAccess,
                          href: "/auth/signup",
                        })
                      }
                    >
                      {LANDING_CTAS.getEarlyAccess}
                    </Link>
                  </li>
                  <li>
                    <Link href="/auth/login" className="hover:text-white transition-colors">
                      {LANDING_CTAS.logIn}
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center">
          <p className="text-gray-400 text-sm">&copy; {year} Bloggr. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
