import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "@workspace/db";
import { HttpError } from "../http-error";

const tokenTtlSeconds = 60 * 60 * 12;

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function parseBase64urlJson<T>(input: string): T {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as T;
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [method, salt, expectedHash] = storedHash.split(":");
  if (method !== "scrypt" || !salt || !expectedHash) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString("base64url"));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signToken(user: AuthUser, secret = process.env.JWT_SECRET ?? "") {
  if (!secret) throw new Error("JWT_SECRET is required");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ sub: user.id, email: user.email, role: user.role, iat: now, exp: now + tokenTtlSeconds }));
  const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string, secret = process.env.JWT_SECRET ?? "") {
  if (!secret) throw new Error("JWT_SECRET is required");
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new HttpError(401, "Invalid token");
  const expected = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new HttpError(401, "Invalid token");
  }

  const decoded = parseBase64urlJson<{ sub: string; exp: number }>(payload);
  if (!decoded.sub || decoded.exp < Math.floor(Date.now() / 1000)) throw new HttpError(401, "Invalid token");
  return decoded.sub;
}
