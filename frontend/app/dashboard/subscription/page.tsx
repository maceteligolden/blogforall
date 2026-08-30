"use client";

import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PaymentMethodsCard } from "@/components/billing/payment-methods-card";
import { AddCardDialog } from "@/components/billing/add-card-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { useSubscription, usePlans, useChangePlan, useCancelSubscription } from "@/lib/hooks/use-subscription";
import { BillingService } from "@/lib/api/services/billing.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useToast } from "@/components/ui/toast";
import { billingTracker } from "@/lib/analytics/flows/billing.tracker";
import type { Plan } from "@/lib/api/services/subscription.service";
import { paidUpgradesLocked } from "@/lib/auth/beta-access";
import { useAuthStore } from "@/lib/store/auth.store";

function formatPrice(price: number, currency = "usd", interval?: string): string {
  if (price === 0 || interval === "free") return "Free";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(price);
  if (interval === "month") return `${amount}/mo`;
  if (interval === "year") return `${amount}/yr`;
  return amount;
}

function statusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Active";
    case "trialing":
      return "Trial";
    case "past_due":
      return "Past due";
    case "cancelled":
      return "Cancelled";
    case "free":
      return "Free";
    default:
      return status;
  }
}

function isFreePlan(plan: { price: number; interval: string }): boolean {
  return plan.price === 0 || plan.interval === "free";
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const lockPaidPlans = paidUpgradesLocked(user);
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscription();
  const { data: plans = [], isLoading: plansLoading } = usePlans();
  const changePlan = useChangePlan();
  const cancelSubscription = useCancelSubscription();

  const [addCardOpen, setAddCardOpen] = useState(false);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [confirmDowngradePlan, setConfirmDowngradePlan] = useState<Plan | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const cardsQuery = useQuery({
    queryKey: QUERY_KEYS.BILLING_CARDS || ["billing", "cards"],
    queryFn: () => BillingService.getCards(),
  });

  const invoicesQuery = useQuery({
    queryKey: QUERY_KEYS.BILLING_INVOICES,
    queryFn: () => BillingService.getInvoiceHistory(5),
  });

  useEffect(() => {
    billingTracker.viewed();
  }, []);

  const isLoading = subscriptionLoading || plansLoading;
  const currentPlanId = subscriptionData?.plan._id;
  const subscription = subscriptionData?.subscription;
  const currentPlan = subscriptionData?.plan;
  const isPaid =
    !!currentPlan &&
    !isFreePlan(currentPlan) &&
    subscription?.status !== "free" &&
    subscription?.status !== "cancelled";

  const applyPlanChange = async (plan: Plan) => {
    const previous = currentPlan?.name ?? "unknown";
    try {
      await changePlan.mutateAsync(plan._id);
      billingTracker.planChanged({ previous_plan: previous, new_plan: plan.name });
      toast({
        title: "Plan updated",
        description:
          isFreePlan(plan) || plan._id === currentPlanId
            ? `You're on ${plan.name}.`
            : `Switched toward ${plan.name}. Changes may apply next billing cycle.`,
        variant: "success",
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Could not change plan.";
      toast({ title: "Error", description: message, variant: "error" });
    }
  };

  const handleSelectPlan = async (plan: Plan) => {
    if (plan._id === currentPlanId) return;
    if (lockPaidPlans && !isFreePlan(plan)) return;

    if (isFreePlan(plan)) {
      setConfirmDowngradePlan(plan);
      return;
    }

    const cards = cardsQuery.data ?? [];
    if (cards.length === 0) {
      setPendingPlanId(plan._id);
      setAddCardOpen(true);
      return;
    }

    await applyPlanChange(plan);
  };

  const handleCancel = async () => {
    try {
      await cancelSubscription.mutateAsync();
      billingTracker.subscriptionCancelled({ previous_plan: currentPlan?.name });
      toast({
        title: "Cancellation scheduled",
        description: "Your plan stays active until the end of the billing period.",
        variant: "success",
      });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Could not cancel subscription.";
      toast({ title: "Error", description: message, variant: "error" });
    } finally {
      setConfirmCancel(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 flex min-h-[50vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 max-w-5xl">
      <Breadcrumb items={[{ label: "Subscription" }]} />
      <div className="mb-8">
        <h1 className="text-2xl font-display text-white">Subscription</h1>
        <p className="text-sm text-gray-400 mt-1">Manage your plan, payment methods, and billing history.</p>
      </div>

      {lockPaidPlans && (
        <div className="mb-8 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-gray-200">
          You&apos;re on Free for the private beta. Paid plans open after the beta — thanks for helping us test.
        </div>
      )}

      {currentPlan && subscription && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Current plan</p>
              <h2 className="text-xl font-semibold text-white">{currentPlan.name}</h2>
              <p className="text-primary font-medium mt-1">
                {formatPrice(currentPlan.price, currentPlan.currency, currentPlan.interval)}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/30 capitalize">
              {statusLabel(subscription.status)}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-gray-400">
            <p>
              Billing period:{" "}
              <span className="text-gray-300">
                {format(new Date(subscription.currentPeriodStart), "MMM d, yyyy")} –{" "}
                {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
              </span>
            </p>
            {subscription.cancelAtPeriodEnd && <p className="text-amber-400">Cancels at end of billing period</p>}
            {subscription.pendingPlanId && (
              <p className="text-gray-300">Plan change scheduled for next billing cycle</p>
            )}
          </div>

          {currentPlan.features?.length > 0 && (
            <ul className="mt-5 space-y-2">
              {currentPlan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-300">
                  <Check className="w-4 h-4 text-primary shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          )}

          {currentPlan.limits && (
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {currentPlan.limits.blogPosts >= 0 && (
                <div className="rounded-lg bg-gray-800/50 border border-gray-800 px-3 py-2">
                  <p className="text-xs text-gray-500">Blog posts</p>
                  <p className="text-sm text-white font-medium">
                    {currentPlan.limits.blogPosts === -1 ? "Unlimited" : currentPlan.limits.blogPosts}
                  </p>
                </div>
              )}
              {currentPlan.limits.apiCallsPerMonth >= 0 && (
                <div className="rounded-lg bg-gray-800/50 border border-gray-800 px-3 py-2">
                  <p className="text-xs text-gray-500">API calls / month</p>
                  <p className="text-sm text-white font-medium">
                    {currentPlan.limits.apiCallsPerMonth === -1
                      ? "Unlimited"
                      : currentPlan.limits.apiCallsPerMonth.toLocaleString()}
                  </p>
                </div>
              )}
              {currentPlan.limits.storageGB >= 0 && (
                <div className="rounded-lg bg-gray-800/50 border border-gray-800 px-3 py-2">
                  <p className="text-xs text-gray-500">Storage</p>
                  <p className="text-sm text-white font-medium">
                    {currentPlan.limits.storageGB === -1 ? "Unlimited" : `${currentPlan.limits.storageGB} GB`}
                  </p>
                </div>
              )}
            </div>
          )}

          {isPaid && !subscription.cancelAtPeriodEnd && (
            <div className="mt-6">
              <Button
                variant="outline"
                className="border-red-800 text-red-300 hover:bg-red-950"
                onClick={() => setConfirmCancel(true)}
                disabled={cancelSubscription.isPending}
              >
                Cancel subscription
              </Button>
            </div>
          )}
        </div>
      )}

      {plans.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Available plans</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan._id === currentPlanId;
              const paidLocked = lockPaidPlans && !isFreePlan(plan);
              return (
                <div
                  key={plan._id}
                  className={`rounded-xl border p-5 ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : paidLocked
                        ? "border-gray-800 bg-gray-900 opacity-60"
                        : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <h3 className="font-semibold text-white">{plan.name}</h3>
                  <p className="text-primary mt-1">{formatPrice(plan.price, plan.currency, plan.interval)}</p>
                  {isCurrent ? (
                    <p className="text-xs text-primary mt-3">Current plan</p>
                  ) : lockPaidPlans && !isFreePlan(plan) ? (
                    <p className="text-xs text-gray-500 mt-3">Opens after beta</p>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-4 bg-primary hover:bg-primary/90"
                      disabled={changePlan.isPending}
                      onClick={() => void handleSelectPlan(plan)}
                    >
                      {changePlan.isPending ? "Updating…" : "Select plan"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Payment methods</h2>
        <PaymentMethodsCard />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Recent invoices</h2>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          {invoicesQuery.isLoading && <p className="p-4 text-sm text-gray-500">Loading invoices…</p>}
          {!invoicesQuery.isLoading && (!invoicesQuery.data || invoicesQuery.data.length === 0) && (
            <p className="p-4 text-sm text-gray-500">No invoices yet.</p>
          )}
          {invoicesQuery.data && invoicesQuery.data.length > 0 && (
            <ul className="divide-y divide-gray-800">
              {invoicesQuery.data.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="text-white">{invoice.description || `Invoice ${invoice.number ?? ""}`}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {format(new Date(invoice.created), "MMM d, yyyy")} · {invoice.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300">
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: invoice.currency.toUpperCase(),
                      }).format(invoice.amount_paid)}
                    </span>
                    {invoice.hosted_invoice_url && (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 text-xs"
                      >
                        View
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AddCardDialog
        open={addCardOpen}
        onOpenChange={(open) => {
          setAddCardOpen(open);
          if (!open) setPendingPlanId(null);
        }}
        onSuccess={() => {
          void cardsQuery.refetch();
          if (pendingPlanId) {
            const plan = plans.find((p) => p._id === pendingPlanId);
            setPendingPlanId(null);
            if (plan) void applyPlanChange(plan);
          }
        }}
      />

      <ConfirmModal
        isOpen={!!confirmDowngradePlan}
        onClose={() => setConfirmDowngradePlan(null)}
        onConfirm={() => {
          const plan = confirmDowngradePlan;
          setConfirmDowngradePlan(null);
          if (plan) void applyPlanChange(plan);
        }}
        title="Switch to Free?"
        message="You'll lose paid-plan limits at the end of the current period or immediately if you're already free-eligible. Continue?"
        confirmText="Switch to Free"
        variant="danger"
      />

      <ConfirmModal
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => void handleCancel()}
        title="Cancel subscription?"
        message="Your plan stays active until the end of the billing period, then you'll move to Free."
        confirmText="Cancel plan"
        variant="danger"
      />
    </div>
  );
}
