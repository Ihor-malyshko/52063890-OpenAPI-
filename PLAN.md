# PLAN: Announcements Board REST API

Source of truth for requirements: `task-formatted.md` (copy of `task.md`). Target: cover every grading item (100 pts), no extra polish.

## 1. Decisions

| Topic | Decision |
|-------|----------|
| Layout | Code in repo root (no `hw/` folder), structure exactly as in task section 4.2 (+ `prisma.config.ts`, `.env.example`, `docker-compose.yml`, `README.md` from boilerplate) |
| Base | Boilerplate `BetterED-Neoversity/Boilerplate-REST-API-Nodejs` (copied by orchestrator in Wave 0) |
| Stack | Node 24, TypeScript (run via `tsx`, ESM, imports use `.ts` extension), Express 5, Prisma 7 + `@prisma/adapter-pg`, PostgreSQL 16, Zod 4 + `@asteasolutions/zod-to-openapi`, bcrypt, jsonwebtoken, swagger-ui-express |
| Database | PostgreSQL in Docker (`docker-compose.yml`, user installs Docker Desktop). `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/announcements?schema=public` |
| Prisma client | Generated into `generated/prisma` (gitignored). Import the shared client as `import prisma from "<relative>/prisma/client.ts"`. Types/enums from `generated/prisma/client.ts` |
| Tokens | Both tokens signed with `JWT_SECRET`. Access: `expiresIn: "15m"`, payload `{ type: "access" }`, `subject: String(userId)`. Refresh: `expiresIn: "7d"`, payload `{ type: "refresh", jti: crypto.randomUUID() }`, `subject: String(userId)`. `jti` guarantees uniqueness of the `token` column |
| One refresh token per user | login/register: `deleteMany({userId})` then `create` (in `$transaction`). refresh: verify -> find by token -> `$transaction([delete old, create new])`. logout: `deleteMany({userId})` |
| `req.user` | `{ sub: number }` (authenticate does `Number(payload.sub)`). Refresh tokens are rejected by `authenticate` (`type !== "access"` -> 401) |

## 2. Conventions

- Code, comments, README: English. Chat with user: Ukrainian.
- ESM, strict TS, imports with explicit `.ts` extension. No `any` except in the existing error handler.
- Controllers are plain `async (req, res)` functions. Express 5 forwards rejected promises to the error handler, so no `try/catch` unless a specific case needs it (throw `http-errors` for 4xx).
- Errors: use `http-errors` (`createHttpError(409, "Username or email already taken")`) - the existing error handler in `app.ts` returns `{ "error": message }` for 4xx. Do not edit `app.ts` (orchestrator owns it).
- Never return `password`. Use Prisma `select`, not post-hoc deletion.
- Error body shape everywhere: `{ "error": string }`; validation errors: `{ "error": "Validation failed", "details": { "body" | "params" | "query": string[] } }`, status 400, each string `"<path>: <message>"`.
- Express 5: `req.query` is a read-only getter. `validateQuery` stores parsed result in `res.locals.query`; `validateBody` overwrites `req.body`; `validateParams` overwrites `req.params` (fall back to `res.locals.params` is NOT used).
- OpenAPI: `registry.registerPath(...)` calls live at the top of each `*.routes.ts` (next to the router). Zod schemas used in docs carry `.openapi("Name")`. Protected paths include `security: [{ bearerAuth: [] }]`. Boilerplate `src/openapi.ts` stays as is except `info.title`/`description` (orchestrator).
- Route files export `default router` (`express.Router()`), mounted by orchestrator in `app.ts`: `app.use("/auth", authRouter)`, `app.use("/announcements", announcementsRouter)`.

## 3. Contracts

### 3.1 Prisma schema (`prisma/schema.prisma`, owned by P1)

```prisma
enum Category { sale service job other }

model User {
  id            Int            @id @default(autoincrement())
  username      String         @unique
  email         String         @unique
  password      String
  name          String
  createdAt     DateTime       @default(now())
  announcements Announcement[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        Int      @id @default(autoincrement())
  token     String   @unique
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model Announcement {
  id          Int      @id @default(autoincrement())
  title       String
  description String
  price       Float
  category    Category
  userId      Int
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### 3.2 Middleware (owned by P2)

`src/middleware/authenticate.ts`
```ts
declare global { namespace Express { interface Request { user?: { sub: number } } } }
export function authenticate(req, res, next): void  // Bearer header -> jwt.verify(JWT_SECRET) -> type==="access" -> req.user={sub:Number(payload.sub)}; else next(createHttpError(401, "Unauthorized"))
```
Missing header, wrong scheme, invalid, expired, wrong type -> 401 `{error}`.

`src/middleware/validate.ts`
```ts
export const validateBody:   (schema: ZodType) => RequestHandler
export const validateParams: (schema: ZodType) => RequestHandler
export const validateQuery:  (schema: ZodType) => RequestHandler   // result in res.locals.query
```
Use `schema.safeParse`; on failure respond 400 with the validation error shape from section 2.

### 3.3 Validators (owned by P3)

`src/validators/auth.validator.ts` exports (Zod schemas, each `.openapi("<Name>")`) and inferred types:
- `registerSchema` {username 3-30, email, password min 6, name min 2}
- `loginSchema` {username: string min 1, password: string min 1}
- `refreshSchema` {refreshToken: string min 1}
- `userSchema` (response: id, username, email, name), `authResponseSchema` (user, accessToken, refreshToken), `tokensResponseSchema`, `meResponseSchema` (user + createdAt as string), `errorSchema` ({error}), `validationErrorSchema` ({error, details})
- types: `RegisterInput`, `LoginInput`, `RefreshInput`

`src/validators/announcements.validator.ts` exports:
- `categoryEnum = z.enum(["sale","service","job","other"])`
- `createAnnouncementSchema` {title 5-50, description min 10, price number > 0, category}
- `updateAnnouncementSchema` = create schema `.partial()` + `.refine` at least one key present (message `"At least one field must be provided"`)
- `idParamSchema` {id: `z.coerce.number().int().positive()`}
- `listQuerySchema` {search?: string (optional, empty allowed), sort: `z.enum(["newest","oldest"]).default("newest")`, page: `z.coerce.number().int().positive().default(1)`}
- response schemas: `announcementSchema` (id, title, description, price, category, createdAt, updatedAt, user{id,username,email,name}), `announcementListSchema` ({data, pagination{total,page,totalPages,perPage}})
- types: `CreateAnnouncementInput`, `UpdateAnnouncementInput`, `ListQuery`
- Reuse `errorSchema`/`validationErrorSchema`/`userSchema` by importing from `auth.validator.ts`.

### 3.4 HTTP contract

Exactly as in `task-formatted.md` sections 2-3 (status codes, messages `"Username or email already taken"`, `"Invalid credentials"`, `"Access denied"`, 404 `"Announcement not found"`).
Pagination: `perPage = 10`, `skip = (page-1)*10`, `totalPages = Math.ceil(total/10)`. Search: `title: { contains: search, mode: "insensitive" }`, applied only when `search` non-empty. Announcement `user` select: `{ id, username, email, name }`.

## 4. Waves and parts

### Wave 0 - Scaffold (orchestrator)
- Owns: `package.json`, `package-lock.json`, `tsconfig.json`, `app.ts`, `prisma.config.ts`, `prisma/client.ts`, `src/openapi.ts`, `.gitignore`, `.env.example`, `.env`, `docker-compose.yml`, `README.md`
- Does: copy boilerplate, add `postinstall: prisma generate`, `docker-compose.yml` (postgres:16), `.env`/`.env.example` with DATABASE_URL and JWT_SECRET, `npm install`.
- Done when: `npm install` succeeds; `.gitignore` contains `.env`, `node_modules`, `generated/prisma`.

### Wave 1 (parallel)

**Part P1: Prisma schema + migration**
- Owns: `prisma/schema.prisma`, `prisma/migrations/**`
- Does: write schema from 3.1; run `npx prisma generate`; produce migration SQL without a DB: create `prisma/migrations/<timestamp>_init/migration.sql` using `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` and add `migration_lock.toml` (`provider = "postgresql"`).
- Done when: `npx prisma validate` OK, `generate` OK, migration folder exists with `CREATE TABLE` for User, RefreshToken, Announcement.
- Covers: grading 1 (schema, relations, timestamps; the DB apply is done by the orchestrator in Wave 3).

**Part P2: Middleware**
- Owns: `src/middleware/authenticate.ts`, `src/middleware/validate.ts`
- Does: per 3.2.
- Done when: `npx tsc --noEmit` has no errors in these files; `declare global` augmentation makes `req.user` typed.
- Covers: grading 3.

**Part P3: Validators + OpenAPI schemas**
- Owns: `src/validators/auth.validator.ts`, `src/validators/announcements.validator.ts`
- Does: per 3.3.
- Done when: `tsc --noEmit` clean; quick `tsx` check (temp script outside repo) shows: empty `{}` fails `updateAnnouncementSchema`, `{price: 0}` fails, `{title:"abcde"}` passes, `listQuerySchema.parse({})` -> `{sort:"newest", page:1}`.
- Covers: grading 2 (validation), 3 (details), 4 (validation), part of 6.

### Wave 2 (parallel; needs Wave 1 merged)

**Part P4: Auth controller + routes + docs**
- Owns: `src/controllers/auth.controller.ts`, `src/routes/auth.routes.ts`
- Does: register / login / refresh / logout / me per task and section 1 token rules; routes with `validateBody`, `authenticate`; `registry.registerPath` for all 5 routes (responses incl. 400/401/409/204, `security` on logout and me).
- Done when: `tsc --noEmit` clean; routes file default-exports a router; no `password` in any response.
- Covers: grading 2, part of 6.

**Part P5: Announcements controller + routes + docs**
- Owns: `src/controllers/announcements.controller.ts`, `src/routes/announcements.routes.ts`
- Does: list / getById (404) / create (`userId = req.user!.sub`) / update (find -> 404 -> ownership 403 -> update) / delete (same checks, `res.status(204).end()`); `registry.registerPath` for all 5 routes (query params, `security` on POST/PATCH/DELETE, 400/401/403/404 responses).
- Done when: `tsc --noEmit` clean; count and findMany share the same `where`; `Promise.all` / `$transaction` for list.
- Covers: grading 4, 5, part of 6.

### Wave 3 - Integration (orchestrator)
- Owns: `app.ts`, `README.md`
- Does: mount routers (imports before `generateOpenApiDocument()` call, which ESM guarantees), update OpenAPI info, README with run instructions; once Docker is running: `docker compose up -d`, `npx prisma migrate deploy` (or `migrate dev`), start server, run smoke script (kept in `%TEMP%`, not in repo) hitting every route and error case from the acceptance checklist.
- Done when: all checklist rows below pass; the generated OpenAPI document shows all 10 operations with lock icons on protected ones.

### Wave 4 - Final review
- Separate review agent on the full result (template in skill `templates.md`); fix confirmed findings; re-run smoke.

## 5. Acceptance checklist

| # | Requirement | How to verify | Status |
|---|-------------|---------------|--------|
| 1.1 | 3 models, relations, timestamps in schema | read schema; `prisma validate` | done (smoke) |
| 1.2 | Migration applied, tables exist | `migrate deploy`; `\dt` or Prisma query | done (smoke) |
| 2.1 | register: bcrypt hash, no `password` in response, 201 | smoke + DB check | done (smoke) |
| 2.2 | register duplicate username/email -> 409 | smoke | done (smoke) |
| 2.3 | register stores refresh token in DB | DB query | done (smoke) |
| 2.4 | login wrong username and wrong password -> same 401 `Invalid credentials` | smoke | done (smoke) |
| 2.5 | login replaces old refresh token | DB: 1 row per user, old token no longer works in `/refresh` | done (smoke) |
| 2.6 | refresh: verify signature, rotation, 401 for garbage / reused token | smoke | done (smoke) |
| 2.7 | logout protected (401 w/o token), deletes token, 204 even twice | smoke | done (smoke) |
| 2.8 | me protected, no `password` | smoke | done (smoke) |
| 3.1 | authenticate: Bearer parse, `req.user`, 401 for invalid/expired/refresh-as-access | smoke (expired token minted via script) | done (smoke) |
| 3.2 | validateBody/Params/Query exist, 400 + details | smoke | done (smoke) |
| 4.1 | list: `data` + `pagination{total,page,totalPages,perPage}` | smoke with 23 rows | done (smoke) |
| 4.2 | search case-insensitive, sort newest/oldest, 10 per page | smoke | done (smoke) |
| 4.3 | get by id with author; unknown id -> 404 | smoke | done (smoke) |
| 4.4 | create: protected, validation, userId from token, 201 | smoke | done (smoke) |
| 4.5 | patch: protected, partial OK, `{}` -> 400, `updatedAt` changes | smoke | done (smoke) |
| 4.6 | delete: protected, 204 empty body | smoke | done (smoke) |
| 5 | patch/delete foreign announcement -> 403 `Access denied` | smoke with 2 users | done (smoke) |
| 6.1 | all auth + announcement paths in `registerPath` | fetch openapi doc, count paths | done (smoke) |
| 6.2 | `bearerAuth` registered, lock on protected routes | `security` on 5 protected operations | done (smoke) |
| 6.3 | `/api-docs` opens | HTTP 200 / browser check | done (smoke) |
| 7 | GitHub link + archive of files (submission by user) | remind user at the end | todo |

## 6. Progress log

| Part | Status | Note |
|------|--------|------|
| Task formatting | done | `task-formatted.md`, grading totals verified (100) |
| Wave 0 | done | scaffold, docker compose, npm install |
| P1 | done | migration SQL generated offline, applied by orchestrator |
| P2 | done | |
| P3 | done | |
| P4 | done | refresh rotation uses interactive transaction |
| P5 | done | |
| Wave 3 | done | migration applied, 61/61 smoke checks passed |
| Wave 4 | done | review fixes: id max int4, P2002 on register, JWT_SECRET startup check, userId in OpenAPI schema |
