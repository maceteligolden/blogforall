"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isPlatformAdminRole, useAuthStore } from "@/lib/store/auth.store";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const persistApi = (useAuthStore as typeof useAuthStore & { persist?: any }).persist;
    if (!persistApi) {
      setHasHydrated(true);
      return;
    }
    const unsub = persistApi.onFinishHydration(() => setHasHydrated(true));
    if (persistApi.hasHydrated()) setHasHydrated(true);
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const finish = () => setIsChecking(false);

    if (!isAuthenticated || !accessToken) {
      const at = localStorage.getItem("access_token");
      const rt = localStorage.getItem("refresh_token");
      if (at && rt) {
        useAuthStore.getState().setTokens(at, rt);
        finish();
        return;
      }

      // Clear stale cookie so middleware allows /login (fixes redirect loop)
      useAuthStore.getState().clearAuth();
      finish();
      router.replace(`/login?redirect=${encodeURIComponent(pathname || "/")}`);
      return;
    }

    if (user && !isPlatformAdminRole(user.role)) {
      useAuthStore.getState().clearAuth();
      finish();
      router.replace("/login");
      return;
    }

    finish();
  }, [hasHydrated, isAuthenticated, accessToken, user, router, pathname]);

  if (!hasHydrated || isChecking || !isAuthenticated || !accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
