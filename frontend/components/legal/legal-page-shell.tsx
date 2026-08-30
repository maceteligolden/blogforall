import type { ReactNode } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";

const LEGAL_NAV = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/cookies", label: "Cookies" },
] as const;

type LegalPageShellProps = {
  title: string;
  lastUpdated: string;
  children: ReactNode;
};

export function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-16 sm:py-20">
        <nav className="mb-8 flex flex-wrap gap-4 text-sm text-gray-500" aria-label="Legal">
          {LEGAL_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-white transition-colors">
              {item.label}
            </Link>
          ))}
        </nav>
        <h1 className="text-4xl md:text-5xl font-bold mb-3">{title}</h1>
        <p className="text-sm text-gray-500 mb-10">Last updated: {lastUpdated}</p>
        <div className="legal-doc space-y-8 text-gray-300 leading-relaxed [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_a]:text-primary [&_a]:hover:underline [&_table]:w-full [&_table]:text-sm [&_th]:text-left [&_th]:text-gray-400 [&_th]:font-medium [&_th]:pb-2 [&_td]:py-2 [&_td]:pr-4 [&_td]:border-t [&_td]:border-gray-800">
          {children}
        </div>
      </div>
      <LandingFooter />
    </div>
  );
}
