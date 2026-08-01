"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { User, Menu, Settings, HelpCircle, LogOut, BookOpen, CreditCard, Gift } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { InviteUsersButton } from "@/components/layout/invite-users-button";
import { SetupProgressRing } from "@/components/onboarding/setup-progress-ring";

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/auth/login");
  };

  const closeMenu = () => setShowUserMenu(false);

  const menuLinks = [
    { href: "/dashboard/profile", label: "Settings", icon: Settings },
    { href: "/dashboard/subscription", label: "Subscription", icon: CreditCard },
    { href: "/dashboard/referrals", label: "Referrals", icon: Gift },
    { href: "/contact", label: "Get help", icon: HelpCircle },
    { href: "/", label: "How it works", icon: BookOpen },
  ] as const;

  return (
    <nav className="bg-black/95 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-[9999]">
      <div className="w-full px-4 lg:px-6 relative z-[9999]">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            {onMenuClick && (
              <button
                type="button"
                onClick={onMenuClick}
                className="md:hidden p-2 text-gray-400 hover:text-white"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <Link href="/dashboard" className="flex items-center">
              <h1 className="text-2xl font-display text-primary tracking-tight">Bloggr</h1>
            </Link>
          </div>

          <div className="flex items-center space-x-4 relative z-[9999]">
            <SetupProgressRing />
            <NotificationBell />
            <InviteUsersButton />

            <div className="relative z-[10000]">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push("/dashboard/profile")}
                  className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
                  title="Go to Settings"
                  aria-label="Go to Settings"
                >
                  <div
                    className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center cursor-pointer hover:bg-primary/30 transition-colors"
                    aria-hidden="true"
                  >
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden md:block text-sm font-medium">
                    {user?.first_name} {user?.last_name}
                  </span>
                </button>

                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="text-gray-400 hover:text-white transition-colors"
                  aria-label={showUserMenu ? "Close user menu" : "Open user menu"}
                  aria-expanded={showUserMenu}
                  aria-haspopup="true"
                  aria-controls="user-menu-dropdown"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {showUserMenu && (
                <div
                  id="user-menu-dropdown"
                  role="menu"
                  aria-label="User menu"
                  className="absolute right-0 mt-2 w-52 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl py-2 z-[10000]"
                  style={{ zIndex: 10000 }}
                >
                  {menuLinks.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                      onClick={closeMenu}
                      aria-label={label}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                  <hr className="my-2 border-gray-800" role="separator" aria-orientation="horizontal" />
                  <button
                    role="menuitem"
                    onClick={() => {
                      closeMenu();
                      handleLogout();
                    }}
                    className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-800 transition-colors"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Sign out
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
