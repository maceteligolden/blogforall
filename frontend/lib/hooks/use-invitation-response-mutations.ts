"use client";

import { useMutation } from "@tanstack/react-query";
import { SiteInvitationService } from "@/lib/api/services/site-invitation.service";

interface UseInvitationResponseMutationsOptions {
  token: string | null;
  onAcceptSuccess?: () => void;
  onRejectSuccess?: () => void;
  onAcceptError?: (message: string) => void;
  onRejectError?: () => void;
}

export function useInvitationResponseMutations(options: UseInvitationResponseMutationsOptions) {
  const {
    token,
    onAcceptSuccess,
    onRejectSuccess,
    onAcceptError,
    onRejectError,
  } = options;

  const acceptMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error("No invitation token");
      return SiteInvitationService.acceptInvitation(token);
    },
    onSuccess: () => onAcceptSuccess?.(),
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to accept invitation";
      onAcceptError?.(msg);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => {
      if (!token) throw new Error("No invitation token");
      return SiteInvitationService.rejectInvitation(token);
    },
    onSuccess: () => onRejectSuccess?.(),
    onError: () => onRejectError?.(),
  });

  return { acceptMutation, rejectMutation };
}
