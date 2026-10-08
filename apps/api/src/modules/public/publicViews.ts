import { publicEventWhere } from './publication';
import { prisma } from '../../lib/prisma';
import { athleteBrief } from '../../lib/utils';
import { rankingProjection } from '../rankings/rankingService';
import { titleProjection } from '../champions/titleService';

export async function publicRankings(seasonId: string, weightClassId: string) {
  const { items } = await rankingProjection(seasonId, weightClassId, prisma, true);
  const athletes = await prisma.athlete.findMany({ where: { id: { in: items.map(s => s.athleteId) } }, ...athleteBrief });
  return items.map(s => ({ ...s, id: `${seasonId}_${weightClassId}_${s.athleteId}`, seasonId, weightClassId,
    athlete: athletes.find(a => a.id === s.athleteId)! }));
}

export async function publicChampions() {
  const wcs = await prisma.weightClass.findMany();
  const reigns = (await Promise.all(wcs.map(w => titleProjection(w.id, prisma, true)))).flat();
  const ids = [...new Set(reigns.flatMap(r => [r.wonAtMatchId, ...r.defenseMatchIds]))];
  const matches = await prisma.match.findMany({ where: { id: { in: ids } }, include: {
    athleteA: athleteBrief, athleteB: athleteBrief, winner: athleteBrief, weightClass: true, event: true,
  } });
  const athletes = await prisma.athlete.findMany({ where: { id: { in: reigns.map(r => r.athleteId) } },
    select: { ...athleteBrief.select, club: true } });
  const seasons = await prisma.season.findMany({ where: { id: { in: reigns.map(r => r.seasonId) } } });
  return reigns.map(({ defenseMatchIds, ...r }) => ({ ...r, id: `title_${r.wonAtMatchId}`,
    athlete: athletes.find(a => a.id === r.athleteId)!, weightClass: wcs.find(w => w.id === r.weightClassId)!,
    season: seasons.find(s => s.id === r.seasonId)!, wonAtMatch: matches.find(m => m.id === r.wonAtMatchId)!,
    defenses: defenseMatchIds.map(matchId => ({ id: `defense_${matchId}`, matchId, match: matches.find(m => m.id === matchId)! })),
  })).sort((a, b) => +b.wonAt - +a.wonAt);
}

export async function publicAthleteHistory(athleteId: string) {
  const matches = await prisma.match.findMany({ where: { event: publicEventWhere, OR: [{ athleteAId: athleteId }, { athleteBId: athleteId }] },
    select: { seasonId: true, weightClassId: true }, distinct: ['seasonId', 'weightClassId'] });
  return (await Promise.all(matches.map(m => rankingProjection(m.seasonId, m.weightClassId, prisma, true))))
    .flatMap(p => p.snapshots.filter(s => s.athleteId === athleteId));
}
