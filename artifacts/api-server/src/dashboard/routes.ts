import { Router } from "express";
import { currentUser, requireAuth } from "../auth/middleware";
import type { UserRepository } from "../auth/repository";
import type { SessionRepository } from "../sessions/repository";

export function createDashboardRouter(repository: SessionRepository, userRepository: UserRepository) {
  const router = Router();

  router.use(requireAuth(userRepository));

  router.get("/", async (req, res) => {
    const sessionId = typeof req.query.sessionId === "string" && req.query.sessionId ? req.query.sessionId : undefined;
    const reviewerId = typeof req.query.reviewerId === "string" && req.query.reviewerId ? req.query.reviewerId : undefined;
    res.json(await repository.dashboard(currentUser(req), { sessionId, reviewerId }));
  });

  return router;
}
