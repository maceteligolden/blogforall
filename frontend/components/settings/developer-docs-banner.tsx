import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

export function DeveloperDocsBanner() {
  return (
    <Link
      href="/docs"
      className="group mb-6 flex items-start gap-4 rounded-lg border border-primary/30 bg-primary/5 p-5 transition-colors hover:border-primary/50 hover:bg-primary/10"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
        <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors">API documentation</p>
        <p className="mt-1 text-sm text-gray-400">
          Authentication, endpoints, and integration examples — everything you need to build on Bloggr.
        </p>
      </div>
      <ArrowRight
        className="mt-1 h-5 w-5 shrink-0 text-gray-500 transition-colors group-hover:text-primary"
        aria-hidden="true"
      />
    </Link>
  );
}
