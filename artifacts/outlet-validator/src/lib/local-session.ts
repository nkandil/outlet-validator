import type { Outlet, OutletValidation, SessionSummary } from "../types";

export const localSessionId = "local-current-session";

interface LocalSessionInput {
  sessionId: string | null;
  sessionName: string;
  fileName: string;
  radiusKm?: number;
  outlets: Outlet[];
  validations: Record<string, OutletValidation>;
  pendingSync: boolean;
}

export interface LocalSessionSummary extends SessionSummary {
  isLocal: true;
}

export function buildLocalSessionSummary(input: LocalSessionInput): LocalSessionSummary | null {
  const hasRecoverableWork = input.outlets.length > 0 || Object.keys(input.validations).length > 0 || Boolean(input.fileName);
  if (!hasRecoverableWork) return null;

  const now = new Date().toISOString();
  return {
    id: localSessionId,
    name: input.sessionName || (input.pendingSync ? "Local unsynced session" : "Local session draft"),
    fileName: input.fileName || "Local browser session",
    radiusKm: input.radiusKm ?? 5,
    outletCount: input.outlets.length,
    reviewedCount: Object.values(input.validations).filter((validation) => validation.status).length,
    createdAt: now,
    updatedAt: now,
    isLocal: true
  };
}
