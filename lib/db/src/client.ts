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

export function getPool() {
  pool ??= new Pool({ connectionString: resolveConnectionString() });
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
