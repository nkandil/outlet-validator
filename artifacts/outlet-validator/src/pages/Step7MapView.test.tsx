import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOutletStore } from "../store";
import { Step7MapView } from "./Step7MapView";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="map">{children}</div>,
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TileLayer: () => <div />,
  useMap: () => ({ getZoom: () => 14, setView: vi.fn() })
}));

vi.mock("../auth", async () => {
  const actual = await vi.importActual<typeof import("../auth")>("../auth");
  return {
    ...actual,
    useAuth: () => ({ user: { id: "admin-id", name: "Admin", email: "admin@example.com", role: "admin" } })
  };
});

function makeOutlets(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    outletKey: `outlet-${index}__row_${index}`,
    rowIndex: index,
    id: `outlet-${index}`,
    latitude: 30 + index / 1000,
    longitude: 31,
    originalData: { id: `outlet-${index}`, name: `Outlet ${index}` },
    distanceKm: null
  }));
}

describe("Step7MapView", () => {
  beforeEach(() => {
    useOutletStore.getState().reset();
    useOutletStore.setState({
      currentStep: 7,
      sessionId: "session-id",
      radiusKm: 5,
      outlets: makeOutlets(60),
      confirmedMapping: { id: "id", lat: "lat", lng: "lng", displayField: "name", colorByField: "", colorByValues: {}, shapeByField: "", shapeByValues: {} },
      visibleFields: ["name"],
      fieldsToVerify: ["name"],
      validations: {},
      syncState: "synced"
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ id: "session-id", radiusKm: 8 })
      }))
    );
    vi.stubGlobal("navigator", { ...navigator, geolocation: undefined, onLine: false });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("removes manual save and rotation controls while limiting nearest outlets", async () => {
    render(<Step7MapView />);

    expect(screen.queryByRole("button", { name: "Save Session" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /rotate map/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Review" })).toHaveLength(50);
    expect(screen.getByText("Showing the nearest 50 of 60 matching outlets.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Show nearest"), { target: { value: "25" } });

    expect(screen.getAllByRole("button", { name: "Review" })).toHaveLength(25);
    expect(screen.getByText("Showing the nearest 25 of 60 matching outlets.")).toBeInTheDocument();
  });

  it("autosaves radius changes after a short debounce", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<Step7MapView />);

    fireEvent.change(screen.getByLabelText("Nearby radius"), { target: { value: "8" } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/sessions/session-id",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ radiusKm: 8 }) })
      )
    );
  });
});
