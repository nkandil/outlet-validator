import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createAuthRouter } from "./auth/routes";
import { InMemoryUserRepository } from "./auth/repository";
import { createDashboardRouter } from "./dashboard/routes";
import { InMemoryGroupRepository } from "./groups/repository";
import { createGroupsRouter } from "./groups/routes";
import { errorHandler } from "./middleware/error-handler";
import { createSessionRouter } from "./sessions/routes";
import { InMemorySessionRepository } from "./sessions/repository";
import { createUsersRouter } from "./users/routes";

const minimalSession = {
  name: "May route",
  fileName: "outlets.xlsx",
  radiusKm: 5,
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
    rawHeaders: ["id", "lat", "lng", "name"]
  },
  outlets: [
    {
      outletKey: "A__row_0",
      rowIndex: 0,
      id: "A",
      latitude: 30,
      longitude: 31,
      originalData: { id: "A", lat: 30, lng: 31, name: "Alpha" },
      distanceKm: null
    }
  ],
  validations: {}
};

function app() {
  const userRepository = new InMemoryUserRepository({
    jwtSecret: "test-secret",
    seedUsers: [
      { id: "admin-id", name: "Admin", email: "admin@example.com", role: "admin", password: "password" },
      { id: "coord-id", name: "Coordinator", email: "coord@example.com", role: "coordinator", password: "password" },
      { id: "reviewer-id", name: "Reviewer", email: "reviewer@example.com", role: "reviewer", password: "password" },
      { id: "other-reviewer-id", name: "Other", email: "other@example.com", role: "reviewer", password: "password" }
    ]
  });
  const groupRepository = new InMemoryGroupRepository();
  const sessionRepository = new InMemorySessionRepository(groupRepository);
  const server = express();
  server.use(express.json());
  server.use("/api/auth", createAuthRouter(userRepository));
  server.use("/api/users", createUsersRouter(userRepository));
  server.use("/api/groups", createGroupsRouter(groupRepository, userRepository));
  server.use("/api/sessions", createSessionRouter(sessionRepository, userRepository));
  server.use("/api/dashboard", createDashboardRouter(sessionRepository, userRepository));
  server.use(errorHandler);
  return server;
}

async function login(server: express.Express, email: string) {
  const response = await request(server).post("/api/auth/login").send({ email, password: "password" }).expect(200);
  return response.body.token as string;
}

describe("protected outlet validator routes", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = "test-secret";
  });

  it("logs in seeded users and rejects bad credentials", async () => {
    const server = app();

    const ok = await request(server).post("/api/auth/login").send({ email: "admin@example.com", password: "password" }).expect(200);
    expect(ok.body.user).toMatchObject({ email: "admin@example.com", role: "admin" });
    expect(ok.body.token).toEqual(expect.any(String));

    await request(server).post("/api/auth/login").send({ email: "admin@example.com", password: "wrong" }).expect(401);
  });

  it("lets coordinators assign reviewers and reviewers only see assigned sessions", async () => {
    const server = app();
    const coordinator = await login(server, "coord@example.com");
    const reviewer = await login(server, "reviewer@example.com");
    const otherReviewer = await login(server, "other@example.com");

    const created = await request(server).post("/api/sessions").set("Authorization", `Bearer ${coordinator}`).send(minimalSession).expect(201);
    await request(server).get("/api/sessions").set("Authorization", `Bearer ${reviewer}`).expect(200, []);

    await request(server)
      .put(`/api/sessions/${created.body.id}/assignments`)
      .set("Authorization", `Bearer ${coordinator}`)
      .send({ userIds: ["reviewer-id"], groupIds: [] })
      .expect(200);

    const assigned = await request(server).get("/api/sessions").set("Authorization", `Bearer ${reviewer}`).expect(200);
    expect(assigned.body).toHaveLength(1);
    expect(assigned.body[0]).toMatchObject({ id: created.body.id, radiusKm: 5 });

    await request(server).get(`/api/sessions/${created.body.id}`).set("Authorization", `Bearer ${otherReviewer}`).expect(403);
  });

  it("lets admins create users and rejects duplicate emails", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");
    const coordinator = await login(server, "coord@example.com");

    const created = await request(server)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin}`)
      .send({ name: "New Reviewer", email: "new-reviewer@example.com", role: "reviewer", password: "temporary-password" })
      .expect(201);

    expect(created.body).toMatchObject({ name: "New Reviewer", email: "new-reviewer@example.com", role: "reviewer" });
    expect(created.body.passwordHash).toBeUndefined();

    await request(server)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin}`)
      .send({ name: "Copy", email: "new-reviewer@example.com", role: "reviewer", password: "temporary-password" })
      .expect(409);

    await request(server)
      .post("/api/users")
      .set("Authorization", `Bearer ${coordinator}`)
      .send({ name: "Blocked", email: "blocked@example.com", role: "reviewer", password: "temporary-password" })
      .expect(403);
  });

  it("reactivates archived users when admins create with an archived email", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");

    await request(server).delete("/api/users/other-reviewer-id").set("Authorization", `Bearer ${admin}`).expect(204);

    const activeUsers = await request(server).get("/api/users").set("Authorization", `Bearer ${admin}`).expect(200);
    expect(activeUsers.body.map((user: { id: string }) => user.id)).not.toContain("other-reviewer-id");

    const allUsers = await request(server).get("/api/users?includeInactive=true").set("Authorization", `Bearer ${admin}`).expect(200);
    expect(allUsers.body.find((user: { id: string }) => user.id === "other-reviewer-id")).toMatchObject({ isActive: false });

    const restored = await request(server)
      .post("/api/users")
      .set("Authorization", `Bearer ${admin}`)
      .send({ name: "Restored Other", email: "other@example.com", role: "coordinator", password: "restored-password" })
      .expect(201);

    expect(restored.body).toMatchObject({ id: "other-reviewer-id", name: "Restored Other", email: "other@example.com", role: "coordinator", isActive: true, disabledAt: null });
    await request(server).post("/api/auth/login").send({ email: "other@example.com", password: "restored-password" }).expect(200);
  });

  it("lets admins restore and permanently delete archived users", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");
    const coordinator = await login(server, "coord@example.com");

    await request(server).delete("/api/users/other-reviewer-id").set("Authorization", `Bearer ${admin}`).expect(204);
    await request(server).patch("/api/users/other-reviewer-id/restore").set("Authorization", `Bearer ${coordinator}`).expect(403);

    const restored = await request(server).patch("/api/users/other-reviewer-id/restore").set("Authorization", `Bearer ${admin}`).expect(200);
    expect(restored.body).toMatchObject({ id: "other-reviewer-id", isActive: true, disabledAt: null });

    await request(server).delete("/api/users/other-reviewer-id").set("Authorization", `Bearer ${admin}`).expect(204);
    await request(server).delete("/api/users/other-reviewer-id/permanent").set("Authorization", `Bearer ${coordinator}`).expect(403);
    await request(server).delete("/api/users/other-reviewer-id/permanent").set("Authorization", `Bearer ${admin}`).expect(204);
    await request(server).get("/api/users?includeInactive=true").set("Authorization", `Bearer ${admin}`).expect(200).expect((response) => {
      expect(response.body.map((user: { id: string }) => user.id)).not.toContain("other-reviewer-id");
    });
  });

  it("lets admins update user roles and blocks coordinators", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");
    const coordinator = await login(server, "coord@example.com");

    const updated = await request(server).patch("/api/users/reviewer-id").set("Authorization", `Bearer ${admin}`).send({ role: "coordinator" }).expect(200);
    expect(updated.body).toMatchObject({ id: "reviewer-id", role: "coordinator" });
    expect(updated.body.passwordHash).toBeUndefined();

    await request(server).patch("/api/users/other-reviewer-id").set("Authorization", `Bearer ${coordinator}`).send({ role: "coordinator" }).expect(403);
  });

  it("lets admins reset user passwords and blocks non-admins", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");
    const coordinator = await login(server, "coord@example.com");

    const updated = await request(server).patch("/api/users/reviewer-id/password").set("Authorization", `Bearer ${admin}`).send({ password: "new-temporary-password" }).expect(200);
    expect(updated.body).toMatchObject({ id: "reviewer-id", email: "reviewer@example.com", role: "reviewer" });
    expect(updated.body.passwordHash).toBeUndefined();

    await request(server).post("/api/auth/login").send({ email: "reviewer@example.com", password: "password" }).expect(401);
    await request(server).post("/api/auth/login").send({ email: "reviewer@example.com", password: "new-temporary-password" }).expect(200);

    await request(server).patch("/api/users/other-reviewer-id/password").set("Authorization", `Bearer ${coordinator}`).send({ password: "another-temporary-password" }).expect(403);
    await request(server).patch("/api/users/other-reviewer-id/password").set("Authorization", `Bearer ${admin}`).send({ password: "short" }).expect(400);
    await request(server).patch("/api/users/missing-id/password").set("Authorization", `Bearer ${admin}`).send({ password: "another-temporary-password" }).expect(404);
    await request(server).delete("/api/users/other-reviewer-id").set("Authorization", `Bearer ${admin}`).expect(204);
    await request(server).patch("/api/users/other-reviewer-id/password").set("Authorization", `Bearer ${admin}`).send({ password: "another-temporary-password" }).expect(200);
  });

  it("lets admins deactivate users while preserving history and blocking login", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");
    const coordinator = await login(server, "coord@example.com");
    const reviewer = await login(server, "reviewer@example.com");
    const created = await request(server).post("/api/sessions").set("Authorization", `Bearer ${admin}`).send(minimalSession).expect(201);
    await request(server).put(`/api/sessions/${created.body.id}/assignments`).set("Authorization", `Bearer ${admin}`).send({ userIds: ["reviewer-id"], groupIds: [] }).expect(200);
    await request(server)
      .put(`/api/sessions/${created.body.id}/validations/A__row_0`)
      .set("Authorization", `Bearer ${reviewer}`)
      .send({ status: "Valid", generalComments: "Done", fields: {} })
      .expect(200);

    await request(server).delete("/api/users/reviewer-id").set("Authorization", `Bearer ${coordinator}`).expect(403);
    await request(server).delete("/api/users/admin-id").set("Authorization", `Bearer ${admin}`).expect(400);
    await request(server).delete("/api/users/reviewer-id").set("Authorization", `Bearer ${admin}`).expect(204);

    await request(server).post("/api/auth/login").send({ email: "reviewer@example.com", password: "password" }).expect(401);
    const users = await request(server).get("/api/users").set("Authorization", `Bearer ${admin}`).expect(200);
    expect(users.body.map((user: { id: string }) => user.id)).not.toContain("reviewer-id");

    const detail = await request(server).get(`/api/sessions/${created.body.id}`).set("Authorization", `Bearer ${admin}`).expect(200);
    expect(detail.body.validations.A__row_0).toMatchObject({ status: "Valid", validatedBy: "Reviewer", reviewerId: "reviewer-id" });
  });

  it("lets admins manage groups and group membership", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");
    const reviewer = await login(server, "reviewer@example.com");

    await request(server).post("/api/groups").set("Authorization", `Bearer ${reviewer}`).send({ name: "Blocked" }).expect(403);

    const created = await request(server)
      .post("/api/groups")
      .set("Authorization", `Bearer ${admin}`)
      .send({ name: "North Reviewers", description: "Cairo and Delta reviewers" })
      .expect(201);

    expect(created.body).toMatchObject({ name: "North Reviewers", description: "Cairo and Delta reviewers" });

    await request(server)
      .put(`/api/groups/${created.body.id}/members`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ userIds: ["reviewer-id", "other-reviewer-id"] })
      .expect(200, { userIds: ["reviewer-id", "other-reviewer-id"] });

    const members = await request(server).get(`/api/groups/${created.body.id}/members`).set("Authorization", `Bearer ${admin}`).expect(200);
    expect(members.body).toEqual({ userIds: ["reviewer-id", "other-reviewer-id"] });
  });

  it("lets reviewers access sessions through assigned groups", async () => {
    const server = app();
    const admin = await login(server, "admin@example.com");
    const reviewer = await login(server, "reviewer@example.com");
    const created = await request(server).post("/api/sessions").set("Authorization", `Bearer ${admin}`).send(minimalSession).expect(201);
    const group = await request(server).post("/api/groups").set("Authorization", `Bearer ${admin}`).send({ name: "Field Reviewers" }).expect(201);

    await request(server).put(`/api/groups/${group.body.id}/members`).set("Authorization", `Bearer ${admin}`).send({ userIds: ["reviewer-id"] }).expect(200);
    await request(server).get(`/api/sessions/${created.body.id}`).set("Authorization", `Bearer ${reviewer}`).expect(403);

    await request(server)
      .put(`/api/sessions/${created.body.id}/assignments`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ userIds: [], groupIds: [group.body.id] })
      .expect(200);

    await request(server).get(`/api/sessions/${created.body.id}`).set("Authorization", `Bearer ${reviewer}`).expect(200);

    await request(server)
      .put(`/api/sessions/${created.body.id}/assignments`)
      .set("Authorization", `Bearer ${admin}`)
      .send({ userIds: [], groupIds: [] })
      .expect(200);

    await request(server).get(`/api/sessions/${created.body.id}`).set("Authorization", `Bearer ${reviewer}`).expect(403);
  });

  it("prevents reviewers from updating unassigned sessions by direct API call", async () => {
    const server = app();
    const coordinator = await login(server, "coord@example.com");
    const reviewer = await login(server, "reviewer@example.com");
    const created = await request(server).post("/api/sessions").set("Authorization", `Bearer ${coordinator}`).send(minimalSession).expect(201);

    await request(server)
      .put(`/api/sessions/${created.body.id}/validations/A__row_0`)
      .set("Authorization", `Bearer ${reviewer}`)
      .send({
        status: "Valid",
        generalComments: "Looks good",
        fields: {},
        gpsPermissionStatus: "granted",
        gpsLatitude: 30,
        gpsLongitude: 31,
        gpsAccuracyMeters: 12,
        gpsCapturedAt: "2026-05-15T10:00:00.000Z",
        distanceToOutletMeters: 0
      })
      .expect(403);
  });

  it("stores one validation per outlet with reviewer identity and GPS evidence", async () => {
    const server = app();
    const coordinator = await login(server, "coord@example.com");
    const reviewer = await login(server, "reviewer@example.com");
    const created = await request(server).post("/api/sessions").set("Authorization", `Bearer ${coordinator}`).send(minimalSession).expect(201);
    await request(server).put(`/api/sessions/${created.body.id}/assignments`).set("Authorization", `Bearer ${coordinator}`).send({ userIds: ["reviewer-id"] }).expect(200);

    await request(server)
      .put(`/api/sessions/${created.body.id}/validations/A__row_0`)
      .set("Authorization", `Bearer ${reviewer}`)
      .send({
        status: "Valid",
        generalComments: "Looks good",
        fields: {},
        gpsPermissionStatus: "granted",
        gpsLatitude: 30,
        gpsLongitude: 31,
        gpsAccuracyMeters: 12,
        gpsCapturedAt: "2026-05-15T10:00:00.000Z",
        distanceToOutletMeters: 0
      })
      .expect(200);

    const detail = await request(server).get(`/api/sessions/${created.body.id}`).set("Authorization", `Bearer ${coordinator}`).expect(200);
    expect(detail.body.validations.A__row_0).toMatchObject({
      status: "Valid",
      validatedBy: "Reviewer",
      reviewerId: "reviewer-id",
      gpsPermissionStatus: "granted",
      gpsLatitude: 30,
      distanceToOutletMeters: 0
    });
  });

  it("supports radius updates for coordinators and dashboard counts", async () => {
    const server = app();
    const coordinator = await login(server, "coord@example.com");
    const created = await request(server).post("/api/sessions").set("Authorization", `Bearer ${coordinator}`).send(minimalSession).expect(201);

    const patched = await request(server).patch(`/api/sessions/${created.body.id}`).set("Authorization", `Bearer ${coordinator}`).send({ radiusKm: 2 }).expect(200);
    expect(patched.body.radiusKm).toBe(2);

    const dashboard = await request(server).get("/api/dashboard").set("Authorization", `Bearer ${coordinator}`).expect(200);
    expect(dashboard.body).toMatchObject({
      totalSessions: 1,
      activeSessions: 1,
      totalOutlets: 1,
      reviewedOutlets: 0,
      pendingOutlets: 1
    });
  });
});
