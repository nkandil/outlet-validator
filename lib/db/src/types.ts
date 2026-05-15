export type FieldStatus = "Valid" | "Invalid" | "Not Sure" | "";
export type OutletStatus = "Valid" | "Needs Update" | "Invalid" | "Duplicate" | "Could Not Verify" | "";
export type PinShape = "circle" | "square" | "diamond" | "triangle" | string;

export interface FieldValidation {
  status: FieldStatus;
  correctedValue: string;
  comment: string;
}

export interface OutletValidation {
  status: OutletStatus;
  generalComments: string;
  correctedValue?: string;
  validatedBy: string;
  validatedAt: string;
  reviewerId?: string;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAccuracyMeters?: number | null;
  gpsCapturedAt?: string;
  gpsPermissionStatus?: "granted" | "denied" | "unavailable" | "";
  distanceToOutletMeters?: number | null;
  fields: Record<string, FieldValidation>;
}

export interface Outlet {
  outletKey: string;
  rowIndex: number;
  id: string;
  latitude: number;
  longitude: number;
  originalData: Record<string, unknown>;
  distanceKm: number | null;
}

export interface ConfirmedMapping {
  id: string;
  lat: string;
  lng: string;
  displayField: string;
  colorByField: string;
  colorByValues: Record<string, string>;
  shapeByField: string;
  shapeByValues: Record<string, PinShape>;
}

export interface SessionConfig {
  confirmedMapping: ConfirmedMapping;
  visibleFields: string[];
  fieldsToVerify: string[];
  reviewerName: string;
  rawHeaders: string[];
}

export interface SessionSummary {
  id: string;
  name: string;
  fileName: string;
  radiusKm: number;
  outletCount: number;
  reviewedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionDetail extends SessionSummary {
  config: SessionConfig;
  outlets: Outlet[];
  validations: Record<string, OutletValidation>;
}

export interface CreateSessionBody {
  name: string;
  fileName: string;
  radiusKm?: number;
  config: SessionConfig;
  outlets: Outlet[];
  validations: Record<string, OutletValidation>;
}

export interface UpdateSessionBody {
  name?: string;
  radiusKm?: number;
  config?: SessionConfig;
  outlets?: Outlet[];
  validations?: Record<string, OutletValidation>;
}

export type UserRole = "admin" | "coordinator" | "reviewer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  disabledAt?: string | null;
}

export interface UserGroup {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserBody {
  name: string;
  email: string;
  role: UserRole;
  password: string;
}

export interface DashboardMetrics {
  totalSessions: number;
  activeSessions: number;
  totalOutlets: number;
  reviewedOutlets: number;
  pendingOutlets: number;
  validCount: number;
  invalidCount: number;
  needsUpdateCount: number;
  duplicateCount: number;
  gpsMissingCount: number;
}
