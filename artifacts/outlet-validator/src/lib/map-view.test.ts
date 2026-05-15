import { describe, expect, it } from "vitest";
import { getGoogleMapsUrl, getMapOutlets } from "./map-view";
import type { Outlet } from "../types";

function outlet(index: number): Outlet {
  return {
    outletKey: `O-${index}__row_${index}`,
    rowIndex: index,
    id: `O-${index}`,
    latitude: 30 + index / 10000,
    longitude: 31,
    originalData: {},
    distanceKm: index / 10
  };
}

describe("map view helpers", () => {
  it("limits map markers to the nearest 50 filtered outlets", () => {
    const outlets = Array.from({ length: 75 }, (_, index) => outlet(index));

    const mapOutlets = getMapOutlets(outlets);

    expect(mapOutlets).toHaveLength(50);
    expect(mapOutlets.at(0)?.id).toBe("O-0");
    expect(mapOutlets.at(-1)?.id).toBe("O-49");
  });

  it("creates a Google Maps destination URL for an outlet", () => {
    expect(getGoogleMapsUrl(outlet(0))).toBe("https://www.google.com/maps/search/?api=1&query=30%2C31");
  });
});
