"use client";

import Link from "next/link";
import { Key, BookOpen, ChevronRight } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";

const developerLinks = [
  {
    href: "/dashboard/api-keys",
    title: "API Keys",
    description: "Create and manage API keys for programmatic access to your content.",
    icon: Key,
  },
  {
    href: "/docs",
    title: "API documentation",
    description: "Reference for authentication, endpoints, and integration examples.",
    icon: BookOpen,
  },
] as const;

export default function DeveloperPage() {
  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb items={[{ label: "Developer" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-display text-white">Developer</h1>
        <p className="text-sm text-gray-400 mt-1">
          API keys, documentation, and tools for building on Bloggr.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
        {developerLinks.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 p-5 rounded-lg border border-gray-800 bg-gray-900 hover:border-primary/40 hover:bg-gray-900/80 transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-white group-hover:text-primary transition-colors">
                {title}
              </h2>
              <p className="text-sm text-gray-400 mt-1">{description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 shrink-0 mt-1" />
          </Link>
        ))}
      </div>
    </div>
  );
}
