"use client";

import { Loader2 } from "lucide-react";

export function WizardFormLoader({ label = "Continuing…" }: { label?: string }) {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3" role="status" aria-live="polite">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}
