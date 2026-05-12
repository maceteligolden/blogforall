"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import { ProtectedRoute } from "@/components/protected-route";
import { Button } from "@/components/ui/button";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { useAIPanel } from "@/components/orchestrator/ai-panel-provider";
import type {
  OrchestratorApproval,
  OrchestratorApprovalStatus,
} from "@/lib/api/types/orchestrator.types";

const STATUS_FILTERS: Array<{ label: string; value: OrchestratorApprovalStatus }> = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Executed", value: "executed" },
  { label: "Expired", value: "expired" },
];

function formatApprovalKind(kind: OrchestratorApproval["kind"]): string {
  switch (kind) {
    case "in_chat_confirmation":
      return "In-chat confirmation";
    case "memory_update":
      return "Memory update";
    case "scheduled_post_review":
      return "Scheduled post review";
    case "campaign_proposal":
      return "Campaign proposal";
    default:
      return kind;
  }
}

function ApprovalCard({
  approval,
  onDecide,
  isDeciding,
}: {
  approval: OrchestratorApproval;
  onDecide: (decision: "approved" | "rejected") => void;
  isDeciding: boolean;
}) {
  const isPending = approval.status === "pending";
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-yellow-900/40 border border-yellow-700 flex items-center justify-center shrink-0">
          <ShieldAlert className="w-4 h-4 text-yellow-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-sm font-semibold truncate">{approval.action}</p>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {formatApprovalKind(approval.kind)}
            </span>
          </div>
          <p className="text-sm text-gray-300 mt-1 leading-relaxed">{approval.summary}</p>
          <p className="text-xs text-gray-500 mt-2">
            Requested {new Date(approval.requested_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${
            isPending
              ? "border-yellow-700 text-yellow-300 bg-yellow-900/30"
              : approval.status === "approved" || approval.status === "executed"
                ? "border-green-700 text-green-300 bg-green-900/30"
                : "border-gray-700 text-gray-400 bg-gray-900/40"
          }`}
        >
          {approval.status}
        </span>
      </div>

      {isPending && (
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDecide("rejected")}
            disabled={isDeciding}
            className="border-gray-700 text-gray-200 hover:bg-gray-800"
          >
            <XCircle className="w-4 h-4 mr-1" aria-hidden="true" /> Reject
          </Button>
          <Button
            size="sm"
            onClick={() => onDecide("approved")}
            disabled={isDeciding}
            className="bg-primary text-white hover:bg-primary/90"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" aria-hidden="true" /> Approve
          </Button>
        </div>
      )}
    </div>
  );
}

export default function ApprovalsPage() {
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();
  const { open: openAIPanel } = useAIPanel();
  const [statusFilter, setStatusFilter] = useState<OrchestratorApprovalStatus>("pending");

  const approvalsQuery = useQuery({
    queryKey: currentSiteId
      ? [...QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId), statusFilter]
      : ["orchestrator", "approvals", "none"],
    queryFn: () =>
      OrchestratorService.listApprovals(currentSiteId as string, statusFilter, 100),
    enabled: !!currentSiteId,
  });

  const decideMutation = useMutation({
    mutationFn: ({
      approvalId,
      decision,
    }: {
      approvalId: string;
      decision: "approved" | "rejected";
    }) =>
      OrchestratorService.decideApproval(currentSiteId as string, approvalId, decision),
    onSuccess: () => {
      if (currentSiteId) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId),
        });
      }
    },
  });

  const approvals = approvalsQuery.data ?? [];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold">Approvals</h1>
              <p className="text-gray-400 mt-1 text-sm">
                Review decisions the orchestrator has queued for human approval. Approving runs the
                pending action; rejecting cancels it.
              </p>
            </div>
            <Button
              onClick={() => openAIPanel()}
              variant="outline"
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <Sparkles className="w-4 h-4 mr-1" aria-hidden="true" /> Open AI chat
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  statusFilter === f.value
                    ? "border-primary bg-primary/20 text-white"
                    : "border-gray-800 text-gray-400 hover:bg-gray-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {approvalsQuery.isLoading && (
            <p className="text-sm text-gray-500">Loading approvals…</p>
          )}
          {approvalsQuery.isError && (
            <p className="text-sm text-red-300">Failed to load approvals. Try refreshing.</p>
          )}
          {!approvalsQuery.isLoading && approvals.length === 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-10 text-center">
              <p className="text-sm text-gray-300">No {statusFilter} approvals right now.</p>
              <p className="text-xs text-gray-500 mt-1">
                Approvals are created when the orchestrator runs an action that needs human review.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {approvals.map((a) => (
              <ApprovalCard
                key={a.id}
                approval={a}
                onDecide={(decision) =>
                  decideMutation.mutate({ approvalId: a.id, decision })
                }
                isDeciding={
                  decideMutation.isPending && decideMutation.variables?.approvalId === a.id
                }
              />
            ))}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
