import fs from "fs";
import path from "path";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;
export type AppTransaction = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
export type DbOrTx = AppDatabase | AppTransaction;

export let pool: Pool;
export let db: AppDatabase;

export async function connectPostgres(): Promise<void> {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not defined in environment variables");
  }

  pool = new Pool({ connectionString: env.databaseUrl });
  db = drizzle(pool, { schema });

  await pool.query("SELECT 1");
  await runAppMigrations();
  logger.info("Postgres connected successfully", {}, "Database");
}

export async function disconnectPostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    logger.info("Postgres disconnected", {}, "Database");
  }
}

export async function withTransaction<T>(fn: (tx: AppTransaction) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

async function runAppMigrations(): Promise<void> {
  const migrationPath = path.join(process.cwd(), "drizzle", "0000_app_apis.sql");
  if (!fs.existsSync(migrationPath)) {
    logger.warn("App SQL migration file not found; skipping", { migrationPath }, "Database");
    return;
  }
  const sql = fs.readFileSync(migrationPath, "utf8");
  await pool.query(sql);
}

export { schema };
