import { injectable, container } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BillingService } from "../services/billing.service";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";

@injectable()
export class BillingController {
  constructor(private billingService: BillingService) {}

  async initializeAddCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const response = await this.billingService.initializeAddCard(userId);
      sendSuccess(res, "Setup intent created successfully", response);
    } catch (error) {
      next(error);
    }
  }

  async confirmCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { payment_method_id } = req.body;
      if (!payment_method_id) {
        return next(new BadRequestError("payment_method_id is required"));
      }

      const card = await this.billingService.confirmCard(userId, payment_method_id);
      sendCreated(res, "Card added successfully", card);
    } catch (error) {
      next(error);
    }
  }

  async fetchCards(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const cards = await this.billingService.fetchUserCards(userId);
      sendSuccess(res, "Cards retrieved successfully", cards);
    } catch (error) {
      next(error);
    }
  }

  async deleteCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: cardId } = req.params;
      await this.billingService.deleteCard(cardId, userId);
      sendNoContent(res, "Card deleted successfully");
    } catch (error) {
      next(error);
    }
  }

  async setDefaultCard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: cardId } = req.params;
      await this.billingService.setDefaultCard(cardId, userId);

      // Update subscription payment method if user has an active paid subscription
      try {
        const subscriptionService = container.resolve(SubscriptionService);
        await subscriptionService.updateSubscriptionPaymentMethod(userId);
      } catch (error) {
        // Log error but don't fail the operation - subscription update is best effort
        console.error("Failed to update subscription payment method:", error);
      }

      sendSuccess(res, "Default card updated successfully", { success: true });
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const invoices = await this.billingService.getInvoiceHistory(userId, limit);
      sendSuccess(res, "Invoice history retrieved successfully", invoices);
    } catch (error) {
      next(error);
    }
  }

  async getInvoiceDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const { id: invoiceId } = req.params;
      if (!invoiceId) {
        return next(new BadRequestError("Invoice ID is required"));
      }

      const invoice = await this.billingService.getInvoiceDetails(userId, invoiceId);
      sendSuccess(res, "Invoice details retrieved successfully", invoice);
    } catch (error) {
      next(error);
    }
  }
}
