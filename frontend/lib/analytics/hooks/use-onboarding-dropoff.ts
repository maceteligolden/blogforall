"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { onboardingTracker } from "../flows/onboarding.tracker";

/**
 * Emits `onboarding dropped` when the user leaves an onboarding route
 * without completing (tab close / navigate away).
 */
export function useOnboardingDropoff(lastStep: string) {
  const pathname = usePathname();
  const lastStepRef = useRef(lastStep);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    lastStepRef.current = lastStep;
  }, [lastStep]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const onLeave = () => {
      onboardingTracker.dropped({
        last_step: lastStepRef.current,
        last_route: pathnameRef.current ?? "",
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        onLeave();
      }
    };

    window.addEventListener("beforeunload", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
