import {openTestDatabase} from './test-database.js';
import {workspaceRoot} from '../src/env.js';
import {existsSync, readFileSync, writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import bcrypt from 'bcryptjs';

if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) throw new Error('Browser API must use the verified test database.');
const db = await openTestDatabase();
try {
  const path = join(workspaceRoot, '.local', 'browser-admin.json');
  const credentials = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as {email: string; password: string}
    : {email: process.env.BROWSER_TEST_ADMIN_EMAIL || 'stage2-admin@kfl.test', password: randomBytes(24).toString('hex')};
  const existing = await db.user.findUnique({where: {email: credentials.email}});
  if (existing) {
    if (existing.role !== 'ADMIN' || !await bcrypt.compare(credentials.password, existing.passwordHash)) {
      throw new Error('Existing browser test account does not match; no password was changed.');
    }
  } else {
    await db.user.create({data: {email: credentials.email, passwordHash: await bcrypt.hash(credentials.password, 12), role: 'ADMIN'}});
    mkdirSync(join(workspaceRoot,'.local'),{recursive:true});
    if(!existsSync(path))writeFileSync(path, JSON.stringify(credentials), {mode: 0o600, flag: 'wx'});
  }
  console.log('Dedicated local browser administrator is ready. Credentials are stored only in .local/browser-admin.json.');
} finally {await db.$disconnect();}
