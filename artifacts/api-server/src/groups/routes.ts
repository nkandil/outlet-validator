import { Router } from "express";
import { z, ZodError } from "zod";
import { requireAuth, requireRole } from "../auth/middleware";
import type { UserRepository } from "../auth/repository";
import { HttpError } from "../http-error";
import type { GroupRepository } from "./repository";

const groupSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional().default("")
});

const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().optional()
  })
  .refine((body) => Object.keys(body).length > 0, "At least one field is required");

const membersSchema = z.object({
  userIds: z.array(z.string())
});

function parseBody<T>(parse: (body: unknown) => T, body: unknown): T {
  try {
    return parse(body);
  } catch (error) {
    if (error instanceof ZodError) throw new HttpError(400, "Invalid request body", error.flatten());
    throw error;
  }
}

export function createGroupsRouter(groupRepository: GroupRepository, userRepository: UserRepository) {
  const router = Router();

  router.use(requireAuth(userRepository));
  router.use(requireRole("admin"));

  router.get("/", async (_req, res) => {
    res.json(await groupRepository.list());
  });

  router.post("/", async (req, res) => {
    const body = parseBody((input) => groupSchema.parse(input), req.body);
    res.status(201).json(await groupRepository.create(body));
  });

  router.patch("/:id", async (req, res) => {
    const body = parseBody((input) => updateGroupSchema.parse(input), req.body);
    const group = await groupRepository.update(String(req.params.id), body);
    if (!group) throw new HttpError(404, "Group not found");
    res.json(group);
  });

  router.delete("/:id", async (req, res) => {
    const deleted = await groupRepository.delete(String(req.params.id));
    if (!deleted) throw new HttpError(404, "Group not found");
    res.status(204).send();
  });

  router.get("/:id/members", async (req, res) => {
    res.json(await groupRepository.getMembers(String(req.params.id)));
  });

  router.put("/:id/members", async (req, res) => {
    const body = parseBody((input) => membersSchema.parse(input), req.body);
    for (const userId of body.userIds) {
      if (!(await userRepository.findById(userId))) throw new HttpError(400, "Group members must be active users");
    }
    res.json(await groupRepository.setMembers(String(req.params.id), body.userIds));
  });

  return router;
}
