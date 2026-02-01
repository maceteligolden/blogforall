"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteInvitationService, CreateInvitationRequest } from "@/lib/api/services/site-invitation.service";
import { QUERY_KEYS } from "@/lib/api/config";

interface InviteMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
}

export function InviteMemberDialog({ isOpen, onClose, siteId }: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  const inviteMemberMutation = useMutation({
    mutationFn: (data: CreateInvitationRequest) =>
      SiteInvitationService.createInvitation(siteId, data),
    onSuccess: () => {
      // Invalidate invitations query to refetch
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.SITE_INVITATIONS(siteId),
      });
      
      // Reset form and close
      setEmail("");
      setRole("editor");
      setError("");
      onClose();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to send invitation";
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    inviteMemberMutation.mutate({
      email: email.trim(),
      role,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Member"
      size="md"
      footer={
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={inviteMemberMutation.isPending}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={inviteMemberMutation.isPending || !email.trim()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {inviteMemberMutation.isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="member-email" className="text-gray-300">
            Email Address <span className="text-red-400">*</span>
          </Label>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            required
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-400">
            An invitation will be sent to this email address
          </p>
        </div>

        <div>
          <Label htmlFor="member-role" className="text-gray-300">
            Role <span className="text-red-400">*</span>
          </Label>
          <select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
          >
            <option value="admin">Admin - Can manage members and content</option>
            <option value="editor">Editor - Can create and edit content</option>
            <option value="viewer">Viewer - Can only view content</option>
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Select the role for this team member
          </p>
        </div>
      </form>
    </Modal>
  );
}
