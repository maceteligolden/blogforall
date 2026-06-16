"use client";

import Link from "next/link";
import { useState, useEffect, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, Plus, Check, Pencil, X, LayoutGrid } from "lucide-react";
import { SiteService } from "@/lib/api/services/site.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { CreateSiteDialog } from "./create-site-dialog";
import { workspaceTracker } from "@/lib/analytics/flows/workspace.tracker";

export function SiteSwitcher() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { currentSiteId, updateSiteContext } = useAuth();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: sitesData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    enabled: isAuthenticated,
  });
  const sites = Array.isArray(sitesData) ? sitesData : [];

  const currentSite = sites.find((site) => site._id === currentSiteId);

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      SiteService.updateSite(id, { name }),
    onSuccess: (updated, variables) => {
      workspaceTracker.updated({ workspace_name: variables.name });
      queryClient.setQueryData(QUERY_KEYS.SITE(variables.id), updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      setEditingSiteId(null);
      setEditName("");
      setEditError(null);
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Could not rename workspace";
      setEditError(message);
    },
  });

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

  useEffect(() => {
    if (!showDropdown) {
      setEditingSiteId(null);
      setEditName("");
      setEditError(null);
    }
  }, [showDropdown]);

  useEffect(() => {
    if (editingSiteId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSiteId]);

  const handleSiteSelect = (siteId: string) => {
    if (siteId !== currentSiteId) {
      const site = sites.find((s) => s._id === siteId);
      workspaceTracker.switched({
        previous_workspace_id: currentSiteId ?? undefined,
        workspace_name: site?.name,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      updateSiteContext(siteId);
    }
    setShowDropdown(false);
  };

  const startEditing = (siteId: string, currentName: string) => {
    setEditingSiteId(siteId);
    setEditName(currentName);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingSiteId(null);
    setEditName("");
    setEditError(null);
    renameMutation.reset();
  };

  const submitEdit = () => {
    if (!editingSiteId) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError("Name cannot be empty");
      return;
    }
    const original = sites.find((s) => s._id === editingSiteId);
    if (original && original.name === trimmed) {
      cancelEditing();
      return;
    }
    setEditError(null);
    renameMutation.mutate({ id: editingSiteId, name: trimmed });
  };

  const handleEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEditing();
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="relative z-[9999]" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 px-3 py-2 rounded-md border border-gray-700 bg-gray-900 hover:bg-gray-800 transition-colors text-sm text-gray-300 hover:text-white min-w-[200px]"
          aria-label={showDropdown ? "Close site selector" : "Open site selector"}
          aria-expanded={showDropdown}
          aria-haspopup="true"
          aria-controls="site-switcher-dropdown"
        >
          <Building2 className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />
          <span className="flex-1 text-left truncate">
            {isLoading ? (
              "Loading..."
            ) : currentSite ? (
              currentSite.name
            ) : (
              "Select Site"
            )}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {showDropdown && (
          <div
            id="site-switcher-dropdown"
            role="menu"
            aria-label="Site selector menu"
            className="absolute left-0 mt-2 w-72 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl py-2 z-[10000]"
            style={{ zIndex: 10000 }}
          >
            {isLoading ? (
              <div className="px-4 py-2 text-sm text-gray-400" role="status" aria-live="polite">Loading sites...</div>
            ) : sites.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-400" role="status">No sites found</div>
            ) : (
              <>
                {(sites ?? []).map((site) => {
                  const isEditing = editingSiteId === site._id;
                  const isCurrent = site._id === currentSiteId;
                  const isSaving = isEditing && renameMutation.isPending;

                  if (isEditing) {
                    return (
                      <div
                        key={site._id}
                        className="px-3 py-2 bg-gray-800/60"
                        role="group"
                        aria-label={`Rename ${site.name}`}
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={handleEditKeyDown}
                            disabled={isSaving}
                            aria-label="Workspace name"
                            aria-invalid={editError ? true : undefined}
                            className="flex-1 min-w-0 px-2 py-1 text-sm bg-gray-900 border border-gray-700 rounded text-white focus:outline-none focus:border-primary disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={submitEdit}
                            disabled={isSaving}
                            aria-label="Save workspace name"
                            className="p-1 rounded text-primary hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Check className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSaving}
                            aria-label="Cancel rename"
                            className="p-1 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                        {editError && (
                          <p className="mt-1 ml-6 text-xs text-red-400" role="alert">
                            {editError}
                          </p>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={site._id}
                      className="flex items-center gap-1 pr-1 hover:bg-gray-800 transition-colors"
                    >
                      <button
                        role="menuitem"
                        onClick={() => handleSiteSelect(site._id)}
                        className="flex-1 min-w-0 flex items-center gap-2 pl-4 pr-2 py-2 text-sm text-gray-300 text-left"
                        aria-label={`Switch to ${site.name} site${isCurrent ? " (current)" : ""}`}
                        aria-checked={isCurrent}
                      >
                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                        <span className="flex-1 truncate">{site.name}</span>
                        {isCurrent && (
                          <Check className="w-4 h-4 text-primary flex-shrink-0" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(site._id, site.name);
                        }}
                        aria-label={`Rename ${site.name}`}
                        className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-700 flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
                <hr className="my-2 border-gray-800" role="separator" aria-orientation="horizontal" />
                <Link
                  href="/dashboard/sites"
                  role="menuitem"
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  onClick={() => setShowDropdown(false)}
                >
                  <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                  Workspaces
                </Link>
                <button
                  role="menuitem"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowCreateDialog(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  aria-label="Create a new site"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Create New Site
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <CreateSiteDialog isOpen={showCreateDialog} onClose={() => setShowCreateDialog(false)} />
    </>
  );
}
