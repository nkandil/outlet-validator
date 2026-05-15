import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Step0SessionPicker } from "./Step0SessionPicker";
import { useOutletStore } from "../store";

describe("Step0SessionPicker", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: "API unavailable" })
      }))
    );
    useOutletStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a recoverable local session without entering a render loop", async () => {
    useOutletStore.setState({
      fileName: "seed.xlsx",
      pendingSync: true,
      outlets: [
        {
          outletKey: "A__row_0",
          rowIndex: 0,
          id: "A",
          latitude: 30,
          longitude: 31,
          originalData: { id: "A", name: "Alpha" },
          distanceKm: null
        }
      ],
      validations: {}
    });

    render(<Step0SessionPicker />);

    await waitFor(() => expect(screen.getByText(/Local unsynced session/i)).toBeInTheDocument());
  });
});
