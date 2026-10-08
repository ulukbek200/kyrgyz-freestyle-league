// Every run gets its own schema; no seed/reset is ever executed against the user's schema.
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const schema = 'hardening_test_' + randomBytes(8).toString('hex');
const source = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!source) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to a PostgreSQL database permitting CREATE SCHEMA');
const url = new URL(source); url.searchParams.set('schema', schema);
const env = { ...process.env, DATABASE_URL: url.toString(), TEST_SCHEMA: schema, NODE_ENV: 'test', JWT_SECRET: 'isolated-hardening-test-secret' };
const admin = new PrismaClient({ datasources: { db: { url: source } } });
async function main() {
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const migrate = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { env, stdio: 'inherit' });
    if (migrate.status !== 0) throw new Error('Test schema migrations failed');
    const args = process.argv.includes('--manual') ? ['--import', 'tsx', 'tests/manual-server.ts']
      : ['--import', 'tsx', '--test', '--test-concurrency=1', ...(process.argv.includes('--competition-only')
        ? ['tests/competition.integration.test.ts']
        : ['tests/integration.test.ts', 'tests/competition.integration.test.ts'])];
    const run = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    process.exitCode = run.status ?? 1;
  } finally {
    if (!/^hardening_test_[0-9a-f]{16}$/.test(schema)) throw new Error('Unsafe test schema');
    await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.$disconnect();
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
