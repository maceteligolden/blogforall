import { injectable, container } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BillingService } from "../services/billing.service";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { sendSuccess, sendCreated, sendNoContent } from "../../../shared/helper/response.helper";
import { logger } from "../../../shared/utils/logger";
import { getJwtUserId } from "../../../shared/utils/jwt-user";

@injectable()
export class BillingController {
  constructor(private billingService: BillingService) {}

  initializeAddCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const response = await this.billingService.initializeAddCard(userId);
      sendSuccess(res, "Setup intent created successfully", response);
    } catch (error) {
      next(error);
    }
  };

  confirmCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { payment_method_id } = req.validatedBody as { payment_method_id: string };
      const card = await this.billingService.confirmCard(userId, payment_method_id);
      sendCreated(res, "Card added successfully", card);
    } catch (error) {
      next(error);
    }
  };

  fetchCards = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const cards = await this.billingService.fetchUserCards(userId);
      sendSuccess(res, "Cards retrieved successfully", cards);
    } catch (error) {
      next(error);
    }
  };

  deleteCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id: cardId } = req.validatedParams as { id: string };
      await this.billingService.deleteCard(cardId, userId);
      sendNoContent(res, "Card deleted successfully");
    } catch (error) {
      next(error);
    }
  };

  setDefaultCard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id: cardId } = req.validatedParams as { id: string };
      await this.billingService.setDefaultCard(cardId, userId);

      try {
        const subscriptionService = container.resolve(SubscriptionService);
        await subscriptionService.updateSubscriptionPaymentMethod(userId);
      } catch (error) {
        logger.error(
          "Failed to update subscription payment method",
          error instanceof Error ? error : new Error(String(error)),
          {},
          "BillingController"
        );
      }

      sendSuccess(res, "Default card updated successfully", { success: true });
    } catch (error) {
      next(error);
    }
  };

  getInvoiceHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { limit } = req.validatedQuery as { limit: number };
      const invoices = await this.billingService.getInvoiceHistory(userId, limit);
      sendSuccess(res, "Invoice history retrieved successfully", invoices);
    } catch (error) {
      next(error);
    }
  };

  getInvoiceDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const { id: invoiceId } = req.validatedParams as { id: string };
      const invoice = await this.billingService.getInvoiceDetails(userId, invoiceId);
      sendSuccess(res, "Invoice details retrieved successfully", invoice);
    } catch (error) {
      next(error);
    }
  };
}
