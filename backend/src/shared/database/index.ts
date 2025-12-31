import mongoose from "mongoose";
import { logger } from "../utils/logger";

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    await mongoose.connect(mongoUri);
    logger.info("Database connected successfully", {}, "Database");
  } catch (error) {
    logger.error("Database connection failed", error as Error, {}, "Database");
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info("Database disconnected", {}, "Database");
  } catch (error) {
    logger.error("Database disconnection failed", error as Error, {}, "Database");
    throw error;
  }
};

