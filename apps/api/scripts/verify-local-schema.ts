import {openTestDatabase} from './test-database.js';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

const db = await openTestDatabase();
try {
  const migrations = await db.$queryRaw<{migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null}[]>`
    SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name`;
  const expected=readdirSync(new URL('../prisma/migrations/',import.meta.url),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();
  assert.deepEqual(migrations.map(m => m.migration_name), expected);
  for (const migration of migrations) {
    assert.ok(migration.finished_at); assert.equal(migration.rolled_back_at, null);
    const content = readFileSync(new URL(`../prisma/migrations/${migration.migration_name}/migration.sql`, import.meta.url));
    assert.equal(createHash('sha256').update(content).digest('hex'), migration.checksum);
  }
  const [index] = await db.$queryRaw<{indexdef: string}[]>`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'Season_single_active'`;
  assert.match(index?.indexdef ?? '', /UNIQUE.*WHERE/);
  const triggers = await db.$queryRaw<{count: bigint}[]>`SELECT count(*) FROM pg_trigger WHERE tgname LIKE 'stage2_failure_%'`;
  assert.equal(Number(triggers[0]?.count), 0);
  console.log(`${migrations.length} migration checksums match; partial unique index exists; no fault-injection triggers remain.`);
  const require = createRequire(import.meta.url);
  const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'diff',
    '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), env: {...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL}, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Database/model drift check failed');
} finally {await db.$disconnect();}
