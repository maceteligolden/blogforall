import { Router } from "express";
import authRouter from "./modules/auth/routes/auth.router";
import blogRouter from "./modules/blog/routes/blog.router";
import apiKeyRouter from "./modules/api-key/routes/api-key.router";
import publicBlogRouter from "./modules/blog/routes/public-blog.router";

const router = Router();

// Auth routes
router.use("/auth", authRouter);

// Blog routes (protected with JWT)
router.use("/blogs", blogRouter);

// Public API routes (protected with API keys)
router.use("/public/blogs", publicBlogRouter);

// API Key routes
router.use("/api-keys", apiKeyRouter);

// Placeholder routes - will be implemented in later phases
// router.use("/comments", commentRouter);

export { router as routes };
