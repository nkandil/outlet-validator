import { afterEach, describe, expect, it, vi } from "vitest";
import { authApi, sessionsApi, setApiToken } from "./api";

describe("sessionsApi", () => {
  afterEach(() => {
    setApiToken(null);
    vi.unstubAllGlobals();
  });

  it("reports a useful error when the dev server returns HTML instead of API JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "text/html" }),
        text: async () => "<!doctype html>"
      }))
    );

    await expect(sessionsApi.list()).rejects.toThrow("Expected JSON from /api/sessions");
  });

  it("attaches the bearer token to API requests", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => []
    }));
    vi.stubGlobal("fetch", fetchMock);
    setApiToken("abc123");

    await sessionsApi.list();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/api/sessions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer abc123" })
      })
    );
  });

  it("supports login through the auth API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ token: "token", user: { id: "u1", name: "User", email: "u@example.com", role: "admin" } })
      }))
    );

    await expect(authApi.login("u@example.com", "password")).resolves.toMatchObject({ token: "token" });
  });

  it("uses same-origin API calls in deployed builds when VITE_API_BASE_URL points at localhost", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => []
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("location", { hostname: "outlet-validator.netlify.app" });

    await sessionsApi.list();

    expect(fetchMock).toHaveBeenCalledWith("/api/sessions", expect.any(Object));
  });
});
