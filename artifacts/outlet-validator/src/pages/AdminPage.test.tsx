import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
import type { AuthUser } from "../types";

let mockUser: AuthUser | null = { id: "admin-id", name: "Admin", email: "admin@example.com", role: "admin" };

vi.mock("../auth", async () => {
  const actual = await vi.importActual<typeof import("../auth")>("../auth");
  return {
    ...actual,
    useAuth: () => ({ user: mockUser, loading: false, login: vi.fn(), logout: vi.fn() })
  };
});

function json(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => body
  };
}

const users = [
  { id: "admin-id", name: "Admin", email: "admin@example.com", role: "admin" },
  { id: "reviewer-id", name: "Reviewer", email: "reviewer@example.com", role: "reviewer" }
];

const groups = [{ id: "group-id", name: "North Reviewers", description: "Cairo" }];

const session = {
  id: "session-id",
  name: "May route",
  fileName: "outlets.csv",
  radiusKm: 5,
  outletCount: 1,
  reviewedCount: 0,
  createdAt: "2026-05-15T08:00:00.000Z",
  updatedAt: "2026-05-15T08:00:00.000Z"
};

const sessionDetail = {
  ...session,
  config: {
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
    visibleFields: ["name"],
    fieldsToVerify: ["name"],
    reviewerName: "",
    rawHeaders: ["id", "lat", "lng", "name", "channel"]
  },
  outlets: [
    {
      outletKey: "A__row_0",
      rowIndex: 0,
      id: "A",
      latitude: 30,
      longitude: 31,
      originalData: { id: "A", lat: 30, lng: 31, name: "Alpha", channel: "Grocery" },
      distanceKm: null
    }
  ],
  validations: {}
};

function installFetchMock() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost:4000").pathname.replace(/^\/api/, "/api");
    const method = init?.method ?? "GET";
    if (url === "/api/users" && method === "GET") return json(users);
    if (url === "/api/users" && method === "POST") return json({ id: "new-id", name: "New Reviewer", email: "new@example.com", role: "reviewer" }, 201);
    if (url === "/api/users/reviewer-id" && method === "PATCH") return json({ id: "reviewer-id", name: "Reviewer", email: "reviewer@example.com", role: "coordinator" });
    if (url === "/api/users/reviewer-id/password" && method === "PATCH") return json({ id: "reviewer-id", name: "Reviewer", email: "reviewer@example.com", role: "reviewer" });
    if (url === "/api/users/reviewer-id" && method === "DELETE") {
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => ({})
      };
    }
    if (url === "/api/groups" && method === "GET") return json(groups);
    if (url === "/api/groups" && method === "POST") return json({ id: "new-group", name: "New Group", description: "" }, 201);
    if (url === "/api/groups/group-id" && method === "PATCH") return json({ id: "group-id", name: "North Reviewers", description: "Updated coverage", createdAt: "2026-05-15T08:00:00.000Z", updatedAt: "2026-05-15T09:00:00.000Z" });
    if (url === "/api/groups/group-id" && method === "DELETE") {
      return {
        ok: true,
        status: 204,
        headers: new Headers(),
        json: async () => ({})
      };
    }
    if (url === "/api/groups/group-id/members" && method === "GET") return json({ userIds: ["reviewer-id"] });
    if (url === "/api/groups/group-id/members" && method === "PUT") return json({ userIds: ["reviewer-id"] });
    if (url === "/api/sessions" && method === "GET") return json([session]);
    if (url === "/api/sessions/session-id" && method === "GET") return json(sessionDetail);
    if (url === "/api/sessions/session-id" && method === "PATCH") return json({ ...session, radiusKm: 3 });
    if (url === "/api/sessions/session-id/assignments" && method === "GET") return json({ userIds: [], groupIds: [] });
    if (url === "/api/sessions/session-id/assignments" && method === "PUT") return json({ userIds: [], groupIds: ["group-id"] });
    return json({ error: `Unhandled ${method} ${url}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<div>Sessions page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    mockUser = { id: "admin-id", name: "Admin", email: "admin@example.com", role: "admin" };
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("redirects non-admin users away from the admin page", async () => {
    mockUser = { id: "reviewer-id", name: "Reviewer", email: "reviewer@example.com", role: "reviewer" };
    installFetchMock();

    renderAdmin();

    expect(await screen.findByText("Sessions page")).toBeInTheDocument();
  });

  it("creates a reviewer user", async () => {
    const fetchMock = installFetchMock();
    renderAdmin();

    await userEvent.type(await screen.findByLabelText("Name"), "New Reviewer");
    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Temporary password"), "temporary-password");
    await userEvent.click(screen.getByRole("button", { name: /create user/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "New Reviewer", email: "new@example.com", role: "reviewer", password: "temporary-password" })
        })
      )
    );
  });

  it("changes a user role from the users list", async () => {
    const fetchMock = installFetchMock();
    renderAdmin();

    await userEvent.selectOptions(await screen.findByLabelText("Role for Reviewer"), "coordinator");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/users/reviewer-id",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "coordinator" })
        })
      )
    );
  });

  it("deactivates a user from the users list", async () => {
    const fetchMock = installFetchMock();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAdmin();

    const deleteButton = await screen.findByRole("button", { name: /delete reviewer/i });
    expect(deleteButton).toHaveTextContent("");
    await userEvent.click(deleteButton);

    expect(window.confirm).toHaveBeenCalledWith("Deactivate this user? Their past reviews stay in reports.");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/users/reviewer-id", expect.objectContaining({ method: "DELETE" })));
  });

  it("resets a user password from an inline users row action", async () => {
    const fetchMock = installFetchMock();
    renderAdmin();

    const changePasswordButton = await screen.findByRole("button", { name: /change password for reviewer/i });
    expect(changePasswordButton).toHaveTextContent("");
    await userEvent.click(changePasswordButton);

    const passwordInput = await screen.findByLabelText("New password for Reviewer");
    const saveButton = screen.getByRole("button", { name: /save password for reviewer/i });
    expect(saveButton).toBeDisabled();

    await userEvent.type(passwordInput, "new-temporary-password");
    await userEvent.click(saveButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/users/reviewer-id/password",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ password: "new-temporary-password" })
        })
      )
    );
    await waitFor(() => expect(screen.queryByLabelText("New password for Reviewer")).not.toBeInTheDocument());
    expect(await screen.findByText("Password updated")).toBeInTheDocument();
  });

  it("creates a group and updates membership", async () => {
    const fetchMock = installFetchMock();
    renderAdmin();

    await userEvent.click(await screen.findByRole("button", { name: "Groups" }));
    await userEvent.type(screen.getByLabelText("Group name"), "New Group");
    await userEvent.click(screen.getByRole("button", { name: /create group/i }));
    const editButton = await screen.findByRole("button", { name: /edit north reviewers/i });
    expect(editButton).toHaveTextContent("");
    await userEvent.click(editButton);
    const membership = screen.getByRole("group", { name: /group members/i });
    fireEvent.click(within(membership).getByLabelText(/reviewer@example.com/i));
    await userEvent.click(screen.getByRole("button", { name: /save members/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/groups", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/groups/group-id/members", expect.objectContaining({ method: "PUT" })));
  });

  it("updates a group description and deletes the group", async () => {
    const fetchMock = installFetchMock();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderAdmin();

    await userEvent.click(await screen.findByRole("button", { name: "Groups" }));
    await userEvent.click(await screen.findByRole("button", { name: /edit north reviewers/i }));
    expect(screen.getByText("Group details")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();
    const fieldGrid = screen.getByLabelText("Edit group name").closest("label")?.parentElement;
    expect(fieldGrid).toHaveClass("grid", "gap-3");
    expect(fieldGrid?.className).not.toContain("grid-cols");
    await userEvent.clear(screen.getByLabelText("Edit description"));
    await userEvent.type(screen.getByLabelText("Edit description"), "Updated coverage");
    await userEvent.click(screen.getByRole("button", { name: /save group details/i }));
    const deleteButton = screen.getByRole("button", { name: /delete north reviewers/i });
    expect(deleteButton).toHaveTextContent("");
    await userEvent.click(deleteButton);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "http://localhost:4000/api/groups/group-id",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ name: "North Reviewers", description: "Updated coverage" })
        })
      )
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/groups/group-id", expect.objectContaining({ method: "DELETE" })));
  });

  it("assigns a group to a session and edits session config", async () => {
    const fetchMock = installFetchMock();
    renderAdmin();

    await userEvent.click(await screen.findByRole("button", { name: "Sessions" }));
    await userEvent.click(await screen.findByRole("button", { name: /manage may route/i }));
    fireEvent.click(await screen.findByLabelText(/north reviewers/i));
    await userEvent.click(screen.getByRole("button", { name: /save assignments/i }));
    expect(await screen.findByText("Assignments saved")).toBeInTheDocument();
    expect(screen.getByLabelText("Sessions management workspace")).toHaveClass("lg:h-[calc(100dvh-15rem)]");
    expect(screen.getByLabelText("Session configuration fields")).toHaveClass("overflow-y-auto");
    expect(screen.getByLabelText("Session configuration actions")).toHaveClass("border-t", "bg-card");
    await userEvent.clear(screen.getByLabelText("Nearby radius"));
    await userEvent.type(screen.getByLabelText("Nearby radius"), "3");
    await userEvent.selectOptions(screen.getByLabelText("Display field"), "channel");
    await userEvent.selectOptions(screen.getByLabelText("Shape by field"), "channel");
    await userEvent.click(await screen.findByRole("button", { name: /set Grocery shape to diamond/i }));
    await userEvent.click(screen.getByRole("button", { name: /preview changes/i }));
    expect(await screen.findByText(/display field changes from name to channel/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /save config/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/sessions/session-id/assignments", expect.objectContaining({ method: "PUT" })));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/api/sessions/session-id", expect.objectContaining({ method: "PATCH" })));
  });
});
