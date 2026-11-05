import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import createHttpError from "http-errors";
import jwt from "jsonwebtoken";
import prisma from "../../prisma/client.ts";
import type { LoginInput, RefreshInput, RegisterInput } from "../validators/auth.validator.ts";

// Used to keep login timing similar when the username does not exist.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

// Env is read lazily so it is always loaded by the time a request arrives.
function issueTokens(userId: number): { accessToken: string; refreshToken: string } {
  const secret = process.env.JWT_SECRET!;
  const accessToken = jwt.sign({ type: "access" }, secret, {
    subject: String(userId),
    expiresIn: "15m",
  });
  const refreshToken = jwt.sign({ type: "refresh", jti: crypto.randomUUID() }, secret, {
    subject: String(userId),
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, email, password, name } = req.body as RegisterInput;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    select: { id: true },
  });
  if (existing) {
    throw createHttpError(409, "Username or email already taken");
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user
    .create({
      data: { username, email, password: hashed, name },
      select: { id: true, username: true, email: true, name: true },
    })
    .catch((err: { code?: string }) => {
      // Concurrent registration with the same username/email
      if (err.code === "P2002") {
        throw createHttpError(409, "Username or email already taken");
      }
      throw err;
    });

  const { accessToken, refreshToken } = issueTokens(user.id);
  await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.id } });

  res.status(201).json({ user, accessToken, refreshToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body as LoginInput;

  const found = await prisma.user.findUnique({ where: { username } });
  const valid = await bcrypt.compare(password, found ? found.password : DUMMY_HASH);
  if (!found || !valid) {
    throw createHttpError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = issueTokens(found.id);
  await prisma.$transaction([
    prisma.refreshToken.deleteMany({ where: { userId: found.id } }),
    prisma.refreshToken.create({ data: { token: refreshToken, userId: found.id } }),
  ]);

  const user = { id: found.id, username: found.username, email: found.email, name: found.name };
  res.status(200).json({ user, accessToken, refreshToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken: oldToken } = req.body as RefreshInput;

  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(oldToken, process.env.JWT_SECRET!);
  } catch {
    throw createHttpError(401, "Invalid refresh token");
  }
  if (typeof payload !== "object" || payload === null || payload.type !== "refresh") {
    throw createHttpError(401, "Invalid refresh token");
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token: oldToken } });
  if (!stored) {
    throw createHttpError(401, "Invalid refresh token");
  }

  const tokens = issueTokens(stored.userId);
  await prisma.$transaction(async (tx) => {
    // deleteMany (not delete) so a concurrent reuse of the same token yields 401, not a 500.
    const { count } = await tx.refreshToken.deleteMany({ where: { token: oldToken } });
    if (count === 0) {
      throw createHttpError(401, "Invalid refresh token");
    }
    await tx.refreshToken.create({ data: { token: tokens.refreshToken, userId: stored.userId } });
  });

  res.status(200).json(tokens);
}

export async function logout(req: Request, res: Response): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId: req.user!.sub } });
  res.status(204).end();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.sub },
    select: { id: true, username: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    throw createHttpError(404, "User not found");
  }
  res.status(200).json(user);
}
