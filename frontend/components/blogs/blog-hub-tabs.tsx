"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabClass = (active: boolean) =>
  `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    active
      ? "bg-primary text-white"
      : "text-gray-400 hover:text-white hover:bg-gray-800"
  }`;

export function BlogHubTabs() {
  const pathname = usePathname();

  return (
    <nav
      className="flex flex-wrap gap-2 border-b border-gray-800 pb-4 mb-6"
      aria-label="Blogs section"
    >
      <Link href="/dashboard/blogs" className={tabClass(pathname === "/dashboard/blogs")}>
        Posts
      </Link>
      <Link
        href="/dashboard/blogs/categories"
        className={tabClass(pathname === "/dashboard/blogs/categories")}
      >
        Categories
      </Link>
      <Link
        href="/dashboard/blogs/scheduled"
        className={tabClass(pathname === "/dashboard/blogs/scheduled")}
      >
        Scheduled
      </Link>
    </nav>
  );
}
