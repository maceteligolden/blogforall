"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SubscriptionService, Plan, SubscriptionResponse } from "@/lib/api/services/subscription.service";
import { Button } from "@/components/ui/button";
import { QUERY_KEYS } from "@/lib/api/config";
import { useState } from "react";

export default function SubscriptionPage() {
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

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
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS });
      setSelectedPlanId(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => SubscriptionService.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
    },
  });

  const handleChangePlan = (planId: string) => {
    if (window.confirm("Are you sure you want to change your plan?")) {
      changePlanMutation.mutate(planId);
    }
  };

  const handleCancel = () => {
    if (window.confirm("Are you sure you want to cancel your subscription? It will remain active until the end of the billing period.")) {
      cancelMutation.mutate();
    }
  };

  if (subscriptionLoading || plansLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  const currentPlan = subscriptionData?.plan;
  const currentSubscription = subscriptionData?.subscription;

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
                {currentSubscription.status !== "free" && !currentSubscription.cancelAtPeriodEnd && (
                  <Button
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    {cancelMutation.isPending ? "Cancelling..." : "Cancel Subscription"}
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
                      <Button
                        onClick={() => handleChangePlan(plan._id)}
                        disabled={changePlanMutation.isPending || plan.interval === "free"}
                        className={`w-full ${
                          plan.interval === "free"
                            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                            : "bg-primary hover:bg-primary/90 text-white"
                        }`}
                      >
                        {changePlanMutation.isPending && selectedPlanId === plan._id
                          ? "Processing..."
                          : isCurrentPlan
                          ? "Current Plan"
                          : "Select Plan"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
