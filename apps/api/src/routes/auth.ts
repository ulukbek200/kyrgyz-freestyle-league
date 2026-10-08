import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../env';
import { h, HttpError } from '../lib/utils';
import { authenticate } from '../middleware/auth';

export const authRouter = Router();

authRouter.post('/login', h(async (req, res) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const ok = user && user.isActive && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new HttpError(401, 'Invalid credentials');
  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '12h' });
  await prisma.auditLog.create({ data: { userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, ip: req.ip } });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

authRouter.get('/me', authenticate, h(async (req, res) => {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: (req as any).user.id } });
  res.json({ id: u.id, email: u.email, name: u.name, role: u.role });
}));
