import type { NextFunction, Request, Response } from "express";
import type { AuthUser, UserRole } from "@workspace/db";
import { HttpError } from "../http-error";
import type { UserRepository } from "./repository";
import { verifyToken } from "./crypto";

type AuthenticatedRequest = Request & { user?: AuthUser };

export function requireAuth(userRepository: UserRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.get("authorization") ?? "";
      const [scheme, token] = header.split(" ");
      if (scheme !== "Bearer" || !token) throw new HttpError(401, "Authentication required");
      const userId = verifyToken(token);
      const user = await userRepository.findById(userId);
      if (!user) throw new HttpError(401, "Authentication required");
      (req as AuthenticatedRequest).user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function currentUser(req: Request) {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw new HttpError(401, "Authentication required");
  return user;
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = currentUser(req);
      if (!roles.includes(user.role)) throw new HttpError(403, "Forbidden");
      next();
    } catch (error) {
      next(error);
    }
  };
}
