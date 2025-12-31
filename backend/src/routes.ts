import { Router } from "express";
import authRouter from "./modules/auth/routes/auth.router";
import blogRouter from "./modules/blog/routes/blog.router";
import apiKeyRouter from "./modules/api-key/routes/api-key.router";

const router = Router();

// Auth routes
router.use("/auth", authRouter);

// Blog routes
router.use("/blogs", blogRouter);

// API Key routes
router.use("/api-keys", apiKeyRouter);

// Placeholder routes - will be implemented in later phases
// router.use("/comments", commentRouter);

export { router as routes };
