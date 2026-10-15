import {readFileSync} from 'node:fs';
import {resolve,relative,sep} from 'node:path';
import assert from 'node:assert/strict';
import {openTestDatabase} from './test-database.js';
import {workspaceRoot} from '../src/env.js';
const backupPath=resolve(process.argv[2]??'');
const backupRoot=resolve(workspaceRoot,'.local','backups');
if(!relative(backupRoot,backupPath)||relative(backupRoot,backupPath).startsWith('..'+sep))throw new Error('Choose an existing backup under .local/backups');
const backup=JSON.parse(readFileSync(backupPath,'utf8'));
const db=await openTestDatabase();
try{
 const report:Record<string,number>={};
 for(const table of ['Athlete','Season','WeightClass','Event','Match','MatchScore','Ranking','RankingSnapshot','Championship','Application']){
  const originals=backup[table] as Record<string,unknown>[];
  const current=JSON.parse(JSON.stringify(await db.$queryRawUnsafe(`SELECT * FROM "${table}"`))) as Record<string,unknown>[];
  const byId=new Map(current.map(row=>[row.id,row]));
  for(const row of originals){const found=byId.get(row.id);assert.ok(found,`${table}: original record missing`);for(const [key,value] of Object.entries(row))assert.deepEqual(found[key],value,`${table}.${key}: original value changed`);}
  report[table]=originals.length;
 }
 console.log('Original records and field values preserved:',report);
}finally{await db.$disconnect();}
