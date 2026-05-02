import { Router } from "express";
import { container } from "tsyringe";
import { BillingController } from "../controllers/billing.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const billingController = container.resolve(BillingController);

router.post("/cards/initialize", authMiddleware, billingController.initializeAddCard);
router.post("/cards/confirm", authMiddleware, billingController.confirmCard);
router.get("/cards", authMiddleware, billingController.fetchCards);
router.delete("/cards/:id", authMiddleware, billingController.deleteCard);
router.put("/cards/:id/default", authMiddleware, billingController.setDefaultCard);
router.get("/invoices", authMiddleware, billingController.getInvoiceHistory);
router.get("/invoices/:id", authMiddleware, billingController.getInvoiceDetails);

export default router;
