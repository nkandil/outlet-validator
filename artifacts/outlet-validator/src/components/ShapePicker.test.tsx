import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShapePicker } from "./ShapePicker";

describe("ShapePicker", () => {
  it("uses visual shape buttons to select a shape", async () => {
    const onChange = vi.fn();

    render(<ShapePicker label="Cafe shape" value="circle" onChange={onChange} />);

    expect(screen.getByRole("group", { name: "Cafe shape" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /circle/i })).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: /diamond/i }));

    expect(onChange).toHaveBeenCalledWith("diamond");
  });
});
