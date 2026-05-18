import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionsApi } from "../lib/api";
import { useOutletStore } from "../store";
import { Step6ReviewerName } from "./Step6ReviewerName";

vi.mock("../auth", () => ({
  useAuth: () => ({
    user: { id: "admin-id", name: "Admin User", email: "admin@example.com", role: "admin" }
  })
}));

vi.mock("../lib/api", () => ({
  sessionsApi: {
    create: vi.fn(),
    update: vi.fn()
  }
}));

describe("Step6ReviewerName", () => {
  beforeEach(() => {
    useOutletStore.getState().reset();
    vi.mocked(sessionsApi.create).mockReset();
    vi.mocked(sessionsApi.update).mockReset();
    useOutletStore.setState({
      currentStep: 6,
      fileName: "outlets.csv",
      confirmedMapping: {
        id: "id",
        lat: "lat",
        lng: "lng",
        displayField: "name",
        colorByField: "",
        colorByValues: {},
        shapeByField: "",
        shapeByValues: {}
      },
      rawHeaders: ["id", "lat", "lng", "name"],
      visibleFields: ["name"],
      fieldsToVerify: ["name"],
      outlets: [
        {
          outletKey: "A__row_0",
          rowIndex: 0,
          id: "A",
          latitude: 30,
          longitude: 31,
          originalData: { id: "A", lat: 30, lng: 31, name: "Alpha" },
          distanceKm: null
        }
      ]
    });
  });

  it("creates only one backend session when Start Validation is clicked repeatedly while saving", async () => {
    const user = userEvent.setup();
    let resolveCreate: (value: Awaited<ReturnType<typeof sessionsApi.create>>) => void = () => undefined;
    vi.mocked(sessionsApi.create).mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );
    const created = {
      id: "session-1",
      name: "outlets.csv",
      fileName: "outlets.csv",
      radiusKm: 5,
      outletCount: 1,
      reviewedCount: 0,
      createdAt: "2026-05-18T00:00:00.000Z",
      updatedAt: "2026-05-18T00:00:00.000Z"
    };

    render(<Step6ReviewerName />);

    const button = screen.getByRole("button", { name: "Start Validation" });
    await user.dblClick(button);
    resolveCreate(created);

    await waitFor(() => expect(sessionsApi.create).toHaveBeenCalledTimes(1));
    expect(useOutletStore.getState().sessionId).toBe("session-1");
    expect(useOutletStore.getState().currentStep).toBe(7);
  });
});
