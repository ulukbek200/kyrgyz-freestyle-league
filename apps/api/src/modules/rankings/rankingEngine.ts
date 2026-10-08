import { RankedMatch, RankingRules, Standing } from './rankingRules';

type Acc = Omit<Standing, 'rank'>;

/** Чистая функция: без БД и побочных эффектов. */
export function computeStandings(athleteIds: string[], matches: RankedMatch[], rules: RankingRules): Standing[] {
  const table = new Map<string, Acc>();
  // Historical opponents remain even if no longer eligible for the current table.
  for (const id of new Set([...athleteIds, ...matches.flatMap(m => [m.athleteAId, m.athleteBId])]))
    table.set(id, { athleteId: id, points: 0, wins: 0, losses: 0, techWins: 0, pins: 0, pointDiff: 0 });
  const h2h = new Map<string, number>();

  for (const m of matches) {
    if (m.athleteAId === m.athleteBId || ![m.athleteAId, m.athleteBId].includes(m.winnerId))
      throw new Error(`Invalid historical match ${m.id}`);
    const loserId = m.winnerId === m.athleteAId ? m.athleteBId : m.athleteAId;
    const w = table.get(m.winnerId);
    const l = table.get(loserId);
    if (!w || !l) continue;

    w.wins++; l.losses++;
    w.points += rules.winPoints + (rules.methodBonus[m.method] ?? 0);
    l.points += rules.lossPoints;
    table.get(m.athleteAId)!.points -= m.penaltiesA * rules.penaltyPoints;
    table.get(m.athleteBId)!.points -= m.penaltiesB * rules.penaltyPoints;

    if (m.method === 'TECHNICAL_SUPERIORITY') w.techWins++;
    if (m.method === 'PIN') w.pins++;
    table.get(m.athleteAId)!.pointDiff += m.scoreA - m.scoreB;
    table.get(m.athleteBId)!.pointDiff += m.scoreB - m.scoreA;
    const k = `${m.winnerId}>${loserId}`;
    h2h.set(k, (h2h.get(k) ?? 0) + 1);
  }

  // Mini-table avoids a non-transitive pairwise comparator for cycles A>B>C>A.
  const headToHead = new Map<string, number>();
  for (const a of table.values()) {
    let value = 0;
    for (const b of table.values()) if (a.points === b.points && a.wins === b.wins)
      value += (h2h.get(`${a.athleteId}>${b.athleteId}`) ?? 0) - (h2h.get(`${b.athleteId}>${a.athleteId}`) ?? 0);
    headToHead.set(a.athleteId, value);
  }
  const cmp = (a: Acc, b: Acc) => {
    for (const rule of rules.tieBreakers) {
      let d = 0;
      if (rule === 'points') d = b.points - a.points;
      else if (rule === 'wins') d = b.wins - a.wins;
      else if (rule === 'techWins') d = b.techWins - a.techWins;
      else if (rule === 'pins') d = b.pins - a.pins;
      else if (rule === 'pointDiff') d = b.pointDiff - a.pointDiff;
      else if (rule === 'headToHead')
        d = headToHead.get(b.athleteId)! - headToHead.get(a.athleteId)!;
      if (d !== 0) return d;
    }
    return a.athleteId.localeCompare(b.athleteId);
  };

  const eligible = new Set(athleteIds);
  return [...table.values()].filter(s => eligible.has(s.athleteId)).sort(cmp).map((s, i) => ({ ...s, rank: i + 1 }));
}
