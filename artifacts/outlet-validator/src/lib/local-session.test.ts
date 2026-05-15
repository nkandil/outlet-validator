import { describe, expect, it } from "vitest";
import { buildLocalSessionSummary } from "./local-session";
import type { Outlet, OutletValidation } from "../types";

const outlets: Outlet[] = [
  {
    outletKey: "A__row_0",
    rowIndex: 0,
    id: "A",
    latitude: 30,
    longitude: 31,
    originalData: {},
    distanceKm: null
  }
];

const validations: Record<string, OutletValidation> = {
  A__row_0: {
    status: "Valid",
    generalComments: "",
    validatedBy: "Nour",
    validatedAt: "2026-05-14T12:00:00.000Z",
    fields: {}
  }
};

describe("local session helpers", () => {
  it("builds a recoverable summary for a local session that has not synced", () => {
    const summary = buildLocalSessionSummary({
      sessionId: null,
      sessionName: "",
      fileName: "outlets.xlsx",
      outlets,
      validations,
      pendingSync: true
    });

    expect(summary).toMatchObject({
      id: "local-current-session",
      name: "Local unsynced session",
      fileName: "outlets.xlsx",
      outletCount: 1,
      reviewedCount: 1,
      isLocal: true
    });
  });

  it("does not create a local summary when there is no local work to recover", () => {
    expect(
      buildLocalSessionSummary({
        sessionId: null,
        sessionName: "",
        fileName: "",
        outlets: [],
        validations: {},
        pendingSync: false
      })
    ).toBeNull();
  });
});
