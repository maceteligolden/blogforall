"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CampaignService, type CampaignIntelligenceSnapshot } from "@/lib/api/services/campaign.service";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/api/config";

function pct(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

export function CampaignIntelligencePanel({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN_INTELLIGENCE(campaignId),
    queryFn: async () => {
      const res = await CampaignService.getIntelligence(campaignId);
      return res.data.data as CampaignIntelligenceSnapshot;
    },
    enabled: !!campaignId,
  });

  const recompute = useMutation({
    mutationFn: () => CampaignService.recomputeIntelligence(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_INTELLIGENCE(campaignId) });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading campaign intelligence…</p>;
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
        <p className="text-sm text-gray-400 mb-3">No intelligence snapshot yet.</p>
        <Button
          variant="outline"
          className="border-gray-700 text-gray-300"
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
        >
          {recompute.isPending ? "Computing…" : "Compute intelligence"}
        </Button>
      </div>
    );
  }

  const dims = data.dimensions ?? {};

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">Campaign intelligence</h3>
          <p className="text-xs text-gray-500 mt-1">
            Success probability {pct(data.success_probability)} · progress {pct((data.progress_pct ?? 0) / 100)}
            {data.computed_at ? ` · updated ${new Date(data.computed_at).toLocaleString()}` : ""}
          </p>
        </div>
        <Button
          variant="outline"
          className="border-gray-700 text-gray-300"
          onClick={() => recompute.mutate()}
          disabled={recompute.isPending}
        >
          {recompute.isPending ? "Recomputing…" : "Recompute"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Object.entries(dims).map(([key, value]) => (
          <div key={key} className="rounded-lg border border-gray-800 bg-black/30 p-3">
            <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, " ")}</p>
            <p className="text-lg font-semibold mt-1">{pct(value as number)}</p>
          </div>
        ))}
      </div>

      {data.funnel_coverage && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Funnel coverage</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.funnel_coverage).map(([k, v]) => (
              <span key={k} className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-300">
                {k}: {pct(v as number)}
              </span>
            ))}
          </div>
        </div>
      )}

      {(data.recommended_actions?.length ?? 0) > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Recommended actions</p>
          <ul className="space-y-1">
            {data.recommended_actions!.map((a, i) => (
              <li key={i} className="text-sm text-gray-300">
                · {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(data.next_questions?.length ?? 0) > 0 && (
        <div>
          <p className="text-sm text-gray-400 mb-2">Next questions</p>
          <ul className="space-y-1">
            {data.next_questions!.map((q, i) => (
              <li key={i} className="text-sm text-gray-300">
                · {q}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
