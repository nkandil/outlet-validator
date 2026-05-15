import { describe, expect, it } from "vitest";
import { buildExportRows } from "./excel";

describe("excel export", () => {
  it("adds validation metadata and field-level columns", () => {
    const rows = buildExportRows({
      outlets: [
        {
          outletKey: "A__row_0",
          rowIndex: 0,
          id: "A",
          latitude: 30,
          longitude: 31,
          distanceKm: 1.25,
          originalData: { id: "A", name: "Alpha" }
        }
      ],
      validations: {
        A__row_0: {
          status: "Needs Update",
          generalComments: "Wrong name",
          validatedBy: "Nour",
          validatedAt: "2026-05-14T12:00:00.000Z",
          gpsLatitude: 30.1,
          gpsLongitude: 31.1,
          gpsAccuracyMeters: 9,
          gpsCapturedAt: "2026-05-14T12:01:00.000Z",
          gpsPermissionStatus: "granted",
          distanceToOutletMeters: 125,
          fields: {
            name: { status: "Invalid", correctedValue: "Alpha New", comment: "Updated sign" }
          }
        }
      },
      fieldsToVerify: ["name"],
      userLocation: { latitude: 30, longitude: 31 }
    });

    expect(rows[0]).toMatchObject({
      "Validation Status": "Needs Update",
      "Validated By": "Nour",
      "General Comments": "Wrong name",
      "GPS Permission": "granted",
      "GPS Latitude": 30.1,
      "Distance To Outlet Meters": 125,
      "name - Validation Status": "Invalid",
      "name - Corrected Value": "Alpha New"
    });
  });
});
