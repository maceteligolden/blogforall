"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Trash2, Check, Loader2, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BillingService, Card as CardType } from "@/lib/api/services/billing.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useToast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { AddCardDialog } from "./add-card-dialog";
import { isCardExpired, getCardBrandName } from "@/lib/utils/card.util";

export function PaymentMethodsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);

  // Fetch cards
  const { data: cards, isLoading } = useQuery({
    queryKey: QUERY_KEYS.BILLING_CARDS || ["billing", "cards"],
    queryFn: () => BillingService.getCards(),
  });

  // Set default card mutation
  const setDefaultMutation = useMutation({
    mutationFn: (cardId: string) => BillingService.setDefaultCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CARDS || ["billing", "cards"] });
      toast({
        title: "Success",
        description: "Default card updated successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to update default card",
        variant: "error",
      });
    },
  });

  // Delete card mutation
  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => BillingService.deleteCard(cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CARDS || ["billing", "cards"] });
      setDeleteCardId(null);
      toast({
        title: "Success",
        description: "Card deleted successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete card",
        variant: "error",
      });
      setDeleteCardId(null);
    },
  });

  const handleDeleteCard = (cardId: string) => {
    setDeleteCardId(cardId);
  };

  const confirmDelete = () => {
    if (deleteCardId) {
      deleteCardMutation.mutate(deleteCardId);
    }
  };

  return (
    <>
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-primary via-blue-500 to-primary" />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Payment Methods</h2>
              <p className="text-sm text-gray-400">Manage your payment methods</p>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => setIsAddCardDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Card
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !cards || cards.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <CreditCard className="w-12 h-12 mx-auto text-gray-600" />
              <p className="text-gray-400 font-medium">No payment methods added</p>
              <p className="text-sm text-gray-500">Add a payment method to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cards.map((card: CardType) => {
                const expired = isCardExpired(card.expire_date);
                return (
                  <div key={card._id} className="space-y-3">
                    <div
                      className={`flex items-center justify-between p-6 border rounded-xl transition-colors ${
                        expired
                          ? "border-red-500/50 bg-red-500/5 hover:border-red-500/70"
                          : "border-gray-800 bg-black/40 hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div
                          className={`p-3 rounded-xl border ${
                            expired
                              ? "bg-red-500/10 border-red-500/20"
                              : "bg-primary/10 border-primary/20"
                          }`}
                        >
                          <CreditCard className={`w-6 h-6 ${expired ? "text-red-500" : "text-primary"}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-bold text-white text-lg">
                              •••• •••• •••• {card.last_digits}
                            </span>
                            {card.is_default && (
                              <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-semibold rounded-full border border-primary/30">
                                Default
                              </span>
                            )}
                            {expired && (
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-semibold rounded-full border border-red-500/30">
                                Expired
                              </span>
                            )}
                          </div>
                          <div className="text-sm space-x-3">
                            <span className={expired ? "text-white/60" : "text-white/60"}>
                              {getCardBrandName(card.type || "")}
                            </span>
                            <span className={expired ? "text-white/60" : "text-white/60"}>•</span>
                            <span className={expired ? "text-red-500 font-bold" : "text-white/60"}>
                              Expires {card.expire_date}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!card.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDefaultMutation.mutate(card._id)}
                            disabled={setDefaultMutation.isPending || expired}
                            className="border-gray-700 text-gray-300 hover:bg-gray-800 disabled:opacity-50"
                          >
                            {setDefaultMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Set Default
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCard(card._id)}
                          disabled={deleteCardMutation.isPending || card.is_default}
                          className="border-red-800 text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                          title={card.is_default ? "Cannot delete default card" : "Delete card"}
                        >
                          {deleteCardMutation.isPending && deleteCardId === card._id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {expired && (
                      <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-500 mb-1">Card Expired</p>
                          <p className="text-xs text-gray-300">
                            This payment method has expired. Please update it or remove it to continue using the service.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteCardId}
        onClose={() => setDeleteCardId(null)}
        onConfirm={confirmDelete}
        title="Delete Payment Method"
        message="Are you sure you want to delete this payment method? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <AddCardDialog
        open={isAddCardDialogOpen}
        onOpenChange={setIsAddCardDialogOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BILLING_CARDS || ["billing", "cards"] });
        }}
      />
    </>
  );
}
