"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { WizardHomeLink } from "@/components/onboarding/wizard-home-link";

type AuthPageHeaderProps = {
  title: string;
  subtitle: ReactNode;
  /** During signup, leave the wizard and delete the in-progress account. */
  clearSignupAttempt?: boolean;
};

const HOME_LINK_CLASS =
  "text-sm text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-sm disabled:opacity-60";

export function AuthPageHeader({ title, subtitle, clearSignupAttempt = false }: AuthPageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-gray-400">{subtitle}</p>
      <p className="mt-4">
        {clearSignupAttempt ? (
          <WizardHomeLink className={HOME_LINK_CLASS}>← Back to home</WizardHomeLink>
        ) : (
          <Link href="/" className={HOME_LINK_CLASS}>
            ← Back to home
          </Link>
        )}
      </p>
    </div>
  );
}
