"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/hooks/use-auth";

type WizardHomeLinkProps = {
  className?: string;
  children: ReactNode;
};

/** Home / Back to home: delete the in-progress signup and return to the landing page. */
export function WizardHomeLink({ className, children }: WizardHomeLinkProps) {
  const { abandonSignup, isAbandoningSignup, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <Link href="/" className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={className} disabled={isAbandoningSignup} onClick={() => abandonSignup()}>
      {isAbandoningSignup ? "Leaving…" : children}
    </button>
  );
}
