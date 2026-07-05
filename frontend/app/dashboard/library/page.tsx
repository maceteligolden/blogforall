"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { LibrarySourcePanel } from "@/components/library/library-source-panel";

export default function LibraryPage() {
  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb items={[{ label: "Library" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-display text-white">Library</h1>
        <p className="text-sm text-gray-400 mt-1">
          Upload files, connect cloud storage, and manage assets used across your workspace.
        </p>
      </div>
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <LibrarySourcePanel />
      </div>
    </div>
  );
}
