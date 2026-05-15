import { describe, expect, it } from "vitest";
import { buildOutlets, haversineKm, nearbySorted } from "./geo";

describe("geo utilities", () => {
  it("calculates distance using the Haversine formula", () => {
    expect(haversineKm({ latitude: 30.0444, longitude: 31.2357 }, { latitude: 30.0500, longitude: 31.2400 })).toBeLessThan(1);
  });

  it("filters invalid coordinates and creates duplicate-safe outlet keys", () => {
    const outlets = buildOutlets(
      [
        { id: "A", lat: "30", lng: "31", name: "Valid" },
        { id: "A", lat: "999", lng: "31", name: "Bad" }
      ],
      { id: "id", lat: "lat", lng: "lng", displayField: "", colorByField: "", colorByValues: {}, shapeByField: "", shapeByValues: {} }
    );

    expect(outlets).toHaveLength(1);
    expect(outlets[0]).toMatchObject({ outletKey: "A__row_0", id: "A", latitude: 30, longitude: 31 });
  });

  it("sorts outlets by recalculated distance from the current location", () => {
    const sorted = nearbySorted(
      [
        { outletKey: "far", rowIndex: 0, id: "far", latitude: 30.05, longitude: 31, originalData: {}, distanceKm: null },
        { outletKey: "near", rowIndex: 1, id: "near", latitude: 30.001, longitude: 31, originalData: {}, distanceKm: null }
      ],
      { latitude: 30, longitude: 31 },
      10
    );

    expect(sorted.map((outlet) => outlet.id)).toEqual(["near", "far"]);
  });

  it("respects a configurable nearby radius", () => {
    const outlets = [
      { outletKey: "two", rowIndex: 0, id: "two", latitude: 30.01, longitude: 31, originalData: {}, distanceKm: null },
      { outletKey: "five", rowIndex: 1, id: "five", latitude: 30.035, longitude: 31, originalData: {}, distanceKm: null }
    ];

    expect(nearbySorted(outlets, { latitude: 30, longitude: 31 }, 2).map((outlet) => outlet.id)).toEqual(["two"]);
    expect(nearbySorted(outlets, { latitude: 30, longitude: 31 }, 5).map((outlet) => outlet.id)).toEqual(["two", "five"]);
  });
});
