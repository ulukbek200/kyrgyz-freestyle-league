import { Match, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { writeTransaction } from '../../lib/transaction';

export interface Reign {
  seasonId: string; weightClassId: string; athleteId: string; wonAtMatchId: string;
  wonAt: Date; lostAt: Date | null; isCurrent: boolean; defenseMatchIds: string[];
}

/** Pure replay: corrections, annulments and out-of-order entry are all equivalent. */
export function computeTitles(matches: Match[]): Reign[] {
  const reigns: Reign[] = [];
  for (const m of [...matches].sort((a, b) => +a.scheduledAt - +b.scheduledAt || a.id.localeCompare(b.id))) {
    if (m.status !== 'COMPLETED' || m.type === 'REGULAR' || !m.winnerId) continue;
    const current = reigns[reigns.length - 1];
    if (current?.athleteId === m.winnerId) { current.defenseMatchIds.push(m.id); continue; }
    if (current) { current.isCurrent = false; current.lostAt = m.scheduledAt; }
    reigns.push({ seasonId: m.seasonId, weightClassId: m.weightClassId, athleteId: m.winnerId,
      wonAtMatchId: m.id, wonAt: m.scheduledAt, lostAt: null, isCurrent: true, defenseMatchIds: [] });
  }
  return reigns;
}

export async function titleProjection(weightClassId: string, tx: Prisma.TransactionClient = prisma, publishedOnly = false) {
  return computeTitles(await tx.match.findMany({ where: { weightClassId, countsForLeagueRanking: true, status: 'COMPLETED', type: { not: 'REGULAR' },
    ...(publishedOnly ? { event: { isPublished: true } } : {}) } }));
}

export async function rebuildTitles(weightClassId: string, tx?: Prisma.TransactionClient): Promise<void> {
  if (!tx) return writeTransaction(t => rebuildTitles(weightClassId, t));
  const reigns = await titleProjection(weightClassId, tx);
  await tx.championship.deleteMany({ where: { weightClassId } });
  for (const { defenseMatchIds, ...data } of reigns) {
    // Stable identity across repeated replay, tied to the title-winning source record.
    await tx.championship.create({ data: { ...data, id: `title_${data.wonAtMatchId}`,
      defenses: { create: defenseMatchIds.map(matchId => ({ id: `defense_${matchId}`, matchId })) } } });
  }
}

/** Титульная логика: вакантный титул, смена чемпиона, защита. */
export async function applyTitleLogic(match: Match, tx: Prisma.TransactionClient) {
  await rebuildTitles(match.weightClassId, tx);
}
