import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

vi.mock("../auth", async () => {
  const actual = await vi.importActual<typeof import("../auth")>("../auth");
  return {
    ...actual,
    useAuth: () => ({
      user: { id: "admin", name: "Admin", email: "admin@example.com", role: "admin" },
      loading: false,
      login: vi.fn(),
      logout: vi.fn()
    })
  };
});

vi.mock("../lib/api", () => ({
  sessionsApi: {
    list: vi.fn(async () => [{ id: "s1", name: "Session 1", fileName: "outlets.csv", radiusKm: 5, outletCount: 10, reviewedCount: 4, createdAt: "", updatedAt: "" }])
  },
  dashboardApi: {
    get: vi.fn(async () => ({
      totalSessions: 1,
      activeSessions: 1,
      totalOutlets: 10,
      reviewedOutlets: 4,
      pendingOutlets: 6,
      validCount: 3,
      invalidCount: 1,
      needsUpdateCount: 2,
      duplicateCount: 0,
      gpsMissingCount: 1
    }))
  }
}));

vi.mock("../lib/sync-queue", () => ({
  getPendingValidationSyncItems: vi.fn(async () => [{ id: "pending" }])
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders chart-led dashboard sections", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("Review progress")).toBeInTheDocument());
    expect(screen.getByText("Status distribution")).toBeInTheDocument();
    expect(screen.getByText("Sync status")).toBeInTheDocument();
    expect(screen.getByLabelText("Reviewed progress chart")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
    expect(screen.getByText("4 of 10 reviewed")).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("Needs update")).toBeInTheDocument();
    expect(screen.getByText("20%")).toBeInTheDocument();
  });
});
