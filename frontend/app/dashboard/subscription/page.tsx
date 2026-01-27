"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SubscriptionService, Plan, SubscriptionResponse } from "@/lib/api/services/subscription.service";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/api/config";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { Loader2 } from "lucide-react";

export default function SubscriptionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isChangePlanDialogOpen, setIsChangePlanDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [pendingPlanChangeId, setPendingPlanChangeId] = useState<string | null>(null);

  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<SubscriptionResponse>({
    queryKey: QUERY_KEYS.SUBSCRIPTION,
    queryFn: () => SubscriptionService.getSubscription(),
  });

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: QUERY_KEYS.PLANS,
    queryFn: () => SubscriptionService.getPlans(),
  });

  const changePlanMutation = useMutation({
    mutationFn: (planId: string) => SubscriptionService.changePlan(planId),
    onSuccess: () => {
      toast({
        title: "Plan change scheduled",
        description: "Your plan change has been scheduled and will take effect at the start of your next billing cycle.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS });
      setSelectedPlanId(null);
      setIsChangePlanDialogOpen(false);
      setPendingPlanChangeId(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || "Failed to change plan";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "error",
      });
      setIsChangePlanDialogOpen(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => SubscriptionService.cancelSubscription(),
    onSuccess: () => {
      toast({
        title: "Cancellation requested",
        description: "Your subscription will be cancelled at the end of your current billing period.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
      setIsCancelDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to cancel subscription",
        variant: "error",
      });
      setIsCancelDialogOpen(false);
    },
  });

  const handleChangePlan = (planId: string) => {
    setSelectedPlanId(planId);
    setIsChangePlanDialogOpen(true);
  };

  const confirmChangePlan = () => {
    if (selectedPlanId) {
      changePlanMutation.mutate(selectedPlanId);
    }
  };

  const handleCancel = () => {
    setIsCancelDialogOpen(true);
  };

  const confirmCancel = () => {
    cancelMutation.mutate();
  };

  if (subscriptionLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  const currentPlan = subscriptionData?.plan;
  const currentSubscription = subscriptionData?.subscription;
  
  // Get pending plan if exists
  const pendingPlan = currentSubscription?.pendingPlanId 
    ? plans?.find((p) => p._id === currentSubscription.pendingPlanId)
    : null;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Subscription Management</h1>

        {/* Current Subscription */}
        {currentSubscription && currentPlan && (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Current Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold mb-2">{currentPlan.name}</h3>
                <p className="text-3xl font-bold text-primary mb-2">
                  ${currentPlan.price}
                  <span className="text-lg text-gray-400">/{currentPlan.interval === "free" ? "free" : "month"}</span>
                </p>
                <p className="text-gray-400 mb-4">Status: <span className="text-white capitalize">{currentSubscription.status}</span></p>
              </div>
              <div>
                <p className="text-gray-400 mb-2">
                  Current Period: {new Date(currentSubscription.currentPeriodStart).toLocaleDateString()} - {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                </p>
                {currentSubscription.cancelAtPeriodEnd && (
                  <p className="text-yellow-400 mb-4">⚠️ Subscription will be cancelled at the end of the billing period</p>
                )}
                {pendingPlan && (
                  <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 mb-4">
                    <p className="text-blue-300 font-semibold mb-2">📅 Plan Change Scheduled</p>
                    <p className="text-blue-200 text-sm mb-1">
                      Your plan will change to <span className="font-bold">{pendingPlan.name}</span> at the start of your next billing cycle.
                    </p>
                    <p className="text-blue-300 text-xs">
                      Effective: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {currentSubscription.status !== "free" && !currentSubscription.cancelAtPeriodEnd && (
                  <Button
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {cancelMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      "Cancel Subscription"
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Plan Limits */}
            <div className="mt-6 pt-6 border-t border-gray-800">
              <h4 className="font-semibold mb-3">Plan Limits</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-gray-400">Blog Posts</p>
                  <p className="text-2xl font-bold">{currentPlan.limits.blogPosts === -1 ? "Unlimited" : currentPlan.limits.blogPosts}</p>
                </div>
                <div>
                  <p className="text-gray-400">API Calls/Month</p>
                  <p className="text-2xl font-bold">{currentPlan.limits.apiCallsPerMonth === -1 ? "Unlimited" : currentPlan.limits.apiCallsPerMonth.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-400">Storage</p>
                  <p className="text-2xl font-bold">{currentPlan.limits.storageGB === -1 ? "Unlimited" : `${currentPlan.limits.storageGB} GB`}</p>
                </div>
              </div>
            </div>

            {/* Features */}
            {currentPlan.features.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-800">
                <h4 className="font-semibold mb-3">Features</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {currentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-300">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Available Plans */}
        {plans && plans.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-6">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const isCurrentPlan = currentPlan?._id === plan._id;
                const isSelected = selectedPlanId === plan._id;

                return (
                  <div
                    key={plan._id}
                    className={`bg-gray-900 rounded-xl border p-6 transition-all ${
                      isCurrentPlan
                        ? "border-primary"
                        : isSelected
                        ? "border-primary/50"
                        : "border-gray-800 hover:border-primary/30"
                    }`}
                  >
                    {isCurrentPlan && (
                      <div className="mb-4">
                        <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/30">
                          Current Plan
                        </span>
                      </div>
                    )}
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-gray-400 ml-2">/{plan.interval === "free" ? "free" : "month"}</span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div>
                        <p className="text-sm text-gray-400">Blog Posts</p>
                        <p className="font-semibold">{plan.limits.blogPosts === -1 ? "Unlimited" : plan.limits.blogPosts}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">API Calls/Month</p>
                        <p className="font-semibold">{plan.limits.apiCallsPerMonth === -1 ? "Unlimited" : plan.limits.apiCallsPerMonth.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Storage</p>
                        <p className="font-semibold">{plan.limits.storageGB === -1 ? "Unlimited" : `${plan.limits.storageGB} GB`}</p>
                      </div>
                    </div>

                    {plan.features.length > 0 && (
                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!isCurrentPlan && (
                      <>
                        {pendingPlan?._id === plan._id ? (
                          <div className="w-full bg-blue-900/30 border border-blue-800 rounded-md px-4 py-2 text-center">
                            <p className="text-blue-300 text-sm font-semibold">Scheduled for Next Cycle</p>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleChangePlan(plan._id)}
                            disabled={changePlanMutation.isPending || plan.interval === "free"}
                            className={`w-full ${
                              plan.interval === "free"
                                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                : "bg-primary hover:bg-primary/90 text-white"
                            }`}
                          >
                            {changePlanMutation.isPending && selectedPlanId === plan._id ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : isCurrentPlan ? (
                              "Current Plan"
                            ) : (
                              "Select Plan"
                            )}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Change Plan Confirmation Dialog */}
        <ConfirmModal
          isOpen={isChangePlanDialogOpen}
          onClose={() => {
            setIsChangePlanDialogOpen(false);
            setSelectedPlanId(null);
          }}
          onConfirm={confirmChangePlan}
          title="Change Plan"
          message={
            selectedPlanId
              ? `Are you sure you want to change to the ${plans?.find((p) => p._id === selectedPlanId)?.name} plan? This change will take effect at the start of your next billing cycle (${currentSubscription ? new Date(currentSubscription.currentPeriodEnd).toLocaleDateString() : "next billing date"}). You can change your plan again before then if needed.`
              : "Are you sure you want to change your plan? This change will take effect at the start of your next billing cycle."
          }
          confirmText="Change Plan"
          cancelText="Cancel"
          variant="default"
        />

        {/* Cancel Subscription Confirmation Dialog */}
        <ConfirmModal
          isOpen={isCancelDialogOpen}
          onClose={() => setIsCancelDialogOpen(false)}
          onConfirm={confirmCancel}
          title="Cancel Subscription"
          message="Are you sure you want to cancel your subscription? It will remain active until the end of your current billing period. You can reactivate it anytime before then."
          confirmText="Cancel Subscription"
          cancelText="Keep Subscription"
          variant="danger"
        />
      </div>
    </div>
  );
}
