import { Router } from "express";
import { z, ZodError } from "zod";
import { HttpError } from "../http-error";
import { currentUser, requireAuth } from "./middleware";
import type { UserRepository } from "./repository";
import { signToken, verifyPassword } from "./crypto";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function publicUser<T extends { passwordHash?: string }>(user: T) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export function createAuthRouter(userRepository: UserRepository) {
  const router = Router();

  router.post("/login", async (req, res) => {
    try {
      const body = loginSchema.parse(req.body);
      const user = await userRepository.findByEmail(body.email);
      if (!user || user.isActive === false || !verifyPassword(body.password, user.passwordHash)) throw new HttpError(401, "Invalid email or password");
      res.json({ token: signToken(user), user: publicUser(user) });
    } catch (error) {
      if (error instanceof ZodError) throw new HttpError(400, "Invalid request body", error.flatten());
      throw error;
    }
  });

  router.get("/me", requireAuth(userRepository), (req, res) => {
    res.json(currentUser(req));
  });

  return router;
}
