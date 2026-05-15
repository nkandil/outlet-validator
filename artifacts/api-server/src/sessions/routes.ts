import { Router } from "express";
import { ZodError } from "zod";
import { currentUser, requireAuth, requireRole } from "../auth/middleware";
import type { UserRepository } from "../auth/repository";
import { HttpError } from "../http-error";
import { assignmentSchema, createSessionSchema, updateSessionSchema, upsertValidationSchema } from "./schemas";
import type { SessionRepository } from "./repository";

function parseBody<T>(parse: (body: unknown) => T, body: unknown): T {
  try {
    return parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(400, "Invalid request body", error.flatten());
    }
    throw error;
  }
}

export function createSessionRouter(repository: SessionRepository, userRepository: UserRepository) {
  const router = Router();

  router.use(requireAuth(userRepository));

  router.get("/", async (req, res) => {
    res.json(await repository.list(currentUser(req)));
  });

  router.post("/", requireRole("admin", "coordinator"), async (req, res) => {
    const body = parseBody((input) => createSessionSchema.parse(input), req.body);
    res.status(201).json(await repository.create(body, currentUser(req)));
  });

  router.get("/:id", async (req, res) => {
    const session = await repository.get(String(req.params.id), currentUser(req));
    if (!session) throw new HttpError(404, "Session not found");
    res.json(session);
  });

  router.patch("/:id", requireRole("admin", "coordinator"), async (req, res) => {
    const body = parseBody((input) => updateSessionSchema.parse(input), req.body);
    const session = await repository.update(String(req.params.id), body, currentUser(req));
    if (!session) throw new HttpError(404, "Session not found");
    res.json(session);
  });

  router.delete("/:id", requireRole("admin"), async (req, res) => {
    const deleted = await repository.delete(String(req.params.id), currentUser(req));
    if (!deleted) throw new HttpError(404, "Session not found");
    res.status(204).send();
  });

  router.get("/:id/assignments", requireRole("admin", "coordinator"), async (req, res) => {
    res.json(await repository.getAssignments(String(req.params.id), currentUser(req)));
  });

  router.put("/:id/assignments", requireRole("admin", "coordinator"), async (req, res) => {
    const body = parseBody((input) => assignmentSchema.parse(input), req.body);
    for (const userId of body.userIds) {
      if (!(await userRepository.findById(userId))) throw new HttpError(400, "Session reviewers must be active users");
    }
    res.json(await repository.assign(String(req.params.id), body, currentUser(req)));
  });

  router.put("/:sessionId/validations/:outletKey", async (req, res) => {
    const body = parseBody((input) => upsertValidationSchema.parse(input), req.body);
    res.json(await repository.upsertValidation(String(req.params.sessionId), String(req.params.outletKey), body, currentUser(req)));
  });

  return router;
}
