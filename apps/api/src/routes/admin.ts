import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { h, HttpError, currentSeasonId } from '../lib/utils';
import { adminManagement } from './adminManagement';

export const adminRouter = Router();
const uid = (req: Request) => (req as any).user.id as string;
const audit = (req: Request, action: string, entity: string, entityId?: string, meta?: any) =>
  prisma.auditLog.create({ data: { userId: uid(req), action, entity, entityId, meta, ip: req.ip } });

// ---------- dashboard ----------
adminRouter.get('/stats', h(async (_q, res) => {
  const [season, athletes, matches, upcoming, completed, applications, champions, media, activity] = await Promise.all([
    currentSeasonId().then((id) => (id ? prisma.season.findUnique({ where: { id } }) : null)),
    prisma.athlete.count({ where: { isArchived: false } }),
    prisma.match.count(),
    prisma.match.count({ where: { status: 'UPCOMING' } }),
    prisma.match.count({ where: { status: 'COMPLETED' } }),
    prisma.application.count({ where: { status: 'PENDING' } }),
    prisma.championship.count({ where: { isCurrent: true } }),
    prisma.mediaPost.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { user: { select: { name: true } } } }),
  ]);
  const nextEvent = await prisma.event.findFirst({ where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, include: { season: true } });
  res.json({ season, nextEvent, athletes, matches, upcoming, completed, applications, champions, media, activity });
}));

adminRouter.use(adminManagement);

adminRouter.get('/notifications', h(async (_q, res) => {
  res.json(await prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }));
}));

// ---------- upload (jpg/png/webp, до 5 МБ) ----------
export const UPLOAD_DIR = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_q, f, cb) => cb(null, crypto.randomBytes(12).toString('hex') + EXT[f.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_q, f, cb) => cb(null, !!EXT[f.mimetype]),
});
adminRouter.post('/upload', upload.single('file'), h(async (req, res) => {
  if (!req.file) throw new HttpError(400, 'Допустимы только jpg, png, webp до 5 МБ');
  await audit(req, 'upload', 'File', req.file.filename);
  res.json({ url: `/uploads/${req.file.filename}` });
}));
