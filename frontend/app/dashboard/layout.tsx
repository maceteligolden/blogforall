"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/layout/navbar";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { ToastProvider } from "@/components/ui/toast";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { SiteService } from "@/lib/api/services/site.service";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/auth.store";
import { useAuth } from "@/lib/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/api/config";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const { currentSiteId, isAuthenticated } = useAuthStore();
  const { updateSiteContext } = useAuth();

  const { data: onboardingStatus, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => OnboardingService.getStatus(),
    retry: false,
    enabled: isAuthenticated,
  });

  // Check if user has sites
  const { data: sites = [], isLoading: sitesLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    retry: false,
    enabled: isAuthenticated && !onboardingStatus?.requiresOnboarding,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (onboardingLoading || sitesLoading) {
      return;
    }

    // First check onboarding
    if (onboardingStatus?.requiresOnboarding) {
      router.push("/onboarding");
      return;
    }

    // Then check if user has sites
    if (sites.length === 0) {
      // User needs to create a site
      router.push("/onboarding/create-site");
      return;
    }

    // Check if currentSiteId is set and valid
    if (!currentSiteId || !sites.find((s) => s._id === currentSiteId)) {
      // Set the first site as current if no currentSiteId or invalid
      const firstSite = sites[0];
      if (firstSite) {
        updateSiteContext(firstSite._id);
        // Don't set checkingOnboarding to false yet - wait for site context update
        return;
      }
    }

    setCheckingOnboarding(false);
  }, [onboardingStatus, onboardingLoading, sites, sitesLoading, currentSiteId, isAuthenticated, router, updateSiteContext]);

  if (checkingOnboarding || onboardingLoading || sitesLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <NotificationProvider>
        <ToastProvider>
          <Navbar />
          <div className="min-h-screen bg-black text-white">
            {children}
          </div>
        </ToastProvider>
      </NotificationProvider>
    </ProtectedRoute>
  );
}

