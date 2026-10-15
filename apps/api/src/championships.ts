import type {Prisma, Championship} from '@prisma/client';
import {HttpError} from './http.js';

type TitleResult = {id: string; seasonId: string|null; winnerId: string | null; scheduledAt: Date};
type Reign = {sourceId?: string; matchId: string | null; seasonId: string|null; athleteId: string; wonAt: Date; defenses: number; isCurrent: boolean};

// Belts belong to a weight class across seasons, matching the existing current-champion API.
// Unlinked historical awards are explicit anchors, not disposable derived records.
export function championshipHistory(matches: TitleResult[], anchors: Pick<Championship,
  'id' | 'seasonId' | 'athleteId' | 'wonAt' | 'defenses'>[] = []): Reign[] {
  const timeline = [
    ...matches.filter(m => m.winnerId).map(m => ({kind: 'match' as const, at: m.scheduledAt, id: m.id, value: m})),
    ...anchors.map(a => ({kind: 'anchor' as const, at: a.wonAt, id: a.id, value: a})),
  ].sort((a, b) => +a.at - +b.at || (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'anchor' ? -1 : 1));
  const history: Reign[] = [];
  for (const entry of timeline) {
    const current = history.at(-1);
    if (entry.kind === 'anchor') {
      if (current) current.isCurrent = false;
      const a = entry.value;
      history.push({sourceId: a.id, matchId: null, seasonId: a.seasonId, athleteId: a.athleteId,
        wonAt: a.wonAt, defenses: a.defenses, isCurrent: true});
    } else {
      const m = entry.value;
      if (current?.athleteId === m.winnerId) current.defenses++;
      else {
        if (current) current.isCurrent = false;
        history.push({matchId: m.id, seasonId: m.seasonId, athleteId: m.winnerId!,
          wonAt: m.scheduledAt, defenses: 0, isCurrent: true});
      }
    }
  }
  return history;
}

export async function rebuildChampionships(tx: Prisma.TransactionClient, weightClassId: string) {
  const matches = await tx.match.findMany({where: {weightClassId, isTitleFight: true, status: 'COMPLETED', winnerId: {not: null}}});
  const anchors = await tx.championship.findMany({where: {weightClassId, matchId: null}, orderBy: [{wonAt: 'asc'}, {id: 'asc'}]});
  // Legacy awards cannot be unambiguously replayed alongside match results.
  // Fail atomically rather than silently delete awards or double-count imported defenses.
  if (anchors.length && matches.length) {
    throw new HttpError(409,
      'Historical championships without a source match need reconciliation before changing title results.');
  }
  const history = championshipHistory(matches, anchors);
  const matchIds = history.flatMap(h => h.matchId ? [h.matchId] : []);
  await tx.championship.deleteMany({where: {weightClassId, matchId: {not: null, notIn: matchIds}}});
  await tx.championship.updateMany({where: {weightClassId}, data: {isCurrent: false}});
  for (const {sourceId, ...reign} of history) {
    if (sourceId) {
      // Do not persist computed defenses on an anchor: otherwise the next replay adds them twice.
      await tx.championship.update({where: {id: sourceId}, data: {isCurrent: reign.isCurrent}});
    } else {
      await tx.championship.upsert({where: {matchId: reign.matchId!},
        create: {...reign, weightClassId}, update: reign});
    }
  }
}
