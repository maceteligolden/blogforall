import { injectable } from "tsyringe";
import Stripe from "stripe";

@injectable()
export class StripeFacade {
  private stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_API_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_API_KEY environment variable is not set");
    }
    this.stripe = new Stripe(apiKey, {
      apiVersion: "2023-10-16",
    });
  }
  /**
   * Create a customer in Stripe
   */
  async createCustomer(email: string, name: string) {
    return await this.stripe.customers.create({
      email,
      name,
    });
  }

  /**
   * Create a subscription
   */
  async createSubscription(customerId: string, priceId: string) {
    return await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ["latest_invoice.payment_intent"],
    });
  }

  /**
   * Cancel a subscription (immediate cancellation)
   */
  async cancelSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Set cancel_at_period_end flag on subscription
   */
  async setCancelAtPeriodEnd(subscriptionId: string, cancelAtPeriodEnd: boolean) {
    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });
  }

  /**
   * Update subscription (change plan)
   */
  async updateSubscription(subscriptionId: string, newPriceId: string) {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const subscriptionItemId = subscription.items.data[0]?.id;

    if (!subscriptionItemId) {
      throw new Error("Subscription has no items");
    }

    return await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
      items: [
        {
          id: subscriptionItemId,
          price: newPriceId,
        },
      ],
      proration_behavior: "none", // Don't prorate - change takes effect at next billing cycle
    });
  }

  /**
   * Retrieve a subscription
   */
  async retrieveSubscription(subscriptionId: string) {
    return await this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["items.data.price"],
    });
  }

  /**
   * Create a setup intent for adding payment methods
   */
  async createSetupIntent(customerId: string) {
    return await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session", // For saving cards for future use, not immediate payment
    });
  }

  /**
   * Attach payment method to customer
   */
  async attachPaymentMethod(customerId: string, paymentMethodId: string) {
    return await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  /**
   * Set default payment method for customer
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string) {
    return await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  /**
   * Update subscription payment method
   */
  async updateSubscriptionPaymentMethod(subscriptionId: string, paymentMethodId: string) {
    return await this.stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(customerId: string) {
    return await this.stripe.paymentMethods.list({
      customer: customerId,
      type: "card",
    });
  }

  /**
   * Retrieve a payment method
   */
  async retrievePaymentMethod(paymentMethodId: string) {
    return await this.stripe.paymentMethods.retrieve(paymentMethodId);
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(paymentMethodId: string) {
    return await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  /**
   * Create a product in Stripe
   */
  async createProduct(name: string, description?: string) {
    return await this.stripe.products.create({
      name,
      description,
    });
  }

  /**
   * Create a price in Stripe
   */
  async createPrice(productId: string, amount: number, currency: string = "usd", interval: "month" | "year" = "month") {
    return await this.stripe.prices.create({
      product: productId,
      unit_amount: Math.round(amount * 100), // Convert to cents
      currency,
      recurring: {
        interval,
      },
    });
  }

  /**
   * Find or create a product by name
   */
  async findOrCreateProduct(name: string, description?: string) {
    const products = await this.stripe.products.list({ limit: 100 });
    const existingProduct = products.data.find((p: { name: string; active: boolean }) => p.name === name && p.active);

    if (existingProduct) {
      return existingProduct;
    }

    return await this.createProduct(name, description);
  }

  /**
   * List invoices for a customer
   */
  async listInvoices(customerId: string, limit: number = 10) {
    return await this.stripe.invoices.list({
      customer: customerId,
      limit,
      expand: ["data.payment_intent", "data.subscription"],
    });
  }

  /**
   * Get invoice details
   */
  async getInvoice(invoiceId: string) {
    return await this.stripe.invoices.retrieve(invoiceId, {
      expand: ["payment_intent", "subscription"],
    });
  }

  /**
   * Convert amount to cents
   */
  currencyConverter(amount: number): number {
    return Number((amount * 100).toFixed(2));
  }

  /**
   * Convert cents to dollars
   */
  currencyReconverter(amount: number): string {
    return (Number(amount) / 100).toFixed(2).toString();
  }
}
