import type { ConfirmedMapping } from "../types";

const aliases = {
  id: ["id", "outlet_id", "customer_id", "lead_id", "code", "store_id", "outletid", "outlet id", "customer id"],
  lat: ["lat", "latitude", "y", "gps_lat", "gps_latitude"],
  lng: ["lng", "lon", "long", "longitude", "x", "gps_long", "gps_longitude"]
};

function normalize(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function findAlias(headers: string[], options: string[]) {
  const normalized = new Map(headers.map((header) => [normalize(header), header]));
  for (const option of options) {
    const exact = normalized.get(normalize(option));
    if (exact) return exact;
  }
  return "";
}

export function detectRequiredColumns(headers: string[]) {
  return {
    id: findAlias(headers, aliases.id),
    lat: findAlias(headers, aliases.lat),
    lng: findAlias(headers, aliases.lng)
  };
}

export function applyDetectedMapping(mapping: ConfirmedMapping, headers: string[]): ConfirmedMapping {
  return { ...mapping, ...detectRequiredColumns(headers) };
}
