import { Router, Request, Response } from "express";
import express from "express";
import { container } from "tsyringe";
import { BillingWebhook } from "../webhooks/billing.webhook";

const router = Router();
const billingWebhook = container.resolve(BillingWebhook);

// Stripe webhook endpoint (must use raw body for signature verification)
router.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  (req: Request, res: Response) => billingWebhook.handleWebhook(req, res)
);

export default router;
