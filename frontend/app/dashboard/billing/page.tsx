"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BillingService, Card } from "@/lib/api/services/billing.service";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [isAddingCard, setIsAddingCard] = useState(false);

  const { data: cards, isLoading } = useQuery<Card[]>({
    queryKey: ["billing", "cards"],
    queryFn: () => BillingService.getCards(),
  });

  const initializeCardMutation = useMutation({
    mutationFn: () => BillingService.initializeAddCard(),
    onSuccess: async (data) => {
      const stripe = await stripePromise;
      if (!stripe) {
        alert("Stripe not initialized");
        return;
      }

      const { error } = await stripe.confirmCardSetup(data.client_secret, {
        payment_method: {
          card: undefined, // Will use Stripe Elements
        },
      });

      if (error) {
        alert(`Error: ${error.message}`);
        setIsAddingCard(false);
      } else {
        // Card setup succeeded - confirm on backend
        await confirmCardMutation.mutateAsync((error as any)?.payment_method?.id || "");
      }
    },
  });

  const confirmCardMutation = useMutation({
    mutationFn: (paymentMethodId: string) => BillingService.confirmCard(paymentMethodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "cards"] });
      setIsAddingCard(false);
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => BillingService.deleteCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "cards"] });
    },
  });

  const setDefaultCardMutation = useMutation({
    mutationFn: (cardId: string) => BillingService.setDefaultCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "cards"] });
    },
  });

  const handleAddCard = () => {
    setIsAddingCard(true);
    initializeCardMutation.mutate();
  };

  const handleDeleteCard = (cardId: string) => {
    if (window.confirm("Are you sure you want to delete this card?")) {
      deleteCardMutation.mutate(cardId);
    }
  };

  const handleSetDefault = (cardId: string) => {
    setDefaultCardMutation.mutate(cardId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Payment Methods</h1>

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Your Cards</h2>
            <Button
              onClick={handleAddCard}
              disabled={isAddingCard || initializeCardMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isAddingCard || initializeCardMutation.isPending ? "Processing..." : "+ Add Card"}
            </Button>
          </div>

          {cards && cards.length > 0 ? (
            <div className="space-y-4">
              {cards.map((card) => (
                <div
                  key={card._id}
                  className="bg-black rounded-lg border border-gray-800 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-primary/20 border border-primary/30 rounded flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">••••</span>
                    </div>
                    <div>
                      <p className="font-semibold">
                        •••• •••• •••• {card.last_digits}
                      </p>
                      <p className="text-sm text-gray-400">
                        {card.type.toUpperCase()} • Expires {card.expire_date}
                      </p>
                    </div>
                    {card.is_default && (
                      <span className="px-3 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/30">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!card.is_default && (
                      <Button
                        onClick={() => handleSetDefault(card._id)}
                        disabled={setDefaultCardMutation.isPending}
                        variant="outline"
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDeleteCard(card._id)}
                      disabled={deleteCardMutation.isPending}
                      variant="outline"
                      className="border-red-800 text-red-400 hover:bg-red-900/20"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No payment methods added yet</p>
              <Button
                onClick={handleAddCard}
                disabled={isAddingCard || initializeCardMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Add Your First Card
              </Button>
            </div>
          )}
        </div>

        <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-400 mb-2">Payment Security</h3>
              <p className="text-sm text-gray-300">
                Your payment information is securely processed by Stripe. We never store your full card details.
                All transactions are encrypted and PCI compliant.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
