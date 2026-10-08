import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { recalculate } from '../src/modules/rankings/rankingService';
import { applyTitleLogic } from '../src/modules/champions/titleService';

const prisma = new PrismaClient();
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const DAY = 86400000;

const FIRST = ['Azamat', 'Bakyt', 'Eldar', 'Nurlan', 'Ulan', 'Kanat', 'Timur', 'Aibek', 'Marat', 'Ruslan', 'Daniyar', 'Sanzhar'];
const LAST = ['Toktorov', 'Asanov', 'Sydykov', 'Kasymov', 'Abdyraev', 'Osmonov', 'Jumabaev', 'Ismailov'];
const NICK = ['Wolf', 'Bear', 'Storm', 'Falcon', 'Rock', 'Steel', 'Hawk', 'Ghost'];
const CITIES = ['Bishkek', 'Osh', 'Karakol', 'Jalal-Abad', 'Naryn', 'Talas'];

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'yes') throw new Error('Seed clears league data. Set ALLOW_DESTRUCTIVE_SEED=yes only for a disposable database.');
  await prisma.$transaction([
    prisma.titleDefense.deleteMany(), prisma.championship.deleteMany(), prisma.rankingSnapshot.deleteMany(),
    prisma.ranking.deleteMany(), prisma.matchScore.deleteMany(), prisma.match.deleteMany(),
    prisma.seasonAthlete.deleteMany(), prisma.mediaPost.deleteMany(), prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(), prisma.application.deleteMany(), prisma.athlete.deleteMany(),
    prisma.event.deleteMany(), prisma.season.deleteMany(), prisma.coach.deleteMany(),
    prisma.club.deleteMany(), prisma.weightClass.deleteMany(), prisma.user.deleteMany(),
  ]);

  const admin = await prisma.user.create({
    data: { email: 'admin@league.kg', name: 'Администратор', role: 'ADMIN', passwordHash: await bcrypt.hash('admin12345', 10) },
  });

  const clubs = await Promise.all(
    ['Ala-Too Wrestling', 'Manas Team', 'Issyk-Kul Fighters', 'Osh Champions'].map((name, i) =>
      prisma.club.create({ data: { name, city: CITIES[i] } })),
  );
  const coaches = await Promise.all(
    ['Эркин Бекмуратов', 'Талант Исаков', 'Сергей Ким', 'Нурбек Алиев'].map((fullName, i) =>
      prisma.coach.create({ data: { fullName, clubId: clubs[i].id } })),
  );
  const wcs = await Promise.all(
    [['65 кг', 65], ['74 кг', 74], ['86 кг', 86]].map(([name, maxKg], i) =>
      prisma.weightClass.create({ data: { name: name as string, maxKg: maxKg as number, sortOrder: i } })),
  );

  const season = await prisma.season.create({
    data: {
      name: 'Season 1', slug: 'season-1', status: 'ACTIVE',
      description: 'Первый сезон лиги вольной борьбы Кыргызстана: три весовые категории, еженедельные события, рейтинг по результатам матчей.',
      startDate: new Date(Date.now() - 30 * DAY),
    },
  });

  const events = [];
  await prisma.seasonWeightClass.createMany({ data: wcs.map(w => ({ seasonId: season.id, weightClassId: w.id })) });
  const offsets = [-21, -14, -7, 7];
  for (let i = 0; i < 4; i++) {
    events.push(await prisma.event.create({
      data: {
        seasonId: season.id, name: `Season 1 — Week ${i + 1}`, slug: `season-1-week-${i + 1}`,
        date: new Date(Date.now() + offsets[i] * DAY), venue: 'Дворец спорта', city: 'Бишкек',
        description: `Неделя ${i + 1} регулярного сезона.`,
        ...(i === 3 ? { ticketUrl: 'https://example.com/tickets', streamUrl: 'https://example.com/live' } : {}),
      },
    }));
  }

  // 24 спортсмена, по 8 в категории
  const byWc: string[][] = [[], [], []];
  for (let i = 0; i < 24; i++) {
    const wi = Math.floor(i / 8);
    const first = FIRST[(i * 5) % 12], last = LAST[i % 8];
    const a = await prisma.athlete.create({
      data: {
        firstName: first, lastName: last, nickname: NICK[(i * 3) % 8], slug: `${slug(`${first}-${last}`)}-${i + 1}`,
        city: CITIES[i % 6], country: 'KG', nationality: 'KG', status: 'ACTIVE',
        birthDate: new Date(1993 + (i % 9), i % 12, 10 + (i % 15)),
        weightClassId: wcs[wi].id, clubId: clubs[i % 4].id, coachId: coaches[i % 4].id,
        achievements: i % 3 === 0 ? ['Чемпион Кыргызстана среди молодёжи', 'Бронза Кубка Центральной Азии'] : ['Призёр республиканских соревнований'],
        bio: `${first} ${last} выступает за клуб ${clubs[i % 4].name}. Атакующий стиль, сильный борьбой в партере.`,
      },
    });
    byWc[wi].push(a.id);
    await prisma.seasonAthlete.create({ data: { seasonId: season.id, athleteId: a.id } });
  }

  // расписание: метод круга, 4 пары за тур
  const rounds = (ids: string[]) => {
    const arr = [...ids]; const out: [string, string][][] = [];
    for (let r = 0; r < 7; r++) {
      out.push(Array.from({ length: 4 }, (_, k) => [arr[k], arr[7 - k]] as [string, string]));
      arr.splice(1, 0, arr.pop()!);
    }
    return out;
  };
  const methods = ['POINTS', 'POINTS', 'POINTS', 'TECHNICAL_SUPERIORITY', 'PIN'] as const;

  for (let w = 0; w < 3; w++) {
    const sched = rounds(byWc[w]);
    for (let e = 0; e < 4; e++) {
      for (let p = 0; p < 4; p++) {
        const [a, b] = sched[e][p];
        const done = e < 3;
        const first = p === 0;
        const type = first && e === 2 ? 'CHAMPIONSHIP' : first && e === 3 ? 'TITLE_DEFENSE' : 'REGULAR';
        const data: any = {
          seasonId: season.id, eventId: events[e].id, weightClassId: wcs[w].id, athleteAId: a, athleteBId: b,
          scheduledAt: new Date(events[e].date.getTime() + p * 3600_000), type,
          status: done ? 'COMPLETED' : 'UPCOMING', referees: ['А. Мамытов', 'Дж. Керимов'],
        };
        if (done) {
          const winnerIsA = rnd() > 0.5;
          const method = methods[Math.floor(rnd() * methods.length)];
          const [ws, ls] = method === 'PIN' ? [4, 0] : method === 'TECHNICAL_SUPERIORITY' ? [12 + Math.floor(rnd() * 4), 0] : [6 + Math.floor(rnd() * 6), Math.floor(rnd() * 5)];
          data.winnerId = winnerIsA ? a : b; data.method = method;
          data.scoreA = winnerIsA ? ws : ls; data.scoreB = winnerIsA ? ls : ws;
          data.periods = { create: [{ period: 1, pointsA: data.scoreA > 3 ? 3 : data.scoreA, pointsB: data.scoreB > 3 ? 3 : data.scoreB },
            { period: 2, pointsA: Math.max(0, data.scoreA - 3), pointsB: Math.max(0, data.scoreB - 3) }] };
        }
        const m = await prisma.match.create({ data });
        if (done) await applyTitleLogic(m, prisma as any);
      }
    }
    await recalculate(season.id, wcs[w].id);
  }

  const posts: [string, string, any][] = [
    ['Лига открывает Season 1', 'Три весовые категории, 24 спортсмена и честный рейтинг: как устроен первый сезон.', 'NEWS'],
    ['Интервью с чемпионом: «Титул нужно защищать каждую неделю»', 'Разговор о подготовке, тренерах и следующем сопернике.', 'INTERVIEW'],
    ['Лучшие моменты Week 3', 'Три чистых туше и один титульный матч — подборка недели.', 'HIGHLIGHT'],
  ];
  for (const [i, [title, excerpt, category]] of posts.entries()) {
    await prisma.mediaPost.create({
      data: { title, excerpt, content: excerpt + ' Полный текст материала будет добавлен редакцией.', category, slug: `post-${i + 1}`,
        isPublished: true, publishedAt: new Date(Date.now() - i * DAY), authorId: admin.id },
    });
  }
  console.log('Seed OK → admin@league.kg / admin12345');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
