import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Prisma} from '@prisma/client';
import {changeResult, resultSchema} from '../src/results.js';

// A strict in-memory repository exercises the service; PostgreSQL locking/rollback is
// deliberately tested separately, not simulated and reported as a database guarantee.
function fixture() {
  const bouts = [0, 1, 2].map(i => ({id: `m${i}`, seasonId: 's', eventId: 'e', weightClassId: 'w',
    athleteAId: 'A', athleteBId: 'B', scheduledAt: new Date(2026, 0, i + 1), isTitleFight: true,
    status: 'UPCOMING', winnerId: null as string | null, method: null as string | null, summary: null}));
  const scores = new Map<string, any>(), ranks = new Map<string, any>(), titles = new Map<string, any>();
  let snapshots: any[] = [];
  const calls: string[] = [];
  const tx = {
    $queryRaw: async (sql:TemplateStringsArray) => {if(sql.join('').includes('to_regclass'))return [{present:false}];calls.push('lock');return [];},
    event:{findUnique:async()=>({id:'e',status:'PLANNED'})},
    match: {
      findUnique: async ({where}: any) => bouts.find(m => m.id === where.id) ?? null,
      findMany: async ({where}: any) => bouts.filter(m => m.status === where.status && m.winnerId &&
        (!where.isTitleFight || m.isTitleFight)).map(m => ({...m, score: scores.get(m.id)})),
      update: async ({where, data}: any) => {calls.push('match.update'); const m = bouts.find(m => m.id === where.id)!; Object.assign(m, data); return {...m};},
    },
    matchScore: {
      upsert: async ({where, create, update}: any) => {
        const data = scores.has(where.matchId) ? update : create;
        for (const key of Object.keys(data)) assert.ok(['matchId', 'athleteAPoints', 'athleteBPoints',
          'periodOneA', 'periodOneB', 'periodTwoA', 'periodTwoB', 'penaltiesA', 'penaltiesB', 'bonus'].includes(key), `Invalid MatchScore field: ${key}`);
        scores.set(where.matchId, {...data});
      },
      deleteMany: async ({where}: any) => {scores.delete(where.matchId);},
    },
    rankingRule: {findUnique: async () => null},
    ranking: {
      findFirst: async ({where}: any) => ranks.get(where.athleteId) ?? null,
      create: async ({data}: any) => {const row={id:data.athleteId,...data};ranks.set(data.athleteId,row);return row;},
      update: async ({where,data}: any) => {const row={...ranks.get(where.id),...data};ranks.set(where.id,row);return row;},
      deleteMany: async ({where}: any) => {for (const id of ranks.keys()) if (!where.athleteId.notIn.includes(id)) ranks.delete(id);},
      findUnique: async ({where}: any) => ranks.get(where.seasonId_weightClassId_athleteId.athleteId) ?? null,
      upsert: async ({where, create, update}: any) => {const id = where.seasonId_weightClassId_athleteId.athleteId; ranks.set(id, {...ranks.get(id), ...(ranks.has(id) ? update : create)});},
    },
    rankingSnapshot: {deleteMany: async () => {snapshots = [];}, createMany: async ({data}: any) => {snapshots.push(...data);}},
    championship: {
      findMany: async () => [...titles.values()].filter(t => t.matchId === null),
      deleteMany: async ({where}: any) => {for (const [id, t] of titles) if (t.matchId && !where.matchId.notIn.includes(t.matchId)) titles.delete(id);},
      updateMany: async ({data}: any) => {for (const t of titles.values()) Object.assign(t, data);},
      update: async ({where, data}: any) => {Object.assign(titles.get(where.id), data);},
      upsert: async ({where, create, update}: any) => {
        const old = [...titles.values()].find(t => t.matchId === where.matchId);
        if (old) Object.assign(old, update);
        else titles.set(where.matchId, {id: where.matchId, ...create});
      },
    },
    notification: {create: async () => {}}, auditLog: {create: async () => {}},
  } as unknown as Prisma.TransactionClient;
  const save = (id: string, winnerId = 'A') => changeResult(tx, id, resultSchema.parse({winnerId, method: 'PIN', athleteAPoints: 4, athleteBPoints: 2}), 'admin');
  return {tx, bouts, scores, ranks, titles, calls, save, snapshots: () => snapshots};
}

test('result persists winner/method on Match and only score fields on MatchScore', async () => {
  const f = fixture(); await f.save('m0');
  assert.equal(f.bouts[0]!.winnerId, 'A'); assert.equal(f.bouts[0]!.method, 'PIN');
  assert.equal(f.scores.get('m0').athleteAPoints, 4);
  assert.deepEqual(f.calls.slice(0, 4), ['lock', 'lock', 'lock', 'match.update']);
});
test('repeated saves do not increment defenses or duplicate championship rows', async () => {
  const f = fixture(); await f.save('m0'); await f.save('m1');
  const before = structuredClone([...f.titles.values()]);
  await f.save('m1'); await f.save('m0');
  assert.deepEqual([...f.titles.values()], before);
  assert.equal([...f.titles.values()][0].defenses, 1);
});
test('editing the first winner rebuilds subsequent reigns and their defense counts', async () => {
  const f = fixture(); await f.save('m0'); await f.save('m1'); await f.save('m2', 'B');
  await f.save('m0', 'B');
  assert.deepEqual([...f.titles.values()].sort((a, b) => +a.wonAt - +b.wonAt).map(t => [t.athleteId, t.defenses, t.isCurrent]),
    [['B', 0, false], ['A', 0, false], ['B', 0, true]]);
});
test('cancellation restores champion, clears score, and removes empty standings', async () => {
  const f = fixture(); await f.save('m0'); await f.save('m1', 'B');
  await changeResult(f.tx, 'm1', null, 'admin');
  assert.equal([...f.titles.values()].find(t => t.isCurrent)?.athleteId, 'A');
  assert.equal(f.scores.has('m1'), false); assert.equal(f.bouts[1]!.winnerId, null);
  assert.equal(f.bouts[1]!.method, null); assert.equal(f.bouts[1]!.status, 'UPCOMING');
  await changeResult(f.tx, 'm0', null, 'admin');
  await changeResult(f.tx, 'm0', null, 'admin');
  assert.equal(f.titles.size, 0); assert.equal(f.ranks.size, 0); assert.equal(f.snapshots().length, 0);
});
test('invalid winner and unknown match are rejected before changes', async () => {
  const f = fixture(); await assert.rejects(f.save('m0', 'outsider'), /participant/);
  await assert.rejects(f.save('unknown'), /not found/);
  assert.equal(f.scores.size, 0); assert.equal(f.titles.size, 0);
});
test('correcting or cancelling an old result also rebuilds later event snapshots', async () => {
  const f = fixture(); f.bouts[1]!.eventId = 'later';
  await f.save('m0'); await f.save('m1');
  assert.equal(f.snapshots().find(s => s.eventId === 'later' && s.athleteId === 'A')?.points, 8);
  await f.save('m0', 'B');
  assert.equal(f.snapshots().find(s => s.eventId === 'later' && s.athleteId === 'A')?.points, 4);
  assert.equal(f.snapshots().find(s => s.eventId === 'later' && s.athleteId === 'B')?.points, 4);
  await changeResult(f.tx, 'm0', null, 'admin');
  assert.equal(f.snapshots().some(s => s.eventId === 'e'), false);
  assert.equal(f.snapshots().find(s => s.eventId === 'later' && s.athleteId === 'B')?.points, 0);
});
test('unlinked legacy championships are not silently overwritten', async () => {
  const f = fixture();
  f.titles.set('legacy', {id: 'legacy', matchId: null, seasonId: 's', athleteId: 'A', wonAt: new Date('2025-01-01'), defenses: 2});
  await assert.rejects(f.save('m0'), /reconciliation/);
  assert.equal(f.titles.get('legacy').defenses, 2);
});
