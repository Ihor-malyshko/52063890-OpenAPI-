import type { NextFunction, Request, Response } from "express";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { sub: number };
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const [scheme, token, ...rest] = header ? header.split(" ") : [];

  if (scheme !== "Bearer" || !token || rest.length > 0) {
    return next(createHttpError(401, "Unauthorized"));
  }

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!);
  } catch {
    return next(createHttpError(401, "Invalid or expired token"));
  }

  if (typeof payload !== "object" || payload === null || payload.type !== "access") {
    return next(createHttpError(401, "Unauthorized"));
  }

  const sub = Number(payload.sub);
  if (payload.sub === undefined || payload.sub === "" || !Number.isInteger(sub)) {
    return next(createHttpError(401, "Unauthorized"));
  }

  req.user = { sub };
  next();
}
