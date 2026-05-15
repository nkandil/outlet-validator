import { describe, expect, it } from "vitest";
import { countReviewed, makeOutletKey } from "./session-utils";

describe("session utilities", () => {
  it("counts only validations with a selected outlet status", () => {
    expect(
      countReviewed({
        a: { status: "Valid" },
        b: { status: "" },
        c: { status: "Needs Update" }
      })
    ).toBe(2);
  });

  it("builds stable keys that avoid duplicate source ID collisions", () => {
    expect(makeOutletKey("OUT-7", 12)).toBe("OUT-7__row_12");
    expect(makeOutletKey("OUT-7", 13)).toBe("OUT-7__row_13");
  });
});
