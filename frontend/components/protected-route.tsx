"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();

  useEffect(() => {
    // Check if user is authenticated
    if (!isAuthenticated || !accessToken) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, accessToken, router]);

  // Show loading state while checking auth
  if (!isAuthenticated || !accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

