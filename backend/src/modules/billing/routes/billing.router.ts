import { Router } from "express";
import { container } from "tsyringe";
import { BillingController } from "../controllers/billing.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import {
  confirmCardBodySchema,
  cardIdParamSchema,
  invoiceListQuerySchema,
  invoiceIdParamSchema,
} from "../validations/billing.validation";

const router = Router();
const billingController = container.resolve(BillingController);

router.post("/cards/initialize", authMiddleware, billingController.initializeAddCard);
router.post("/cards/confirm", authMiddleware, validateBody(confirmCardBodySchema), billingController.confirmCard);
router.get("/cards", authMiddleware, billingController.fetchCards);
router.delete("/cards/:id", authMiddleware, validateParams(cardIdParamSchema), billingController.deleteCard);
router.put("/cards/:id/default", authMiddleware, validateParams(cardIdParamSchema), billingController.setDefaultCard);
router.get("/invoices", authMiddleware, validateQuery(invoiceListQuerySchema), billingController.getInvoiceHistory);
router.get("/invoices/:id", authMiddleware, validateParams(invoiceIdParamSchema), billingController.getInvoiceDetails);

export default router;
