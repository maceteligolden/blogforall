"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";

export function LandingHeader() {
  const { isAuthenticated } = useAuthStore();

  return (
    <header className="bg-black/90 backdrop-blur-md border-b border-gray-800/80 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <nav className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center font-semibold text-white hover:text-primary transition-colors">
            Bloggr
          </Link>
          <div className="flex items-center gap-8">
            <Link href="/#features" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">
              Features
            </Link>
            <Link href="/#pricing" className="text-sm text-gray-400 hover:text-white transition-colors hidden sm:inline">
              Pricing
            </Link>
            <Link href="/docs" className="text-sm text-gray-400 hover:text-white transition-colors">
              Docs
            </Link>
            <Link href="/contact" className="text-sm text-gray-400 hover:text-white transition-colors">
              Contact
            </Link>
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-4 py-2">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Login
                </Link>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg px-4 py-2">
                    Sign up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
