import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface Card {
  _id: string;
  stripe_card_token: string;
  last_digits: string;
  expire_date: string;
  type: string;
  is_default: boolean;
}

export class BillingService {
  /**
   * Initialize add card process - returns setup intent client secret
   */
  static async initializeAddCard(): Promise<{ client_secret: string }> {
    const response = await apiClient.post<{ data: { client_secret: string } }>(
      API_ENDPOINTS.BILLING.INITIALIZE_CARD
    );
    return response.data.data;
  }

  /**
   * Confirm and save card after setup intent is confirmed
   */
  static async confirmCard(paymentMethodId: string): Promise<Card> {
    const response = await apiClient.post<{ data: Card }>(API_ENDPOINTS.BILLING.CONFIRM_CARD, {
      payment_method_id: paymentMethodId,
    });
    return response.data.data;
  }

  /**
   * Get all user cards
   */
  static async getCards(): Promise<Card[]> {
    const response = await apiClient.get<{ data: Card[] }>(API_ENDPOINTS.BILLING.GET_CARDS);
    return response.data.data || [];
  }

  /**
   * Delete a card
   */
  static async deleteCard(cardId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.BILLING.DELETE_CARD(cardId));
  }

  /**
   * Set default card
   */
  static async setDefaultCard(cardId: string): Promise<void> {
    await apiClient.put(API_ENDPOINTS.BILLING.SET_DEFAULT_CARD(cardId));
  }
}
