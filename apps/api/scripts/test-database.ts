import '../src/env.js';
import {PrismaClient} from '@prisma/client';

export async function openTestDatabase() {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) throw new Error('TEST_DATABASE_URL is required; DATABASE_URL is never a fallback.');
  const url = new URL(value);
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/kfl_tournament_test' ||
      url.searchParams.get('schema') !== 'public') {
    throw new Error('Refusing a database outside the dedicated local stage-2 cluster.');
  }
  const db = new PrismaClient({datasourceUrl: value});
  try {
    const [identity] = await db.$queryRaw<{database: string; port: number; purpose: string | null}[]>`
      SELECT current_database() AS database, inet_server_port() AS port,
      shobj_description(oid, 'pg_database') AS purpose FROM pg_database WHERE datname = current_database()`;
    if (identity?.database !== 'kfl_tournament_test' || identity.port !== 55432 || identity.purpose !== 'KFL_TOURNAMENT_TEST_ONLY') {
      throw new Error('Dedicated test database identity marker is missing.');
    }
    return db;
  } catch {
    await db.$disconnect();
    throw new Error('Local test database connection or identity verification failed (credentials omitted).');
  }
}
