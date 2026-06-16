"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const HUB_TAB_PATHS = new Set([
  "/dashboard/blogs",
  "/dashboard/blogs/categories",
  "/dashboard/blogs/scheduled",
]);

function getBackNav(pathname: string): { href: string; label: string } | null {
  if (HUB_TAB_PATHS.has(pathname)) return null;
  if (!pathname.startsWith("/dashboard/blogs")) return null;
  if (pathname.startsWith("/dashboard/blogs/scheduled/")) {
    return { href: "/dashboard/blogs/scheduled", label: "Back to scheduled posts" };
  }
  return { href: "/dashboard/blogs", label: "Back to blogs" };
}

export default function BlogsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const backNav = getBackNav(pathname);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        {backNav && (
          <div className="mb-4">
            <Link
              href={backNav.href}
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              {backNav.label}
            </Link>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
