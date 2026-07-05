"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/layout/navbar";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { ToastProvider } from "@/components/ui/toast";
import { OrchestratorProvider } from "@/components/orchestrator/orchestrator-provider";
import { OrchestratorUrlSync } from "@/components/orchestrator/orchestrator-url-sync";
import { TokenExhaustionProvider } from "@/components/usage/token-exhaustion-provider";
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
  const pathname = usePathname();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentSiteId, isAuthenticated } = useAuthStore();
  const { updateSiteContext } = useAuth();

  const { data: onboardingStatus, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => OnboardingService.getStatus(),
    retry: false,
    enabled: isAuthenticated,
  });

  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    retry: false,
    enabled: isAuthenticated && !onboardingStatus?.requiresOnboarding,
  });
  const sites = Array.isArray(sitesData) ? sitesData : [];

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      if (typeof window !== "undefined") {
        const at = localStorage.getItem("access_token");
        const rt = localStorage.getItem("refresh_token");
        if (at && rt) {
          useAuthStore.getState().setTokens(at, rt);
          return;
        }
      }
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname || "/dashboard")}`);
      return;
    }

    if (onboardingLoading || sitesLoading) {
      return;
    }

    if (onboardingStatus?.requiresOnboarding) {
      void OnboardingService.skip()
        .catch(() => undefined)
        .finally(() => {
          router.replace("/onboarding/create-site");
        });
      return;
    }

    if (sites.length === 0) {
      router.push("/onboarding/create-site");
      return;
    }

    if (!currentSiteId || !sites.find((s) => s._id === currentSiteId)) {
      const firstSite = sites[0];
      if (firstSite) {
        updateSiteContext(firstSite._id);
        return;
      }
    }

    const currentSite = sites.find((s) => s._id === currentSiteId);
    if (currentSite && currentSite.status === "onboarding") {
      router.push("/onboarding/create-site?step=chat");
      return;
    }

    setCheckingOnboarding(false);
  }, [
    pathname,
    onboardingStatus,
    onboardingLoading,
    sites,
    sitesLoading,
    currentSiteId,
    isAuthenticated,
    router,
    updateSiteContext,
  ]);

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
          <TokenExhaustionProvider>
            <OrchestratorProvider>
              <Suspense fallback={null}>
                <OrchestratorUrlSync />
              </Suspense>
              <Navbar onMenuClick={() => setSidebarOpen(true)} />
              <div className="flex min-h-[calc(100vh-4rem)] bg-black text-white">
                <DashboardSidebar
                  mobileOpen={sidebarOpen}
                  onMobileClose={() => setSidebarOpen(false)}
                />
                <div className="flex-1 min-w-0">{children}</div>
              </div>
            </OrchestratorProvider>
          </TokenExhaustionProvider>
        </ToastProvider>
      </NotificationProvider>
    </ProtectedRoute>
  );
}
