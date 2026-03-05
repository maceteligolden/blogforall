"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Plus, Check } from "lucide-react";
import { SiteService, Site } from "@/lib/api/services/site.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { CreateSiteDialog } from "./create-site-dialog";
import { useQueryClient } from "@tanstack/react-query";

export function SiteSwitcher() {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentSiteId, updateSiteContext } = useAuth();
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();

  // Fetch sites
  const { data: sitesData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    enabled: isAuthenticated,
  });
  const sites = Array.isArray(sitesData) ? sitesData : [];

  // Get current site
  const currentSite = sites.find((site) => site._id === currentSiteId);

  // Close dropdown when clicking outside
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

  const handleSiteSelect = (siteId: string) => {
    if (siteId !== currentSiteId) {
      // Invalidate all blog and category queries when switching sites
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      updateSiteContext(siteId);
    }
    setShowDropdown(false);
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
            className="absolute left-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-lg shadow-2xl py-2 z-[10000]"
            style={{ zIndex: 10000 }}
          >
            {isLoading ? (
              <div className="px-4 py-2 text-sm text-gray-400" role="status" aria-live="polite">Loading sites...</div>
            ) : sites.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-400" role="status">No sites found</div>
            ) : (
              <>
                {sites.map((site) => (
                  <button
                    key={site._id}
                    role="menuitem"
                    onClick={() => handleSiteSelect(site._id)}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                    aria-label={`Switch to ${site.name} site${site._id === currentSiteId ? " (current)" : ""}`}
                    aria-checked={site._id === currentSiteId}
                  >
                    <span className="flex-1 text-left truncate">{site.name}</span>
                    {site._id === currentSiteId && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" aria-hidden="true" />
                    )}
                  </button>
                ))}
                <hr className="my-2 border-gray-800" role="separator" aria-orientation="horizontal" />
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
