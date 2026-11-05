import express from "express";
import { registry } from "../openapi.ts";
import { login, logout, me, refresh, register } from "../controllers/auth.controller.ts";
import { authenticate } from "../middleware/authenticate.ts";
import { validateBody } from "../middleware/validate.ts";
import {
  authResponseSchema,
  errorSchema,
  loginSchema,
  meResponseSchema,
  refreshSchema,
  registerSchema,
  tokensResponseSchema,
  validationErrorSchema,
} from "../validators/auth.validator.ts";

const jsonBody = <T extends typeof registerSchema | typeof loginSchema | typeof refreshSchema>(schema: T) => ({
  body: { required: true, content: { "application/json": { schema } } },
});

const json = <T extends object>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema } },
});

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  summary: "Register a new user",
  description:
    "Creates a user with a bcrypt-hashed password and returns the user together with an access token (15 minutes) and a refresh token (7 days).",
  request: jsonBody(registerSchema),
  responses: {
    201: json("User registered", authResponseSchema),
    400: json("Validation failed", validationErrorSchema),
    409: json("Username or email already taken", errorSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  summary: "Log in",
  description:
    "Verifies credentials and returns a new token pair. The previous refresh token of the user is replaced.",
  request: jsonBody(loginSchema),
  responses: {
    200: json("Logged in", authResponseSchema),
    400: json("Validation failed", validationErrorSchema),
    401: json("Invalid credentials", errorSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  summary: "Refresh the token pair",
  description:
    "Verifies the refresh token and exchanges it for a new token pair (token rotation: the old refresh token is invalidated).",
  request: jsonBody(refreshSchema),
  responses: {
    200: json("New token pair", tokensResponseSchema),
    400: json("Validation failed", validationErrorSchema),
    401: json("Invalid refresh token", errorSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  summary: "Log out",
  description: "Deletes the refresh token of the current user. Requires a valid access token.",
  security: [{ bearerAuth: [] }],
  responses: {
    204: { description: "Logged out" },
    401: json("Missing or invalid access token", errorSchema),
  },
});

registry.registerPath({
  method: "get",
  path: "/auth/me",
  tags: ["Auth"],
  summary: "Get the current user",
  description: "Returns the profile of the user identified by the access token.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: json("Current user", meResponseSchema),
    401: json("Missing or invalid access token", errorSchema),
    404: json("User not found", errorSchema),
  },
});

const router = express.Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.post("/refresh", validateBody(refreshSchema), refresh);
router.post("/logout", authenticate, logout);
router.get("/me", authenticate, me);

export default router;
