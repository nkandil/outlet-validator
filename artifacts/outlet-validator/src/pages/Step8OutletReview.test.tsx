import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutletStore } from "../store";
import type { Outlet, OutletValidation } from "../types";
import { Step8OutletReview } from "./Step8OutletReview";

const outlet: Outlet = {
  outletKey: "A__row_0",
  rowIndex: 0,
  id: "A",
  latitude: 30,
  longitude: 31,
  originalData: { id: "A", name: "كوكا كولا" },
  distanceKm: 0.12
};

function ReviewHarness({ onSync }: { onSync: (outletKey: string, validation: OutletValidation) => Promise<void> }) {
  const selectedOutletKey = useOutletStore((state) => state.selectedOutletKey);
  return selectedOutletKey ? <Step8OutletReview outlet={outlet} onSync={onSync} /> : null;
}

describe("Step8OutletReview", () => {
  beforeEach(() => {
    useOutletStore.getState().reset();
    useOutletStore.setState({
      currentStep: 7,
      reviewerName: "Tester",
      selectedOutletKey: outlet.outletKey,
      confirmedMapping: { id: "id", lat: "lat", lng: "lng", displayField: "name", colorByField: "", colorByValues: {}, shapeByField: "", shapeByValues: {} },
      visibleFields: ["name"],
      fieldsToVerify: ["name"]
    });
  });

  afterEach(() => cleanup());

  it("uses button groups for statuses and saves Invalid as the outlet status", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn(async () => undefined);

    render(<ReviewHarness onSync={onSync} />);

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    const outletStatus = screen.getByRole("group", { name: "Outlet status" });
    expect(within(outletStatus).getByRole("button", { name: "Invalid" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Invalid Lead" })).not.toBeInTheDocument();

    await user.click(within(outletStatus).getByRole("button", { name: "Invalid" }));
    await user.click(screen.getByRole("button", { name: "Save Review" }));

    expect(useOutletStore.getState().validations[outlet.outletKey].status).toBe("Invalid");
    expect(onSync).toHaveBeenCalledWith(outlet.outletKey, expect.objectContaining({ status: "Invalid" }));
  });

  it("closes immediately and uses live location without waiting for background sync", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn(() => new Promise<void>(() => undefined));
    useOutletStore.setState({ userLocation: { latitude: 30.001, longitude: 31.001, accuracyMeters: 8, capturedAt: "2026-05-15T10:00:00.000Z" } });

    render(<ReviewHarness onSync={onSync} />);

    await user.click(within(screen.getByRole("group", { name: "Outlet status" })).getByRole("button", { name: "Valid" }));
    await user.click(screen.getByRole("button", { name: "Save Review" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Save Review" })).not.toBeInTheDocument());
    expect(onSync).toHaveBeenCalledWith(
      outlet.outletKey,
      expect.objectContaining({
        status: "Valid",
        gpsPermissionStatus: "granted",
        gpsLatitude: 30.001,
        gpsAccuracyMeters: 8
      })
    );
  });
});
