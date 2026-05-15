import type { AuthUser, ConfirmedMapping, DashboardMetrics, FieldValidation, Outlet, OutletValidation, SessionConfig, SessionDetail, SessionSummary, UserGroup, UserRole } from "@workspace/db";
import type { WorkBook } from "xlsx";

export type { AuthUser, ConfirmedMapping, DashboardMetrics, FieldValidation, Outlet, OutletValidation, SessionConfig, SessionDetail, SessionSummary, UserGroup, UserRole };

export type RowData = Record<string, unknown>;
export type SyncState = "idle" | "saved-local" | "saving" | "syncing" | "synced" | "failed";
export type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAt?: string;
}

export interface UploadState {
  workbook: WorkBook | null;
  sheetNames: string[];
  selectedSheet: string;
  rawHeaders: string[];
  rawRows: RowData[];
  fileName: string;
}

export const defaultMapping: ConfirmedMapping = {
  id: "",
  lat: "",
  lng: "",
  displayField: "",
  colorByField: "",
  colorByValues: {},
  shapeByField: "",
  shapeByValues: {}
};
