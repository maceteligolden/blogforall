import { Router } from "express";
import authRouter from "./modules/auth/routes/auth.router";
import blogRouter from "./modules/blog/routes/blog.router";

const router = Router();

// Auth routes
router.use("/auth", authRouter);

// Blog routes
router.use("/blogs", blogRouter);

// Placeholder routes - will be implemented in later phases
// router.use("/api-keys", apiKeyRouter);
// router.use("/comments", commentRouter);

export { router as routes };
