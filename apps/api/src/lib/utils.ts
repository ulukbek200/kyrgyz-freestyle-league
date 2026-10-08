import { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from './prisma';
import { z } from 'zod';
import crypto from 'crypto';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler =>
  (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };

export const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';

export const uniqueSuffix = () => crypto.randomBytes(6).toString('hex');

export function paging(q: any) {
  const { page, limit } = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(20) }).parse(q);
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

/** Активный сезон (или самый свежий). */
export async function currentSeasonId(): Promise<string | null> {
  const s =
    (await prisma.season.findFirst({ where: { status: 'ACTIVE', competition: null }, orderBy: { startDate: 'desc' } })) ??
    (await prisma.season.findFirst({ where: { competition: null }, orderBy: { startDate: 'desc' } }));
  return s?.id ?? null;
}

export const athleteBrief = {
  select: { id: true, slug: true, firstName: true, lastName: true, nickname: true, photoUrl: true, city: true, country: true },
} as const;
