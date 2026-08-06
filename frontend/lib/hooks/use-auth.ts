import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/auth.store";
import { AuthService, LoginRequest, SignupRequest, ChangePasswordRequest } from "../api/services/auth.service";
import { OnboardingService } from "../api/services/onboarding.service";
import { signupWizardPath } from "../onboarding/signup-wizard";
import { authTracker } from "../analytics/flows/auth.tracker";
import { QUERY_KEYS } from "../api/config";

async function routeToSignupWizard(router: ReturnType<typeof useRouter>) {
  try {
    const onboardingStatus = await OnboardingService.getStatus();
    if (onboardingStatus.requiresOnboarding) {
      try {
        await OnboardingService.skip();
      } catch {
        // Continue with workspace setup even if skip fails
      }
    }
    const wizard = await OnboardingService.getSignupWizardStatus();
    router.push(signupWizardPath(wizard));
  } catch {
    router.push("/onboarding/create-site");
  }
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setTokens, setUser, setCurrentSiteId, clearAuth, user, isAuthenticated, currentSiteId } = useAuthStore();

  const clearSessionQueries = () => {
    queryClient.removeQueries({ queryKey: ["onboarding"] });
    queryClient.removeQueries({ queryKey: QUERY_KEYS.SITES });
  };

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => AuthService.login(data),
    onMutate: () => {
      authTracker.loginStarted();
    },
    onSuccess: async (response) => {
      const { tokens, user: userData } = response.data.data;
      clearSessionQueries();
      setTokens(tokens.access_token, tokens.refresh_token);
      setUser(userData);
      authTracker.loginSuccess({ userId: userData.id, planType: userData.plan });

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get("redirect");
        if (redirect) {
          router.push(redirect);
          return;
        }
      }

      await routeToSignupWizard(router);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Invalid email or password";
      authTracker.loginFailed({ error_message: message });
      console.error("Login failed:", message);
    },
  });

  const signupMutation = useMutation({
    mutationFn: (data: SignupRequest) => AuthService.signup(data),
    onMutate: () => {
      authTracker.signupStarted();
    },
    onSuccess: (response) => {
      const { tokens, user: userData } = response.data.data;
      // Drop previous account's onboarding/sites cache before navigating.
      clearSessionQueries();
      setTokens(tokens.access_token, tokens.refresh_token);
      setUser(userData);
      queryClient.setQueryData(["onboarding", "signup-wizard"], { stage: "email_verification" });
      authTracker.signupCompleted();

      if (typeof window !== "undefined") {
        const inviteToken = sessionStorage.getItem("blogforall_signup_invite_token");
        sessionStorage.removeItem("blogforall_signup_invite_token");
        if (inviteToken) {
          router.push(`/invitations/accept?token=${encodeURIComponent(inviteToken)}`);
          return;
        }
      }

      router.push("/auth/verify-email");
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Registration failed";
      authTracker.signupFailed({ error_message: message });
      console.error("Signup failed:", message);
      throw error;
    },
  });

  const abandonSignupMutation = useMutation({
    mutationFn: () => AuthService.abandonSignup(),
    onSuccess: () => {
      clearSessionQueries();
      clearAuth();
      router.replace("/auth/signup");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => AuthService.logout(),
    onSuccess: () => {
      authTracker.logout();
      clearSessionQueries();
      clearAuth();
      router.push("/auth/login");
    },
    onError: () => {
      authTracker.logout();
      clearSessionQueries();
      clearAuth();
      router.push("/auth/login");
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { first_name?: string; last_name?: string; phone_number?: string }) =>
      AuthService.updateProfile(data),
    onSuccess: (response, variables) => {
      if (variables.first_name || variables.last_name || variables.phone_number) {
        useAuthStore.getState().updateUser({
          first_name: variables.first_name,
          last_name: variables.last_name,
          phone_number: variables.phone_number,
        });
      }
      profileQuery.refetch();
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: ChangePasswordRequest) => AuthService.changePassword(data),
  });

  const updateSiteContextMutation = useMutation({
    mutationFn: (siteId: string) => AuthService.updateSiteContext(siteId),
    onSuccess: async (response) => {
      const { access_token } = response.data.data;
      const currentRefreshToken = useAuthStore.getState().refreshToken;
      if (currentRefreshToken) {
        setTokens(access_token, currentRefreshToken);
      }
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update workspace context";
      console.error("Update workspace context failed:", message);
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
    abandonSignup: abandonSignupMutation.mutate,
    abandonSignupAsync: abandonSignupMutation.mutateAsync,
    isAbandoningSignup: abandonSignupMutation.isPending,
    updateProfile: updateProfileMutation.mutate,
    changePassword: changePasswordMutation.mutate,
    updateSiteContext: updateSiteContextMutation.mutate,
    profile: profileQuery.data,
    isLoading:
      loginMutation.isPending ||
      signupMutation.isPending ||
      logoutMutation.isPending ||
      updateSiteContextMutation.isPending ||
      abandonSignupMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    signupError: signupMutation.error,
    user,
    isAuthenticated,
    currentSiteId,
    profileQuery,
  };
}
