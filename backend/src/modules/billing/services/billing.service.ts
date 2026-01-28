import { injectable } from "tsyringe";
import User from "../../../shared/schemas/user.schema";
import { StripeFacade } from "../../../shared/facade/stripe.facade";
import { CardRepository } from "../repositories/card.repository";
import { BadRequestError, NotFoundError } from "../../../shared/errors";

@injectable()
export class BillingService {
  constructor(
    private stripeFacade: StripeFacade,
    private cardRepository: CardRepository
  ) {}

  /**
   * Initialize add card process - creates setup intent
   */
  async initializeAddCard(userId: string): Promise<{ client_secret: string }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    // Create Stripe customer if doesn't exist
    if (!user.stripe_customer_id) {
      const customer = await this.stripeFacade.createCustomer(
        user.email,
        `${user.first_name} ${user.last_name}`.trim()
      );
      await User.findByIdAndUpdate(userId, {
        stripe_customer_id: customer.id,
      });
      user.stripe_customer_id = customer.id;
    }

    if (!user.stripe_customer_id) {
      throw new BadRequestError("Stripe customer ID is required");
    }

    const setupIntent = await this.stripeFacade.createSetupIntent(user.stripe_customer_id);

    if (!setupIntent.client_secret) {
      throw new BadRequestError("Failed to create setup intent");
    }

    return {
      client_secret: setupIntent.client_secret,
    };
  }

  /**
   * Confirm and save card after setup intent is confirmed
   */
  async confirmCard(userId: string, paymentMethodId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user || !user.stripe_customer_id) {
      throw new NotFoundError("User not found or no Stripe customer");
    }

    // Check if this is the first card
    const existingCards = await this.cardRepository.findByCustomerId(user.stripe_customer_id);
    const isFirstCard = existingCards.length === 0;

    // Attach payment method to customer
    await this.stripeFacade.attachPaymentMethod(user.stripe_customer_id, paymentMethodId);

    // Get card details from Stripe
    const paymentMethod = await this.stripeFacade.retrievePaymentMethod(paymentMethodId);

    if (!paymentMethod || !paymentMethod.card) {
      throw new BadRequestError("Failed to fetch card details");
    }

    // If this is the first card, set it as default
    if (isFirstCard) {
      await this.stripeFacade.setDefaultPaymentMethod(user.stripe_customer_id, paymentMethodId);
    }

    // Save card to database
    const card = await this.cardRepository.create({
      stripe_card_token: paymentMethodId,
      last_digits: paymentMethod.card.last4,
      expire_date: `${paymentMethod.card.exp_month}/${paymentMethod.card.exp_year}`,
      type: paymentMethod.card.brand,
      stripe_customer_id: user.stripe_customer_id,
      is_default: isFirstCard,
    });

    return card;
  }

  /**
   * Fetch all user cards
   */
  async fetchUserCards(userId: string): Promise<any[]> {
    const user = await User.findById(userId);
    if (!user || !user.stripe_customer_id) {
      return [];
    }

    const cards = await this.cardRepository.findByCustomerId(user.stripe_customer_id);
    return cards;
  }

  /**
   * Delete a card
   */
  async deleteCard(cardId: string, userId: string): Promise<void> {
    const card = await this.cardRepository.findById(cardId);
    if (!card) {
      throw new NotFoundError("Card not found");
    }

    const user = await User.findById(userId);
    if (!user || card.stripe_customer_id !== user.stripe_customer_id) {
      throw new BadRequestError("Unauthorized");
    }

    // Detach from Stripe
    try {
      await this.stripeFacade.deletePaymentMethod(card.stripe_card_token);
    } catch (error) {
      // Continue even if Stripe deletion fails
    }

    // Delete from database
    await this.cardRepository.delete(cardId);
  }

  /**
   * Set default card
   */
  async setDefaultCard(cardId: string, userId: string): Promise<void> {
    const card = await this.cardRepository.findById(cardId);
    if (!card) {
      throw new NotFoundError("Card not found");
    }

    const user = await User.findById(userId);
    if (!user || card.stripe_customer_id !== user.stripe_customer_id) {
      throw new BadRequestError("Unauthorized");
    }

    // Set all cards to non-default
    await this.cardRepository.setAllCardsNonDefault(card.stripe_customer_id);

    // Set this card as default
    await this.cardRepository.update(cardId, { is_default: true });

    // Update Stripe customer default payment method
    await this.stripeFacade.setDefaultPaymentMethod(card.stripe_customer_id, card.stripe_card_token);

    // Note: Subscription payment method update is handled separately to avoid circular dependency
    // The subscription service will check for default card when needed
  }

  /**
   * Get invoice history for user
   */
  async getInvoiceHistory(userId: string, limit: number = 10): Promise<any[]> {
    const user = await User.findById(userId);
    if (!user || !user.stripe_customer_id) {
      return [];
    }

    const invoices = await this.stripeFacade.listInvoices(user.stripe_customer_id, limit);
    
    return invoices.data.map((invoice: any) => ({
      id: invoice.id,
      number: invoice.number,
      amount_paid: invoice.amount_paid / 100, // Convert from cents
      amount_due: invoice.amount_due / 100,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000),
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      description: invoice.description || `Invoice ${invoice.number || invoice.id}`,
    }));
  }

  /**
   * Get invoice details
   */
  async getInvoiceDetails(userId: string, invoiceId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user || !user.stripe_customer_id) {
      throw new NotFoundError("User not found or no Stripe customer");
    }

    const invoice = await this.stripeFacade.getInvoice(invoiceId);
    
    // Verify invoice belongs to user
    if (invoice.customer !== user.stripe_customer_id) {
      throw new BadRequestError("Invoice not found");
    }

    return {
      id: invoice.id,
      number: invoice.number,
      amount_paid: invoice.amount_paid / 100,
      amount_due: invoice.amount_due / 100,
      subtotal: invoice.subtotal / 100,
      total: invoice.total / 100,
      currency: invoice.currency,
      status: invoice.status,
      created: new Date(invoice.created * 1000),
      period_start: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      period_end: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      description: invoice.description || `Invoice ${invoice.number || invoice.id}`,
      lines: invoice.lines?.data?.map((line: any) => ({
        description: line.description,
        amount: line.amount / 100,
        quantity: line.quantity,
        period: line.period ? {
          start: new Date(line.period.start * 1000),
          end: new Date(line.period.end * 1000),
        } : null,
      })) || [],
    };
  }
}
