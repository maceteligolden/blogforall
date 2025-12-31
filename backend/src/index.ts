import "reflect-metadata";
import express from "express";
import "dotenv/config";
import { connectDatabase } from "./shared/database";
import { logger } from "./shared/utils/logger";
import { errorHandler } from "./shared/middlewares/error-handler.middleware";
import { requestLogger } from "./shared/middlewares/request-logger.middleware";
import { routes } from "./routes";

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : ["http://localhost:3000", "http://localhost:3002", "http://localhost:3001"];

  // Allow requests from whitelisted origins or any origin in development
  if (origin && (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development")) {
    res.header("Access-Control-Allow-Origin", origin);
  } else if (!process.env.FRONTEND_URL && process.env.NODE_ENV === "development") {
    // In development, allow any origin if FRONTEND_URL is not set
    res.header("Access-Control-Allow-Origin", origin || "*");
  } else if (process.env.FRONTEND_URL) {
    // In production, use the configured frontend URL
    res.header("Access-Control-Allow-Origin", allowedOrigins[0]);
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "BlogForAll API is running" });
});

app.use("/api/v1", routes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {}, "Server");
    });
  } catch (error) {
    logger.error("Failed to start server", error as Error, {}, "Server");
    process.exit(1);
  }
};

startServer();
