"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { User, CreditCard } from "lucide-react";
import { useState } from "react";
import { SiteSwitcher } from "@/components/sites/site-switcher";

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  return (
    <nav className="bg-black/95 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center">
            <h1 className="text-2xl font-display text-primary tracking-tight">BlogForAll</h1>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <SiteSwitcher />
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/blogs"
              className="text-sm text-gray-400 hover:text-white transition-colors font-medium"
            >
              Blogs
            </Link>
            <Link
              href="/dashboard/categories"
              className="text-sm text-gray-400 hover:text-white transition-colors font-medium"
            >
              Categories
            </Link>
            <Link
              href="/dashboard/api-keys"
              className="text-sm text-gray-400 hover:text-white transition-colors font-medium"
            >
              API Keys
            </Link>
          </div>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* User Menu */}
            <div className="relative">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push("/dashboard/profile")}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                  title="Go to Profile"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden md:block text-sm font-medium">
                    {user?.first_name} {user?.last_name}
                  </span>
                </button>
                
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-lg py-2">
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                  <Link
                    href="/dashboard/billing"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <CreditCard className="w-4 h-4" />
                    Billing
                  </Link>
                  <Link
                    href="/"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    Home
                  </Link>
                  <hr className="my-2 border-gray-800" />
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

