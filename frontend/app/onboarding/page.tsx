"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SubscriptionService, Plan } from "@/lib/api/services/subscription.service";
import { BillingService } from "@/lib/api/services/billing.service";
import { OnboardingService } from "@/lib/api/services/onboarding.service";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/protected-route";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

function OnboardingForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const stripe = useStripe();
  const elements = useElements();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [step, setStep] = useState<"plan" | "card">("plan");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if onboarding is already completed
  const { data: onboardingStatus } = useQuery({
    queryKey: ["onboarding", "status"],
    queryFn: () => OnboardingService.getStatus(),
    retry: false,
  });

  useEffect(() => {
    if (onboardingStatus && !onboardingStatus.requiresOnboarding) {
      router.push("/dashboard");
    }
  }, [onboardingStatus, router]);

  const { data: plans, isLoading: plansLoading, error: plansError } = useQuery<Plan[]>({
    queryKey: ["subscription", "plans"],
    queryFn: () => SubscriptionService.getPlans(),
    retry: 2,
  });

  // Debug logging
  useEffect(() => {
    if (plans) {
      console.log("Plans loaded:", plans);
    }
    if (plansError) {
      console.error("Error loading plans:", plansError);
    }
  }, [plans, plansError]);

  const initializeCardMutation = useMutation({
    mutationFn: () => BillingService.initializeAddCard(),
    onSuccess: (data) => {
      setClientSecret(data.client_secret);
      setStep("card");
    },
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: ({ planId, paymentMethodId }: { planId: string; paymentMethodId: string }) =>
      OnboardingService.complete(planId, paymentMethodId),
    onSuccess: async () => {
      queryClient.invalidateQueries();
      // Check if user has sites, if not redirect to site creation
      try {
        const { SiteService } = await import("@/lib/api/services/site.service");
        const sites = await SiteService.getSites();
        if (sites.length === 0) {
          router.push("/onboarding/create-site");
        } else {
          router.push("/dashboard");
        }
      } catch (error) {
        // If check fails, redirect to site creation to be safe
        router.push("/onboarding/create-site");
      }
    },
  });

  const skipOnboardingMutation = useMutation({
    mutationFn: () => OnboardingService.skip(),
    onSuccess: async () => {
      queryClient.invalidateQueries();
      // Check if user has sites, if not redirect to site creation
      try {
        const { SiteService } = await import("@/lib/api/services/site.service");
        const sites = await SiteService.getSites();
        if (sites.length === 0) {
          router.push("/onboarding/create-site");
        } else {
          router.push("/dashboard");
        }
      } catch (error) {
        // If check fails, redirect to site creation to be safe
        router.push("/onboarding/create-site");
      }
    },
  });

  const handlePlanSelect = (planId: string) => {
    setSelectedPlanId(planId);
    initializeCardMutation.mutate();
  };

  const handleSkip = () => {
    skipOnboardingMutation.mutate();
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !selectedPlanId || !clientSecret) return;

    setIsProcessing(true);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setIsProcessing(false);
      return;
    }

    try {
      // Confirm the setup intent
      const { error: setupError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (setupError) {
        alert(`Error: ${setupError.message}`);
        setIsProcessing(false);
        return;
      }

      if (setupIntent?.status === "succeeded" && setupIntent.payment_method) {
        // Complete onboarding with plan and payment method
        await completeOnboardingMutation.mutateAsync({
          planId: selectedPlanId,
          paymentMethodId: setupIntent.payment_method as string,
        });
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  if (plansLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse">Loading plans...</div>
      </div>
    );
  }

  if (plansError) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error loading plans. Please refresh the page.</p>
          <p className="text-gray-400 text-sm">{String(plansError)}</p>
        </div>
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-yellow-400 mb-4">No plans available. Please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Welcome to <span className="text-primary">BlogForAll</span>
          </h1>
          <p className="text-xl text-gray-400">
            {step === "plan"
              ? "Choose a plan to get started"
              : "Add your payment method to complete setup"}
          </p>
        </div>

        {step === "plan" && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {plans.map((plan) => {
                const isFree = plan.price === 0 || plan.interval === "free";
                return (
                  <div
                    key={plan._id}
                    className={`bg-gray-900 rounded-xl border p-6 cursor-pointer transition-all ${
                      selectedPlanId === plan._id
                        ? "border-primary scale-105"
                        : "border-gray-800 hover:border-primary/50"
                    } ${isFree ? "ring-2 ring-primary/30" : ""}`}
                    onClick={() => !isFree && handlePlanSelect(plan._id)}
                  >
                    {selectedPlanId === plan._id && (
                      <div className="mb-4">
                        <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/30">
                          Selected
                        </span>
                      </div>
                    )}
                    {isFree && (
                      <div className="mb-4">
                        <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs font-semibold rounded-full border border-green-800">
                          Free Plan
                        </span>
                      </div>
                    )}
                    <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                    <div className="mb-4">
                      {isFree ? (
                        <span className="text-4xl font-bold">Free</span>
                      ) : (
                        <>
                          <span className="text-4xl font-bold">${plan.price}</span>
                          <span className="text-gray-400 ml-2">/month</span>
                        </>
                      )}
                    </div>
                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-gray-400">
                        {plan.limits.blogPosts === -1 ? "Unlimited" : plan.limits.blogPosts} blog posts
                      </p>
                      <p className="text-sm text-gray-400">
                        {plan.limits.apiCallsPerMonth === -1
                          ? "Unlimited"
                          : plan.limits.apiCallsPerMonth.toLocaleString()}{" "}
                        API calls/month
                      </p>
                      <p className="text-sm text-gray-400">
                        {plan.limits.storageGB === -1 ? "Unlimited" : `${plan.limits.storageGB} GB`} storage
                      </p>
                    </div>
                    {plan.features.length > 0 && (
                      <ul className="space-y-1 mb-4">
                        {plan.features.slice(0, 3).map((feature, index) => (
                          <li key={index} className="text-xs text-gray-300 flex items-center gap-2">
                            <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    )}
                    {isFree && (
                      <div className="mt-4 pt-4 border-t border-gray-800">
                        <p className="text-xs text-gray-400 text-center">Default plan - No payment required</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {selectedPlanId && initializeCardMutation.isPending && (
              <div className="text-center mb-6">
                <div className="animate-pulse text-gray-400">Preparing payment form...</div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
              <Button
                onClick={handleSkip}
                disabled={skipOnboardingMutation.isPending}
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800 px-8"
              >
                {skipOnboardingMutation.isPending ? "Skipping..." : "Skip for now (Use Free Plan)"}
              </Button>
            </div>
          </div>
        )}

        {step === "card" && clientSecret && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
              <h2 className="text-2xl font-semibold mb-6">Add Payment Method</h2>
              <form onSubmit={handleCardSubmit}>
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-300">Card Details</label>
                  <div className="bg-black rounded-lg border border-gray-800 p-4">
                    <CardElement
                      options={{
                        style: {
                          base: {
                            fontSize: "16px",
                            color: "#ffffff",
                            "::placeholder": {
                              color: "#9ca3af",
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    onClick={() => {
                      setStep("plan");
                      setClientSecret(null);
                    }}
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={!stripe || isProcessing || completeOnboardingMutation.isPending}
                    className="bg-primary hover:bg-primary/90 text-white px-8"
                  >
                    {isProcessing || completeOnboardingMutation.isPending
                      ? "Processing..."
                      : "Complete Setup"}
                  </Button>
                </div>
              </form>
            </div>

            <div className="mt-6 bg-yellow-900/20 border border-yellow-800 rounded-xl p-4">
              <p className="text-sm text-gray-300">
                🔒 Your payment information is securely processed by Stripe. We never store your full card details.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <Elements stripe={stripePromise}>
        <OnboardingForm />
      </Elements>
    </ProtectedRoute>
  );
}
