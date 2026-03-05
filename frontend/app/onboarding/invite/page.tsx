"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/protected-route";
import { Users } from "lucide-react";

const INVITE_PROMPT_SEEN_KEY = "blogforall_invite_prompt_seen";

export default function OnboardingInvitePage() {
  const router = useRouter();

  useEffect(() => {
    localStorage.setItem(INVITE_PROMPT_SEEN_KEY, "true");
  }, []);

  const handleSkip = () => {
    router.push("/dashboard");
  };

  const handleInvite = () => {
    router.push("/dashboard/sites/members");
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Invite your team
            </h1>
            <p className="text-xl text-gray-400">
              Add members to your workspace so they can collaborate on blogs and content. You can do this later from the dashboard.
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mb-6">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <p className="text-gray-300 text-center mb-8">
              Invite members by email and assign them a role (viewer, editor, or admin). They will receive an email to join your workspace.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 px-8"
              >
                Skip for now
              </Button>
              <Button
                onClick={handleInvite}
                className="bg-primary hover:bg-primary/90 text-white px-8"
              >
                Invite members
              </Button>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            You can manage invitations anytime from Workspaces → Members
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
