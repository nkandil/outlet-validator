import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function resolveConnectionString() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for PostgreSQL persistence");
  }

  return process.env.DATABASE_URL;
}

export function createPoolConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  const isSupabaseHost = url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".pooler.supabase.com");
  const requiresSsl = url.searchParams.get("sslmode") === "require" || isSupabaseHost;

  if (url.searchParams.get("sslmode") === "require") {
    url.searchParams.delete("sslmode");
  }

  const config: pg.PoolConfig = { connectionString: url.toString() };

  if (requiresSsl) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

export function getPool() {
  pool ??= new Pool(createPoolConfig(resolveConnectionString()));
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
