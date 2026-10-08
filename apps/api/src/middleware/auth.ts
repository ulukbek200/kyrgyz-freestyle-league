import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../env';
import { HttpError } from '../lib/utils';
import { prisma } from '../lib/prisma';

export interface AuthUser { id: string; role: Role }

export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new HttpError(401, 'Unauthorized'));
  try {
    const p = jwt.verify(header.slice(7), env.JWT_SECRET, { algorithms: ['HS256'] }) as AuthUser;
    if (typeof p.id !== 'string') return next(new HttpError(401, 'Invalid identity'));
    const user = await prisma.user.findUnique({ where: { id: p.id }, select: { id: true, role: true, isActive: true } });
    if (!user?.isActive) return next(new HttpError(401, 'Account is disabled'));
    (req as any).user = { id: user.id, role: user.role };
    next();
  } catch (e) {
    next(e instanceof jwt.JsonWebTokenError ? new HttpError(401, 'Invalid token') : e);
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    const u = (req as any).user as AuthUser | undefined;
    if (!u || !roles.includes(u.role)) return next(new HttpError(403, 'Forbidden'));
    next();
  };
