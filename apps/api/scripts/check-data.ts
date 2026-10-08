import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main() {
  const checks = await prisma.$queryRaw<Array<{ problem: string; count: bigint }>>`
    SELECT 'event_season_mismatch' AS problem, count(*) FROM "Match" m JOIN "Event" e ON e.id=m."eventId" WHERE m."seasonId"<>e."seasonId"
    UNION ALL SELECT 'same_athlete', count(*) FROM "Match" WHERE "athleteAId"="athleteBId"
    UNION ALL SELECT 'invalid_winner', count(*) FROM "Match" WHERE "winnerId" IS NOT NULL AND "winnerId" NOT IN ("athleteAId","athleteBId")
    UNION ALL SELECT 'incomplete_result', count(*) FROM "Match" WHERE status='COMPLETED' AND ("winnerId" IS NULL OR method IS NULL OR "scoreA" IS NULL OR "scoreB" IS NULL)
    UNION ALL SELECT 'orphan_application', count(*) FROM "Application" a LEFT JOIN "Athlete" b ON a."athleteId"=b.id WHERE a."athleteId" IS NOT NULL AND b.id IS NULL
    UNION ALL SELECT 'duplicate_application_athlete', count(*) FROM (SELECT "athleteId" FROM "Application" WHERE "athleteId" IS NOT NULL GROUP BY "athleteId" HAVING count(*)>1) t
    UNION ALL SELECT 'negative_score', count(*) FROM "Match" WHERE "scoreA"<0 OR "scoreB"<0 OR "penaltiesA"<0 OR "penaltiesB"<0
  `;
  console.table(checks.map(c => ({ problem: c.problem, count: Number(c.count) })));
  console.log('Source counts', { athletes: await prisma.athlete.count(), matches: await prisma.match.count(), applications: await prisma.application.count() });
  if (checks.some(c => c.count > 0)) process.exitCode = 1;
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
