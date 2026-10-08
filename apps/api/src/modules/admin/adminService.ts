import { z } from 'zod';
import { HttpError, slugify, uniqueSuffix } from '../../lib/utils';
import { writeTransaction, logAudit } from '../../lib/transaction';
import { recalculate } from '../rankings/rankingService';
import { rankingRulesSchema } from '../rankings/rankingRules';
import { refreshMatches, validateAdmission } from '../matches/matchService';

export const athleteSchema = z.object({
  firstName: z.string().trim().min(1), lastName: z.string().trim().min(1), nickname: z.string().nullable().optional(),
  birthDate: z.coerce.date().nullable().optional(), country: z.string().default('KG'), city: z.string().nullable().optional(),
  photoUrl: z.string().max(500).nullable().optional(), bio: z.string().nullable().optional(), achievements: z.array(z.string()).default([]),
  status: z.enum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'RETIRED']).default('ACTIVE'), isArchived: z.boolean().default(false),
  clubId: z.string().nullable().optional(), coachId: z.string().nullable().optional(), weightClassId: z.string().min(1),
}).strict();

export async function saveAthlete(id: string | undefined, input: unknown, userId: string) {
  const d = id ? athleteSchema.partial().parse(input) : athleteSchema.parse(input);
  return writeTransaction(async tx => {
    const old = id ? await tx.athlete.findUniqueOrThrow({ where: { id } }) : null;
    const data = { ...d, photoUrl: d.photoUrl === '' ? null : d.photoUrl };
    const a = id ? await tx.athlete.update({ where: { id }, data }) : await tx.athlete.create({ data: {
      ...data as z.infer<typeof athleteSchema>, slug: `${slugify(`${d.firstName}-${d.lastName}`)}-${uniqueSuffix()}`,
    } });
    const rosters = await tx.seasonAthlete.findMany({ where: { athleteId: a.id } });
    for (const r of rosters) for (const wc of new Set([a.weightClassId, old?.weightClassId ?? a.weightClassId]))
      await recalculate(r.seasonId, wc, tx);
    await logAudit(tx, userId, id ? 'athlete.update' : 'athlete.create', 'Athlete', a.id, d);
    return a;
  });
}

export const seasonSchema = z.object({
  name: z.string().trim().min(1), description: z.string().optional(), startDate: z.coerce.date(), endDate: z.coerce.date().nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'FINISHED']).default('DRAFT'), rankingRules: rankingRulesSchema.optional(),
  weightClassIds: z.array(z.string().min(1)).default([]),
}).strict();

export async function saveSeason(id: string | undefined, input: unknown, userId: string) {
  const { weightClassIds, ...d } = id ? seasonSchema.partial().parse(input) : seasonSchema.parse(input);
  return writeTransaction(async tx => {
    const old = id ? await tx.season.findUniqueOrThrow({ where: { id } }) : null;
    const start = d.startDate ?? old!.startDate, end = d.endDate === undefined ? old?.endDate : d.endDate;
    if (end && end < start) throw new HttpError(400, 'Season end must follow start');
    if (d.status === 'ACTIVE') await tx.season.updateMany({ where: { status: 'ACTIVE', ...(id ? { id: { not: id } } : {}) }, data: { status: 'FINISHED' } });
    const s = id ? await tx.season.update({ where: { id }, data: d }) : await tx.season.create({ data: {
      ...d as Omit<z.infer<typeof seasonSchema>, 'weightClassIds'>, slug: `${slugify(d.name!)}-${uniqueSuffix()}`,
    } });
    if (weightClassIds !== undefined) {
      const ids = [...new Set(weightClassIds)];
      if (await tx.weightClass.count({ where: { id: { in: ids } } }) !== ids.length) throw new HttpError(400, 'Unknown weight class');
      if (await tx.match.count({ where: { seasonId: s.id, weightClassId: { notIn: ids } } }) ||
          await tx.seasonAthlete.count({ where: { seasonId: s.id, athlete: { weightClassId: { notIn: ids } } } }))
        throw new HttpError(409, 'Cannot remove a category used by matches or the roster');
      await tx.seasonWeightClass.deleteMany({ where: { seasonId: s.id } });
      await tx.seasonWeightClass.createMany({ data: ids.map(weightClassId => ({ seasonId: s.id, weightClassId })) });
    }
    if (d.rankingRules || (old && old.status !== s.status)) {
      const wcs = await tx.weightClass.findMany();
      for (const w of wcs) await recalculate(s.id, w.id, tx);
    }
    await logAudit(tx, userId, id ? 'season.update' : 'season.create', 'Season', s.id, input);
    return s;
  });
}

export async function changeRoster(seasonId: string, athleteId: string, remove: boolean, userId: string) {
  return writeTransaction(async tx => {
    const a = await tx.athlete.findUniqueOrThrow({ where: { id: athleteId } });
    const s = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (s.status === 'FINISHED') throw new HttpError(409, 'Season is finished');
    if (remove) {
      if (await tx.match.count({ where: { seasonId, status: { in: ['UPCOMING', 'LIVE'] }, OR: [{ athleteAId: athleteId }, { athleteBId: athleteId }] } }))
        throw new HttpError(409, 'Cancel scheduled matches before removing this athlete');
      await tx.seasonAthlete.deleteMany({ where: { seasonId, athleteId } });
    } else {
      if (a.isArchived || a.status !== 'ACTIVE') throw new HttpError(400, 'Athlete is not active');
      if (!await tx.seasonWeightClass.findUnique({ where: { seasonId_weightClassId: { seasonId, weightClassId: a.weightClassId } } }))
        throw new HttpError(400, 'Select the athlete weight class for the season first');
      await tx.seasonAthlete.upsert({ where: { seasonId_athleteId: { seasonId, athleteId } }, create: { seasonId, athleteId }, update: {} });
    }
    await recalculate(seasonId, a.weightClassId, tx);
    await logAudit(tx, userId, remove ? 'roster.remove' : 'roster.add', 'Season', seasonId, { athleteId });
  });
}

export const eventSchema = z.object({ seasonId: z.string().min(1), name: z.string().trim().min(1), date: z.coerce.date(),
  venue: z.string().optional(), city: z.string().optional(), description: z.string().optional(), isPublished: z.boolean().default(true),
  coverUrl: z.string().max(500).optional(), ticketUrl: z.string().url().optional().or(z.literal('')), streamUrl: z.string().url().optional().or(z.literal('')) }).strict();

export async function saveEvent(id: string | undefined, input: unknown, userId: string) {
  const d = id ? eventSchema.partial().parse(input) : eventSchema.parse(input);
  return writeTransaction(async tx => {
    const old = id ? await tx.event.findUniqueOrThrow({ where: { id }, include: { matches: true } }) : null;
    if (old && d.seasonId && d.seasonId !== old.seasonId) {
      for (const m of old.matches) await validateAdmission(tx, { ...m, seasonId: d.seasonId });
    }
    // Composite FK cascades seasonId to every match; derived state is refreshed below.
    const e = id ? await tx.event.update({ where: { id }, data: d }) : await tx.event.create({ data: {
      ...d as z.infer<typeof eventSchema>, slug: `${slugify(d.name!)}-${uniqueSuffix()}`,
    } });
    if (old) await refreshMatches(tx, [...old.matches, ...old.matches.map(m => ({ ...m, seasonId: e.seasonId }))]);
    await logAudit(tx, userId, id ? 'event.update' : 'event.create', 'Event', e.id, input);
    return e;
  });
}

export async function decideApplication(id: string, action: 'approve' | 'reject' | 'request-info', notes: string | undefined, userId: string) {
  return writeTransaction(async tx => {
    const app = await tx.application.findUniqueOrThrow({ where: { id } });
    if (app.status === 'APPROVED' || app.athleteId) {
      if (action === 'approve') return { ok: true, athleteId: app.athleteId };
      throw new HttpError(409, 'An approved application cannot be rejected');
    }
    let athleteId: string | null = null;
    if (action === 'approve') {
      const wc = await tx.weightClass.findFirst({ where: { maxKg: { gte: app.weightKg } }, orderBy: { maxKg: 'asc' } });
      if (!wc) throw new HttpError(400, 'No suitable weight class');
      const athlete = await tx.athlete.create({ data: {
        firstName: app.firstName, lastName: app.lastName, birthDate: app.birthDate, city: app.city, country: app.country,
        photoUrl: app.photoUrl, status: 'ACTIVE', weightClassId: wc.id,
        achievements: app.achievements?.split('\n').filter(Boolean) ?? [],
        slug: `${slugify(`${app.firstName}-${app.lastName}`)}-${uniqueSuffix()}`,
      } });
      athleteId = athlete.id;
    }
    const changed = await tx.application.updateMany({ where: { id, athleteId: null, status: { not: 'APPROVED' } },
      data: { status: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'MORE_INFO', athleteId, adminNotes: notes ?? app.adminNotes } });
    if (changed.count !== 1) throw new HttpError(409, 'Application was already processed');
    await logAudit(tx, userId, `application.${action}`, 'Application', id, { athleteId });
    return { ok: true, athleteId };
  });
}
