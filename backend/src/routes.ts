import { Router } from "express";
import authRouter from "./modules/auth/routes/auth.router";
import blogRouter from "./modules/blog/routes/blog.router";
import apiKeyRouter from "./modules/api-key/routes/api-key.router";
import publicBlogRouter from "./modules/blog/routes/public-blog.router";
import commentRouter from "./modules/comment/routes/comment.router";
import categoryRouter from "./modules/category/routes/category.router";
import subscriptionRouter from "./modules/subscription/routes/subscription.router";
import billingRouter from "./modules/billing/routes/billing.router";
import webhookRouter from "./modules/billing/routes/webhook.router";
import onboardingRouter from "./modules/onboarding/routes/onboarding.router";
import siteRouter from "./modules/site/routes/site.router";
import { SiteInvitationController } from "./modules/site/controllers/site-invitation.controller";
import { container } from "tsyringe";
import { authMiddleware } from "./shared/middlewares/auth.middleware";

const router = Router();

// Auth routes
router.use("/auth", authRouter);

// Blog routes (protected with JWT)
router.use("/blogs", blogRouter);

// Public API routes (protected with API keys)
router.use("/public/blogs", publicBlogRouter);

// API Key routes
router.use("/api-keys", apiKeyRouter);

// Category routes (protected with JWT)
router.use("/categories", categoryRouter);

// Comment routes (public for create/like, protected for update/delete)
router.use("/comments", commentRouter);

// Subscription routes (protected with JWT)
router.use("/subscriptions", subscriptionRouter);

// Billing routes (protected with JWT)
router.use("/billing", billingRouter);

// Webhook routes (no auth required, uses Stripe signature verification)
router.use("/webhooks", webhookRouter);

// Onboarding routes (protected with JWT)
router.use("/onboarding", onboardingRouter);

// Site routes (protected with JWT)
router.use("/sites", siteRouter);

// Invitation routes (protected with JWT)
// These routes are for users to view and accept/reject their invitations
const invitationController = container.resolve(SiteInvitationController);
router.get("/invitations", authMiddleware, invitationController.getUserInvitations);
router.post("/invitations/:token/accept", authMiddleware, invitationController.acceptInvitation);
router.post("/invitations/:token/reject", authMiddleware, invitationController.rejectInvitation);

export { router as routes };
