import type { AuthUser, CreateSessionBody, CreateUserBody, DashboardMetrics, OutletValidation, SessionDetail, SessionSummary, UpdateSessionBody, UserGroup, UserRole } from "@workspace/db";

const tokenStorageKey = "outlet-validator-auth-token";
let apiToken: string | null = typeof localStorage === "undefined" ? null : localStorage.getItem(tokenStorageKey);
let unauthorizedHandler: (() => void) | null = null;

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getApiBase() {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  if (!configured) return "";

  try {
    const configuredUrl = new URL(configured);
    const currentHostname = typeof location === "undefined" ? "localhost" : location.hostname;
    if (isLocalHostname(configuredUrl.hostname) && !isLocalHostname(currentHostname)) return "";
  } catch {
    return configured;
  }

  return configured;
}

export function setApiToken(token: string | null) {
  apiToken = token;
  if (typeof localStorage !== "undefined") {
    if (token) localStorage.setItem(tokenStorageKey, token);
    else localStorage.removeItem(tokenStorageKey);
  }
}

export function getApiToken() {
  return apiToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined)
  };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  const response = await fetch(`${getApiBase()}/api${path}`, {
    ...init,
    headers
  });
  const contentType = response.headers.get("content-type") ?? "";

  if (!response.ok) {
    if (response.status === 401) {
      setApiToken(null);
      unauthorizedHandler?.();
    }
    const body = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  if (!contentType.includes("application/json")) {
    throw new Error(`Expected JSON from /api${path}, but received ${contentType || "unknown content type"}. Is the API server running?`);
  }

  return response.json() as Promise<T>;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  me: () => request<AuthUser>("/auth/me")
};

export const usersApi = {
  list: (role?: UserRole) => request<AuthUser[]>(`/users${role ? `?role=${encodeURIComponent(role)}` : ""}`),
  create: (body: CreateUserBody) =>
    request<AuthUser>("/users", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  updateRole: (id: string, role: UserRole) =>
    request<AuthUser>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ role })
    }),
  delete: (id: string) =>
    request<void>(`/users/${id}`, {
      method: "DELETE"
    })
};

export const groupsApi = {
  list: () => request<UserGroup[]>("/groups"),
  create: (body: { name: string; description?: string }) =>
    request<UserGroup>("/groups", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  update: (id: string, body: { name?: string; description?: string }) =>
    request<UserGroup>(`/groups/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  delete: (id: string) =>
    request<void>(`/groups/${id}`, {
      method: "DELETE"
    }),
  getMembers: (id: string) => request<{ userIds: string[] }>(`/groups/${id}/members`),
  setMembers: (id: string, userIds: string[]) =>
    request<{ userIds: string[] }>(`/groups/${id}/members`, {
      method: "PUT",
      body: JSON.stringify({ userIds })
    })
};

export const sessionsApi = {
  list: () => request<SessionSummary[]>("/sessions"),
  create: (body: CreateSessionBody) =>
    request<SessionSummary>("/sessions", {
      method: "POST",
      body: JSON.stringify(body)
    }),
  get: (id: string) => request<SessionDetail>(`/sessions/${id}`),
  update: (id: string, body: UpdateSessionBody) =>
    request<SessionSummary>(`/sessions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  delete: (id: string) =>
    request<void>(`/sessions/${id}`, {
      method: "DELETE"
    }),
  getAssignments: (id: string) => request<{ userIds: string[]; groupIds: string[] }>(`/sessions/${id}/assignments`),
  setAssignments: (id: string, assignment: { userIds: string[]; groupIds?: string[] }) =>
    request<{ userIds: string[]; groupIds: string[] }>(`/sessions/${id}/assignments`, {
      method: "PUT",
      body: JSON.stringify({ userIds: assignment.userIds, groupIds: assignment.groupIds ?? [] })
    }),
  upsertValidation: (sessionId: string, outletKey: string, validation: OutletValidation) =>
    request<OutletValidation>(`/sessions/${sessionId}/validations/${encodeURIComponent(outletKey)}`, {
      method: "PUT",
      body: JSON.stringify(validation)
    })
};

export const dashboardApi = {
  get: (filters: { sessionId?: string; reviewerId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.sessionId) params.set("sessionId", filters.sessionId);
    if (filters.reviewerId) params.set("reviewerId", filters.reviewerId);
    const query = params.toString();
    return request<DashboardMetrics>(`/dashboard${query ? `?${query}` : ""}`);
  }
};
