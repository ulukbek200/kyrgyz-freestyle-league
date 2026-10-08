import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '@prisma/client';
import { computeStandings } from '../src/modules/rankings/rankingEngine';
import { RANKING_DEFAULTS } from '../src/modules/rankings/rankingRules';
import { computeTitles } from '../src/modules/champions/titleService';

const match = (id: string, winnerId = 'A', extra: Partial<Match> = {}): Match => ({
  id, athleteAId: 'A', athleteBId: 'B', winnerId, method: 'POINTS', scoreA: 3, scoreB: 0,
  penaltiesA: 0, penaltiesB: 0, type: 'CHAMPIONSHIP', status: 'COMPLETED', seasonId: 's', weightClassId: 'w',
  eventId: 'e', scheduledAt: new Date(`2026-01-0${id.slice(-1)}T10:00:00Z`), referees: [],
  notes: null, videoUrl: null, createdAt: new Date(), updatedAt: new Date(), ...extra,
});
test('rankings: archive/suspension/category change cannot erase wins against historical opponents', () => {
  const m = match('m1');
  for (const ids of [['A', 'B'], ['A']]) {
    const a = computeStandings(ids, [m as any], RANKING_DEFAULTS).find(s => s.athleteId === 'A')!;
    assert.equal(a.wins, 1); assert.equal(a.points, 3);
  }
});
test('rankings: penalties, bonus and cycles are deterministic', () => {
  const a = match('m1', 'A', { method: 'PIN', penaltiesA: 1 });
  assert.equal(computeStandings(['A', 'B'], [a as any], { ...RANKING_DEFAULTS, penaltyPoints: 1 })[0].points, 4);
  const cycle = [match('m1'), match('m2', 'B', { athleteAId: 'B', athleteBId: 'C' }), match('m3', 'C', { athleteAId: 'C', athleteBId: 'A' })];
  assert.deepEqual(computeStandings(['A', 'B', 'C'], cycle as any, RANKING_DEFAULTS), computeStandings(['C', 'B', 'A'], [...cycle].reverse() as any, RANKING_DEFAULTS));
});
test('title: first fight establishes champion', () => assert.equal(computeTitles([match('m1')])[0].athleteId, 'A'));
test('title: successful defense', () => {
  const r = computeTitles([match('m1'), match('m2', 'A', { type: 'TITLE_DEFENSE' })]);
  assert.equal(r.length, 1); assert.deepEqual(r[0].defenseMatchIds, ['m2']);
});
test('title: challenger starts next reign and closes previous', () => {
  const r = computeTitles([match('m1'), match('m2', 'B', { type: 'TITLE_DEFENSE' })]);
  assert.equal(r[0].isCurrent, false); assert.equal(r[1].athleteId, 'B'); assert.equal(+r[0].lostAt!, +r[1].wonAt);
});
test('title: correcting winner also replays later defenses', () => {
  const r = computeTitles([match('m1', 'B'), match('m2', 'B', { type: 'TITLE_DEFENSE' })]);
  assert.equal(r.length, 1); assert.equal(r[0].athleteId, 'B'); assert.deepEqual(r[0].defenseMatchIds, ['m2']);
});
test('title: annulment restores previous champion', () => {
  const r = computeTitles([match('m1'), match('m2', 'B', { status: 'CANCELLED' })]);
  assert.equal(r.length, 1); assert.equal(r[0].athleteId, 'A'); assert.equal(r[0].isCurrent, true);
});
test('title: repeated replay and out-of-order entry are idempotent', () => {
  const ms = [match('m1'), match('m2', 'B')];
  assert.deepEqual(computeTitles(ms), computeTitles([...ms].reverse()));
  assert.deepEqual(computeTitles(ms), computeTitles(ms));
});
