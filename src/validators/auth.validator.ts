import { z } from "zod";
import "../openapi.ts";

export const registerSchema = z
  .object({
    username: z.string().min(3).max(30).openapi({ example: "ivan_petrenko" }),
    email: z.email().openapi({ example: "ivan@example.com" }),
    password: z.string().min(6).openapi({ example: "secret123" }),
    name: z.string().min(2).openapi({ example: "Іван" }),
  })
  .openapi("RegisterBody");

export const loginSchema = z
  .object({
    username: z.string().min(1).openapi({ example: "ivan_petrenko" }),
    password: z.string().min(1).openapi({ example: "secret123" }),
  })
  .openapi("LoginBody");

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).openapi({ example: "eyJhbGci..." }),
  })
  .openapi("RefreshBody");

export const userSchema = z
  .object({
    id: z.number().int().openapi({ example: 1 }),
    username: z.string().openapi({ example: "ivan_petrenko" }),
    email: z.string().openapi({ example: "ivan@example.com" }),
    name: z.string().openapi({ example: "Іван" }),
  })
  .openapi("User");

export const tokensResponseSchema = z
  .object({
    accessToken: z.string().openapi({ example: "eyJhbGci..." }),
    refreshToken: z.string().openapi({ example: "eyJhbGci..." }),
  })
  .openapi("TokensResponse");

export const authResponseSchema = z
  .object({
    user: userSchema,
    accessToken: z.string().openapi({ example: "eyJhbGci..." }),
    refreshToken: z.string().openapi({ example: "eyJhbGci..." }),
  })
  .openapi("AuthResponse");

export const meResponseSchema = userSchema
  .extend({
    createdAt: z.string().openapi({ example: "2025-01-10T12:00:00.000Z" }),
  })
  .openapi("MeResponse");

export const errorSchema = z
  .object({
    error: z.string().openapi({ example: "Invalid credentials" }),
  })
  .openapi("Error");

export const validationErrorSchema = z
  .object({
    error: z.string().openapi({ example: "Validation failed" }),
    details: z
      .record(z.string(), z.array(z.string()))
      .openapi({ example: { body: ["email: Invalid email address"] } }),
  })
  .openapi("ValidationError");

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
