"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/lib/hooks/use-admin-auth";
import { useAuthStore, useIsSuperAdmin } from "@/lib/store/auth.store";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/blogs", label: "Blogs" },
  { href: "/token-usage", label: "Token usage" },
  { href: "/profile", label: "Profile" },
  { href: "/change-password", label: "Password" },
];

export function AdminNavbar() {
  const pathname = usePathname();
  const { logout } = useAdminAuth();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useIsSuperAdmin();

  return (
    <header className="bg-black/95 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Link href="/" className="font-display text-2xl text-primary tracking-wide">
              Bloggr Admin
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    (item.href === "/users" ? pathname.startsWith("/users") : pathname === item.href)
                      ? "bg-primary text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {isSuperAdmin && (
                <Link
                  href="/admins/new"
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith("/admins")
                      ? "bg-primary text-white"
                      : "text-gray-400 hover:text-white hover:bg-gray-800"
                  )}
                >
                  Create admin
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden md:block text-sm text-gray-400">
                {user.first_name} {user.last_name}
                <span className="text-gray-600 ml-2">({user.role})</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => logout()}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
