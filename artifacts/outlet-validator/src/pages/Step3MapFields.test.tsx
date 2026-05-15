import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Step3MapFields } from "./Step3MapFields";
import { useOutletStore } from "../store";

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

  it("uses shape buttons for initial pin shape setup", async () => {
    render(<Step3MapFields />);

    await userEvent.click(await screen.findByRole("button", { name: /set Cafe shape to triangle/i }));

    expect(useOutletStore.getState().confirmedMapping.shapeByValues.Cafe).toBe("triangle");
  });
});
