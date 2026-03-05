"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsAdmin, useAuthStore } from "@/lib/store/auth.store";

interface AdminGuardProps {
  children: React.ReactNode;
  /** Redirect path when user is not admin. Defaults to /dashboard. */
  redirectTo?: string;
}

/**
 * Renders children only when the current user has admin role.
 * Redirects non-admin users to redirectTo (default /dashboard).
 * Use inside ProtectedRoute so auth is already established.
 */
export function AdminGuard({ children, redirectTo = "/dashboard" }: AdminGuardProps) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!isAdmin) {
      router.replace(redirectTo);
    }
  }, [isAuthenticated, isAdmin, redirectTo, router]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
          <p className="text-gray-400">Checking access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
