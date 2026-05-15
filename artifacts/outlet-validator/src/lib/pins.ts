import L from "leaflet";
import type { ConfirmedMapping, Outlet, OutletValidation } from "../types";

export const presetColors = ["#F40009", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#ca8a04"];
export const pinShapes = ["circle", "square", "diamond", "triangle"] as const;

export function distinctValues(outlets: Outlet[], field: string) {
  if (!field) return [];
  return [...new Set(outlets.map((outlet) => String(outlet.originalData[field] ?? "")).filter(Boolean))].slice(0, 50);
}

export function markerColor(outlet: Outlet, mapping: ConfirmedMapping, validation?: OutletValidation) {
  if (mapping.colorByField) {
    const value = String(outlet.originalData[mapping.colorByField] ?? "");
    return mapping.colorByValues[value] ?? "#F40009";
  }
  return validation?.status ? "#16a34a" : "#F40009";
}

export function markerShape(outlet: Outlet, mapping: ConfirmedMapping) {
  if (mapping.shapeByField) {
    const value = String(outlet.originalData[mapping.shapeByField] ?? "");
    return mapping.shapeByValues[value] ?? "circle";
  }
  return "circle";
}

export function makeOutletIcon(color: string, shape: string) {
  const className = `pin-shape pin-${shape}`;
  return L.divIcon({
    className: "",
    html: `<span class="${className}" style="background:${color};--pin-color:${color}"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}
