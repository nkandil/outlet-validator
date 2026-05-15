import type { Outlet } from "../types";

export const maxMapOutlets = 50;

export function getMapOutlets(outlets: Outlet[], limit: number | "all" = maxMapOutlets) {
  return limit === "all" ? outlets : outlets.slice(0, limit);
}

export function getGoogleMapsUrl(outlet: Outlet) {
  const query = encodeURIComponent(`${outlet.latitude},${outlet.longitude}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
