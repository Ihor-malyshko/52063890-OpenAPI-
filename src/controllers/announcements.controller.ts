import type { Request, Response } from "express";
import createHttpError from "http-errors";
import prisma from "../../prisma/client.ts";
import type {
  CreateAnnouncementInput,
  ListQuery,
  UpdateAnnouncementInput,
} from "../validators/announcements.validator.ts";

const PER_PAGE = 10;

const userSelect = { id: true, username: true, email: true, name: true };
const include = { user: { select: userSelect } };

export async function list(_req: Request, res: Response): Promise<void> {
  const { search, sort, page } = res.locals.query as ListQuery;

  const where = search
    ? { title: { contains: search, mode: "insensitive" as const } }
    : {};
  const direction = sort === "oldest" ? "asc" : "desc";
  const orderBy = [{ createdAt: direction }, { id: direction }] as const;

  const [data, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [...orderBy],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include,
    }),
    prisma.announcement.count({ where }),
  ]);

  res.status(200).json({
    data,
    pagination: {
      total,
      page,
      totalPages: Math.ceil(total / PER_PAGE),
      perPage: PER_PAGE,
    },
  });
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = req.params.id as unknown as number;

  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include,
  });
  if (!announcement) {
    throw createHttpError(404, "Announcement not found");
  }

  res.status(200).json(announcement);
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateAnnouncementInput;

  const announcement = await prisma.announcement.create({
    data: { ...body, userId: req.user!.sub },
    include,
  });

  res.status(201).json(announcement);
}

async function findOwned(req: Request) {
  const id = req.params.id as unknown as number;

  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement) {
    throw createHttpError(404, "Announcement not found");
  }
  if (announcement.userId !== req.user!.sub) {
    throw createHttpError(403, "Access denied");
  }

  return id;
}

export async function update(req: Request, res: Response): Promise<void> {
  const id = await findOwned(req);

  const announcement = await prisma.announcement.update({
    where: { id },
    data: req.body as UpdateAnnouncementInput,
    include,
  });

  res.status(200).json(announcement);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const id = await findOwned(req);

  await prisma.announcement.delete({ where: { id } });

  res.status(204).end();
}
