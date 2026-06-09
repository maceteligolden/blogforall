import { create } from "zustand";
import { persist } from "zustand/middleware";

export const PLATFORM_ROLES = {
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;

export function isPlatformAdminRole(role?: string): boolean {
  return role === PLATFORM_ROLES.ADMIN || role === PLATFORM_ROLES.SUPER_ADMIN;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  plan: string;
  role?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  updateUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setTokens: (accessToken, refreshToken) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("access_token", accessToken);
          localStorage.setItem("refresh_token", refreshToken);
          const expires = new Date();
          expires.setDate(expires.getDate() + 7);
          document.cookie = `auth-token=${accessToken}; path=/; expires=${expires.toUTCString()}; SameSite=Lax`;
        }
        set({ accessToken, refreshToken, isAuthenticated: true });
      },

      setUser: (user) => set({ user, isAuthenticated: true }),

      clearAuth: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        });
      },

      updateUser: (userData) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...userData } });
      },
    }),
    {
      name: "admin-auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const useIsSuperAdmin = (): boolean =>
  useAuthStore((s) => s.user?.role === PLATFORM_ROLES.SUPER_ADMIN);
