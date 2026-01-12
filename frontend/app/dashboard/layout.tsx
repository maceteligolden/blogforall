"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/layout/navbar";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { useQuery } from "@tanstack/react-query";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  const { data: onboardingStatus, isLoading } = useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => OnboardingService.getStatus(),
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && onboardingStatus) {
      if (onboardingStatus.requiresOnboarding) {
        router.push("/onboarding");
      } else {
        setCheckingOnboarding(false);
      }
    }
  }, [onboardingStatus, isLoading, router]);

  if (checkingOnboarding || isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <NotificationProvider>
        <Navbar />
        <div className="min-h-screen bg-black text-white">
          {children}
        </div>
      </NotificationProvider>
    </ProtectedRoute>
  );
}

