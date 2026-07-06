"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Mail, RefreshCw, X } from "lucide-react";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { SiteInvitation, SiteInvitationService } from "@/lib/api/services/site-invitation.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { cn } from "@/lib/utils/cn";
import { formatInvitationExpiry, invitationStatusLabel, isInvitationExpired } from "@/lib/utils/invitation.util";

interface PendingInvitationsListProps {
  siteId: string;
  invitations: SiteInvitation[];
  compact?: boolean;
}

export function PendingInvitationsList({ siteId, invitations, compact = false }: PendingInvitationsListProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [invitationToCancel, setInvitationToCancel] = useState<SiteInvitation | null>(null);

  const resendMutation = useMutation({
    mutationFn: (invitationId: string) => SiteInvitationService.resendInvitation(siteId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITE_INVITATIONS(siteId) });
      toast({ variant: "success", title: "Invitation resent", description: "A fresh invitation email was sent." });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to resend invitation";
      toast({ variant: "error", title: "Resend failed", description: message });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (invitationId: string) => SiteInvitationService.cancelInvitation(siteId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITE_INVITATIONS(siteId) });
      setInvitationToCancel(null);
      toast({ variant: "success", title: "Invitation cancelled", description: "The invite is no longer active." });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to cancel invitation";
      toast({ variant: "error", title: "Cancel failed", description: message });
    },
  });

  const activeInvites = invitations.filter((inv) => inv.status === "pending" || inv.status === "expired");

  if (activeInvites.length === 0) {
    return (
      <p className={cn("text-sm text-gray-500", compact ? "py-2" : "py-4 text-center")}>No pending invitations yet.</p>
    );
  }

  return (
    <>
      <ul className={cn("space-y-2", compact ? "max-h-48 overflow-y-auto" : "")}>
        {activeInvites.map((inv) => {
          const expired = isInvitationExpired(inv);
          const status = invitationStatusLabel(inv);
          const canCancel = inv.status === "pending" && !expired;

          return (
            <li
              key={inv._id}
              className={cn(
                "flex items-start gap-3 rounded-md border border-gray-800 bg-gray-900/50 px-3 py-2",
                compact ? "text-sm" : ""
              )}
            >
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{inv.email}</p>
                <p className="text-xs capitalize text-gray-500">{inv.role}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatInvitationExpiry(inv)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-medium",
                    expired
                      ? "border-red-800 bg-red-900/30 text-red-400"
                      : "border-amber-800 bg-amber-900/30 text-amber-400"
                  )}
                >
                  {status}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => resendMutation.mutate(inv._id)}
                    disabled={resendMutation.isPending}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 disabled:opacity-50"
                    title={expired ? "Send a new invitation" : "Resend invitation"}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Resend
                  </button>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setInvitationToCancel(inv)}
                      disabled={cancelMutation.isPending}
                      className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      title="Cancel invitation"
                    >
                      <X className="h-3 w-3" />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {invitationToCancel && (
        <ConfirmModal
          isOpen={!!invitationToCancel}
          onClose={() => setInvitationToCancel(null)}
          onConfirm={() => cancelMutation.mutate(invitationToCancel._id)}
          title="Cancel invitation"
          message={`Cancel the invitation sent to ${invitationToCancel.email}? They will no longer be able to join with this link.`}
          confirmText="Cancel invitation"
          cancelText="Keep"
          variant="danger"
          closeOnConfirm={false}
          isConfirming={cancelMutation.isPending}
        />
      )}
    </>
  );
}
