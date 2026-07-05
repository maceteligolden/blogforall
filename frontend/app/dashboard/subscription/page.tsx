"use client";

import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PaymentMethodsCard } from "@/components/billing/payment-methods-card";
import { Button } from "@/components/ui/button";
import { useSubscription, usePlans } from "@/lib/hooks/use-subscription";
import { useQuery } from "@tanstack/react-query";
import { BillingService } from "@/lib/api/services/billing.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useToast } from "@/components/ui/toast";
import { billingTracker } from "@/lib/analytics/flows/billing.tracker";
import { useEffect } from "react";

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

export default function SubscriptionPage() {
  const { toast } = useToast();
  const { data: subscriptionData, isLoading: subscriptionLoading } = useSubscription();
  const { data: plans = [], isLoading: plansLoading } = usePlans();

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
        <p className="text-sm text-gray-400 mt-1">
          Manage your plan, payment methods, and billing history.
        </p>
      </div>

      {currentPlan && subscription && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">
                Current plan
              </p>
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
            {subscription.cancelAtPeriodEnd && (
              <p className="text-amber-400">Cancels at end of billing period</p>
            )}
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
                    {currentPlan.limits.storageGB === -1
                      ? "Unlimited"
                      : `${currentPlan.limits.storageGB} GB`}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {plans.length > 1 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Available plans</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan._id === currentPlanId;
              return (
                <div
                  key={plan._id}
                  className={`rounded-xl border p-5 ${
                    isCurrent
                      ? "border-primary bg-primary/5"
                      : "border-gray-800 bg-gray-900"
                  }`}
                >
                  <h3 className="font-semibold text-white">{plan.name}</h3>
                  <p className="text-primary mt-1">
                    {formatPrice(plan.price, plan.currency, plan.interval)}
                  </p>
                  {isCurrent ? (
                    <p className="text-xs text-primary mt-3">Current plan</p>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-4 bg-primary hover:bg-primary/90"
                      onClick={() =>
                        toast({
                          title: "Plan change unavailable",
                          description:
                            "Paid plans are not available yet. Your account uses the free plan.",
                          variant: "default",
                        })
                      }
                    >
                      Select plan
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
          {invoicesQuery.isLoading && (
            <p className="p-4 text-sm text-gray-500">Loading invoices…</p>
          )}
          {!invoicesQuery.isLoading && (!invoicesQuery.data || invoicesQuery.data.length === 0) && (
            <p className="p-4 text-sm text-gray-500">No invoices yet.</p>
          )}
          {invoicesQuery.data && invoicesQuery.data.length > 0 && (
            <ul className="divide-y divide-gray-800">
              {invoicesQuery.data.map((invoice) => (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
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
                      }).format(invoice.amount_paid / 100)}
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
    </div>
  );
}
