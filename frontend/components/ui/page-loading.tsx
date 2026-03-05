"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageLoadingProps {
  /** Breadcrumb items to show above the loading state */
  breadcrumbItems?: BreadcrumbItem[];
  /** Message shown below the spinner (e.g. "Loading workspaces...") */
  message?: string;
}

export function PageLoading({ breadcrumbItems = [], message = "Loading..." }: PageLoadingProps) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        {breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} />}
        <div className="py-12 text-center">
          <div
            className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"
            aria-hidden
          />
          <p className="text-gray-400">{message}</p>
        </div>
      </div>
    </div>
  );
}
