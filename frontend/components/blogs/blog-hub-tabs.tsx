"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabClass = (active: boolean) =>
  `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    active ? "bg-primary text-white" : "text-gray-400 hover:text-white hover:bg-gray-800"
  }`;

export function PostsHubTabs() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2 border-b border-gray-800 pb-4 mb-6" aria-label="Posts section">
      <Link href="/dashboard/posts" className={tabClass(pathname === "/dashboard/posts")}>
        Posts
      </Link>
      <Link href="/dashboard/posts/categories" className={tabClass(pathname === "/dashboard/posts/categories")}>
        Categories
      </Link>
      <Link href="/dashboard/posts/scheduled" className={tabClass(pathname === "/dashboard/posts/scheduled")}>
        Scheduled
      </Link>
    </nav>
  );
}

/** @deprecated Use PostsHubTabs */
export const ContentHubTabs = PostsHubTabs;
/** @deprecated Use PostsHubTabs */
export const BlogHubTabs = PostsHubTabs;
