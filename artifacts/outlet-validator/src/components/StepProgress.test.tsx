import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useOutletStore } from "../store";
import { StepProgress } from "./StepProgress";

describe("StepProgress", () => {
  beforeEach(() => {
    useOutletStore.getState().reset();
  });

  afterEach(() => cleanup());

  it("uses the Market Visit Validation subtitle", () => {
    useOutletStore.setState({ currentStep: 3 });

    render(<StepProgress />);

    expect(screen.getByText("Market Visit Validation")).toBeInTheDocument();
  });

  it("hides the wizard step labels on the validation field step", () => {
    useOutletStore.setState({ currentStep: 7 });

    render(<StepProgress />);

    expect(screen.queryByText("Upload")).not.toBeInTheDocument();
    expect(screen.queryByText("Field")).not.toBeInTheDocument();
  });
});
