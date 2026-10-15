// Optional manual QA server. Never uses the working database as a fallback.
import {openTestDatabase} from '../scripts/test-database.js';
if(process.env.DATABASE_URL!==process.env.TEST_DATABASE_URL)throw new Error('Manual QA requires the dedicated test database');
const verified=await openTestDatabase();await verified.$disconnect();
process.env.PORT='4101';
process.env.WEB_ORIGIN='http://localhost:5173';
await import('../scripts/browser-fixture.js');
await import('../src/server.js');
