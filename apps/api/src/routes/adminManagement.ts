import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { h, paging, slugify, uniqueSuffix } from '../lib/utils';
import { logAudit, writeTransaction } from '../lib/transaction';
import { saveAthlete, saveSeason, changeRoster, saveEvent, decideApplication } from '../modules/admin/adminService';
import { createMatch, editMatch, deleteMatch, resultSchema, submitResult } from '../modules/matches/matchService';
import { recalculate } from '../modules/rankings/rankingService';
import { rebuildTitles } from '../modules/champions/titleService';

export const adminManagement = Router();
const uid = (req: any) => req.user.id as string;
const matchInclude = { athleteA: true, athleteB: true, weightClass: true, event: true, periods: { orderBy: { period: 'asc' as const } } };

// Read-only directories for the existing administrative data model.
adminManagement.get('/clubs', h(async (_q, res) => res.json(await prisma.club.findMany({ include: { _count: { select: { athletes: true } } }, orderBy: { name: 'asc' } }))));
adminManagement.get('/coaches', h(async (_q, res) => res.json(await prisma.coach.findMany({ include: { club: true }, orderBy: { fullName: 'asc' } }))));
adminManagement.get('/users', h(async (_q, res) => res.json(await prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, isActive: true }, orderBy: { name: 'asc' } }))));
adminManagement.get('/champions', h(async (_q, res) => res.json(await prisma.championship.findMany({ include: { athlete: true, weightClass: true, season: true, defenses: true }, orderBy: { wonAt: 'desc' } }))));

adminManagement.get('/athletes', h(async (req, res) => {
  const { search, status, weightClassId, archived } = z.object({ search: z.string().optional(),
    status: z.enum(['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED', 'RETIRED', 'ARCHIVED']).optional(),
    weightClassId: z.string().optional(), archived: z.enum(['true', 'false']).optional() }).parse(req.query);
  const p = paging(req.query);
  const where = { ...(weightClassId ? { weightClassId } : {}),
    ...(status === 'ARCHIVED' ? { isArchived: true } : status ? { status, isArchived: false } : {}),
    ...(archived ? { isArchived: archived === 'true' } : {}),
    ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' as const } }, { lastName: { contains: search, mode: 'insensitive' as const } }] } : {}) };
  const [total, items] = await Promise.all([prisma.athlete.count({ where }), prisma.athlete.findMany({ where, skip: p.skip, take: p.take,
    orderBy: [{ lastName: 'asc' }, { id: 'asc' }], include: { club: true, weightClass: true } })]);
  res.json({ items, total, page: p.page, limit: p.limit });
}));
adminManagement.get('/athletes/:id', h(async (req, res) => {
  const a = await prisma.athlete.findUniqueOrThrow({ where: { id: req.params.id }, include: { weightClass: true, club: true,
    snapshots: { include: { event: true }, orderBy: { event: { date: 'asc' } } }, championships: { include: { defenses: true } } } });
  const matches = await prisma.match.findMany({ where: { OR: [{ athleteAId: a.id }, { athleteBId: a.id }] }, include: matchInclude, orderBy: { scheduledAt: 'desc' } });
  res.json({ ...a, matches });
}));
adminManagement.post('/athletes', h(async (req, res) => res.status(201).json(await saveAthlete(undefined, req.body, uid(req)))));
adminManagement.patch('/athletes/:id', h(async (req, res) => res.json(await saveAthlete(req.params.id, req.body, uid(req)))));
adminManagement.delete('/athletes/:id', h(async (req, res) => res.json(await saveAthlete(req.params.id, { isArchived: true }, uid(req)))));
adminManagement.post('/athletes/:id/restore', h(async (req, res) => res.json(await saveAthlete(req.params.id, { isArchived: false, status: 'ACTIVE' }, uid(req)))));

adminManagement.get('/seasons', h(async (_q, res) => res.json(await prisma.season.findMany({ orderBy: { startDate: 'desc' }, include: { weightClasses: { include: { weightClass: true } } } }))));
adminManagement.post('/seasons', h(async (req, res) => res.status(201).json(await saveSeason(undefined, req.body, uid(req)))));
adminManagement.patch('/seasons/:id', h(async (req, res) => res.json(await saveSeason(req.params.id, req.body, uid(req)))));
adminManagement.get('/seasons/:id/athletes', h(async (req, res) => {
  res.json(await prisma.seasonAthlete.findMany({ where: { seasonId: req.params.id }, include: { athlete: { include: { weightClass: true } } } }));
}));
adminManagement.post('/seasons/:id/athletes', h(async (req, res) => {
  const { athleteId } = z.object({ athleteId: z.string().min(1) }).parse(req.body);
  await changeRoster(req.params.id, athleteId, false, uid(req)); res.json({ ok: true });
}));
adminManagement.delete('/seasons/:id/athletes/:athleteId', h(async (req, res) => {
  await changeRoster(req.params.id, req.params.athleteId, true, uid(req)); res.json({ ok: true });
}));
adminManagement.post('/weight-classes', h(async (req, res) => {
  const d = z.object({ name: z.string().min(1), maxKg: z.coerce.number().positive(), sortOrder: z.coerce.number().int().default(0) }).parse(req.body);
  const w = await writeTransaction(async tx => {
    const w = await tx.weightClass.create({ data: d }); await logAudit(tx, uid(req), 'weightClass.create', 'WeightClass', w.id); return w;
  }); res.status(201).json(w);
}));
adminManagement.get('/events', h(async (_q, res) => res.json(await prisma.event.findMany({ orderBy: { date: 'desc' }, include: { season: true } }))));
adminManagement.post('/events', h(async (req, res) => res.status(201).json(await saveEvent(undefined, req.body, uid(req)))));
adminManagement.patch('/events/:id', h(async (req, res) => res.json(await saveEvent(req.params.id, req.body, uid(req)))));

adminManagement.get('/matches', h(async (req, res) => {
  const p = paging(req.query);
  const filters = z.object({ search: z.string().optional(), seasonId: z.string().optional(), eventId: z.string().optional(), weightClassId: z.string().optional(),
    status: z.enum(['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED']).optional() }).parse(req.query);
  const { search, ...rest } = filters;
  const ci = { contains: search ?? '', mode: 'insensitive' as const };
  const where = { ...rest, ...(search ? { OR: [{ athleteA: { OR: [{ firstName: ci }, { lastName: ci }] } }, { athleteB: { OR: [{ firstName: ci }, { lastName: ci }] } }, { event: { name: ci } }] } : {}) };
  const [total, items] = await Promise.all([prisma.match.count({ where }), prisma.match.findMany({ where, skip: p.skip, take: p.take, orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }], include: matchInclude })]);
  res.json({ items, total, page: p.page, limit: p.limit });
}));
adminManagement.get('/matches/:id', h(async (req, res) => res.json(await prisma.match.findUniqueOrThrow({ where: { id: req.params.id }, include: matchInclude }))));
adminManagement.post('/matches', h(async (req, res) => res.status(201).json(await createMatch(req.body, uid(req)))));
adminManagement.patch('/matches/:id', h(async (req, res) => res.json(await editMatch(req.params.id, req.body, uid(req)))));
adminManagement.post('/matches/:id/result', h(async (req, res) => {
  const match = await submitResult(req.params.id, resultSchema.parse(req.body), uid(req));
  // Flags are returned only after the existing transaction has committed successfully.
  res.json({ ...match, updates: { resultSaved: true, rankingsUpdated: true, championshipUpdated: match.type !== 'REGULAR' } });
}));
adminManagement.delete('/matches/:id', h(async (req, res) => { await deleteMatch(req.params.id, uid(req)); res.json({ ok: true }); }));
adminManagement.post('/rankings/recalculate', h(async (req, res) => {
  const { seasonId, weightClassId } = z.object({ seasonId: z.string(), weightClassId: z.string().optional() }).parse(req.body);
  await writeTransaction(async tx => {
    const wcs = weightClassId ? [{ id: weightClassId }] : await tx.weightClass.findMany();
    for (const wc of wcs) { await recalculate(seasonId, wc.id, tx); await rebuildTitles(wc.id, tx); }
    await logAudit(tx, uid(req), 'ranking.recalculate', 'Season', seasonId);
  }); res.json({ ok: true });
}));

adminManagement.get('/applications', h(async (_q, res) => res.json(await prisma.application.findMany({ orderBy: { createdAt: 'desc' } }))));
adminManagement.post('/applications/:id/:action(approve|reject|request-info)', h(async (req, res) => {
  const { notes } = z.object({ notes: z.string().max(2000).optional() }).parse(req.body ?? {});
  res.json(await decideApplication(req.params.id, req.params.action as 'approve' | 'reject' | 'request-info', notes, uid(req)));
}));

const mediaSchema = z.object({ title: z.string().trim().min(1), content: z.string().min(1), excerpt: z.string().optional(),
  category: z.enum(['NEWS', 'INTERVIEW', 'ATHLETE_STORY', 'HIGHLIGHT', 'TRAINING', 'BEHIND_THE_SCENES', 'BACKSTAGE', 'FACE_OFF', 'CHAMPIONSHIP'])
    .transform(v => v === 'BACKSTAGE' ? 'BEHIND_THE_SCENES' as const : v),
  coverUrl: z.string().max(500).nullable().optional(), athleteId: z.string().nullable().optional(), isPublished: z.boolean().default(false) }).strict();
adminManagement.get('/media', h(async (_q, res) => res.json(await prisma.mediaPost.findMany({ orderBy: { createdAt: 'desc' } }))));
adminManagement.post('/media', h(async (req, res) => {
  const d = mediaSchema.parse(req.body);
  res.status(201).json(await writeTransaction(async tx => {
    const p = await tx.mediaPost.create({ data: { ...d, slug: `${slugify(d.title)}-${uniqueSuffix()}`, authorId: uid(req), publishedAt: d.isPublished ? new Date() : null } });
    await logAudit(tx, uid(req), 'media.create', 'MediaPost', p.id); return p;
  }));
}));
adminManagement.patch('/media/:id', h(async (req, res) => {
  const d = mediaSchema.partial().parse(req.body);
  res.json(await writeTransaction(async tx => {
    const old = await tx.mediaPost.findUniqueOrThrow({ where: { id: req.params.id } });
    const p = await tx.mediaPost.update({ where: { id: old.id }, data: { ...d,
      ...(d.isPublished === true && !old.publishedAt ? { publishedAt: new Date() } : {}) } });
    await logAudit(tx, uid(req), 'media.update', 'MediaPost', p.id); return p;
  }));
}));
adminManagement.delete('/media/:id', h(async (req, res) => {
  await writeTransaction(async tx => {
    await tx.mediaPost.delete({ where: { id: req.params.id } });
    await logAudit(tx, uid(req), 'media.delete', 'MediaPost', req.params.id);
  }); res.json({ ok: true });
}));
