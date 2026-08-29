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
  const dir = path.join(process.cwd(), "drizzle");
  if (!fs.existsSync(dir)) {
    logger.warn("App SQL migration directory not found; skipping", { dir }, "Database");
    return;
  }
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await pool.query(sql);
    logger.info("Applied SQL migration", { file }, "Database");
  }
}

export { schema };
