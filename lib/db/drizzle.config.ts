import { defineConfig } from "drizzle-kit";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadRootEnv() {
  const envPath = resolve("../../.env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

loadRootEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run Drizzle against PostgreSQL");
}

function getDbCredentials(connectionString: string) {
  const url = new URL(connectionString);
  const isSupabaseHost = url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".pooler.supabase.com");
  const sslRequired = url.searchParams.get("sslmode") === "require" || isSupabaseHost;

  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: sslRequired ? { rejectUnauthorized: false } : undefined
  };
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: getDbCredentials(process.env.DATABASE_URL)
});
