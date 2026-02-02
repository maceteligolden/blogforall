import { useState, useEffect, useCallback } from "react";
import { PromptAnalysis } from "@/lib/api/services/blog-generation.service";

const DRAFT_STORAGE_KEY = "blog_generation_draft";
const DRAFT_EXPIRY_DAYS = 7; // Drafts expire after 7 days

interface BlogGenerationDraft {
  mode: "write" | "ai-generate";
  prompt: string;
  promptAnalysis: PromptAnalysis | null;
  formData: {
    title: string;
    content: string;
    content_type: "html" | "markdown";
    excerpt: string;
    featured_image: string;
    category: string;
    status: "draft" | "published" | "unpublished";
  };
  timestamp: number;
}

export function useBlogDraft() {
  const [hasDraft, setHasDraft] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // Check if draft exists and is valid
  const checkDraft = useCallback((): BlogGenerationDraft | null => {
    if (typeof window === "undefined") return null;

    try {
      const draftJson = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!draftJson) return null;

      const draft: BlogGenerationDraft = JSON.parse(draftJson);
      
      // Check if draft has expired
      const now = Date.now();
      const draftAge = now - draft.timestamp;
      const expiryMs = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      
      if (draftAge > expiryMs) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
      }

      return draft;
    } catch (error) {
      console.error("Error reading draft:", error);
      return null;
    }
  }, []);

  // Load draft
  const loadDraft = useCallback((): BlogGenerationDraft | null => {
    const draft = checkDraft();
    setHasDraft(!!draft);
    return draft;
  }, [checkDraft]);

  // Save draft
  const saveDraft = useCallback((draft: Omit<BlogGenerationDraft, "timestamp">) => {
    if (typeof window === "undefined") return;

    try {
      const draftWithTimestamp: BlogGenerationDraft = {
        ...draft,
        timestamp: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draftWithTimestamp));
      setHasDraft(true);
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  }, []);

  // Clear draft
  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setHasDraft(false);
    } catch (error) {
      console.error("Error clearing draft:", error);
    }
  }, []);

  // Check for draft on mount
  useEffect(() => {
    const draft = checkDraft();
    setHasDraft(!!draft);
  }, [checkDraft]);

  return {
    hasDraft,
    draftRestored,
    setDraftRestored,
    loadDraft,
    saveDraft,
    clearDraft,
    checkDraft,
  };
}
