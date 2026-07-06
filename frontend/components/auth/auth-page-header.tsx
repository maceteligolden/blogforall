import Link from "next/link";
import type { ReactNode } from "react";

type AuthPageHeaderProps = {
  title: string;
  subtitle: ReactNode;
};

export function AuthPageHeader({ title, subtitle }: AuthPageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
      <p className="mt-4 lg:hidden">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-sm"
        >
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
