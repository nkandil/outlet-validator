import type { ConfirmedMapping, Outlet, RowData, UserLocation } from "../types";

function makeBrowserOutletKey(id: unknown, rowIndex: number) {
  const sourceId = String(id ?? "").trim() || `row_${rowIndex}`;
  return `${sourceId}__row_${rowIndex}`;
}

export function parseCoordinate(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.trim().replace(",", "."));
  return Number.NaN;
}

export function isValidLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function buildOutlets(rows: RowData[], mapping: ConfirmedMapping): Outlet[] {
  return rows.flatMap((row, index) => {
    const latitude = parseCoordinate(row[mapping.lat]);
    const longitude = parseCoordinate(row[mapping.lng]);
    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return [];

    const id = String(row[mapping.id] ?? `row-${index}`).trim() || `row-${index}`;
    return [
      {
        outletKey: makeBrowserOutletKey(id, index),
        rowIndex: index,
        id,
        latitude,
        longitude,
        originalData: row,
        distanceKm: null
      }
    ];
  });
}

export function haversineKm(a: UserLocation, b: UserLocation) {
  const earthKm = 6371;
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function withDistances(outlets: Outlet[], userLocation: UserLocation | null) {
  if (!userLocation) return outlets.map((outlet) => ({ ...outlet, distanceKm: null }));
  return outlets.map((outlet) => ({
    ...outlet,
    distanceKm: haversineKm(userLocation, { latitude: outlet.latitude, longitude: outlet.longitude })
  }));
}

export function nearbySorted(outlets: Outlet[], userLocation: UserLocation | null, radiusKm = 5) {
  const measured = withDistances(outlets, userLocation);
  if (!userLocation) return measured;
  return measured.filter((outlet) => outlet.distanceKm !== null && outlet.distanceKm <= radiusKm).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
}

export function duplicateIds(outlets: Outlet[]) {
  const counts = new Map<string, number>();
  outlets.forEach((outlet) => counts.set(outlet.id, (counts.get(outlet.id) ?? 0) + 1));
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}
