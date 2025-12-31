"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth.store";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, accessToken } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Give a moment for auth state to initialize from localStorage
    const timer = setTimeout(() => {
      setIsChecking(false);
      if (!isAuthenticated || !accessToken) {
        router.push("/auth/login");
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, accessToken, router]);

  // Show loading state while checking auth
  if (isChecking || !isAuthenticated || !accessToken) {
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

