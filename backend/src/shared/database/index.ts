import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { connectPostgres, disconnectPostgres } from "./drizzle";

export { db, pool, withTransaction } from "./drizzle";
export type { AppDatabase, AppTransaction, DbOrTx } from "./drizzle";
export * from "./schema";
export { withId, withIds, omitUndefined } from "./map-row";

function hostnameFromDbUrl(url: string): string {
  try {
    return new URL(url.replace(/^mongodb(\+srv)?:\/\//i, "http://")).hostname;
  } catch {
    return "";
  }
}

function assertRoutableDbHost(name: string, url: string): void {
  if (!env.isProduction) return;
  const hostname = hostnameFromDbUrl(url);
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    throw new Error(
      `${name} points at ${hostname}. Inside Docker that is this container, not Mongo/Postgres. Use the database service hostname.`
    );
  }
}

export const connectDatabase = async (): Promise<void> => {
  try {
    const mongoUri = env.mongodbUri;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables");
    }
    if (!env.databaseUrl) {
      throw new Error("DATABASE_URL is not defined in environment variables");
    }
    assertRoutableDbHost("MONGODB_URI", mongoUri);
    assertRoutableDbHost("DATABASE_URL", env.databaseUrl);

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
