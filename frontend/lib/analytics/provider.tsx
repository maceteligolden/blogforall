"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initPostHog, capturePageView, isPostHogEnabled } from "./posthog";

function PostHogPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isPostHogEnabled()) return;
    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
    capturePageView(url);
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return (
    <>
      {children}
      {isPostHogEnabled() && (
        <Suspense fallback={null}>
          <PostHogPageViewTracker />
        </Suspense>
      )}
    </>
  );
}
