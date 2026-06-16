import Link from "next/link";
import type { ReactNode } from "react";

type AuthPageHeaderProps = {
  title: string;
  subtitle: ReactNode;
};

export function AuthPageHeader({ title, subtitle }: AuthPageHeaderProps) {
  return (
    <div>
      <Link
        href="/"
        className="block text-center text-3xl font-bold text-primary mb-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-sm"
        aria-label="Bloggr home"
      >
        Bloggr
      </Link>
      <h2 className="text-center text-2xl font-bold text-white mt-4">{title}</h2>
      <p className="mt-2 text-center text-sm text-gray-400">{subtitle}</p>
      <p className="mt-3 text-center">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded-sm"
        >
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
