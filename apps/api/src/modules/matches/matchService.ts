import { Match, Prisma } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../../lib/utils';
import { recalculate } from '../rankings/rankingService';
import { rebuildTitles } from '../champions/titleService';
import { writeTransaction, logAudit } from '../../lib/transaction';

export const resultSchema = z.object({
  winnerId: z.string().min(1),
  method: z.enum(['POINTS', 'TECHNICAL_SUPERIORITY', 'PIN', 'FORFEIT', 'DISQUALIFICATION', 'INJURY']),
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
  penaltiesA: z.number().int().min(0).default(0),
  penaltiesB: z.number().int().min(0).default(0),
  periods: z.array(z.object({ a: z.number().int().min(0), b: z.number().int().min(0) })).max(4).optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type ResultInput = z.infer<typeof resultSchema>;

/** Результат → пересчёт рейтинга → snapshots → титул → уведомление. Всё в одной транзакции. */
export async function submitResult(matchId: string, input: ResultInput, userId: string) {
  return writeTransaction(tx => submitResultTx(tx, matchId, input, userId));
}

export async function submitResultTx(tx: Prisma.TransactionClient, matchId: string, input: ResultInput, userId: string, competition = false) {
      const match = await tx.match.findUnique({ where: { id: matchId }, include: { periods: { orderBy: { period: 'asc' } } } });
      if (!match) throw new HttpError(404, 'Match not found');
      if (competition === match.countsForLeagueRanking) throw new HttpError(409, 'Use the appropriate competition or league result workflow');
      if (![match.athleteAId, match.athleteBId].includes(input.winnerId))
        throw new HttpError(400, 'Winner must be one of the match athletes');
      if (match.status === 'CANCELLED') throw new HttpError(409, 'Restore the match before entering a result');
      if (match.status !== 'COMPLETED') await validateAdmission(tx, match);
      const periods = input.periods ?? match.periods.map(p => ({ a: p.pointsA, b: p.pointsB }));
      if (periods.length && (periods.reduce((n, p) => n + p.a, 0) !== input.scoreA || periods.reduce((n, p) => n + p.b, 0) !== input.scoreB))
        throw new HttpError(400, 'Period totals must equal the final score');
      if (['POINTS', 'TECHNICAL_SUPERIORITY'].includes(input.method)) {
        const winnerScore = input.winnerId === match.athleteAId ? input.scoreA : input.scoreB;
        const loserScore = input.winnerId === match.athleteAId ? input.scoreB : input.scoreA;
        if (winnerScore < loserScore) throw new HttpError(400, 'Winner cannot have fewer points');
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          status: 'COMPLETED', winnerId: input.winnerId, method: input.method,
          scoreA: input.scoreA, scoreB: input.scoreB,
          penaltiesA: input.penaltiesA, penaltiesB: input.penaltiesB, notes: input.notes,
          ...(input.periods === undefined ? {} : { periods: { deleteMany: {}, create: periods.map((p, i) => ({ period: i + 1, pointsA: p.a, pointsB: p.b })) } }),
        },
      });

      if (match.countsForLeagueRanking) {
        await recalculate(match.seasonId, match.weightClassId, tx);
        await rebuildTitles(match.weightClassId, tx);
      }

      await tx.auditLog.create({
        data: { userId, action: 'match.result.submit', entity: 'Match', entityId: matchId, meta: input as any },
      });
      await tx.notification.create({
        data: { type: 'MATCH_COMPLETED', title: 'Матч завершён', payload: { matchId } },
      });
      return updated;
}

export const matchSchema = z.object({
  eventId: z.string().min(1), seasonId: z.string().min(1).optional(), weightClassId: z.string().min(1),
  athleteAId: z.string().min(1), athleteBId: z.string().min(1), scheduledAt: z.coerce.date(),
  type: z.enum(['REGULAR', 'CHAMPIONSHIP', 'TITLE_DEFENSE']).default('REGULAR'),
  status: z.enum(['UPCOMING', 'LIVE', 'CANCELLED']).default('UPCOMING'),
  referees: z.array(z.string()).default([]), videoUrl: z.string().url().nullable().optional(),
}).strict();

/** Applies only to new participation, never to a correction of historical results. */
export async function validateAdmission(tx: Prisma.TransactionClient, m: Pick<Match, 'seasonId' | 'weightClassId' | 'athleteAId' | 'athleteBId'>) {
  if (m.athleteAId === m.athleteBId) throw new HttpError(400, 'Athletes must differ');
  const season = await tx.season.findUniqueOrThrow({ where: { id: m.seasonId } });
  if (season.status === 'FINISHED') throw new HttpError(409, 'Season is finished');
  if (!await tx.seasonWeightClass.findUnique({ where: { seasonId_weightClassId: { seasonId: m.seasonId, weightClassId: m.weightClassId } } }))
    throw new HttpError(400, 'Weight class is not selected for this season');
  const roster = await tx.seasonAthlete.findMany({ where: { seasonId: m.seasonId, athleteId: { in: [m.athleteAId, m.athleteBId] } }, include: { athlete: true } });
  if (roster.length !== 2) throw new HttpError(400, 'Both athletes must belong to the season roster');
  if (roster.some(r => r.athlete.isArchived || r.athlete.status !== 'ACTIVE' || r.athlete.weightClassId !== m.weightClassId))
    throw new HttpError(400, 'Both athletes must be active and eligible for the match weight class');
}

export async function refreshMatches(tx: Prisma.TransactionClient, affected: Array<Pick<Match, 'seasonId' | 'weightClassId'>>) {
  const pairs = new Map(affected.map(m => [`${m.seasonId}:${m.weightClassId}`, m]));
  for (const m of pairs.values()) await recalculate(m.seasonId, m.weightClassId, tx);
  for (const wc of new Set(affected.map(m => m.weightClassId))) await rebuildTitles(wc, tx);
}

export async function createMatch(input: unknown, userId: string) {
  const d = matchSchema.parse(input);
  return writeTransaction(async tx => {
    const event = await tx.event.findUniqueOrThrow({ where: { id: d.eventId } });
    if (d.seasonId && d.seasonId !== event.seasonId) throw new HttpError(400, 'Event/season mismatch');
    if (await tx.competition.findUnique({ where: { seasonId: event.seasonId } })) throw new HttpError(409, 'Use Competition Management for tournament matches');
    const data = { ...d, seasonId: event.seasonId };
    await validateAdmission(tx, data);
    const m = await tx.match.create({ data });
    await logAudit(tx, userId, 'match.create', 'Match', m.id);
    return m;
  });
}

export async function editMatch(id: string, input: unknown, userId: string) {
  const d = matchSchema.partial().parse(input);
  return writeTransaction(async tx => {
    const old = await tx.match.findUniqueOrThrow({ where: { id } });
    if (!old.countsForLeagueRanking) throw new HttpError(409, 'Use Competition Management for tournament corrections');
    const event = await tx.event.findUniqueOrThrow({ where: { id: d.eventId ?? old.eventId } });
    if (d.seasonId && d.seasonId !== event.seasonId) throw new HttpError(400, 'Event/season mismatch');
    const next = { ...old, ...d, seasonId: event.seasonId };
    const changedParticipants = next.athleteAId !== old.athleteAId || next.athleteBId !== old.athleteBId;
    const changedScope = changedParticipants || next.seasonId !== old.seasonId || next.weightClassId !== old.weightClassId;
    if (next.athleteAId === next.athleteBId) throw new HttpError(400, 'Athletes must differ');
    if (changedParticipants && old.status === 'COMPLETED' && !d.status)
      throw new HttpError(409, 'Reopen or cancel the match before replacing result participants');
    if (changedScope || (next.status !== 'COMPLETED' && next.status !== 'CANCELLED')) await validateAdmission(tx, next);
    const clearResult = next.status !== 'COMPLETED';
    const m = await tx.match.update({ where: { id }, data: { ...d, seasonId: event.seasonId,
      ...(clearResult ? { winnerId: null, method: null, scoreA: null, scoreB: null, penaltiesA: 0, penaltiesB: 0, periods: { deleteMany: {} } } : {}) } });
    await refreshMatches(tx, [old, m]);
    await logAudit(tx, userId, 'match.update', 'Match', id, { before: old, after: m });
    return m;
  });
}

export async function deleteMatch(id: string, userId: string) {
  return writeTransaction(async tx => {
    const old = await tx.match.findUniqueOrThrow({ where: { id } });
    if (!old.countsForLeagueRanking) throw new HttpError(409, 'Use Competition Management for tournament corrections');
    // Release derived foreign keys before deleting the source, inside the same transaction.
    await tx.championship.deleteMany({ where: { weightClassId: old.weightClassId } });
    await tx.match.delete({ where: { id } });
    await refreshMatches(tx, [old]);
    await logAudit(tx, userId, 'match.delete', 'Match', id, old);
  });
}
