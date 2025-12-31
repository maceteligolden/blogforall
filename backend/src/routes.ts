import { Router } from "express";
import authRouter from "./modules/auth/routes/auth.router";

const router = Router();

// Auth routes
router.use("/auth", authRouter);

// Placeholder routes - will be implemented in later phases
// router.use("/blogs", blogRouter);
// router.use("/api-keys", apiKeyRouter);
// router.use("/comments", commentRouter);

export { router as routes };

