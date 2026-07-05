"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Copy, Check, Gift, Loader2, Users } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { useReferralDashboard } from "@/lib/hooks/use-referral";
import { useToast } from "@/components/ui/toast";

export default function ReferralsPage() {
  const { data, isLoading } = useReferralDashboard();
  const { toast } = useToast();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const copyToClipboard = async (text: string, type: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast({
        title: "Copied",
        description: type === "link" ? "Referral link copied" : "Referral code copied",
        variant: "success",
      });
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "error",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 lg:p-6">
        <p className="text-gray-400">Unable to load referral program.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl">
      <Breadcrumb items={[{ label: "Referrals" }]} />
      <div className="mb-8">
        <h1 className="text-2xl font-display text-white">Referrals</h1>
        <p className="text-sm text-gray-400 mt-1">Invite friends to Bloggr and earn bonus tokens when they sign up.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 mb-8">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total referrals</span>
          </div>
          <p className="text-3xl font-semibold text-white">{data.total_referrals}</p>
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <div className="flex items-center gap-2 text-gray-400 mb-2">
            <Gift className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Reward per signup</span>
          </div>
          <p className="text-3xl font-semibold text-white">
            {data.reward_per_referral_tokens.toLocaleString()}
            <span className="text-sm font-normal text-gray-400 ml-1">tokens</span>
          </p>
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8 space-y-4">
        <h2 className="text-base font-semibold text-white">Your referral link</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={data.referral_link}
            className="flex-1 bg-black border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300"
            aria-label="Referral link"
          />
          <Button
            type="button"
            variant="outline"
            className="border-gray-700 text-gray-300 shrink-0"
            onClick={() => copyToClipboard(data.referral_link, "link")}
          >
            {copied === "link" ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
            Copy link
          </Button>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Or share your code</p>
          <div className="flex items-center gap-2">
            <code className="px-3 py-2 rounded-lg bg-black border border-gray-700 text-primary font-mono text-sm">
              {data.referral_code}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-gray-400"
              onClick={() => copyToClipboard(data.referral_code, "code")}
              aria-label="Copy referral code"
            >
              {copied === "code" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Referral history</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {data.referrals.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No referrals yet. Share your link to get started.</p>
          ) : (
            <ul className="divide-y divide-gray-800">
              {data.referrals.map((referral) => (
                <li key={referral.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="text-white">{referral.referred_name || referral.referred_email || "New user"}</p>
                    {referral.referred_email && referral.referred_name && (
                      <p className="text-gray-500 text-xs">{referral.referred_email}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs capitalize">{referral.status.replace("_", " ")}</p>
                    <p className="text-gray-500 text-xs">{format(new Date(referral.signed_up_at), "MMM d, yyyy")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
