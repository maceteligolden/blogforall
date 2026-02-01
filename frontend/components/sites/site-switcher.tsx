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
  const { data: sites = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    enabled: isAuthenticated,
  });

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
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center space-x-2 px-3 py-2 rounded-md border border-gray-700 bg-gray-900 hover:bg-gray-800 transition-colors text-sm text-gray-300 hover:text-white min-w-[200px]"
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
          <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
        </button>

        {showDropdown && (
          <div className="absolute left-0 mt-2 w-64 bg-gray-900 border border-gray-800 rounded-lg shadow-lg py-2 z-50">
            {isLoading ? (
              <div className="px-4 py-2 text-sm text-gray-400">Loading sites...</div>
            ) : sites.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-400">No sites found</div>
            ) : (
              <>
                {sites.map((site) => (
                  <button
                    key={site._id}
                    onClick={() => handleSiteSelect(site._id)}
                    className="w-full flex items-center justify-between px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    <span className="flex-1 text-left truncate">{site.name}</span>
                    {site._id === currentSiteId && (
                      <Check className="w-4 h-4 text-primary flex-shrink-0 ml-2" />
                    )}
                  </button>
                ))}
                <hr className="my-2 border-gray-800" />
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowCreateDialog(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
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
