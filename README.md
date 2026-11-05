# Announcements Board REST API

JSON-only REST API for an announcements board: JWT authentication (access + refresh tokens with rotation), ownership checks, pagination/search/sorting, and OpenAPI documentation (Swagger UI).

## Stack

Node.js 24, TypeScript (run with `tsx`), Express 5, Prisma 7 + PostgreSQL (`@prisma/adapter-pg`), Zod 4 + `@asteasolutions/zod-to-openapi`, bcrypt, jsonwebtoken, swagger-ui-express.

## Getting started

```bash
npm install                 # also runs `prisma generate` (postinstall)
cp .env.example .env        # on Windows: copy .env.example .env
docker compose up -d        # PostgreSQL 16 on localhost:5432
npm run prisma:migrate      # or: npm run prisma:deploy (applies existing migrations)
npm run dev                 # http://localhost:3000
```

Swagger UI: <http://localhost:3000/api-docs> (use **Authorize** with an access token to call protected routes).

### Environment variables (`.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (default matches `docker-compose.yml`) |
| `JWT_SECRET` | Secret used to sign access and refresh tokens (required, replace the placeholder with your own value; the server exits at startup if it is missing) |
| `PORT` | Optional, defaults to `3000` |

## Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | no | Register, returns `{ user, accessToken, refreshToken }` (201) |
| POST | `/auth/login` | no | Login, replaces the stored refresh token (200) |
| POST | `/auth/refresh` | no | Rotate tokens using a refresh token (200) |
| POST | `/auth/logout` | yes | Delete the user's refresh token (204) |
| GET | `/auth/me` | yes | Current user profile (200) |
| GET | `/announcements` | no | List: `?search=&sort=newest\|oldest&page=` (10 per page) |
| GET | `/announcements/:id` | no | Single announcement with author (404 if missing) |
| POST | `/announcements` | yes | Create (author taken from the token) |
| PATCH | `/announcements/:id` | yes | Partial update, owner only (403 otherwise) |
| DELETE | `/announcements/:id` | yes | Delete, owner only (204, 403 otherwise) |

Access tokens live 15 minutes, refresh tokens 7 days. Send the access token as `Authorization: Bearer <token>`.

## Project structure

```text
prisma/            schema.prisma, migrations/, client.ts
src/controllers/   auth.controller.ts, announcements.controller.ts
src/middleware/    authenticate.ts, validate.ts
src/routes/        auth.routes.ts, announcements.routes.ts (routes + OpenAPI path registration)
src/validators/    auth.validator.ts, announcements.validator.ts (Zod schemas)
src/openapi.ts     OpenAPI registry, bearerAuth scheme, document generator
app.ts             Express app, error handler
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start with file watching |
| `npm start` | Start the server |
| `npm run prisma:migrate` | Create/apply migrations in development |
| `npm run prisma:deploy` | Apply existing migrations |
| `npm run prisma:generate` | Generate Prisma Client |
