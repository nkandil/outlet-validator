import * as XLSX from "xlsx";
import type { Outlet, OutletValidation, UserLocation } from "../types";

interface ExportInput {
  outlets: Outlet[];
  validations: Record<string, OutletValidation>;
  fieldsToVerify: string[];
  userLocation: UserLocation | null;
}

export function buildExportRows({ outlets, validations, fieldsToVerify, userLocation }: ExportInput) {
  return outlets.map((outlet) => {
    const validation = validations[outlet.outletKey];
    const row: Record<string, unknown> = {
      ...outlet.originalData,
      "Validation Status": validation?.status ?? "",
      "Validated By": validation?.validatedBy ?? "",
      "Validated At": validation?.validatedAt ? new Date(validation.validatedAt).toLocaleString() : "",
      "Distance From User KM": outlet.distanceKm ?? "",
      "User Latitude": validation?.gpsLatitude ?? userLocation?.latitude ?? "",
      "User Longitude": validation?.gpsLongitude ?? userLocation?.longitude ?? "",
      "GPS Latitude": validation?.gpsLatitude ?? "",
      "GPS Longitude": validation?.gpsLongitude ?? "",
      "GPS Accuracy Meters": validation?.gpsAccuracyMeters ?? "",
      "GPS Captured At": validation?.gpsCapturedAt ? new Date(validation.gpsCapturedAt).toLocaleString() : "",
      "GPS Permission": validation?.gpsPermissionStatus ?? "",
      "Distance To Outlet Meters": validation?.distanceToOutletMeters ?? "",
      "General Comments": validation?.generalComments ?? ""
    };

    for (const field of fieldsToVerify) {
      const fieldValidation = validation?.fields[field];
      row[`${field} - Validation Status`] = fieldValidation?.status ?? "";
      row[`${field} - Corrected Value`] = fieldValidation?.correctedValue ?? "";
      row[`${field} - Comment`] = fieldValidation?.comment ?? "";
    }

    return row;
  });
}

export function exportValidatedWorkbook(input: ExportInput) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(buildExportRows(input));
  XLSX.utils.book_append_sheet(workbook, sheet, "Validated Outlets");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `outlet_validation_${date}.xlsx`);
}
