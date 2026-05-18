import { Router } from "express";
import { z, ZodError } from "zod";
import type { UserRole } from "@workspace/db";
import { currentUser, requireAuth, requireRole } from "../auth/middleware";
import type { UserRepository } from "../auth/repository";
import { HttpError } from "../http-error";

const createUserSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  role: z.enum(["admin", "coordinator", "reviewer"]),
  password: z.string().min(8)
});

const updateUserRoleSchema = z.object({
  role: z.enum(["admin", "coordinator", "reviewer"])
});

const updateUserPasswordSchema = z.object({
  password: z.string().min(8)
});

function parseBody<T>(parse: (body: unknown) => T, body: unknown): T {
  try {
    return parse(body);
  } catch (error) {
    if (error instanceof ZodError) throw new HttpError(400, "Invalid request body", error.flatten());
    throw error;
  }
}

export function createUsersRouter(userRepository: UserRepository) {
  const router = Router();

  router.use(requireAuth(userRepository));

  router.get("/", requireRole("admin", "coordinator"), async (req, res) => {
    currentUser(req);
    const role = typeof req.query.role === "string" ? (req.query.role as UserRole) : undefined;
    const includeInactive = req.query.includeInactive === "true";
    res.json(await userRepository.list(role, includeInactive));
  });

  router.post("/", requireRole("admin"), async (req, res) => {
    const body = parseBody((input) => createUserSchema.parse(input), req.body);
    res.status(201).json(await userRepository.create(body));
  });

  router.patch("/:id", requireRole("admin"), async (req, res) => {
    const body = parseBody((input) => updateUserRoleSchema.parse(input), req.body);
    const user = await userRepository.updateRole(String(req.params.id), body.role);
    if (!user) throw new HttpError(404, "User not found");
    res.json(user);
  });

  router.patch("/:id/password", requireRole("admin"), async (req, res) => {
    const body = parseBody((input) => updateUserPasswordSchema.parse(input), req.body);
    const user = await userRepository.updatePassword(String(req.params.id), body.password);
    if (!user) throw new HttpError(404, "User not found");
    res.json(user);
  });

  router.patch("/:id/restore", requireRole("admin"), async (req, res) => {
    const user = await userRepository.restore(String(req.params.id));
    if (!user) throw new HttpError(404, "User not found");
    res.json(user);
  });

  router.delete("/:id", requireRole("admin"), async (req, res) => {
    const id = String(req.params.id);
    if (currentUser(req).id === id) throw new HttpError(400, "You cannot deactivate your own account");
    const user = await userRepository.deactivate(id);
    if (!user) throw new HttpError(404, "User not found");
    res.status(204).send();
  });

  router.delete("/:id/permanent", requireRole("admin"), async (req, res) => {
    const deleted = await userRepository.hardDelete(String(req.params.id));
    if (!deleted) throw new HttpError(404, "User not found");
    res.status(204).send();
  });

  return router;
}
