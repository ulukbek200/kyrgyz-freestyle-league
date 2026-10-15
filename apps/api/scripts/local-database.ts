import {openTestDatabase} from './test-database.js';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const db = await openTestDatabase();
const command = process.argv[2] ?? 'check';
try {
  const tables = await db.$queryRaw<{tablename: string}[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
  console.log(`Verified local test database: 127.0.0.1:55432/kfl_stage2_test; ${tables.length} public tables.`);
  if (command === 'deploy') {
    if (tables.length && !tables.some(t => t.tablename === '_prisma_migrations')) {
      throw new Error('Refusing baseline on an existing schema without migration history.');
    }
    const require = createRequire(import.meta.url);
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: {...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL}, stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('Local migration deployment failed');
  } else if (command !== 'check') throw new Error('Use check or deploy');
} finally {await db.$disconnect();}
