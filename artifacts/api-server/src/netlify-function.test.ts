import { describe, expect, test, vi } from "vitest";

vi.stubEnv("DEMO_MODE", "true");
vi.stubEnv("JWT_SECRET", "test-secret");

const { handler } = await import("../../../netlify/functions/api.ts");

interface LambdaTestResponse {
  statusCode: number;
  body: string;
}

describe("Netlify API function", () => {
  test("serves the API health endpoint from the public API path", async () => {
    const response = (await handler(
      {
        path: "/api/healthz",
        httpMethod: "GET",
        headers: {},
        body: "",
        requestContext: { identity: { sourceIp: "" } }
      },
      {}
    )) as LambdaTestResponse;

    expect(JSON.parse(response.body)).toEqual({ status: "ok", mode: "demo" });
    expect(response.statusCode).toBe(200);
  });

  test("serves the API health endpoint from the rewritten function path", async () => {
    const response = (await handler(
      {
        path: "/.netlify/functions/api/healthz",
        httpMethod: "GET",
        headers: {},
        body: "",
        requestContext: { identity: { sourceIp: "" } }
      },
      {}
    )) as LambdaTestResponse;

    expect(JSON.parse(response.body)).toEqual({ status: "ok", mode: "demo" });
    expect(response.statusCode).toBe(200);
  });
});
