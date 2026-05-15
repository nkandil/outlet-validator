import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { MapLegend } from "./MapLegend";
import type { Outlet } from "../types";

const outlets: Outlet[] = [
  {
    outletKey: "a",
    rowIndex: 0,
    id: "A",
    latitude: 30,
    longitude: 31,
    originalData: { segment: "Gold", channel: "Cafe" },
    distanceKm: null
  },
  {
    outletKey: "b",
    rowIndex: 1,
    id: "B",
    latitude: 30,
    longitude: 31,
    originalData: { segment: "Silver", channel: "Restaurant" },
    distanceKm: null
  }
];

afterEach(() => cleanup());

describe("MapLegend", () => {
  it("renders configured color and shape legends", () => {
    render(
      <MapLegend
        outlets={outlets}
        validations={{}}
        mapping={{
          id: "id",
          lat: "lat",
          lng: "lng",
          displayField: "",
          colorByField: "segment",
          colorByValues: { Gold: "#facc15", Silver: "#94a3b8" },
          shapeByField: "channel",
          shapeByValues: { Cafe: "diamond", Restaurant: "triangle" }
        }}
      />
    );

    expect(screen.queryByRole("region", { name: /map legend/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /show legend/i })).toBeInTheDocument();
  });

  it("shows and hides configured color and shape legends from a compact button", async () => {
    render(
      <MapLegend
        outlets={outlets}
        validations={{}}
        mapping={{
          id: "id",
          lat: "lat",
          lng: "lng",
          displayField: "",
          colorByField: "segment",
          colorByValues: { Gold: "#facc15", Silver: "#94a3b8" },
          shapeByField: "channel",
          shapeByValues: { Cafe: "diamond", Restaurant: "triangle" }
        }}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /show legend/i }));

    expect(screen.getByRole("region", { name: /map legend/i })).toBeInTheDocument();
    expect(screen.getByText("Colors: segment")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("Silver")).toBeInTheDocument();
    expect(screen.getByText("Shapes: channel")).toBeInTheDocument();
    expect(screen.getByText("Cafe")).toBeInTheDocument();
    expect(screen.getByText("Restaurant")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /hide legend/i }));
    expect(screen.queryByRole("region", { name: /map legend/i })).not.toBeInTheDocument();
  });

  it("renders reviewed and unreviewed fallback when no color or shape field is configured", async () => {
    render(
      <MapLegend
        outlets={outlets}
        validations={{ a: { status: "Valid", generalComments: "", validatedBy: "", validatedAt: "", fields: {} } }}
        mapping={{ id: "id", lat: "lat", lng: "lng", displayField: "", colorByField: "", colorByValues: {}, shapeByField: "", shapeByValues: {} }}
      />
    );

    await userEvent.click(screen.getByRole("button", { name: /show legend/i }));
    expect(screen.getByText("Colors: review status")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByText("Unreviewed")).toBeInTheDocument();
    expect(screen.getByText("Shapes: default")).toBeInTheDocument();
    expect(screen.getByText("Outlet marker")).toBeInTheDocument();
  });
});
