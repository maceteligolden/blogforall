import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/auth.store";
import { AuthService, LoginRequest, SignupRequest, ChangePasswordRequest } from "../api/services/auth.service";
import { OnboardingService } from "../api/services/onboarding.service";

export function useAuth() {
  const router = useRouter();
  const { setTokens, setUser, setCurrentSiteId, clearAuth, user, isAuthenticated, currentSiteId } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => AuthService.login(data),
    onSuccess: async (response) => {
      const { tokens, user: userData } = response.data.data;
      setTokens(tokens.access_token, tokens.refresh_token);
      setUser(userData);
      
      // currentSiteId is automatically extracted from token in setTokens
      
      // Check onboarding status
      try {
        const onboardingStatus = await OnboardingService.getStatus();
        if (onboardingStatus.requiresOnboarding) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      } catch (error) {
        // If check fails, redirect to onboarding to be safe
        router.push("/onboarding");
      }
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Invalid email or password";
      console.error("Login failed:", message);
    },
  });

  const signupMutation = useMutation({
    mutationFn: (data: SignupRequest) => AuthService.signup(data),
    onSuccess: () => {
      // Redirect to login - user will be redirected to onboarding after login
      router.push("/auth/login?message=Account created successfully. Please sign in to continue.");
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Registration failed";
      console.error("Signup failed:", message);
      throw error; // Re-throw to allow component to handle
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => AuthService.logout(),
    onSuccess: () => {
      clearAuth();
      router.push("/auth/login");
    },
    onError: () => {
      clearAuth();
      router.push("/auth/login");
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { first_name?: string; last_name?: string; phone_number?: string }) =>
      AuthService.updateProfile(data),
    onSuccess: (response, variables) => {
      // Update user in store
      if (variables.first_name || variables.last_name || variables.phone_number) {
        useAuthStore.getState().updateUser({
          first_name: variables.first_name,
          last_name: variables.last_name,
          phone_number: variables.phone_number,
        });
      }
      // Refetch profile
      profileQuery.refetch();
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) => AuthService.changePassword(data),
  });

  /**
   * Update site context (switch active site)
   */
  const updateSiteContextMutation = useMutation({
    mutationFn: (siteId: string) => AuthService.updateSiteContext(siteId),
    onSuccess: async (response) => {
      const { access_token } = response.data.data;
      // Update token in store (which will extract and set currentSiteId)
      const currentRefreshToken = useAuthStore.getState().refreshToken;
      if (currentRefreshToken) {
        setTokens(access_token, currentRefreshToken);
      }
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to update site context";
      console.error("Update site context failed:", message);
    },
  });

  const profileQuery = useQuery({
    queryKey: ["auth", "profile"],
    queryFn: async () => {
      const response = await AuthService.getProfile();
      return response.data.data;
    },
    enabled: isAuthenticated,
  });

  return {
    login: loginMutation.mutate,
    signup: signupMutation.mutate,
    signupAsync: signupMutation.mutateAsync,
    logout: logoutMutation.mutate,
    updateProfile: updateProfileMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    updateSiteContext: updateSiteContextMutation.mutate,
    profile: profileQuery.data,
    isLoading: loginMutation.isPending || signupMutation.isPending || logoutMutation.isPending || updateSiteContextMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    signupError: signupMutation.error,
    user,
    isAuthenticated,
    currentSiteId,
    profileQuery,
  };
}

