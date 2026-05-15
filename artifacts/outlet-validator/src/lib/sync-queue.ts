import localforage from "localforage";
import type { OutletValidation } from "../types";

export type PendingValidationSyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface PendingValidationSync {
  localId: string;
  sessionId: string;
  outletKey: string;
  payload: OutletValidation;
  status: PendingValidationSyncStatus;
  errorMessage: string;
  createdAt: string;
}

const store = localforage.createInstance({
  name: "outlet-validator",
  storeName: "pending_validation_sync"
});

function makeLocalId(sessionId: string, outletKey: string) {
  return `${sessionId}:${outletKey}:${Date.now()}`;
}

export async function enqueueValidationSync(input: { sessionId: string; outletKey: string; payload: OutletValidation }) {
  const item: PendingValidationSync = {
    localId: makeLocalId(input.sessionId, input.outletKey),
    sessionId: input.sessionId,
    outletKey: input.outletKey,
    payload: input.payload,
    status: "pending",
    errorMessage: "",
    createdAt: new Date().toISOString()
  };
  await store.setItem(item.localId, item);
  return item;
}

export async function getPendingValidationSyncItems() {
  const items: PendingValidationSync[] = [];
  await store.iterate<PendingValidationSync, void>((value) => {
    if (value.status !== "synced") items.push(value);
  });
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function setStatus(item: PendingValidationSync, status: PendingValidationSyncStatus, errorMessage = "") {
  const next = { ...item, status, errorMessage };
  await store.setItem(item.localId, next);
  return next;
}

export async function retryValidationSync(send: (item: PendingValidationSync) => Promise<void>) {
  const items = await getPendingValidationSyncItems();
  for (const item of items) {
    const syncing = await setStatus(item, "syncing");
    try {
      await send(syncing);
      await store.removeItem(item.localId);
    } catch (error) {
      await setStatus(item, "failed", error instanceof Error ? error.message : "Sync failed");
    }
  }
}

export async function clearValidationQueue() {
  await store.clear();
}
