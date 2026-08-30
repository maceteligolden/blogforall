"use client";

import { useEffect } from "react";
import { useAuthStore } from "../../store/auth.store";
import { identifyUser, groupWorkspace, resetAnalytics } from "../client";

/**
 * Syncs analytics identity with auth store.
 * Call once at app root (inside AnalyticsProvider tree).
 */
export function useIdentifyUser() {
  const user = useAuthStore((s) => s.user);
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      resetAnalytics();
      return;
    }

    identifyUser(user.id, {
      email: user.email,
      plan: user.plan,
      first_name: user.first_name,
      last_name: user.last_name,
      account_type: user.account_type,
      is_approved: user.is_approved,
    });
  }, [isAuthenticated, user?.id, user?.email, user?.plan, user?.account_type, user?.is_approved]);

  useEffect(() => {
    if (currentSiteId) {
      groupWorkspace(currentSiteId);
    }
  }, [currentSiteId]);
}
