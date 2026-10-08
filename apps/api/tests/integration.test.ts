import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { prisma } from '../src/lib/prisma';
import { app } from '../src/app';
import { env } from '../src/env';

if (!process.env.TEST_SCHEMA?.startsWith('hardening_test_') || new URL(process.env.DATABASE_URL!).searchParams.get('schema') !== process.env.TEST_SCHEMA)
  throw new Error('Integration tests must use the isolated-schema runner');
let server: ReturnType<typeof app.listen>, base: string, token: string, userId: string;
before(async () => {
  const user = await prisma.user.create({ data: { name: 'Test admin', email: 'integration@example.test', passwordHash: 'not-used', role: 'ADMIN' } });
  userId = user.id; token = jwt.sign({ id: user.id, role: 'ADMIN' }, env.JWT_SECRET);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${(server.address() as any).port}/api`;
});
after(async () => { server?.close(); await prisma.$disconnect(); });
async function req(method: string, path: string, data?: any, auth = true, expected = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  const body = await r.json(); assert.equal(r.status, expected, `${method} ${path}: ${JSON.stringify(body)}`); return body as any;
}
let seq = 0;
test('phase2 filters and sorting use public career records before pagination', async () => {
  const f = await fixture(), m = await f.create(), b = f.athletes[1];
  await req('POST', `/admin/matches/${m.id}/result`, f.result(b.id));
  await req('PATCH', `/admin/athletes/${b.id}`, { country: 'KZ', city: 'Almaty' });
  const list = await req('GET', `/athletes?seasonId=${f.season.id}&sort=wins&limit=1`, undefined, false);
  assert.equal(list.total, 3); assert.equal(list.items[0].id, b.id); assert.equal(list.items[0].stats.record, '1–0');
  const filtered = await req('GET', `/athletes?seasonId=${f.season.id}&country=KZ&city=Almaty`, undefined, false);
  assert.equal(filtered.total, 1);
  const profile = await req('GET', `/athletes/${b.id}`, undefined, false);
  assert.equal(profile.stats.recentForm[0].result, 'W'); assert.equal(profile.latestMatch.id, m.id);
});
test('phase2 result confirmations and historical context come from committed data', async () => {
  const f = await fixture(), m = await f.create();
  const saved = await req('POST', `/admin/matches/${m.id}/result`, f.result());
  assert.deepEqual(saved.updates, { resultSaved: true, rankingsUpdated: true, championshipUpdated: false });
  const event = await req('POST', '/admin/events', { name: 'Context event', seasonId: f.season.id, date: '2026-02-01', isPublished: true }, true, 201);
  const next = await f.create({ eventId: event.id, scheduledAt: '2026-02-01T10:00:00Z', type: 'CHAMPIONSHIP' });
  const detail = await req('GET', `/matches/${next.id}`, undefined, false);
  assert.equal(detail.context[f.athletes[0].id].stats.record, '1–0');
  assert.equal(detail.context[f.athletes[0].id].rankingBefore, 1);
  const title = await req('POST', `/admin/matches/${next.id}/result`, f.result());
  assert.equal(title.updates.championshipUpdated, true);
  const ranks = await req('GET', `/rankings?seasonId=${f.season.id}&weightClassId=${f.wc.id}`, undefined, false);
  assert.equal(typeof ranks.rules.winPoints, 'number');
});
test('phase2 media detail and expanded search respect publication', async () => {
  const f = await fixture(), m = await f.create();
  const title = `Unique editorial ${f.season.id}`;
  const post = await req('POST', '/admin/media', { title, content: 'Story', category: 'NEWS', isPublished: true, athleteId: f.athletes[0].id }, true, 201);
  assert.equal((await req('GET', `/media/${post.slug}`, undefined, false)).athlete.id, f.athletes[0].id);
  assert.ok((await req('GET', `/search?q=${encodeURIComponent(title)}`, undefined, false)).some((x: any) => x.type === 'media'));
  assert.ok((await req('GET', `/search?q=${encodeURIComponent(f.event.name)}`, undefined, false)).some((x: any) => x.url === `/matches/${m.id}`));
  await req('PATCH', `/admin/media/${post.id}`, { isPublished: false });
  await req('GET', `/media/${post.slug}`, undefined, false, 404);
  assert.ok(!(await req('GET', `/search?q=${encodeURIComponent(title)}`, undefined, false)).some((x: any) => x.type === 'media'));
});
test('phase2 admin directories require authorization and omit password hashes', async () => {
  for (const path of ['/admin/users', '/admin/clubs', '/admin/coaches', '/admin/champions']) {
    await req('GET', path, undefined, false, 401);
    assert.ok(!JSON.stringify(await req('GET', path)).includes('passwordHash'));
  }
});
async function fixture() {
  const n = ++seq;
  const wc = await req('POST', '/admin/weight-classes', { name: `WC ${n}`, maxKg: 70 }, true, 201);
  const wc2 = await req('POST', '/admin/weight-classes', { name: `WC2 ${n}`, maxKg: 90 }, true, 201);
  const season = await req('POST', '/admin/seasons', { name: `Season ${n}`, startDate: '2026-01-01', weightClassIds: [wc.id, wc2.id] }, true, 201);
  const athletes = [];
  for (const name of ['A', 'B', 'C']) {
    const a = await req('POST', '/admin/athletes', { firstName: name, lastName: `Test ${n}`, weightClassId: wc.id }, true, 201);
    await req('POST', `/admin/seasons/${season.id}/athletes`, { athleteId: a.id }); athletes.push(a);
  }
  const event = await req('POST', '/admin/events', { name: `Event ${n}`, seasonId: season.id, date: '2026-01-02', isPublished: true }, true, 201);
  const matchData = { eventId: event.id, weightClassId: wc.id, athleteAId: athletes[0].id, athleteBId: athletes[1].id, scheduledAt: '2026-01-02T10:00:00Z', type: 'REGULAR' };
  const create = (extra = {}) => req('POST', '/admin/matches', { ...matchData, ...extra }, true, 201);
  const result = (winnerId = athletes[0].id) => ({ winnerId, method: 'POINTS', scoreA: winnerId === athletes[0].id ? 3 : 0, scoreB: winnerId === athletes[0].id ? 0 : 3 });
  return { wc, wc2, season, athletes, event, matchData, create, result };
}
test('full workflow: result correction, title correction, archive opponent, next event/match', async () => {
  const f = await fixture(), [a, b, c] = f.athletes;
  const m = await f.create(); await req('POST', `/admin/matches/${m.id}/result`, f.result());
  let r = await req('GET', `/rankings?seasonId=${f.season.id}&weightClassId=${f.wc.id}`, undefined, false);
  assert.equal(r.items.find((r: any) => r.athleteId === a.id).points, 3);
  await req('POST', `/admin/matches/${m.id}/result`, f.result(b.id));
  r = await req('GET', `/rankings?seasonId=${f.season.id}&weightClassId=${f.wc.id}`, undefined, false);
  assert.equal(r.items.find((r: any) => r.athleteId === b.id).wins, 1);
  const title = await f.create({ type: 'CHAMPIONSHIP', scheduledAt: '2026-01-03T10:00:00Z' });
  await req('POST', `/admin/matches/${title.id}/result`, f.result());
  await req('POST', `/admin/matches/${title.id}/result`, f.result(b.id));
  assert.equal((await prisma.championship.findFirstOrThrow({ where: { weightClassId: f.wc.id, isCurrent: true } })).athleteId, b.id);
  await req('DELETE', `/admin/athletes/${a.id}`);
  const winner = await prisma.ranking.findFirstOrThrow({ where: { athleteId: b.id, seasonId: f.season.id } });
  assert.equal(winner.wins, 2); assert.equal(winner.points, 6);
  const history = await req('GET', `/admin/athletes/${a.id}`); assert.equal(history.matches.length, 2);
  const archived = await req('GET', '/admin/athletes?status=ARCHIVED'); assert.ok(archived.items.some((x: any) => x.id === a.id));
  const next = await req('POST', '/admin/events', { name: 'Next', seasonId: f.season.id, date: '2026-02-01' }, true, 201);
  await f.create({ eventId: next.id, athleteAId: b.id, athleteBId: c.id, scheduledAt: '2026-02-01T10:00:00Z' });
});
test('historical snapshots and winner stats survive all current eligibility changes', async () => {
  const f = await fixture(), [a, b] = f.athletes;
  const m = await f.create(); await req('POST', `/admin/matches/${m.id}/result`, f.result());
  for (const data of [{ status: 'SUSPENDED' }, { status: 'RETIRED' }, { status: 'INACTIVE' }, { isArchived: true }, { isArchived: false, status: 'ACTIVE', weightClassId: f.wc2.id }]) {
    await req('PATCH', `/admin/athletes/${b.id}`, data);
    const winner = await prisma.ranking.findFirstOrThrow({ where: { seasonId: f.season.id, weightClassId: f.wc.id, athleteId: a.id } });
    assert.equal(winner.wins, 1); assert.equal(winner.points, 3);
    const snap = await prisma.rankingSnapshot.findFirstOrThrow({ where: { eventId: f.event.id, athleteId: b.id, weightClassId: f.wc.id } });
    assert.equal(snap.losses, 1);
  }
  // Correct a historical result after the opponent changes category.
  await req('POST', `/admin/matches/${m.id}/result`, f.result(b.id));
  assert.equal((await prisma.ranking.findFirstOrThrow({ where: { seasonId: f.season.id, athleteId: a.id } })).losses, 1);
});
test('titles: defense, challenger, idempotency, correction, annulment and deletion', async () => {
  const f = await fixture(), [a, b] = f.athletes;
  const first = await f.create({ type: 'CHAMPIONSHIP' }); await req('POST', `/admin/matches/${first.id}/result`, f.result());
  const defense = await f.create({ type: 'TITLE_DEFENSE', scheduledAt: '2026-01-03T10:00:00Z' });
  await req('POST', `/admin/matches/${defense.id}/result`, f.result());
  await req('POST', `/admin/matches/${defense.id}/result`, f.result());
  assert.equal(await prisma.titleDefense.count({ where: { matchId: defense.id } }), 1);
  await req('POST', `/admin/matches/${defense.id}/result`, f.result(b.id));
  assert.equal(await prisma.championship.count({ where: { weightClassId: f.wc.id } }), 2);
  await req('POST', `/admin/matches/${first.id}/result`, f.result(b.id));
  assert.equal(await prisma.championship.count({ where: { weightClassId: f.wc.id } }), 1);
  assert.equal(await prisma.titleDefense.count({ where: { matchId: defense.id } }), 1);
  await req('PATCH', `/admin/matches/${defense.id}`, { status: 'CANCELLED' });
  assert.equal(await prisma.titleDefense.count({ where: { matchId: defense.id } }), 0);
  await req('DELETE', `/admin/matches/${first.id}`);
  assert.equal(await prisma.championship.count({ where: { weightClassId: f.wc.id } }), 0);
});
test('match moves recalculate both scopes and enforce event/season agreement', async () => {
  const f = await fixture(); const m = await f.create(); await req('POST', `/admin/matches/${m.id}/result`, f.result());
  const target = await req('POST', '/admin/seasons', { name: 'Target', startDate: '2026-02-01', weightClassIds: [f.wc.id] }, true, 201);
  for (const a of f.athletes) await req('POST', `/admin/seasons/${target.id}/athletes`, { athleteId: a.id });
  const event = await req('POST', '/admin/events', { name: 'Target event', seasonId: target.id, date: '2026-02-02' }, true, 201);
  await req('PATCH', `/admin/matches/${m.id}`, { eventId: event.id, seasonId: f.season.id }, true, 400);
  const moved = await req('PATCH', `/admin/matches/${m.id}`, { eventId: event.id }); assert.equal(moved.seasonId, target.id);
  assert.equal((await prisma.ranking.findFirstOrThrow({ where: { seasonId: f.season.id, athleteId: f.athletes[0].id } })).wins, 0);
  assert.equal((await prisma.ranking.findFirstOrThrow({ where: { seasonId: target.id, athleteId: f.athletes[0].id } })).wins, 1);
  assert.equal(await prisma.rankingSnapshot.count({ where: { eventId: f.event.id } }), 0);
  await req('PATCH', `/admin/matches/${m.id}`, { athleteBId: f.athletes[2].id }, true, 409);
  await req('PATCH', `/admin/matches/${m.id}`, { status: 'UPCOMING', athleteBId: f.athletes[2].id });
  assert.equal((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).winnerId, null);
});
test('roster validation rejects equal, missing, wrong-weight, blocked and non-roster athletes', async () => {
  const f = await fixture(), [a, b] = f.athletes;
  for (const extra of [{ athleteBId: a.id }, { athleteBId: 'missing' }, { weightClassId: f.wc2.id }])
    await req('POST', '/admin/matches', { ...f.matchData, ...extra }, true, 400);
  await req('PATCH', `/admin/athletes/${b.id}`, { status: 'SUSPENDED' });
  await req('POST', '/admin/matches', f.matchData, true, 400);
  await req('PATCH', `/admin/athletes/${b.id}`, { status: 'ACTIVE' });
  await req('DELETE', `/admin/seasons/${f.season.id}/athletes/${b.id}`);
  await req('POST', '/admin/matches', f.matchData, true, 400);
  await req('POST', `/admin/seasons/${f.season.id}/athletes`, { athleteId: b.id });
  await f.create(); await req('DELETE', `/admin/seasons/${f.season.id}/athletes/${b.id}`, undefined, true, 409);
});
test('period data survives omission, supports three periods, and rejects inconsistent totals', async () => {
  const f = await fixture(), m = await f.create();
  await req('POST', `/admin/matches/${m.id}/result`, { ...f.result(), notes: null, periods: [{ a: 1, b: 0 }, { a: 1, b: 0 }, { a: 1, b: 0 }] });
  await req('POST', `/admin/matches/${m.id}/result`, { ...f.result(), notes: 'Correction without periods' });
  assert.equal((await req('GET', `/admin/matches/${m.id}`)).periods.length, 3);
  await req('POST', `/admin/matches/${m.id}/result`, { ...f.result(), scoreA: 4 }, true, 400);
  assert.equal((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).scoreA, 3);
});
test('atomic rollback: failure after source change does not leave result, rankings or audit behind', async () => {
  const f = await fixture(), m = await f.create();
  const { submitResult } = await import('../src/modules/matches/matchService');
  await assert.rejects(submitResult(m.id, { ...f.result(), penaltiesA: 0, penaltiesB: 0 } as any, 'missing-audit-user'));
  assert.equal((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).status, 'UPCOMING');
  assert.equal(await prisma.rankingSnapshot.count({ where: { eventId: f.event.id } }), 0);
});
test('application approval is atomic, concurrent and repeated approval create one athlete', async () => {
  const f = await fixture();
  const application = await req('POST', '/applications', { firstName: 'Applicant', lastName: 'Concurrent', birthDate: '2000-01-01', city: 'Bishkek', country: 'KG', phone: '123456', email: 'applicant@example.test', weightKg: 65, agreed: true }, false, 201);
  const { decideApplication } = await import('../src/modules/admin/adminService');
  await assert.rejects(decideApplication(application.id, 'approve', undefined, 'missing-user'));
  assert.equal((await prisma.application.findUniqueOrThrow({ where: { id: application.id } })).athleteId, null);
  assert.equal(await prisma.athlete.count({ where: { lastName: 'Concurrent' } }), 0);
  const results = await Promise.all([req('POST', `/admin/applications/${application.id}/approve`, {}), req('POST', `/admin/applications/${application.id}/approve`, {})]);
  assert.equal(results[0].athleteId, results[1].athleteId);
  assert.equal(await prisma.athlete.count({ where: { lastName: 'Concurrent' } }), 1);
  await req('POST', `/admin/applications/${application.id}/reject`, {}, true, 409);
});
test('publication filtering includes details, search, profiles, rankings, titles and home', async () => {
  const f = await fixture(), m = await f.create({ type: 'CHAMPIONSHIP' });
  await req('POST', `/admin/matches/${m.id}/result`, f.result());
  await req('PATCH', `/admin/events/${f.event.id}`, { isPublished: false });
  await req('GET', `/events/${f.event.id}`, undefined, false, 404);
  await req('GET', `/events/${f.event.slug}`, undefined, false, 404);
  await req('GET', `/matches/${m.id}`, undefined, false, 404);
  assert.equal((await req('GET', `/matches?eventId=${f.event.id}`, undefined, false)).total, 0);
  const profile = await req('GET', `/athletes/${f.athletes[0].id}`, undefined, false);
  assert.equal(profile.matches.length, 0); assert.equal(profile.history.length, 0); assert.equal(profile.championships.length, 0); assert.equal(profile.stats.wins, 0);
  assert.equal((await req('GET', `/rankings?seasonId=${f.season.id}&weightClassId=${f.wc.id}`, undefined, false)).items[0].points, 0);
  for (const path of ['/home', '/events', '/champions', `/seasons/${f.season.id}`, `/search?q=${encodeURIComponent(f.event.name)}`])
    assert.ok(!JSON.stringify(await req('GET', path, undefined, false)).includes(f.event.id), path);
  assert.ok((await req('GET', '/admin/events')).some((e: any) => e.id === f.event.id));
  assert.equal((await req('GET', `/admin/matches/${m.id}`)).id, m.id);
});
test('authorization uses current DB role/status, not stale JWT claims', async () => {
  await req('GET', '/admin/stats', undefined, false, 401);
  await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
  await req('POST', '/admin/weight-classes', { name: 'Forbidden', maxKg: 80 }, true, 401);
  await prisma.user.update({ where: { id: userId }, data: { isActive: true, role: 'MODERATOR' } });
  await req('GET', '/admin/stats', undefined, true, 403);
  await prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
  await req('GET', '/admin/stats');
});
test('media create/edit/publish/unpublish/delete and BACKSTAGE compatibility', async () => {
  const p = await req('POST', '/admin/media', { title: 'Backstage', content: 'Full text', category: 'BACKSTAGE' }, true, 201);
  assert.equal(p.category, 'BEHIND_THE_SCENES');
  assert.ok(!(await req('GET', '/media', undefined, false)).some((m: any) => m.id === p.id));
  await req('PATCH', `/admin/media/${p.id}`, { isPublished: true, content: 'Edited' });
  assert.equal((await req('GET', '/media', undefined, false)).find((m: any) => m.id === p.id).content, 'Edited');
  await req('PATCH', `/admin/media/${p.id}`, { isPublished: false });
  assert.ok(!(await req('GET', '/media', undefined, false)).some((m: any) => m.id === p.id));
  await req('DELETE', `/admin/media/${p.id}`); assert.equal(await prisma.mediaPost.count({ where: { id: p.id } }), 0);
});

test('event move cascades season and rebuilds snapshots; direct inconsistent writes are rejected', async () => {
  const f = await fixture(), m = await f.create({ type: 'CHAMPIONSHIP' });
  await req('POST', `/admin/matches/${m.id}/result`, f.result());
  const target = await req('POST', '/admin/seasons', { name: 'Move whole event', startDate: '2026-01-01', weightClassIds: [f.wc.id] }, true, 201);
  await req('PATCH', `/admin/events/${f.event.id}`, { seasonId: target.id }, true, 400);
  assert.equal((await prisma.event.findUniqueOrThrow({ where: { id: f.event.id } })).seasonId, f.season.id);
  for (const a of f.athletes) await req('POST', `/admin/seasons/${target.id}/athletes`, { athleteId: a.id });
  await req('PATCH', `/admin/events/${f.event.id}`, { seasonId: target.id, date: '2026-03-01' });
  assert.equal((await prisma.match.findUniqueOrThrow({ where: { id: m.id } })).seasonId, target.id);
  assert.equal((await prisma.championship.findFirstOrThrow({ where: { weightClassId: f.wc.id } })).seasonId, target.id);
  assert.equal(await prisma.rankingSnapshot.count({ where: { eventId: f.event.id, seasonId: f.season.id } }), 0);
  await assert.rejects(prisma.match.update({ where: { id: m.id }, data: { seasonId: f.season.id } }));
  await assert.rejects(prisma.match.update({ where: { id: m.id }, data: { athleteBId: m.athleteAId } }));
});

test('weight-class and title-type edits rebuild both old and new projections', async () => {
  const f = await fixture(), m = await f.create({ type: 'CHAMPIONSHIP' });
  await req('POST', `/admin/matches/${m.id}/result`, f.result());
  for (const a of f.athletes) await req('PATCH', `/admin/athletes/${a.id}`, { weightClassId: f.wc2.id });
  await req('PATCH', `/admin/matches/${m.id}`, { weightClassId: f.wc2.id });
  assert.equal(await prisma.championship.count({ where: { weightClassId: f.wc.id } }), 0);
  assert.equal(await prisma.championship.count({ where: { weightClassId: f.wc2.id } }), 1);
  assert.equal(await prisma.rankingSnapshot.count({ where: { eventId: f.event.id, weightClassId: f.wc.id } }), 0);
  await req('PATCH', `/admin/matches/${m.id}`, { type: 'REGULAR' });
  assert.equal(await prisma.championship.count({ where: { weightClassId: f.wc2.id } }), 0);
});

test('concurrent result writes do not lose rankings or duplicate current titles', async () => {
  const f = await fixture(), a = await f.create({ type: 'CHAMPIONSHIP' }), b = await f.create({ type: 'TITLE_DEFENSE', scheduledAt: '2026-01-03T00:00:00Z' });
  await Promise.all([req('POST', `/admin/matches/${a.id}/result`, f.result()), req('POST', `/admin/matches/${b.id}/result`, f.result())]);
  assert.equal((await prisma.ranking.findFirstOrThrow({ where: { seasonId: f.season.id, athleteId: f.athletes[0].id } })).wins, 2);
  assert.equal(await prisma.championship.count({ where: { weightClassId: f.wc.id, isCurrent: true } }), 1);
  assert.equal(await prisma.titleDefense.count({ where: { matchId: b.id } }), 1);
});

test('unpublishing a later title fight restores the public champion without altering admin truth', async () => {
  const f = await fixture(), first = await f.create({ type: 'CHAMPIONSHIP' });
  await req('POST', `/admin/matches/${first.id}/result`, f.result());
  const ev = await req('POST', '/admin/events', { name: 'Private final', seasonId: f.season.id, date: '2026-02-01' }, true, 201);
  const second = await f.create({ eventId: ev.id, type: 'TITLE_DEFENSE', scheduledAt: '2026-02-01T00:00:00Z' });
  await req('POST', `/admin/matches/${second.id}/result`, f.result(f.athletes[1].id));
  await req('PATCH', `/admin/events/${ev.id}`, { isPublished: false });
  const publicTitle = (await req('GET', '/champions', undefined, false)).find((c: any) => c.weightClassId === f.wc.id && c.isCurrent);
  assert.equal(publicTitle.athleteId, f.athletes[0].id); assert.equal(publicTitle.lostAt, null);
  assert.equal((await prisma.championship.findFirstOrThrow({ where: { weightClassId: f.wc.id, isCurrent: true } })).athleteId, f.athletes[1].id);
});
