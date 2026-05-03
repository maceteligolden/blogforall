import { Router } from "express";
import authRouter from "./modules/auth/routes/auth.router";
import siteBlogRouter from "./modules/blog/routes/site-blog.router";
import siteCampaignRouter from "./modules/campaign/routes/site-campaign.router";
import publicBlogRouter from "./modules/blog/routes/public-blog.router";
import commentRouter from "./modules/comment/routes/comment.router";
import siteCategoryRouter from "./modules/category/routes/site-category.router";
import { authMiddleware } from "./shared/middlewares/auth.middleware";
import subscriptionRouter from "./modules/subscription/routes/subscription.router";
import billingRouter from "./modules/billing/routes/billing.router";
import webhookRouter from "./modules/billing/routes/webhook.router";
import onboardingRouter from "./modules/onboarding/routes/onboarding.router";
import siteRouter from "./modules/site/routes/site.router";
import userInvitationsRouter from "./modules/site/routes/user-invitations.router";
import notificationRouter from "./modules/notification/routes/notification.router";

const router = Router();

// Auth routes
router.use("/auth", authRouter);

// Blog routes (site-scoped: GET siteId in path; POST/PUT body validated on router)
router.use("/sites/:siteId/blogs", siteBlogRouter);

// Public API routes (protected with API keys)
router.use("/public/blogs", publicBlogRouter);

// Category routes (site-scoped, JWT)
router.use("/sites/:siteId/categories", authMiddleware, siteCategoryRouter);

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

// Notification routes (protected with JWT)
router.use("/notifications", notificationRouter);

// Campaign routes (site-scoped, JWT)
router.use("/sites/:siteId/campaigns", siteCampaignRouter);

// User invitation routes (protected with JWT): list and accept/reject by token
router.use("/invitations", userInvitationsRouter);

export { router as routes };
