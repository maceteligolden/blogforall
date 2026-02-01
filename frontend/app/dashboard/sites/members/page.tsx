"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { SiteService, SiteMember } from "@/lib/api/services/site.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { Plus, Trash2, User, Shield, Edit, Eye } from "lucide-react";
import { InviteMemberDialog } from "@/components/sites/invite-member-dialog";

type SiteMemberRole = "owner" | "admin" | "editor" | "viewer";

const roleLabels: Record<SiteMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
};

const roleIcons: Record<SiteMemberRole, React.ReactNode> = {
  owner: <Shield className="w-4 h-4" />,
  admin: <Shield className="w-4 h-4" />,
  editor: <Edit className="w-4 h-4" />,
  viewer: <Eye className="w-4 h-4" />,
};

const roleColors: Record<SiteMemberRole, string> = {
  owner: "bg-purple-900/30 text-purple-400 border-purple-800",
  admin: "bg-blue-900/30 text-blue-400 border-blue-800",
  editor: "bg-green-900/30 text-green-400 border-green-800",
  viewer: "bg-gray-900/30 text-gray-400 border-gray-800",
};

export default function SiteMembersPage() {
  const router = useRouter();
  const { currentSiteId } = useAuthStore();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<SiteMember | null>(null);
  const [memberToUpdateRole, setMemberToUpdateRole] = useState<SiteMember | null>(null);
  const queryClient = useQueryClient();

  // Fetch site members
  const { data: members = [], isLoading } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.SITE_MEMBERS(currentSiteId) : [],
    queryFn: () => {
      if (!currentSiteId) throw new Error("No site selected");
      return SiteService.getSiteMembers(currentSiteId);
    },
    enabled: !!currentSiteId,
  });

  // Fetch current site info
  const { data: currentSite } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.SITE(currentSiteId) : [],
    queryFn: () => {
      if (!currentSiteId) throw new Error("No site selected");
      return SiteService.getSiteById(currentSiteId);
    },
    enabled: !!currentSiteId,
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => {
      if (!currentSiteId) throw new Error("No site selected");
      return SiteService.removeMember(currentSiteId, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: currentSiteId ? QUERY_KEYS.SITE_MEMBERS(currentSiteId) : [],
      });
      setMemberToRemove(null);
    },
  });

  // Update member role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin" | "editor" | "viewer" }) => {
      if (!currentSiteId) throw new Error("No site selected");
      return SiteService.updateMemberRole(currentSiteId, userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: currentSiteId ? QUERY_KEYS.SITE_MEMBERS(currentSiteId) : [],
      });
      setMemberToUpdateRole(null);
    },
  });

  if (!currentSiteId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <Breadcrumb items={[{ label: "Dashboard" }, { label: "Site Members" }]} />
          <div className="py-12 text-center">
            <p className="text-gray-400">Please select a site to view members</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <Breadcrumb items={[{ label: "Dashboard" }, { label: "Site Members" }]} />
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-400">Loading members...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Dashboard" }, { label: "Site Members" }]} />

        <main className="py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-display mb-2 tracking-tight">
                {currentSite?.name || "Site"} Members
              </h1>
              <p className="text-gray-400">Manage team members and their roles</p>
            </div>
            <Button
              onClick={() => setShowInviteDialog(true)}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </div>

          {/* Members List */}
          {members.length === 0 ? (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
              <User className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No members yet</h3>
              <p className="text-gray-400 mb-6">Invite team members to collaborate on this site</p>
              <Button
                onClick={() => setShowInviteDialog(true)}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800/50 border-b border-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wide">
                        Member
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wide">
                        Role
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400 uppercase tracking-wide">
                        Joined
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {members.map((member) => (
                      <tr key={member._id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                              <User className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <div className="text-white font-medium">
                                {member.user
                                  ? `${member.user.first_name} ${member.user.last_name}`
                                  : "Unknown User"}
                              </div>
                              <div className="text-sm text-gray-400">
                                {member.user?.email || "No email"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <select
                              value={member.role}
                              onChange={(e) => {
                                const newRole = e.target.value as SiteMemberRole;
                                if (newRole !== member.role && member.role !== "owner" && newRole !== "owner") {
                                  updateRoleMutation.mutate({
                                    userId: member.user_id,
                                    role: newRole as "admin" | "editor" | "viewer",
                                  });
                                }
                              }}
                              disabled={
                                member.role === "owner" ||
                                updateRoleMutation.isPending
                              }
                              className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {Object.entries(roleLabels).map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {member.joined_at
                            ? new Date(member.joined_at).toLocaleDateString()
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {member.role !== "owner" && (
                            <button
                              onClick={() => setMemberToRemove(member)}
                              className="text-red-400 hover:text-red-300 transition-colors p-2"
                              title="Remove member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Invite Member Dialog */}
      {showInviteDialog && (
        <InviteMemberDialog
          isOpen={showInviteDialog}
          onClose={() => setShowInviteDialog(false)}
          siteId={currentSiteId}
        />
      )}

      {/* Remove Member Confirmation */}
      {memberToRemove && (
        <ConfirmModal
          isOpen={!!memberToRemove}
          onClose={() => setMemberToRemove(null)}
          onConfirm={() => {
            if (memberToRemove) {
              removeMemberMutation.mutate(memberToRemove.user_id);
            }
          }}
          title="Remove Member"
          message={`Are you sure you want to remove ${
            memberToRemove.user
              ? `${memberToRemove.user.first_name} ${memberToRemove.user.last_name}`
              : "this member"
          } from the site?`}
          confirmText="Remove"
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </div>
  );
}
