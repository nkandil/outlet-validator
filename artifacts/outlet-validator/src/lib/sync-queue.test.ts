import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearValidationQueue, enqueueValidationSync, getPendingValidationSyncItems, retryValidationSync } from "./sync-queue";

const validation = {
  status: "Valid" as const,
  generalComments: "",
  validatedBy: "Reviewer",
  validatedAt: "2026-05-15T10:00:00.000Z",
  fields: {}
};

describe("validation sync queue", () => {
  beforeEach(async () => {
    await clearValidationQueue();
  });

  it("keeps failed validation saves pending and removes them after retry succeeds", async () => {
    await enqueueValidationSync({ sessionId: "s1", outletKey: "A__row_0", payload: validation });

    await retryValidationSync(vi.fn(async () => {
      throw new Error("offline");
    }));

    let items = await getPendingValidationSyncItems();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ status: "failed", errorMessage: "offline" });

    await retryValidationSync(vi.fn(async () => undefined));

    items = await getPendingValidationSyncItems();
    expect(items).toHaveLength(0);
  });
});
