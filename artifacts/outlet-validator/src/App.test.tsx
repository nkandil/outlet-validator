import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useOutletStore } from "./store";

vi.mock("./auth", async () => {
  const actual = await vi.importActual<typeof import("./auth")>("./auth");
  return {
    ...actual,
    useAuth: () => ({ user: { id: "reviewer-id", name: "Reviewer", email: "reviewer@example.com", role: "reviewer" }, loading: false })
  };
});

vi.mock("./pages/Step1Upload", () => ({
  Step1Upload: () => <main>Upload outlet data</main>
}));

describe("App shell", () => {
  beforeEach(() => {
    useOutletStore.getState().reset();
  });

  it("keeps wizard content in a bounded non-overscrolling host", () => {
    useOutletStore.setState({ currentStep: 1 });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>
    );

    const contentHost = screen.getByText("Upload outlet data").parentElement;
    expect(contentHost).toHaveClass("overscroll-contain");
  });
});
