import { describe, expect, it } from "vitest";
import { detectRequiredColumns } from "./schema-detect";

describe("detectRequiredColumns", () => {
  it("detects known aliases for outlet ID, latitude, and longitude", () => {
    expect(detectRequiredColumns(["Customer ID", "GPS_Latitude", "gps_long"])).toEqual({
      id: "Customer ID",
      lat: "GPS_Latitude",
      lng: "gps_long"
    });
  });

  it("leaves missing fields blank without blocking manual mapping", () => {
    expect(detectRequiredColumns(["Name", "Region"])).toEqual({ id: "", lat: "", lng: "" });
  });
});
