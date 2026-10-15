import {openTestDatabase} from './test-database.js';
import {workspaceRoot} from '../src/env.js';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {createRequire} from 'node:module';

// Never rewrite a user-provided database URL or use the working DATABASE_URL.
const mode=process.argv[2]||'all';
if(!['api','browser','all'].includes(mode))throw new Error('Use api, browser or all');
const verified=await openTestDatabase();await verified.$disconnect();
process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
process.env.TOURNAMENT_TEST_DATABASE_URL=process.env.TEST_DATABASE_URL;
process.env.UPLOAD_DIR=join(workspaceRoot,'.local','team-test-uploads');
const require=createRequire(import.meta.url);
function run(args:string[],cwd=workspaceRoot){
 const result=spawnSync(process.execPath,args,{cwd,env:process.env,stdio:'inherit',windowsHide:true});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
// Only the verified dedicated local test DB is migrated, never the working DB.
run([require.resolve('prisma/build/index.js'),'migrate','deploy','--schema','apps/api/prisma/schema.prisma']);
if(mode!=='browser')run(['--import','tsx','--test','--test-concurrency=1','apps/api/tests/api.integration.ts','apps/api/tests/postgres.test.ts','apps/api/tests/tournamentSystem.integration.ts']);
if(mode!=='api'){
 run(['--import','tsx','apps/api/scripts/browser-fixture.ts']);
 run([join(workspaceRoot,'node_modules','@playwright','test','cli.js'),'test','--config','playwright.config.ts',...process.argv.slice(3)],join(workspaceRoot,'apps','web'));
}
