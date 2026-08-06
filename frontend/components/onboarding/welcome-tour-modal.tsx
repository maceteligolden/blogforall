"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthService } from "@/lib/api/services/auth.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { Button } from "@/components/ui/button";
import { useStartWorkspaceSetupInterview } from "@/lib/onboarding/use-start-setup-interview";

export function WelcomeTourModal() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const { startWorkspaceSetupInterview } = useStartWorkspaceSetupInterview();

  const { data: profile } = useQuery({
    queryKey: ["auth", "profile", "welcome"],
    queryFn: async () => {
      const res = await AuthService.getProfile();
      return res.data.data as {
        welcome_tour_dismissed?: boolean;
        first_name?: string;
      };
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (profile && profile.welcome_tour_dismissed === false) {
      setOpen(true);
    }
  }, [profile]);

  const dismiss = async () => {
    setDismissing(true);
    try {
      await AuthService.dismissWelcomeTour();
      updateUser({ welcome_tour_dismissed: true });
      setOpen(false);
    } catch {
      setOpen(false);
    } finally {
      setDismissing(false);
    }
  };

  const finishBrandSetup = async () => {
    setDismissing(true);
    try {
      await AuthService.dismissWelcomeTour();
      updateUser({ welcome_tour_dismissed: true });
      setOpen(false);
      await startWorkspaceSetupInterview();
    } catch {
      setOpen(false);
    } finally {
      setDismissing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-2">
          Welcome{profile?.first_name ? `, ${profile.first_name}` : ""}
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          Your workspace is ready. Finish brand setup so the AI can write in your voice — share your website or answer a
          few quick questions in chat. You can also continue anytime from the setup progress bar in the navbar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={() => void finishBrandSetup()} disabled={dismissing}>
            {dismissing ? "…" : "Finish brand setup"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 border-gray-700"
            onClick={() => void dismiss()}
            disabled={dismissing}
          >
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}
