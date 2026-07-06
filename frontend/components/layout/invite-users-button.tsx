"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users } from "lucide-react";
import { InviteWorkspaceModal } from "@/components/layout/invite-workspace-modal";
import { SiteService } from "@/lib/api/services/site.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { cn } from "@/lib/utils/cn";

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
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

export function InviteUsersButton() {
  const { currentSiteId } = useAuthStore();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: members = [] } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.SITE_MEMBERS(currentSiteId) : ["site-members", "none"],
    queryFn: () => SiteService.getSiteMembers(currentSiteId!),
    enabled: !!currentSiteId,
  });

  const memberCount = members.length;
  const previewMembers = members.slice(0, 3);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const openModal = () => {
    setShowDropdown(false);
    setShowModal(true);
  };

  if (!currentSiteId) {
    return null;
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowDropdown((open) => !open)}
          className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
          aria-expanded={showDropdown}
          aria-haspopup="true"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">{memberCount} member{memberCount === 1 ? "" : "s"}</span>
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-800 bg-gray-900 p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Team</p>
              <button
                type="button"
                onClick={openModal}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite
              </button>
            </div>
            <ul className="space-y-2">
              {previewMembers.map((member) => {
                const displayName =
                  `${member.user?.first_name ?? ""} ${member.user?.last_name ?? ""}`.trim() ||
                  member.user?.email ||
                  "Member";
                return (
                  <li key={member._id} className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                      {getInitials(member.user?.first_name, member.user?.last_name, member.user?.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{displayName}</p>
                      <p className="truncate text-xs text-gray-500">{roleLabels[member.role] ?? member.role}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {memberCount > 3 && <p className="mt-2 text-xs text-gray-500">+{memberCount - 3} more</p>}
            <button
              type="button"
              onClick={openModal}
              className={cn(
                "mt-3 w-full rounded-md border border-gray-700 px-3 py-2 text-sm text-gray-300",
                "hover:bg-gray-800 hover:text-white transition-colors"
              )}
            >
              Invite teammates
            </button>
          </div>
        )}
      </div>

      <InviteWorkspaceModal isOpen={showModal} onClose={() => setShowModal(false)} siteId={currentSiteId} />
    </>
  );
}
