"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { SiteInvitationService, CreateInvitationRequest } from "@/lib/api/services/site-invitation.service";
import { SiteService } from "@/lib/api/services/site.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { cn } from "@/lib/utils/cn";
import { PendingInvitationsList } from "@/components/sites/pending-invitations-list";

interface InviteWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteId: string;
}

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const roleColors: Record<string, string> = {
  owner: "bg-purple-900/30 text-purple-400 border-purple-800",
  admin: "bg-blue-900/30 text-blue-400 border-blue-800",
  editor: "bg-green-900/30 text-green-400 border-green-800",
  viewer: "bg-gray-800 text-gray-300 border-gray-700",
};

function getInitials(firstName?: string, lastName?: string, email?: string) {
  const name = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function InviteWorkspaceModal({ isOpen, onClose, siteId }: InviteWorkspaceModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "viewer">("editor");
  const [error, setError] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: QUERY_KEYS.SITE_MEMBERS(siteId),
    queryFn: () => SiteService.getSiteMembers(siteId),
    enabled: isOpen && !!siteId,
  });

  const { data: invitations = [] } = useQuery({
    queryKey: QUERY_KEYS.SITE_INVITATIONS(siteId),
    queryFn: () => SiteInvitationService.getSiteInvitations(siteId),
    enabled: isOpen && !!siteId,
  });

  const inviteMutation = useMutation({
    mutationFn: (data: CreateInvitationRequest) => SiteInvitationService.createInvitation(siteId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITE_INVITATIONS(siteId) });
      toast({
        variant: "success",
        title: "Invitation sent",
        description: `Invitation sent to ${variables.email}.`,
      });
      setEmail("");
      setRole("editor");
      setError("");
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to send invitation";
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Email is required");
      return;
    }
    if (!trimmed.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    inviteMutation.mutate({ email: trimmed, role });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite to workspace" size="lg">
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-800 bg-red-900/50 p-3 text-sm text-red-200">{error}</div>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label htmlFor="invite-email" className="text-gray-300">
                Email address
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                className="mt-1 border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
              />
            </div>
            <div className="sm:w-40">
              <Label htmlFor="invite-role" className="text-gray-300">
                Role
              </Label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "editor" | "viewer")}
                className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
              >
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <Button
              type="submit"
              disabled={inviteMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90 sm:shrink-0"
            >
              {inviteMutation.isPending ? "Sending..." : "Send invitation"}
            </Button>
          </div>
        </form>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-300">
            Pending invitations
          </h3>
          <PendingInvitationsList siteId={siteId} invitations={invitations} compact />
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-300">Members ({members.length})</h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900/50 p-2">
            {members.map((member) => {
              const displayName =
                `${member.user?.first_name ?? ""} ${member.user?.last_name ?? ""}`.trim() ||
                member.user?.email ||
                "Member";
              return (
                <li
                  key={member._id}
                  className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-gray-800/50 transition-colors"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary"
                    aria-hidden="true"
                  >
                    {getInitials(member.user?.first_name, member.user?.last_name, member.user?.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{displayName}</p>
                    <p className="truncate text-xs text-gray-500">{member.user?.email}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                      roleColors[member.role] ?? roleColors.viewer
                    )}
                  >
                    {roleLabels[member.role] ?? member.role}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
