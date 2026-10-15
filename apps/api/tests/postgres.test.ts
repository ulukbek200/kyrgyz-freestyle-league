import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../src/env.js';
import {openTestDatabase} from '../scripts/test-database.js';
import {randomUUID} from 'node:crypto';
import {changeResult, resultSchema} from '../src/results.js';
import {createActiveSeason} from '../src/leagueRules.js';

// Opt in with a DEDICATED, already migrated TEST_DATABASE_URL. Never use DATABASE_URL.
test('PostgreSQL: real result replay, cancellation, season switch and rollback', {skip: !process.env.TEST_DATABASE_URL}, async () => {
  const db = await openTestDatabase();
  const prefix = `test-${randomUUID()}`;
  const rollback = new Error('intentional test rollback');
  let matchId = '';
  try {
    await assert.rejects(db.$transaction(async tx => {
      const season = await createActiveSeason(tx, {name: prefix, startsAt: new Date('2026-01-01')});
      const next = await createActiveSeason(tx, {name: `${prefix}-next`, startsAt: new Date('2027-01-01')});
      assert.equal(await tx.season.count({where: {isActive: true}}), 1);
      assert.equal((await tx.season.findUniqueOrThrow({where: {id: season.id}})).isActive, false);
      assert.equal(next.isActive, true);
      const weight = await tx.weightClass.create({data: {name: prefix, kilograms: 65}});
      const user = await tx.user.create({data: {email: `${prefix}@example.invalid`, passwordHash: 'not-a-password', role: 'ADMIN'}});
      const a = await tx.athlete.create({data: {firstName: 'A', lastName: prefix, city: 'test', weightClassId: weight.id}});
      const b = await tx.athlete.create({data: {firstName: 'B', lastName: prefix, city: 'test', weightClassId: weight.id}});
      const event = await tx.event.create({data: {name: prefix, slug: prefix, venue: 'test', startsAt: new Date('2026-01-01'), seasonId: season.id}});
      const base = {seasonId: season.id, eventId: event.id, weightClassId: weight.id, athleteAId: a.id, athleteBId: b.id, isTitleFight: true};
      const first = await tx.match.create({data: {...base, scheduledAt: new Date('2026-01-01')}});
      const second = await tx.match.create({data: {...base, scheduledAt: new Date('2026-02-01')}});
      matchId = first.id;
      const result = resultSchema.parse({winnerId: a.id, method: 'PIN', athleteAPoints: 4, athleteBPoints: 0});
      await changeResult(tx, first.id, result, user.id);
      await changeResult(tx, second.id, result, user.id);
      await changeResult(tx, second.id, result, user.id);
      assert.equal((await tx.championship.findFirstOrThrow({where: {weightClassId: weight.id, isCurrent: true}})).defenses, 1);
      await changeResult(tx, first.id, {...result, winnerId: b.id}, user.id);
      assert.equal(await tx.championship.count({where: {weightClassId: weight.id}}), 2);
      await changeResult(tx, second.id, null, user.id);
      assert.equal((await tx.championship.findFirstOrThrow({where: {weightClassId: weight.id, isCurrent: true}})).athleteId, b.id);
      await changeResult(tx, first.id, null, user.id);
      assert.equal(await tx.championship.count({where: {weightClassId: weight.id}}), 0);
      assert.equal(await tx.ranking.count({where: {weightClassId: weight.id}}), 0);
      assert.equal(await tx.matchScore.count({where: {matchId: first.id}}), 0);
      // Reject an out-of-contract direct write too; it proves the SQL partial index exists.
      await assert.rejects(tx.season.create({data: {name: `${prefix}-illegal`, startsAt: new Date(), isActive: true}}));
      throw rollback;
    }, {timeout: 30000}), error => error === rollback);
    assert.equal(await db.match.count({where: {id: matchId}}), 0);
    assert.equal(await db.season.count({where: {name: prefix}}), 0);
  } finally {await db.$disconnect();}
});
