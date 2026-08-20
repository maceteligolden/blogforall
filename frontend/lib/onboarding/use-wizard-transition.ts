"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

/** Keeps the wizard chrome visible and swaps the form for a loader until the next page mounts. */
export function useWizardTransition() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const begin = useCallback(() => setPending(true), []);
  const cancel = useCallback(() => setPending(false), []);

  const push = useCallback(
    (href: string) => {
      setPending(true);
      router.push(href);
    },
    [router]
  );

  const replace = useCallback(
    (href: string) => {
      setPending(true);
      router.replace(href);
    },
    [router]
  );

  return { pending, begin, cancel, push, replace };
}
