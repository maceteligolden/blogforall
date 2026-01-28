"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PaymentMethodsCard } from "@/components/billing/payment-methods-card";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SubscriptionService, Plan, SubscriptionResponse } from "@/lib/api/services/subscription.service";
import { BillingService, Invoice } from "@/lib/api/services/billing.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { Loader2, Download, ExternalLink, FileText, Calendar, DollarSign } from "lucide-react";
import { format } from "date-fns";

export default function BillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isChangePlanDialogOpen, setIsChangePlanDialogOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);

  // Fetch subscription data
  const { data: subscriptionData, isLoading: subscriptionLoading } = useQuery<SubscriptionResponse>({
    queryKey: QUERY_KEYS.SUBSCRIPTION,
    queryFn: () => SubscriptionService.getSubscription(),
  });

  // Fetch plans
  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: QUERY_KEYS.PLANS,
    queryFn: () => SubscriptionService.getPlans(),
  });

  // Fetch invoice history
  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: QUERY_KEYS.BILLING_INVOICES,
    queryFn: () => BillingService.getInvoiceHistory(20),
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

  const formatCurrency = (amount: number, currency: string = "usd") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "paid") {
      return "bg-green-900/30 text-green-400 border-green-800";
    }
    if (statusLower === "open" || statusLower === "draft") {
      return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
    }
    if (statusLower === "uncollectible" || statusLower === "void") {
      return "bg-red-900/30 text-red-400 border-red-800";
    }
    return "bg-gray-900/30 text-gray-400 border-gray-800";
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
  const pendingPlan = currentSubscription?.pendingPlanId
    ? plans?.find((p) => p._id === currentSubscription.pendingPlanId)
    : null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Billing & Subscription" }]} />
        
        <div className="py-8">
          <h1 className="text-4xl font-bold mb-2">Billing & Subscription</h1>
          <p className="text-gray-400 text-lg mb-8">Manage your subscription, payment methods, and billing history</p>

          {/* Current Subscription Section */}
          {currentSubscription && currentPlan && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-primary">Current Subscription</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xl font-bold mb-2">{currentPlan.name}</h3>
                  <p className="text-3xl font-bold text-primary mb-2">
                    ${currentPlan.price}
                    <span className="text-lg text-gray-400">
                      /{currentPlan.interval === "free" ? "free" : "month"}
                    </span>
                  </p>
                  <p className="text-gray-400 mb-4">
                    Status: <span className="text-white capitalize">{currentSubscription.status}</span>
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 mb-2">
                    Current Period: {new Date(currentSubscription.currentPeriodStart).toLocaleDateString()} -{" "}
                    {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                  </p>
                  {currentSubscription.cancelAtPeriodEnd && (
                    <p className="text-yellow-400 mb-4">
                      ⚠️ Subscription will be cancelled at the end of the billing period
                    </p>
                  )}
                  {pendingPlan && (
                    <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4 mb-4">
                      <p className="text-blue-300 font-semibold mb-2">📅 Plan Change Scheduled</p>
                      <p className="text-blue-200 text-sm mb-1">
                        Your plan will change to <span className="font-bold">{pendingPlan.name}</span> at the start of
                        your next billing cycle.
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
                    <p className="text-2xl font-bold">
                      {currentPlan.limits.blogPosts === -1 ? "Unlimited" : currentPlan.limits.blogPosts}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">API Calls/Month</p>
                    <p className="text-2xl font-bold">
                      {currentPlan.limits.apiCallsPerMonth === -1
                        ? "Unlimited"
                        : currentPlan.limits.apiCallsPerMonth.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Storage</p>
                    <p className="text-2xl font-bold">
                      {currentPlan.limits.storageGB === -1 ? "Unlimited" : `${currentPlan.limits.storageGB} GB`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Available Plans Section */}
          {plans && plans.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-6">Available Plans</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((plan) => {
                  const isCurrentPlan = currentPlan?._id === plan._id;

                  return (
                    <div
                      key={plan._id}
                      className={`bg-gray-900 rounded-xl border p-6 transition-all ${
                        isCurrentPlan
                          ? "border-primary"
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
                      {pendingPlan?._id === plan._id && (
                        <div className="mb-4">
                          <span className="px-3 py-1 bg-blue-900/30 text-blue-300 text-xs font-semibold rounded-full border border-blue-800">
                            Scheduled for Next Cycle
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
                          <p className="font-semibold">
                            {plan.limits.apiCallsPerMonth === -1
                              ? "Unlimited"
                              : plan.limits.apiCallsPerMonth.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Storage</p>
                          <p className="font-semibold">
                            {plan.limits.storageGB === -1 ? "Unlimited" : `${plan.limits.storageGB} GB`}
                          </p>
                        </div>
                      </div>

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
                          {changePlanMutation.isPending && selectedPlanId === plan._id ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Select Plan"
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Methods Section */}
          <div className="mb-8">
            <PaymentMethodsCard />
          </div>

          {/* Invoice History Section */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
            <h2 className="text-2xl font-semibold mb-4 text-primary">Invoice History</h2>
            {invoicesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !invoices || invoices.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <FileText className="w-12 h-12 mx-auto text-gray-600" />
                <p className="text-gray-400 font-medium">No invoices found</p>
                <p className="text-sm text-gray-500">Your invoice history will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Invoice</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Period</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Amount</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                        <td className="py-4 px-4">
                          <div>
                            <p className="text-white font-medium">
                              {invoice.number || invoice.id.slice(0, 8)}
                            </p>
                            <p className="text-sm text-gray-400">{invoice.description}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-gray-300">
                          {format(new Date(invoice.created), "MMM dd, yyyy")}
                        </td>
                        <td className="py-4 px-4 text-gray-300">
                          {invoice.period_start && invoice.period_end ? (
                            <div className="text-sm">
                              <p>{format(new Date(invoice.period_start), "MMM dd")}</p>
                              <p className="text-gray-500">to {format(new Date(invoice.period_end), "MMM dd, yyyy")}</p>
                            </div>
                          ) : (
                            <span className="text-gray-500">—</span>
                          )}
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-white font-semibold">
                            {formatCurrency(invoice.amount_paid, invoice.currency)}
                          </p>
                        </td>
                        <td className="py-4 px-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(
                              invoice.status
                            )}`}
                          >
                            {invoice.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {invoice.invoice_pdf && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(invoice.invoice_pdf!, "_blank")}
                                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                PDF
                              </Button>
                            )}
                            {invoice.hosted_invoice_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(invoice.hosted_invoice_url!, "_blank")}
                                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                View
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Security Notice */}
          <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <svg
                className="w-6 h-6 text-yellow-400 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="font-semibold text-yellow-400 mb-2">Payment Security</h3>
                <p className="text-sm text-gray-300">
                  Your payment information is securely processed by Stripe. We never store your full card details. All
                  transactions are encrypted and PCI compliant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

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
  );
}
