"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function syncTokensFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  const at = localStorage.getItem("access_token");
  const rt = localStorage.getItem("refresh_token");
  if (at && rt) {
    useAuthStore.getState().setTokens(at, rt);
    return true;
  }
  return false;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [hydrated, setHydrated] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(useAuthStore.getState().isAuthenticated && useAuthStore.getState().accessToken);
  });

  // Sync tokens synchronously on first client render so soft navigations from
  // signup don't stick on "Checking authentication…".
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      setHydrated(true);
      return;
    }

    const hasTokens = syncTokensFromStorage();
    if (hasTokens) {
      setHydrated(true);
      return;
    }

    const persistApi = (
      useAuthStore as unknown as {
        persist?: { hasHydrated?: () => boolean; onFinishHydration?: (cb: () => void) => () => void };
      }
    ).persist;

    if (persistApi?.hasHydrated?.()) {
      if (!syncTokensFromStorage() && !useAuthStore.getState().isAuthenticated) {
        router.push(`/auth/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`);
      }
      setHydrated(true);
      return;
    }

    const unsub = persistApi?.onFinishHydration?.(() => {
      if (!syncTokensFromStorage() && !useAuthStore.getState().isAuthenticated) {
        router.push(`/auth/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`);
      }
      setHydrated(true);
    });

    // Fallback if persist API is unavailable.
    const timer = setTimeout(() => {
      if (!syncTokensFromStorage() && !useAuthStore.getState().isAuthenticated) {
        router.push(`/auth/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`);
      }
      setHydrated(true);
    }, 50);

    return () => {
      unsub?.();
      clearTimeout(timer);
    };
  }, [isAuthenticated, accessToken, router, pathname]);

  if (!hydrated || !isAuthenticated || !accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
