"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CategoryService, Category } from "@/lib/api/services/category.service";
import { SiteService, Site } from "@/lib/api/services/site.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { Checkbox } from "@/components/ui/checkbox";

interface ImportCategoriesDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportCategoriesDialog({ isOpen, onClose }: ImportCategoriesDialogProps) {
  const { currentSiteId } = useAuthStore();
  const [sourceSiteId, setSourceSiteId] = useState<string>("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const queryClient = useQueryClient();

  // Fetch user's sites
  const { data: sites = [] } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(),
    enabled: isOpen,
  });

  // Fetch categories from source site
  const { data: sourceCategories = [] } = useQuery({
    queryKey: sourceSiteId ? [...QUERY_KEYS.CATEGORIES, "source", sourceSiteId] : [],
    queryFn: async () => {
      if (!sourceSiteId) return [];
      // Temporarily switch site context to fetch source site categories
      // Note: This is a workaround - ideally the backend would support fetching categories by siteId
      // For now, we'll need to handle this differently or add a new endpoint
      const response = await CategoryService.getCategories({ tree: true });
      return response.data?.data || [];
    },
    enabled: isOpen && !!sourceSiteId && sourceSiteId !== currentSiteId,
  });

  const importCategoriesMutation = useMutation({
    mutationFn: ({ sourceSiteId, targetSiteId, categoryIds }: {
      sourceSiteId: string;
      targetSiteId: string;
      categoryIds: string[];
    }) => CategoryService.importCategories(sourceSiteId, targetSiteId, categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
      setSourceSiteId("");
      setSelectedCategoryIds(new Set());
      setError("");
      onClose();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to import categories";
      setError(message);
    },
  });

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSourceSiteId("");
      setSelectedCategoryIds(new Set());
      setError("");
    }
  }, [isOpen]);

  const handleSourceSiteChange = (siteId: string) => {
    setSourceSiteId(siteId);
    setSelectedCategoryIds(new Set());
  };

  const toggleCategorySelection = (categoryId: string) => {
    const newSelection = new Set(selectedCategoryIds);
    if (newSelection.has(categoryId)) {
      newSelection.delete(categoryId);
    } else {
      newSelection.add(categoryId);
    }
    setSelectedCategoryIds(newSelection);
  };

  const toggleCategoryWithChildren = (category: Category & { children?: Category[] }) => {
    const newSelection = new Set(selectedCategoryIds);
    const isSelected = newSelection.has(category._id);
    
    const toggleRecursive = (cat: Category & { children?: Category[] }) => {
      if (isSelected) {
        newSelection.delete(cat._id);
      } else {
        newSelection.add(cat._id);
      }
      if (cat.children) {
        cat.children.forEach(toggleRecursive);
      }
    };
    
    toggleRecursive(category);
    setSelectedCategoryIds(newSelection);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!sourceSiteId) {
      setError("Please select a source site");
      return;
    }

    if (!currentSiteId) {
      setError("No target site selected");
      return;
    }

    if (selectedCategoryIds.size === 0) {
      setError("Please select at least one category to import");
      return;
    }

    importCategoriesMutation.mutate({
      sourceSiteId,
      targetSiteId: currentSiteId,
      categoryIds: Array.from(selectedCategoryIds),
    });
  };

  const renderCategoryTree = (categories: (Category & { children?: Category[] })[], level = 0): React.ReactNode => {
    return categories.map((category) => {
      const isSelected = selectedCategoryIds.has(category._id);
      const hasChildren = category.children && category.children.length > 0;
      
      return (
        <div key={category._id} className={`ml-${level * 4}`}>
          <div className="flex items-center space-x-2 py-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => {
                if (hasChildren) {
                  toggleCategoryWithChildren(category);
                } else {
                  toggleCategorySelection(category._id);
                }
              }}
            />
            <Label
              className="flex-1 cursor-pointer text-gray-300"
              onClick={() => {
                if (hasChildren) {
                  toggleCategoryWithChildren(category);
                } else {
                  toggleCategorySelection(category._id);
                }
              }}
            >
              {category.color && (
                <span
                  className="inline-block w-3 h-3 rounded mr-2"
                  style={{ backgroundColor: category.color }}
                />
              )}
              {category.name}
              {category.description && (
                <span className="text-xs text-gray-500 ml-2">- {category.description}</span>
              )}
            </Label>
          </div>
          {hasChildren && (
            <div className="ml-6">
              {renderCategoryTree(category.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Filter out current site from source sites
  const availableSourceSites = sites.filter((site) => site._id !== currentSiteId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Categories"
      size="lg"
      footer={
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={importCategoriesMutation.isPending}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              importCategoriesMutation.isPending ||
              !sourceSiteId ||
              selectedCategoryIds.size === 0
            }
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {importCategoriesMutation.isPending ? "Importing..." : `Import ${selectedCategoryIds.size} Categor${selectedCategoryIds.size === 1 ? "y" : "ies"}`}
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
          <Label htmlFor="source-site" className="text-gray-300">
            Source Site <span className="text-red-400">*</span>
          </Label>
          <select
            id="source-site"
            value={sourceSiteId}
            onChange={(e) => handleSourceSiteChange(e.target.value)}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 text-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
            required
          >
            <option value="">Select a site...</option>
            {availableSourceSites.map((site) => (
              <option key={site._id} value={site._id}>
                {site.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Select the site you want to import categories from
          </p>
        </div>

        {sourceSiteId && (
          <div>
            <Label className="text-gray-300 mb-2 block">
              Select Categories to Import <span className="text-red-400">*</span>
            </Label>
            <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-md bg-gray-800/50 p-4">
              {sourceCategories.length === 0 ? (
                <p className="text-gray-400 text-sm">No categories found in the selected site</p>
              ) : (
                <div className="space-y-1">
                  {renderCategoryTree(sourceCategories as (Category & { children?: Category[] })[])}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-gray-400">
              {selectedCategoryIds.size > 0
                ? `${selectedCategoryIds.size} categor${selectedCategoryIds.size === 1 ? "y" : "ies"} selected`
                : "Select categories to import (nested categories will be imported automatically)"}
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
