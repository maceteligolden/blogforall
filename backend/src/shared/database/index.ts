import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { connectPostgres, disconnectPostgres } from "./drizzle";

export { db, pool, withTransaction } from "./drizzle";
export type { AppDatabase, AppTransaction, DbOrTx } from "./drizzle";
export * from "./schema";
export { withId, withIds, omitUndefined } from "./map-row";

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = env.mongodbUri;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }

    await Promise.all([mongoose.connect(mongoUri), connectPostgres()]);
    logger.info("Databases connected successfully", {}, "Database");
  } catch (error) {
    logger.error("Database connection failed", error as Error, {}, "Database");
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await Promise.all([mongoose.disconnect(), disconnectPostgres()]);
    logger.info("Databases disconnected", {}, "Database");
  } catch (error) {
    logger.error("Database disconnection failed", error as Error, {}, "Database");
    throw error;
  }
};
