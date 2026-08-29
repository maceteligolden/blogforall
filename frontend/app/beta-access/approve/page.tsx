"use client";

import { Suspense } from "react";
import { BetaDecisionPage } from "@/components/beta-access/beta-decision-page";

export default function BetaApprovePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <p className="text-gray-400">Loading…</p>
        </div>
      }
    >
      <BetaDecisionPage mode="approve" />
    </Suspense>
  );
}
