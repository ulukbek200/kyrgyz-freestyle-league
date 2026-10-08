import { publicEventWhere, publicSeasonWhere } from '../modules/public/publication';
import { publicRecords, enrichMatches, matchContext, mediaInclude } from '../modules/public/productViews';
import { getRules } from '../modules/rankings/rankingService';
import { publicRankings, publicChampions, publicAthleteHistory } from '../modules/public/publicViews';
import { rankingProjection } from '../modules/rankings/rankingService';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { h, HttpError, paging, currentSeasonId, athleteBrief } from '../lib/utils';

export const publicRouter = Router();
const evMatchInclude = { orderBy: { scheduledAt: 'asc' as const }, include: { athleteA: athleteBrief, athleteB: athleteBrief, weightClass: true } };
const TYPE_PRIORITY: Record<string, number> = { CHAMPIONSHIP: 0, TITLE_DEFENSE: 1, REGULAR: 2 };
/** Главный бой события: титульный матч, иначе самая тяжёлая категория. */
function pickMain(matches: any[]) {
  return [...matches].sort((a, b) => TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type] || b.weightClass.sortOrder - a.weightClass.sortOrder)[0] ?? null;
}
const withMain = ({ matches, ...e }: any) => ({ ...e, matchCount: matches.length, mainMatch: pickMain(matches) });
const matchInclude = {
  athleteA: athleteBrief, athleteB: athleteBrief, winner: athleteBrief,
  weightClass: true, event: { select: { id: true, name: true, slug: true, date: true } },
} as const;

publicRouter.get('/weight-classes', h(async (_q, res) => {
  res.json(await prisma.weightClass.findMany({ orderBy: { sortOrder: 'asc' } }));
}));

publicRouter.get('/clubs', h(async (_q, res) => res.json(await prisma.club.findMany({ orderBy: { name: 'asc' } }))));

publicRouter.get('/seasons', h(async (_q, res) => {
  res.json(await prisma.season.findMany({ where: publicSeasonWhere, orderBy: { startDate: 'desc' }, include: { _count: { select: { events: { where: publicEventWhere }, athletes: true } } } }));
}));

publicRouter.get('/seasons/:id', h(async (req, res) => {
  const s = await prisma.season.findFirst({
    where: { AND: [publicSeasonWhere, { OR: [{ id: req.params.id }, { slug: req.params.id }] }] },
    include: { events: { where: publicEventWhere, orderBy: { date: 'asc' } }, _count: { select: { athletes: true, matches: { where: { event: publicEventWhere } } } } },
  });
  if (!s) throw new HttpError(404, 'Season not found');
  res.json({ ...s, championships: (await publicChampions()).filter(c => c.seasonId === s.id) });
}));

// ---------- athletes ----------
publicRouter.get('/athletes', h(async (req, res) => {
  const { skip, take, page, limit } = paging(req.query);
  const { weightClassId, city, country, clubId, search, champion, sort = 'name' } = z.object({ weightClassId: z.string().optional(), city: z.string().optional(), country: z.string().optional(), clubId: z.string().optional(), search: z.string().optional(), champion: z.enum(['true','false']).optional(), sort: z.enum(['name','ranking','wins']).optional() }).parse(req.query);
  const seasonId = (req.query.seasonId as string) || (await currentSeasonId());
  const publicTitles = await publicChampions();
  const where: any = {
    isArchived: false, status: { in: ['ACTIVE', 'INACTIVE'] },
    ...(weightClassId && { weightClassId }),
    ...(clubId && { clubId }),
    ...(country && { country: { equals: country, mode: 'insensitive' } }),
    ...(req.query.seasonId && { seasons: { some: { seasonId } } }),
    ...(city && { city: { contains: city, mode: 'insensitive' } }),
    ...(champion === 'true' && { id: { in: publicTitles.filter(c => c.isCurrent).map(c => c.athleteId) } }),
    ...(search && { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }] }),
  };
  const [total, rows] = await Promise.all([
    prisma.athlete.count({ where }),
    prisma.athlete.findMany({
      where, orderBy: [{ weightClass: { sortOrder: 'asc' } }, { lastName: 'asc' }],
      include: {
        club: true, weightClass: true,
        
      },
    }),
  ]);
  const scopes = [...new Set(rows.map(a => a.weightClassId))];
  const rankings = seasonId ? (await Promise.all(scopes.map(w => publicRankings(seasonId, w)))).flat() : [];
  const records = await publicRecords(rows.map(a => a.id));
  const allItems = rows.map(a => ({ ...a, stats: records.get(a.id), ranking: rankings.find(r => r.athleteId === a.id) ?? null, isChampion: publicTitles.some(c => c.athleteId === a.id && c.isCurrent) }));
  allItems.sort((a,b) => (sort === 'ranking' ? (a.ranking?.rank ?? Number.MAX_SAFE_INTEGER) - (b.ranking?.rank ?? Number.MAX_SAFE_INTEGER) : sort === 'wins' ? b.stats!.wins - a.stats!.wins : 0) || a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName) || a.id.localeCompare(b.id));
  const items = allItems.slice(skip, skip + take);
  res.json({ items, total, page, limit });
}));

publicRouter.get('/athletes/:id', h(async (req, res) => {
  const a = await prisma.athlete.findFirst({
    where: { OR: [{ id: req.params.id }, { slug: req.params.id }], isArchived: false, status: { in: ['ACTIVE', 'INACTIVE'] } },
    include: {
      club: true, coach: true, weightClass: true,
      
      videos: true, photos: true, mediaPosts: { where: { isPublished: true } },
    },
  });
  if (!a) throw new HttpError(404, 'Athlete not found');
  const matches = await prisma.match.findMany({
    where: { event: publicEventWhere, OR: [{ athleteAId: a.id }, { athleteBId: a.id }] },
    orderBy: { scheduledAt: 'desc' }, include: matchInclude,
  });
  const snapshots = await publicAthleteHistory(a.id);
  const championships = (await publicChampions()).filter(c => c.athleteId === a.id);
  const currentId = await currentSeasonId();
  const currentSeason = currentId ? await prisma.season.findUnique({ where: { id: currentId } }) : null;
  const seasonIds = [...new Set([...(currentId ? [currentId] : []), ...matches.map(m => m.seasonId)])];
  const rankings = (await Promise.all(seasonIds.map(s => publicRankings(s, a.weightClassId)))).flat().filter(r => r.athleteId === a.id);
  const done = matches.filter((m) => m.status === 'COMPLETED');
  const won = done.filter((m) => m.winnerId === a.id);
  const stats = {
    matches: done.length, wins: won.length, losses: done.length - won.length,
    winRate: done.length ? Math.round((won.length / done.length) * 100) : 0,
    techWins: won.filter((m) => m.method === 'TECHNICAL_SUPERIORITY').length,
    pins: won.filter((m) => m.method === 'PIN').length,
    highestRank: snapshots.length ? Math.min(...snapshots.map((s) => s.rank)) : null,
  };
  const history = snapshots
    .sort((x, y) => +new Date(x.event.date) - +new Date(y.event.date))
    .map((s, i, all) => ({ event: s.event.name, eventId: s.eventId, date: s.event.date, rank: s.rank, points: s.points, seasonId: s.seasonId, weightClassId: s.weightClassId, previousRank: all.slice(0, i).filter(p => p.seasonId === s.seasonId && p.weightClassId === s.weightClassId).at(-1)?.rank ?? null }));
  const record = (await publicRecords([a.id])).get(a.id)!;
  res.json({ ...a, matches, stats: { ...stats, ...record }, history, rankings, currentSeason, currentRanking: rankings.find(r => r.seasonId === currentId) ?? null, nextMatch: matches.filter(m => ['UPCOMING','LIVE'].includes(m.status)).sort((x,y) => +x.scheduledAt - +y.scheduledAt)[0] ?? null, latestMatch: done[0] ?? null, championships, isChampion: championships.some(c => c.isCurrent) });
}));

// ---------- rankings ----------
publicRouter.get('/rankings', h(async (req, res) => {
  const seasonId = (req.query.seasonId as string) || (await currentSeasonId());
  let weightClassId = req.query.weightClassId as string;
  if (!weightClassId) weightClassId = (await prisma.weightClass.findFirst({ orderBy: { sortOrder: 'asc' } }))?.id ?? '';
  if (!seasonId || !weightClassId) return res.json({ items: [], seasonId, weightClassId });
  const [rows, champs] = await Promise.all([
    publicRankings(seasonId, weightClassId),
    publicChampions().then(cs => cs.filter(c => c.weightClassId === weightClassId && c.isCurrent)),
  ]);
  const champIds = new Set(champs.map((c) => c.athleteId));
  const items = rows.map((r) => ({
    ...r, isChampion: champIds.has(r.athleteId),
    winRate: r.wins + r.losses ? Math.round((r.wins / (r.wins + r.losses)) * 100) : 0,
    isNew: r.previousRank === null && r.wins + r.losses > 0,
    movement: r.previousRank ? r.previousRank - r.rank : 0,
  }));
  res.json({ items, seasonId, weightClassId, rules: await getRules(seasonId), champions: (await publicChampions()).filter(c => c.weightClassId === weightClassId && c.isCurrent) });
}));

// ---------- events ----------
publicRouter.get('/events', h(async (req, res) => {
  const seasonId = req.query.seasonId as string | undefined;
  res.json((await prisma.event.findMany({
    where: { ...publicEventWhere, ...(seasonId && { seasonId }) }, orderBy: { date: 'desc' },
    include: { season: { select: { name: true } }, matches: evMatchInclude },
  })).map(withMain));
}));

publicRouter.get('/events/:id', h(async (req, res) => {
  const e = await prisma.event.findFirst({
    where: { ...publicEventWhere, OR: [{ id: req.params.id }, { slug: req.params.id }] },
    include: { season: true, sponsors: true, matches: { orderBy: { scheduledAt: 'asc' }, include: matchInclude } },
  });
  if (!e) throw new HttpError(404, 'Event not found');
  const matches = await enrichMatches(e.matches);
  res.json({ ...e, matches, mainMatch: pickMain(matches), matchCount: matches.length });
}));

// ---------- matches ----------
publicRouter.get('/matches', h(async (req, res) => {
  const { skip, take, page, limit } = paging(req.query);
  const { status, seasonId, weightClassId, eventId } = req.query as Record<string, string>;
  if (status) z.enum(['UPCOMING', 'LIVE', 'COMPLETED', 'CANCELLED']).parse(status.toUpperCase());
  const where: any = {
    event: publicEventWhere,
    ...(status && { status: status.toUpperCase() }),
    ...(seasonId && { seasonId }), ...(weightClassId && { weightClassId }), ...(eventId && { eventId }),
  };
  const order = status?.toUpperCase() === 'UPCOMING' ? 'asc' : 'desc';
  const [total, items] = await Promise.all([
    prisma.match.count({ where }),
    prisma.match.findMany({ where, skip, take, orderBy: { scheduledAt: order }, include: matchInclude }),
  ]);
  res.json({ items, total, page, limit });
}));

publicRouter.get('/matches/:id', h(async (req, res) => {
  const m = await prisma.match.findFirst({
    where: { id: req.params.id, event: publicEventWhere },
    include: { ...matchInclude, periods: { orderBy: { period: 'asc' } } },
  });
  if (!m) throw new HttpError(404, 'Match not found');
  // влияние на рейтинг: место до/после события
  let impact: any = null;
  if (m.status === 'COMPLETED') {
    const { snapshots: snaps } = await rankingProjection(m.seasonId, m.weightClassId, prisma, true);
    impact = {};
    for (const id of [m.athleteAId, m.athleteBId]) {
      const list = snaps.filter((s) => s.athleteId === id);
      const idx = list.findIndex((s) => s.eventId === m.eventId);
      impact[id] = idx >= 0 ? { before: idx > 0 ? list[idx - 1].rank : null, after: list[idx].rank } : null;
    }
  }
  const [enriched] = await enrichMatches([m]);
  const titles = (await publicChampions()).filter(c => c.wonAtMatchId === m.id || c.defenses.some(d => d.matchId === m.id));
  res.json({ ...enriched, impact, impactScope: 'EVENT', context: await matchContext(m), championshipResult: titles[0] ? { athleteId: titles[0].athleteId, isDefense: titles[0].wonAtMatchId !== m.id } : null });
}));

// ---------- champions ----------
publicRouter.get('/champions', h(async (_q, res) => {
  const rows = await publicChampions();
  const records = await publicRecords(rows.map(c => c.athleteId));
  res.json(rows.map(c => ({ ...c, stats: records.get(c.athleteId) })));
}));

// ---------- media ----------
publicRouter.get('/media', h(async (req, res) => {
  const { category } = req.query as Record<string, string>;
  const parsedCategory = category ? z.enum(['NEWS', 'INTERVIEW', 'ATHLETE_STORY', 'HIGHLIGHT', 'BEHIND_THE_SCENES', 'TRAINING', 'FACE_OFF', 'CHAMPIONSHIP', 'BACKSTAGE']).parse(category) : undefined;
  res.json(await prisma.mediaPost.findMany({
    where: { isPublished: true, ...(parsedCategory && { category: parsedCategory === 'BACKSTAGE' ? 'BEHIND_THE_SCENES' : parsedCategory }) },
    orderBy: { publishedAt: 'desc' }, take: 50, include: mediaInclude,
  }));
}));

publicRouter.get('/media/:id', h(async (req, res) => {
  const post = await prisma.mediaPost.findFirst({ where: { isPublished: true, OR: [{ id: req.params.id }, { slug: req.params.id }] }, include: mediaInclude });
  if (!post) throw new HttpError(404, 'Media not found');
  res.json(post);
}));

// ---------- search ----------
publicRouter.get('/search', h(async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  const ci = { contains: q, mode: 'insensitive' as const };
  const [athletes, events, clubs, matches, media] = await Promise.all([
    prisma.athlete.findMany({ where: { isArchived: false, status: { in: ['ACTIVE', 'INACTIVE'] }, OR: [{ firstName: ci }, { lastName: ci }, { nickname: ci }] }, take: 6 }),
    prisma.event.findMany({ where: { name: ci, ...publicEventWhere }, take: 4 }),
    prisma.club.findMany({ where: { name: ci }, take: 3 }),
    prisma.match.findMany({ where: { event: publicEventWhere, OR: [{ event: { name: ci } }, { athleteA: { OR: [{firstName:ci},{lastName:ci}] } }, { athleteB: { OR: [{firstName:ci},{lastName:ci}] } }] }, include: matchInclude, take: 4, orderBy: { scheduledAt: 'desc' } }),
    prisma.mediaPost.findMany({ where: { isPublished: true, OR: [{title:ci},{excerpt:ci}] }, take: 4, orderBy: {publishedAt:'desc'} }),
  ]);
  res.json([
    ...athletes.map((a) => ({ type: 'athlete', label: `${a.firstName} ${a.lastName}`, url: `/athletes/${a.slug}` })),
    ...events.map((e) => ({ type: 'event', label: e.name, url: `/events/${e.slug}` })),
    ...clubs.map((c) => ({ type: 'club', label: c.name, url: `/athletes?clubId=${c.id}` })),
    ...matches.map(m => ({ type: 'match', label: `${m.athleteA.firstName} ${m.athleteA.lastName} — ${m.athleteB.firstName} ${m.athleteB.lastName}`, url: `/matches/${m.id}` })),
    ...media.map(p => ({ type: 'media', label: p.title, url: `/media/${p.slug}` })),
  ]);
}));

// ---------- home ----------
publicRouter.get('/home', h(async (_q, res) => {
  const seasonId = await currentSeasonId();
  const [season, nextEvent, upcoming, results, wcs, champions, media, counts] = await Promise.all([
    seasonId ? prisma.season.findUnique({ where: { id: seasonId } }) : null,
    (async () => {
      const inc = { season: { select: { name: true } }, matches: evMatchInclude };
      const e = await prisma.event.findFirst({ where: { date: { gte: new Date() }, ...publicEventWhere }, orderBy: { date: 'asc' }, include: inc });
      return e ? withMain(e) : null;
    })(),
    prisma.match.findMany({ where: { event: publicEventWhere, status: { in: ['UPCOMING', 'LIVE'] } }, orderBy: { scheduledAt: 'asc' }, take: 6, include: matchInclude }),
    prisma.match.findMany({ where: { event: publicEventWhere, status: 'COMPLETED' }, orderBy: { scheduledAt: 'desc' }, take: 6, include: matchInclude }),
    prisma.weightClass.findMany({ orderBy: { sortOrder: 'asc' } }),
    publicChampions().then(cs => cs.filter(c => c.isCurrent)),
    prisma.mediaPost.findMany({ where: { isPublished: true }, orderBy: { publishedAt: 'desc' }, take: 3 }),
    Promise.all([prisma.athlete.count({ where: { status: 'ACTIVE' } }), prisma.match.count({ where: { event: publicEventWhere, status: 'COMPLETED' } }), prisma.event.count({ where: publicEventWhere })]),
  ]);
  const topRankings = await Promise.all(wcs.map(async (wc) => ({
    weightClass: wc,
    items: seasonId ? (await publicRankings(seasonId, wc.id)).slice(0, 5) : [],
  })));
  const featured = nextEvent?.mainMatch ? (await enrichMatches([nextEvent.mainMatch]))[0] : null;
  const records = await publicRecords(champions.map(c => c.athleteId));
  const rankedGroups = topRankings.map(g => ({ ...g, items: g.items.map(r => ({ ...r, movement: r.previousRank === null ? 0 : r.previousRank - r.rank, isNew: r.previousRank === null && r.wins + r.losses > 0, isChampion: champions.some(c => c.athleteId === r.athleteId && c.weightClassId === g.weightClass.id) })) }));
  res.json({ season, nextEvent, featured, upcoming, results, topRankings: rankedGroups, champions: champions.map(c => ({ ...c, stats: records.get(c.athleteId) })), media, counts: { athletes: counts[0], matches: counts[1], events: counts[2] } });
}));

// ---------- applications (публичная форма) ----------
const applicationSchema = z.object({
  firstName: z.string().min(1).max(80), lastName: z.string().min(1).max(80),
  birthDate: z.coerce.date(), city: z.string().min(1).max(80), country: z.string().min(1).max(80),
  phone: z.string().min(5).max(30), email: z.string().email(), weightKg: z.coerce.number().min(30).max(200),
  club: z.string().max(120).optional(), coach: z.string().max(120).optional(),
  experience: z.string().max(2000).optional(), achievements: z.string().max(2000).optional(),
  socialLinks: z.string().max(500).optional(), videoUrl: z.string().url().max(500).optional().or(z.literal('')),
  photoUrl: z.string().url().max(500).optional().or(z.literal('')), medicalInfo: z.string().max(2000).optional(),
  agreed: z.literal(true),
});
publicRouter.post('/applications', h(async (req, res) => {
  const data = applicationSchema.parse(req.body);
  const app = await prisma.application.create({ data: { ...data, videoUrl: data.videoUrl || null, photoUrl: data.photoUrl || null } });
  await prisma.notification.create({ data: { type: 'NEW_APPLICATION', title: `Новая заявка: ${data.firstName} ${data.lastName}`, payload: { applicationId: app.id } } });
  res.status(201).json({ id: app.id });
}));
