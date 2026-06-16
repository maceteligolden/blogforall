import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as Sentry from "@sentry/nextjs";
import { getCurrentSiteIdFromToken } from "../utils/jwt";
import { getOrCreateSessionId } from "../observability/session";
import { identifyUser, groupWorkspace, resetPostHog } from "../analytics/posthog";

export const USER_ROLE = {
  USER: "user",
  ADMIN: "admin",
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  plan: string;
  role?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  currentSiteId: string | null;
  isAuthenticated: boolean;

  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setCurrentSiteId: (siteId: string | null) => void;
  clearAuth: () => void;
  updateUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      currentSiteId: null,
      isAuthenticated: false,

      setTokens: (accessToken: string, refreshToken: string) => {
        // Extract currentSiteId from token
        const currentSiteId = getCurrentSiteIdFromToken(accessToken) || null;

        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
          
          if (currentSiteId) {
            localStorage.setItem("current_site_id", currentSiteId);
          }
          
          // Set cookie for Next.js Middleware
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `auth-token=${accessToken}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
        }

        set({
          accessToken,
          refreshToken,
          currentSiteId,
          isAuthenticated: true,
        });
      },

      setUser: (user: User) => {
        if (typeof window !== "undefined" && user.email) {
          localStorage.setItem("user_email", user.email);
        }

        if (typeof window !== "undefined") {
          try {
            Sentry.setUser({ id: user.id, email: user.email });
            Sentry.setTag("sessionId", getOrCreateSessionId());
            identifyUser(user.id, {
              email: user.email,
              plan: user.plan,
              first_name: user.first_name,
              last_name: user.last_name,
            });
          } catch {
            // observability must not block auth
          }
        }

        set({ user, isAuthenticated: true });
      },

      setCurrentSiteId: (siteId: string | null) => {
        if (typeof window !== "undefined") {
          if (siteId) {
            localStorage.setItem("current_site_id", siteId);
          } else {
            localStorage.removeItem("current_site_id");
          }
        }

        if (typeof window !== "undefined" && siteId) {
          try {
            groupWorkspace(siteId);
          } catch {
            // analytics must not block site switch
          }
        }

        set({ currentSiteId: siteId });
      },

      clearAuth: () => {
        if (typeof window !== "undefined") {
          try {
            Sentry.setUser(null);
            resetPostHog();
          } catch {
            // observability must not block logout
          }
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user_email");
          localStorage.removeItem("current_site_id");
          
          // Clear cookie
          document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }

        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          currentSiteId: null,
          isAuthenticated: false,
        });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        currentSiteId: state.currentSiteId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

/** Selector: true when the current user has admin role. Use to guard admin-only UI. */
export const useIsAdmin = (): boolean => useAuthStore((s) => s.user?.role === USER_ROLE.ADMIN);

