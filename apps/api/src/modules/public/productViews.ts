import { publicEventWhere } from './publication';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publicRankings, publicChampions } from './publicViews';
import { rankingProjection } from '../rankings/rankingService';

/** Public career statistics: published, completed source records only. */
export async function publicRecords(ids: string[], before?: Date) {
  const matches = await prisma.match.findMany({ where: { status: 'COMPLETED', event: publicEventWhere,
    ...(before ? { scheduledAt: { lt: before } } : {}), OR: [{ athleteAId: { in: ids } }, { athleteBId: { in: ids } }] },
    orderBy: [{ scheduledAt: 'desc' }, { id: 'asc' }] });
  return new Map(ids.map(id => {
    const played = matches.filter(m => m.athleteAId === id || m.athleteBId === id);
    const wins = played.filter(m => m.winnerId === id);
    return [id, { wins: wins.length, losses: played.length - wins.length, matches: played.length,
      record: `${wins.length}–${played.length - wins.length}`, winRate: played.length ? Math.round(wins.length / played.length * 100) : 0,
      techWins: wins.filter(m => m.method === 'TECHNICAL_SUPERIORITY').length, pins: wins.filter(m => m.method === 'PIN').length,
      recentForm: played.slice(0, 5).map(m => ({ matchId: m.id, result: m.winnerId === id ? 'W' : 'L', date: m.scheduledAt })) }];
  }));
}

export async function enrichMatches<T extends { athleteAId: string; athleteBId: string; seasonId: string; weightClassId: string; athleteA: any; athleteB: any }>(matches: T[]) {
  const ids = [...new Set(matches.flatMap(m => [m.athleteAId, m.athleteBId]))];
  if (!ids.length) return matches;
  const [records, titles] = await Promise.all([publicRecords(ids), publicChampions()]);
  const scopes = [...new Map(matches.map(m => [`${m.seasonId}:${m.weightClassId}`, m])).values()];
  const rankings = (await Promise.all(scopes.map(m => publicRankings(m.seasonId, m.weightClassId)))).flat();
  return matches.map(m => ({ ...m, ...Object.fromEntries(['athleteA', 'athleteB'].map(key => {
    const a = (m as any)[key];
    return [key, { ...a, stats: records.get(a.id), ranking: rankings.find(r => r.athleteId === a.id && r.seasonId === m.seasonId && r.weightClassId === m.weightClassId) ?? null,
      isChampion: titles.some(c => c.isCurrent && c.athleteId === a.id && c.weightClassId === m.weightClassId) }];
  })) }));
}

export async function matchContext(m: { seasonId: string; weightClassId: string; eventId: string; scheduledAt: Date; athleteAId: string; athleteBId: string }) {
  const [projection, records, events] = await Promise.all([
    rankingProjection(m.seasonId, m.weightClassId, prisma, true), publicRecords([m.athleteAId, m.athleteBId], m.scheduledAt),
    prisma.event.findMany({ where: { seasonId: m.seasonId, isPublished: true }, orderBy: [{ date: 'asc' }, { id: 'asc' }] }),
  ]);
  const eventIndex = events.findIndex(e => e.id === m.eventId);
  const earlierEvents = new Set(events.slice(0, eventIndex).map(e => e.id));
  return Object.fromEntries([m.athleteAId, m.athleteBId].map(id => {
    const prior = projection.snapshots.filter(s => s.athleteId === id && earlierEvents.has(s.eventId));
    return [id, { stats: records.get(id), rankingBefore: prior.at(-1)?.rank ?? null }];
  }));
}

export const mediaInclude = { athlete: { select: { id: true, slug: true, firstName: true, lastName: true } } } satisfies Prisma.MediaPostInclude;
