import { useMutation } from "@tanstack/react-query";
import {
  AuthService,
  ForgotPasswordRequest,
  VerifyResetCodeRequest,
  ResetPasswordRequest,
} from "../api/services/auth.service";

export function usePasswordReset() {
  const forgotPasswordMutation = useMutation({
    mutationFn: (data: ForgotPasswordRequest) => AuthService.forgotPassword(data),
  });

  const verifyResetCodeMutation = useMutation({
    mutationFn: (data: VerifyResetCodeRequest) => AuthService.verifyResetCode(data),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (data: ResetPasswordRequest) => AuthService.resetPassword(data),
  });

  return {
    forgotPassword: forgotPasswordMutation.mutateAsync,
    verifyResetCode: verifyResetCodeMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    isRequestingCode: forgotPasswordMutation.isPending,
    isVerifyingCode: verifyResetCodeMutation.isPending,
    isResettingPassword: resetPasswordMutation.isPending,
  };
}
