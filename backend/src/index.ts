import "reflect-metadata";
import express from "express";
import "dotenv/config";
import path from "path";
import { connectDatabase } from "./shared/database";
import { logger } from "./shared/utils/logger";
import { errorHandler } from "./shared/middlewares/error-handler.middleware";
import { requestLogger } from "./shared/middlewares/request-logger.middleware";
import { routes } from "./routes";

const app = express();
const PORT = process.env.PORT || 3001;

// Serve uploaded images statically (before other middlewares to avoid conflicts)
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Middlewares
app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Default allowed origins for development
  const defaultOrigins = ["http://localhost:3000", "http://localhost:3002", "http://localhost:3001", "https://blogforall-ij6u.onrender.com"];
  
  // Get allowed origins from environment or use defaults
  const allowedOrigins = process.env.FRONTEND_URL
    ? [...process.env.FRONTEND_URL.split(",").map((url) => url.trim()), ...defaultOrigins]
    : defaultOrigins;

  // Remove duplicates
  const uniqueOrigins = [...new Set(allowedOrigins)];

  // In development, allow any localhost origin or configured origins
  if (process.env.NODE_ENV === "development") {
    if (origin && (uniqueOrigins.includes(origin) || (origin.includes("localhost") && origin.match(/^http:\/\/localhost:\d+$/)))) {
      res.header("Access-Control-Allow-Origin", origin);
    } else if (origin) {
      res.header("Access-Control-Allow-Origin", "*");
    }
  } else {
    // In production, only allow configured origins
    if (origin && uniqueOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
    }
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-access-key-id, x-secret-key");
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
