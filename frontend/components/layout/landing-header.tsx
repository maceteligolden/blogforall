"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";
import { LANDING_CTAS } from "@/lib/landing/landing-copy";
import { IS_WAITLIST_MODE } from "@/lib/landing/waitlist-mode";
import { cn } from "@/lib/utils/cn";

const OPEN_NAV_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#why-bloggr", label: "Why Bloggr" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/docs", label: "Docs", hideOnMobile: true },
  { href: "/contact", label: "Contact" },
] as const;

const WAITLIST_NAV_LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#difference", label: "The difference" },
  { href: "/#why-not-generic", label: "Why Bloggr" },
  { href: "/docs", label: "Docs", hideOnMobile: true },
  { href: "/contact", label: "Contact" },
] as const;

function scrollToWaitlistHero() {
  const hero = document.getElementById("waitlist-hero");
  const emailInput =
    document.getElementById("waitlist-email-hero-first-name") ?? document.getElementById("waitlist-email-hero");
  if (hero) {
    hero.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => emailInput?.focus(), 400);
    return;
  }
  window.location.assign("/#waitlist-hero");
}

export function LandingHeader() {
  const { isAuthenticated } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navLinks = IS_WAITLIST_MODE ? WAITLIST_NAV_LINKS : OPEN_NAV_LINKS;

  const closeMobile = () => setMobileOpen(false);

  const handleEarlyAccess = () => {
    closeMobile();
    scrollToWaitlistHero();
  };

  return (
    <header className="bg-black/90 backdrop-blur-md border-b border-gray-800/80 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <nav className="flex justify-between items-center h-16" aria-label="Primary">
          <Link
            href="/"
            className="flex items-center font-display text-xl tracking-[0.08em] text-white hover:text-primary transition-colors"
            onClick={closeMobile}
          >
            Bloggr
          </Link>

          <div className="hidden md:flex items-center gap-7">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                  {LANDING_CTAS.dashboard}
                </Button>
              </Link>
            ) : IS_WAITLIST_MODE ? (
              <Button
                type="button"
                onClick={handleEarlyAccess}
                className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
              >
                {LANDING_CTAS.getEarlyAccess}
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                  {LANDING_CTAS.logIn}
                </Link>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-4 py-2 transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0">
                    {LANDING_CTAS.startFree}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 md:hidden">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-3 py-2">
                  Dashboard
                </Button>
              </Link>
            ) : IS_WAITLIST_MODE ? (
              <Button
                type="button"
                onClick={handleEarlyAccess}
                className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-3 py-2"
              >
                {LANDING_CTAS.getEarlyAccess}
              </Button>
            ) : (
              <Link href="/auth/signup">
                <Button className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-3 py-2">
                  {LANDING_CTAS.startFree}
                </Button>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-gray-400 hover:text-white transition-colors"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </div>

      <div
        id="mobile-nav"
        className={cn(
          "md:hidden border-t border-gray-800/80 bg-black/95 backdrop-blur-md overflow-hidden transition-all duration-200",
          mobileOpen ? "max-h-[28rem] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="px-6 py-4 flex flex-col gap-1">
          {navLinks.filter((link) => !("hideOnMobile" in link && link.hideOnMobile)).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={closeMobile}
              className="text-sm text-gray-400 hover:text-white transition-colors py-3 min-h-[44px] flex items-center"
            >
              {link.label}
            </Link>
          ))}
          {!isAuthenticated &&
            (IS_WAITLIST_MODE ? (
              <Button
                type="button"
                onClick={handleEarlyAccess}
                className="mt-2 min-h-[48px] w-full bg-primary hover:bg-primary/90 text-white font-medium rounded-lg"
              >
                {LANDING_CTAS.getEarlyAccess}
              </Button>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  onClick={closeMobile}
                  className="text-sm text-gray-400 hover:text-white transition-colors py-3 min-h-[44px] flex items-center"
                >
                  {LANDING_CTAS.logIn}
                </Link>
                <Link href="/auth/signup" onClick={closeMobile} className="mt-2 block">
                  <Button className="min-h-[48px] w-full bg-primary hover:bg-primary/90 text-white font-medium rounded-lg">
                    {LANDING_CTAS.startFree}
                  </Button>
                </Link>
              </>
            ))}
        </div>
      </div>
    </header>
  );
}
