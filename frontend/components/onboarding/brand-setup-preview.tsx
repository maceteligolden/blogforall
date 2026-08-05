"use client";

import { BRAND_SETUP_ITEMS } from "@/lib/onboarding/brand-setup-items";

/** Static preview of deferred brand-setup items (no inputs). */
export function BrandSetupPreview() {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
      <p className="text-xs font-medium text-gray-300 mb-1">Coming up on your dashboard</p>
      <p className="text-[11px] text-gray-500 mb-2">
        Finish brand setup with AI later — about 2 minutes. Nothing to fill in here.
      </p>
      <ul className="space-y-1">
        {BRAND_SETUP_ITEMS.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-3 text-center text-gray-600">○</span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
