import type { Request, RequestHandler } from "express";
import type { ZodType } from "zod";

type Target = "body" | "params" | "query";

function validate(target: Target, schema: ZodType, apply: (req: Request, res: Parameters<RequestHandler>[1], data: unknown) => void): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const messages = result.error.issues.map((issue) => {
        const path = issue.path.map(String).join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      });
      res.status(400).json({ error: "Validation failed", details: { [target]: messages } });
      return;
    }

    apply(req, res, result.data);
    next();
  };
}

export const validateBody = (schema: ZodType): RequestHandler =>
  validate("body", schema, (req, _res, data) => {
    req.body = data;
  });

export const validateParams = (schema: ZodType): RequestHandler =>
  validate("params", schema, (req, _res, data) => {
    req.params = data as Request["params"];
  });

// Express 5: req.query is a read-only getter, so the parsed result goes to res.locals.query.
export const validateQuery = (schema: ZodType): RequestHandler =>
  validate("query", schema, (_req, res, data) => {
    res.locals.query = data;
  });
