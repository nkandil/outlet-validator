import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Step3MapFields } from "./Step3MapFields";
import { useOutletStore } from "../store";
import { sessionsApi } from "../lib/api";

vi.mock("../lib/api", () => ({
  sessionsApi: {
    create: vi.fn(),
    update: vi.fn()
  }
}));

describe("Step3MapFields", () => {
  beforeEach(() => {
    useOutletStore.getState().reset();
    useOutletStore.setState({
      rawHeaders: ["id", "lat", "lng", "channel"],
      rawRows: [
        { id: "A", lat: 30, lng: 31, channel: "Cafe" },
        { id: "B", lat: 30.1, lng: 31.1, channel: "Restaurant" }
      ],
      confirmedMapping: {
        id: "id",
        lat: "lat",
        lng: "lng",
        displayField: "",
        colorByField: "",
        colorByValues: {},
        shapeByField: "channel",
        shapeByValues: {}
      }
    });
  });

  afterEach(() => cleanup());

  it("uses shape buttons for initial pin shape setup", async () => {
    render(<Step3MapFields />);

    await userEvent.click(await screen.findByRole("button", { name: /set Cafe shape to triangle/i }));

    expect(useOutletStore.getState().confirmedMapping.shapeByValues.Cafe).toBe("triangle");
  });

  it("creates only one backend session when Continue is clicked repeatedly while saving", async () => {
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
      outletCount: 2,
      reviewedCount: 0,
      createdAt: "2026-05-18T00:00:00.000Z",
      updatedAt: "2026-05-18T00:00:00.000Z"
    };
    useOutletStore.setState({ fileName: "outlets.csv" });

    render(<Step3MapFields />);

    const button = screen.getByRole("button", { name: "Continue" });
    await user.dblClick(button);
    resolveCreate(created);

    await waitFor(() => expect(sessionsApi.create).toHaveBeenCalledTimes(1));
    expect(useOutletStore.getState().sessionId).toBe("session-1");
  });
});
