import { describe, expect, it, vi } from "vitest";

const { createPoolConfig, resolveConnectionString } = await import("./client");

describe("database client", () => {
  it("uses DATABASE_URL when it is configured", () => {
    vi.stubEnv("DATABASE_URL", "postgres://configured/database");

    expect(resolveConnectionString()).toBe("postgres://configured/database");
  });

  it("requires DATABASE_URL when it is not configured", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => resolveConnectionString()).toThrow("DATABASE_URL is required for PostgreSQL persistence");
  });

  it("enables TLS when the connection string requires SSL", () => {
    const config = createPoolConfig("postgres://postgres.ref:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require");

    expect(config).toEqual({
      connectionString: "postgres://postgres.ref:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
      ssl: { rejectUnauthorized: false }
    });
  });

  it("enables TLS for Supabase pooler URLs even when sslmode is omitted", () => {
    const config = createPoolConfig("postgres://postgres.ref:password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres");

    expect(config).toEqual({
      connectionString: "postgres://postgres.ref:password@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
      ssl: { rejectUnauthorized: false }
    });
  });
});
