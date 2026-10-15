import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Prisma} from '@prisma/client';
import {selectWeightClass, createActiveSeason} from '../src/leagueRules.js';
import {championshipHistory} from '../src/championships.js';

const classes = [74, 57, 65].map(kg => ({id: String(kg), kilograms: kg}));
test('weight selection respects upper limits, exact boundaries and rejects overweight', () => {
  for (const [weight, expected] of [[57, 57], [57.1, 65], [64, 65], [65, 65], [65.1, 74], [74, 74]]) {
    assert.equal(selectWeightClass(classes, weight!).kilograms, expected);
  }
  for (const weight of [74.1, 100, NaN, -1, 0]) assert.throws(() => selectWeightClass(classes, weight));
  assert.throws(() => selectWeightClass([], 60));
});
test('active season creation locks before deactivation, also without endsAt', async () => {
  const calls: string[] = [];
  const tx = {
    $executeRaw: async () => {calls.push('lock');},
    season: {updateMany: async () => {calls.push('deactivate');}, create: async ({data}: {data: unknown}) => {calls.push('create'); return data;}},
  } as unknown as Prisma.TransactionClient;
  const created = await createActiveSeason(tx, {name: '2027', startsAt: new Date('2027-01-01')});
  assert.deepEqual(calls, ['lock', 'deactivate', 'create']);
  assert.equal(created.isActive, true);
  await assert.rejects(createActiveSeason(tx, {name: 'bad', startsAt: new Date('2027-01-01'), endsAt: new Date('2026-01-01')}));
});
const matches = ['A', 'A', 'B', 'B', 'A'].map((winnerId, i) => ({id: `m${i}`, winnerId,
  seasonId: i < 3 ? '2026' : '2027', scheduledAt: new Date(2026, 0, i + 1)}));
test('title history is repeatable and spans seasons', () => {
  const a = championshipHistory(matches), b = championshipHistory([...matches].reverse());
  assert.deepEqual(a, b);
  assert.deepEqual(a.map(x => [x.athleteId, x.defenses, x.isCurrent]), [['A', 1, false], ['B', 1, false], ['A', 0, true]]);
});
test('correcting a past winner recalculates subsequent defenses and reigns', () => {
  const corrected = matches.map(m => m.id === 'm2' ? {...m, winnerId: 'A'} : m);
  assert.deepEqual(championshipHistory(corrected).map(x => [x.athleteId, x.defenses]), [['A', 2], ['B', 0], ['A', 0]]);
});
test('cancelling titles restores the preceding champion or removes the last title', () => {
  assert.equal(championshipHistory(matches.slice(0, -1)).at(-1)?.athleteId, 'B');
  assert.deepEqual(championshipHistory([]), []);
});
