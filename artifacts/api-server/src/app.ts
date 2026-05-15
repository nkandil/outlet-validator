import cors from "cors";
import express from "express";
import { InMemoryUserRepository, PostgresUserRepository } from "./auth/repository";
import { createAuthRouter } from "./auth/routes";
import { createDashboardRouter } from "./dashboard/routes";
import { InMemoryGroupRepository, PostgresGroupRepository } from "./groups/repository";
import { createGroupsRouter } from "./groups/routes";
import { errorHandler } from "./middleware/error-handler";
import { InMemorySessionRepository, PostgresSessionRepository } from "./sessions/repository";
import { createSessionRouter } from "./sessions/routes";
import { createUsersRouter } from "./users/routes";

export function createApp() {
  const app = express();
  const demoMode = process.env.DEMO_MODE === "true";
  const userRepository = demoMode
    ? new InMemoryUserRepository({
        seedUsers: [
          {
            id: "demo-admin",
            name: process.env.ADMIN_NAME?.trim() || "Demo Admin",
            email: process.env.ADMIN_EMAIL?.trim() || "admin@example.com",
            role: "admin",
            password: process.env.ADMIN_PASSWORD || "change-me"
          },
          {
            id: "demo-coordinator",
            name: "Demo Coordinator",
            email: "coordinator@example.com",
            role: "coordinator",
            password: process.env.ADMIN_PASSWORD || "change-me"
          },
          {
            id: "demo-reviewer",
            name: "Demo Reviewer",
            email: "reviewer@example.com",
            role: "reviewer",
            password: process.env.ADMIN_PASSWORD || "change-me"
          }
        ]
      })
    : new PostgresUserRepository();
  const groupRepository = demoMode ? new InMemoryGroupRepository() : new PostgresGroupRepository();
  const sessionRepository = demoMode ? new InMemorySessionRepository(groupRepository) : new PostgresSessionRepository(groupRepository);

  if (!demoMode) {
    void userRepository.ensureSeedAdmin().catch((error) => {
      console.error("Failed to seed admin user", error);
    });
  }

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  app.get("/api/healthz", (_req, res) => {
    res.json({ status: "ok", mode: demoMode ? "demo" : "postgres" });
  });

  app.use("/api/auth", createAuthRouter(userRepository));
  app.use("/api/users", createUsersRouter(userRepository));
  app.use("/api/groups", createGroupsRouter(groupRepository, userRepository));
  app.use("/api/sessions", createSessionRouter(sessionRepository, userRepository));
  app.use("/api/dashboard", createDashboardRouter(sessionRepository, userRepository));
  app.use(errorHandler);

  return app;
}
