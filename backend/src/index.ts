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
  res.header("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Routes
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "BlogForAll API is running" });
});

app.use("/api", routes);

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

