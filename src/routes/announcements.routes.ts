import express from "express";
import { registry } from "../openapi.ts";
import { authenticate } from "../middleware/authenticate.ts";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validate.ts";
import {
  announcementListSchema,
  announcementSchema,
  createAnnouncementSchema,
  idParamSchema,
  listQuerySchema,
  updateAnnouncementSchema,
} from "../validators/announcements.validator.ts";
import { errorSchema, validationErrorSchema } from "../validators/auth.validator.ts";
import * as controller from "../controllers/announcements.controller.ts";

const json = <T extends object>(schema: T) => ({
  content: { "application/json": { schema } },
});

const bearer = [{ bearerAuth: [] }];

registry.registerPath({
  method: "get",
  path: "/announcements",
  tags: ["Announcements"],
  summary: "List announcements",
  description:
    "Returns a paginated list of announcements (10 per page) with optional case-insensitive title search and sorting by creation date.",
  request: { query: listQuerySchema },
  responses: {
    200: { description: "Paginated list of announcements", ...json(announcementListSchema) },
    400: { description: "Invalid query parameters", ...json(validationErrorSchema) },
  },
});

registry.registerPath({
  method: "get",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Get announcement by id",
  description: "Returns a single announcement together with its author.",
  request: { params: idParamSchema },
  responses: {
    200: { description: "The announcement", ...json(announcementSchema) },
    400: { description: "Invalid id", ...json(validationErrorSchema) },
    404: { description: "Announcement not found", ...json(errorSchema) },
  },
});

registry.registerPath({
  method: "post",
  path: "/announcements",
  tags: ["Announcements"],
  summary: "Create announcement",
  description: "Creates a new announcement owned by the authenticated user.",
  security: bearer,
  request: {
    body: { required: true, ...json(createAnnouncementSchema) },
  },
  responses: {
    201: { description: "Announcement created", ...json(announcementSchema) },
    400: { description: "Validation failed", ...json(validationErrorSchema) },
    401: { description: "Missing, invalid or expired access token", ...json(errorSchema) },
  },
});

registry.registerPath({
  method: "patch",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Update announcement",
  description:
    "Partially updates an announcement. Only the owner may update it; at least one field must be provided.",
  security: bearer,
  request: {
    params: idParamSchema,
    body: { required: true, ...json(updateAnnouncementSchema) },
  },
  responses: {
    200: { description: "Announcement updated", ...json(announcementSchema) },
    400: { description: "Validation failed", ...json(validationErrorSchema) },
    401: { description: "Missing, invalid or expired access token", ...json(errorSchema) },
    403: { description: "The announcement belongs to another user", ...json(errorSchema) },
    404: { description: "Announcement not found", ...json(errorSchema) },
  },
});

registry.registerPath({
  method: "delete",
  path: "/announcements/{id}",
  tags: ["Announcements"],
  summary: "Delete announcement",
  description: "Deletes an announcement. Only the owner may delete it.",
  security: bearer,
  request: { params: idParamSchema },
  responses: {
    204: { description: "Announcement deleted" },
    400: { description: "Invalid id", ...json(validationErrorSchema) },
    401: { description: "Missing, invalid or expired access token", ...json(errorSchema) },
    403: { description: "The announcement belongs to another user", ...json(errorSchema) },
    404: { description: "Announcement not found", ...json(errorSchema) },
  },
});

const router = express.Router();

router.get("/", validateQuery(listQuerySchema), controller.list);
router.get("/:id", validateParams(idParamSchema), controller.getById);
router.post("/", authenticate, validateBody(createAnnouncementSchema), controller.create);
router.patch(
  "/:id",
  authenticate,
  validateParams(idParamSchema),
  validateBody(updateAnnouncementSchema),
  controller.update,
);
router.delete("/:id", authenticate, validateParams(idParamSchema), controller.remove);

export default router;
