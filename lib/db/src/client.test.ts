import { describe, expect, it, vi } from "vitest";

const { resolveConnectionString } = await import("./client");

describe("database client", () => {
  it("uses DATABASE_URL when it is configured", () => {
    vi.stubEnv("DATABASE_URL", "postgres://configured/database");

    expect(resolveConnectionString()).toBe("postgres://configured/database");
  });

  it("requires DATABASE_URL when it is not configured", () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(() => resolveConnectionString()).toThrow("DATABASE_URL is required for PostgreSQL persistence");
  });
});
