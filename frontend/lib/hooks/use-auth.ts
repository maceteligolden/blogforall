import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../store/auth.store";
import { AuthService, LoginRequest, SignupRequest, ChangePasswordRequest } from "../api/services/auth.service";

export function useAuth() {
  const router = useRouter();
  const { setTokens, setUser, clearAuth, user, isAuthenticated } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => AuthService.login(data),
    onSuccess: (response) => {
      const { tokens, user: userData } = response.data.data;
      setTokens(tokens.access_token, tokens.refresh_token);
      setUser(userData);
      router.push("/dashboard");
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Invalid email or password";
      console.error("Login failed:", message);
    },
  });

  const signupMutation = useMutation({
    mutationFn: (data: SignupRequest) => AuthService.signup(data),
    onSuccess: () => {
      router.push("/auth/login");
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
    profile: profileQuery.data,
    isLoading: loginMutation.isPending || signupMutation.isPending || logoutMutation.isPending,
    isUpdatingProfile: updateProfileMutation.isPending,
    isChangingPassword: changePasswordMutation.isPending,
    signupError: signupMutation.error,
    user,
    isAuthenticated,
    profileQuery,
  };
}

