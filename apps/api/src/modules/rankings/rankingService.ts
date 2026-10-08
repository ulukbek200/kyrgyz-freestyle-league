import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { writeTransaction } from '../../lib/transaction';
import { computeStandings } from './rankingEngine';
import { RANKING_DEFAULTS, RankedMatch, RankingRules, rankingRulesSchema } from './rankingRules';

export async function getRules(seasonId: string, tx: Prisma.TransactionClient = prisma): Promise<RankingRules> {
  const season = await tx.season.findUniqueOrThrow({ where: { id: seasonId } });
  const o = rankingRulesSchema.parse(season.rankingRules ?? {});
  return { ...RANKING_DEFAULTS, ...o, methodBonus: { ...RANKING_DEFAULTS.methodBonus, ...(o.methodBonus ?? {}) } };
}

/**
 * Полный идемпотентный пересчёт рейтинга сезона для одной весовой категории.
 * Рейтинг — производная от завершённых матчей; вызывается после любого изменения результата.
 */
export async function rankingProjection(seasonId: string, weightClassId: string, tx: Prisma.TransactionClient = prisma, publishedOnly = false) {
  if (await tx.competition.findUnique({ where: { seasonId } })) return { items: [], snapshots: [] };
  const rules = await getRules(seasonId, tx);
  const participants = await tx.seasonAthlete.findMany({
    where: { seasonId, athlete: { weightClassId, isArchived: false, status: 'ACTIVE' } },
    select: { athleteId: true },
  });
  const athleteIds = participants.map((p) => p.athleteId);

  const events = await tx.event.findMany({
    where: { seasonId, ...(publishedOnly ? { isPublished: true } : {}) },
    orderBy: [{ date: 'asc' }, { id: 'asc' }],
    include: { matches: { where: { weightClassId, countsForLeagueRanking: true, status: 'COMPLETED', winnerId: { not: null } }, orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }] } },
  });

  const cumulative: RankedMatch[] = [];
  let last = computeStandings(athleteIds, [], rules);
  let previous = new Map<string, number>();
  const snapshots: Array<{ seasonId: string; weightClassId: string; eventId: string; athleteId: string; rank: number; points: number; wins: number; losses: number; event: { id: string; name: string; date: Date } }> = [];

  for (const ev of events) {
    if (ev.matches.length === 0) continue;
    cumulative.push(...ev.matches.map(toRanked));
    const standings = computeStandings(athleteIds, cumulative, rules);
    // Historical snapshots are based on actual participants, independent of today's roster.
    const historicalIds = [...new Set(cumulative.flatMap(m => [m.athleteAId, m.athleteBId]))];
    snapshots.push(...computeStandings(historicalIds, cumulative, rules).map(s => ({
        seasonId, weightClassId, eventId: ev.id, athleteId: s.athleteId,
        rank: s.rank, points: s.points, wins: s.wins, losses: s.losses,
        event: { id: ev.id, name: ev.name, date: ev.date },
      })));
    previous = new Map(last.filter(s => s.wins + s.losses > 0).map((s) => [s.athleteId, s.rank]));
    last = standings;
  }
  return { items: last.map(s => ({ ...s, previousRank: previous.get(s.athleteId) ?? null })), snapshots };
}

export async function recalculate(seasonId: string, weightClassId: string, tx?: Prisma.TransactionClient) {
  if (!tx) return writeTransaction(t => recalculate(seasonId, weightClassId, t));
  const { items: last, snapshots } = await rankingProjection(seasonId, weightClassId, tx);
  const athleteIds = last.map(s => s.athleteId);
  await tx.rankingSnapshot.deleteMany({ where: { seasonId, weightClassId } });
  if (snapshots.length) await tx.rankingSnapshot.createMany({ data: snapshots.map(({ event, ...s }) => s) });

  await tx.ranking.deleteMany({ where: { seasonId, weightClassId, athleteId: { notIn: athleteIds } } });
  for (const s of last) {
    const data = {
      rank: s.rank, previousRank: s.previousRank,
      points: s.points, wins: s.wins, losses: s.losses, techWins: s.techWins, pins: s.pins,
    };
    await tx.ranking.upsert({
      where: { seasonId_weightClassId_athleteId: { seasonId, weightClassId, athleteId: s.athleteId } },
      create: { seasonId, weightClassId, athleteId: s.athleteId, ...data },
      update: data,
    });
  }
  return last;
}

function toRanked(m: any): RankedMatch {
  return {
    id: m.id, athleteAId: m.athleteAId, athleteBId: m.athleteBId, winnerId: m.winnerId,
    method: m.method ?? 'POINTS', scoreA: m.scoreA ?? 0, scoreB: m.scoreB ?? 0,
    penaltiesA: m.penaltiesA, penaltiesB: m.penaltiesB,
  };
}
