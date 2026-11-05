import { z } from "zod";
import "../openapi.ts";
import { userSchema } from "./auth.validator.ts";

export const categoryEnum = z.enum(["sale", "service", "job", "other"]);

export const createAnnouncementSchema = z
  .object({
    title: z.string().min(5).max(50).openapi({ example: "Продам велосипед" }),
    description: z
      .string()
      .min(10)
      .openapi({ example: "Гірський велосипед, 21 швидкість" }),
    price: z.number().positive().openapi({ example: 8000 }),
    category: categoryEnum.openapi({ example: "sale" }),
  })
  .openapi("CreateAnnouncementBody");

export const updateAnnouncementSchema = createAnnouncementSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field must be provided",
  })
  .openapi("UpdateAnnouncementBody");

export const idParamSchema = z
  .object({
    id: z.coerce.number().int().positive().max(2147483647).openapi({ example: 5 }),
  })
  .openapi("AnnouncementIdParams");

export const listQuerySchema = z
  .object({
    search: z
      .string()
      .optional()
      .openapi({ example: "ноутбук", description: "Case-insensitive title search" }),
    sort: z.enum(["newest", "oldest"]).default("newest").openapi({ example: "newest" }),
    page: z.coerce.number().int().positive().default(1).openapi({ example: 1 }),
  })
  .openapi("ListAnnouncementsQuery");

export const announcementSchema = z
  .object({
    id: z.number().int().openapi({ example: 5 }),
    title: z.string().openapi({ example: "Продам ноутбук ASUS" }),
    description: z.string().openapi({ example: "Відмінний стан, 16GB RAM" }),
    price: z.number().openapi({ example: 18000 }),
    category: categoryEnum.openapi({ example: "sale" }),
    createdAt: z.string().openapi({ example: "2025-01-10T12:00:00.000Z" }),
    updatedAt: z.string().openapi({ example: "2025-01-10T12:00:00.000Z" }),
    userId: z.number().int().openapi({ example: 1 }),
    user: userSchema,
  })
  .openapi("Announcement");

export const announcementListSchema = z
  .object({
    data: z.array(announcementSchema),
    pagination: z.object({
      total: z.number().int().openapi({ example: 23 }),
      page: z.number().int().openapi({ example: 2 }),
      totalPages: z.number().int().openapi({ example: 3 }),
      perPage: z.number().int().openapi({ example: 10 }),
    }),
  })
  .openapi("AnnouncementList");

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
