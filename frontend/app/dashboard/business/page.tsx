"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BusinessProfileForm } from "@/components/business/business-profile-form";

export default function BusinessPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Business" }]} />
        <div className="mb-8 mt-4">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">Business</h1>
          <p className="mt-2 text-sm text-gray-400">
            Workspace profile the AI uses for strategy, drafts, and brand setup. Edit here or improve sections in chat.
          </p>
        </div>
        <BusinessProfileForm />
      </div>
    </div>
  );
}
