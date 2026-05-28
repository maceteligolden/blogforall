"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  AdminApiService,
  ChangePasswordRequest,
  LoginRequest,
  UpdateProfileRequest,
} from "../api/services/admin.service";
import { QUERY_KEYS } from "../api/config";
import { isPlatformAdminRole, useAuthStore } from "../store/auth.store";

export function useAdminAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTokens, setUser, clearAuth, user, isAuthenticated } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => AdminApiService.login(data),
    onSuccess: (response) => {
      const { tokens, user: userData } = response.data.data;
      if (!isPlatformAdminRole(userData.role)) {
        throw new Error("This account does not have platform admin access.");
      }
      setTokens(tokens.access_token, tokens.refresh_token);
      setUser(userData);
      router.push("/");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => AdminApiService.logout(),
    onSettled: () => {
      clearAuth();
      queryClient.clear();
      router.push("/login");
    },
  });

  const profileQuery = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PROFILE,
    queryFn: async () => {
      const res = await AdminApiService.getProfile();
      return res.data.data as {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        phone_number?: string;
        role: string;
      };
    },
    enabled: isAuthenticated,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateProfileRequest) => AdminApiService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ADMIN_PROFILE });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) => AdminApiService.changePassword(data),
  });

  return {
    user,
    isAuthenticated,
    profileQuery,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    updateProfile: updateProfileMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    loginError: loginMutation.error,
  };
}
