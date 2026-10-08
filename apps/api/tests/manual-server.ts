import { once } from 'node:events';
import bcrypt from 'bcryptjs';
import express from 'express';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';

if (!/^hardening_test_[0-9a-f]{16}$/.test(process.env.TEST_SCHEMA ?? '') || new URL(process.env.DATABASE_URL!).searchParams.get('schema') !== process.env.TEST_SCHEMA)
  throw new Error('Manual QA requires the isolated schema runner');

async function main() {
  await prisma.user.create({ data: { email: 'qa@example.test', name: 'QA admin', role: 'ADMIN', passwordHash: await bcrypt.hash('qa-local-only-2026', 10) } });
  const wrapper = express();
  wrapper.get('/api/__qa/status', (_req, res) => res.json({ isolated: true, schema: process.env.TEST_SCHEMA }));
  // This route exists only in the isolated loopback QA server, never in src/app.
  wrapper.post('/__qa/finish', (_req, res) => {
    res.json({ ok: true }); server.close(async () => { await prisma.$disconnect(); });
  });
  wrapper.use(app);
  const server = wrapper.listen(4101, '127.0.0.1'); await once(server, 'listening');
  console.log('Manual QA ready: http://127.0.0.1:4101; qa@example.test / qa-local-only-2026');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
