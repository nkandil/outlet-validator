import type { ErrorRequestHandler } from "express";
import { HttpError } from "../http-error";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message, details: error.details });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
};
