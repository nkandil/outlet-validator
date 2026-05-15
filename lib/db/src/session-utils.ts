import type { OutletValidation } from "./types";

export function makeOutletKey(id: unknown, rowIndex: number) {
  const sourceId = String(id ?? "").trim() || `row_${rowIndex}`;
  return `${sourceId}__row_${rowIndex}`;
}

export function countReviewed(validations: Record<string, Partial<OutletValidation>> = {}) {
  return Object.values(validations).filter((validation) => Boolean(validation.status)).length;
}
