import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "../../../.env") });
loadEnv({ path: resolve(here, "../.env"), override: true });

const baseUrl = (process.env.OUTLET_VALIDATOR_BASE_URL ?? "https://outlet-validator.netlify.app").replace(/\/$/, "");
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
const runId = `codex-prod-smoke-${Date.now()}`;
const userEmail = `${runId}@example.com`;
const password = "temporary-password";

interface RequestOptions {
  method?: string;
  token?: string;
  body?: unknown;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function request(path: string, options: RequestOptions = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json().catch(() => undefined) : await response.text().catch(() => undefined);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body ? String((body as { error?: unknown }).error) : `Request failed with ${response.status}`;
    throw new Error(`${options.method ?? "GET"} ${path}: ${message}`);
  }
  return body;
}

async function cleanup(token: string, userId?: string) {
  if (!userId) return;
  await request(`/api/users/${userId}`, { method: "DELETE", token }).catch(() => undefined);
  await request(`/api/users/${userId}/permanent`, { method: "DELETE", token }).catch(() => undefined);
}

async function main() {
  assert(adminEmail && adminPassword, "ADMIN_EMAIL and ADMIN_PASSWORD are required for production smoke validation.");

  const health = await request("/api/healthz");
  assert(health?.mode === "postgres", "published API is not running in postgres mode");

  const login = await request("/api/auth/login", { method: "POST", body: { email: adminEmail, password: adminPassword } });
  const token = login?.token;
  assert(token, "admin login did not return a token");

  let userId = "";
  try {
    const created = await request("/api/users", {
      method: "POST",
      token,
      body: { name: `${runId} Reviewer`, email: userEmail, role: "reviewer", password }
    });
    userId = created.id;
    assert(created.email === userEmail && created.isActive !== false, "created user response was not active");

    await request(`/api/users/${userId}`, { method: "DELETE", token });
    const archivedUsers = await request("/api/users?includeInactive=true", { token });
    assert(Array.isArray(archivedUsers) && archivedUsers.some((user) => user.id === userId && user.isActive === false), "archived user was not listed");

    const restored = await request("/api/users", {
      method: "POST",
      token,
      body: { name: `${runId} Restored`, email: userEmail, role: "reviewer", password: "restored-password" }
    });
    assert(restored.id === userId && restored.isActive !== false, "creating with archived email did not restore the user");

    await request("/api/auth/login", { method: "POST", body: { email: userEmail, password: "restored-password" } });
    await request(`/api/users/${userId}`, { method: "DELETE", token });
    await request(`/api/users/${userId}/permanent`, { method: "DELETE", token });
    userId = "";
  } finally {
    await cleanup(token, userId);
  }

  console.log(`Production smoke validation passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
