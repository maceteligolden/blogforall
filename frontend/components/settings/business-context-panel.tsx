"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Settings → Business redirects to the dedicated Business sidebar page. */
export function BusinessContextPanel() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/business");
  }, [router]);

  return (
    <div className="flex items-center justify-center py-12">
      <p className="text-sm text-gray-400">Opening Business…</p>
    </div>
  );
}
