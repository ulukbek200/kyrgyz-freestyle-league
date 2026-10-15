import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {openTestDatabase} from './test-database.js';
import {workspaceRoot} from '../src/env.js';

const db=await openTestDatabase();
try {
  // Raw SQL works both before and after the additive migration.
  const report:Record<string,unknown>={createdAt:new Date().toISOString(),purpose:'Local U17/U23 migration backup and manual review'};
  for(const table of ['Athlete','Season','WeightClass','Event','Match','MatchScore','Ranking','RankingSnapshot','Championship','Application']){
    report[table]=await db.$queryRawUnsafe(`SELECT * FROM "${table}"`);
  }
  const directory=join(workspaceRoot,'.local','backups');mkdirSync(directory,{recursive:true});
  const file=join(directory,`divisions-${new Date().toISOString().replaceAll(':','-')}.json`);
  writeFileSync(file,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
  console.log('Local backup:',file);
  console.log('Counts:',Object.fromEntries(Object.entries(report).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,(v as unknown[]).length])));
  console.log('Review legacy seasons (explicit year), events/matches (division), category mappings and applications lacking season. No historic division inferred.');
}finally{await db.$disconnect();}
