"use client";

import { X } from "lucide-react";
import { LibrarySourcePanel } from "@/components/library/library-source-panel";

interface KnowledgeBaseModalProps {
  open: boolean;
  onClose: () => void;
}

export function KnowledgeBaseModal({ open, onClose }: KnowledgeBaseModalProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close knowledge base modal"
        className="fixed inset-0 z-50 bg-black/70"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Knowledge base"
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Knowledge base</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <LibrarySourcePanel enabled={open} />
        </div>
      </div>
    </>
  );
}
