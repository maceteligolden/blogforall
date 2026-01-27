"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { BillingService } from "@/lib/api/services/billing.service";
import { useToast } from "@/components/ui/toast";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface AddCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

function AddCardForm({ onSuccess, onClose }: { onSuccess?: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      // Confirm the setup intent
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: "if_required",
      });

      if (confirmError) {
        toast({
          title: "Error",
          description: confirmError.message || "Failed to add card",
          variant: "error",
        });
        setIsLoading(false);
        return;
      }

      if (setupIntent?.status === "succeeded" && setupIntent.payment_method) {
        // Confirm the card on the backend
        await BillingService.confirmCard(setupIntent.payment_method as string);

        toast({
          title: "Success",
          description: "Card added successfully",
          variant: "success",
        });

        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to add card",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <PaymentElement
          options={{
            layout: "tabs",
          }}
        />
      </div>
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isLoading}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Adding...
            </>
          ) : (
            <>
              <CreditCard className="w-4 h-4 mr-2" />
              Add Card
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function AddCardDialog({ open, onOpenChange, onSuccess }: AddCardDialogProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (open) {
      // Initialize setup intent when dialog opens
      const initializeSetupIntent = async () => {
        try {
          setIsInitializing(true);
          const response = await BillingService.initializeAddCard();
          setClientSecret(response.client_secret);
        } catch (error: any) {
          console.error("Failed to initialize setup intent:", error);
        } finally {
          setIsInitializing(false);
        }
      };

      initializeSetupIntent();
    } else {
      // Reset state when dialog closes
      setClientSecret(null);
      setIsInitializing(true);
    }
  }, [open]);

  const options: StripeElementsOptions = {
    clientSecret: clientSecret ?? undefined,
    appearance: {
      theme: "night",
      variables: {
        colorPrimary: "#3b82f6",
        colorBackground: "#111827",
        colorText: "#ffffff",
        colorDanger: "#ef4444",
        fontFamily: "system-ui, sans-serif",
        spacingUnit: "4px",
        borderRadius: "8px",
      },
    },
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Add Payment Method"
      size="lg"
    >
      {isInitializing || !clientSecret ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-gray-400 text-sm">Initializing card setup...</p>
        </div>
      ) : (
        <Elements stripe={stripePromise} options={options}>
          <AddCardForm
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        </Elements>
      )}
    </Modal>
  );
}
