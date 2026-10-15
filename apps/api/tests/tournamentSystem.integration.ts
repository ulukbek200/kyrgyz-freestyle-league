import '../src/env.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync,type ChildProcess} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';

test('group tournament: isolated PostgreSQL, API restart and full sixteen-athlete playoff',async t=>{
 const value=process.env.TOURNAMENT_TEST_DATABASE_URL;if(!value)throw new Error('TOURNAMENT_TEST_DATABASE_URL is required; working DATABASE_URL is never used');
 const url=new URL(value);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/kfl_tournament_test');
 const owner=new PrismaClient({datasourceUrl:url.href});
 const [identity]=await owner.$queryRaw<{purpose:string}[]>`SELECT shobj_description(oid,'pg_database') AS purpose FROM pg_database WHERE datname=current_database()`;
 assert.equal(identity.purpose,'KFL_TOURNAMENT_TEST_ONLY');
 const schema='kfl_groups_'+randomUUID().replaceAll('-','');url.searchParams.set('schema',schema);
 let db:PrismaClient|undefined,child:ChildProcess|undefined;
 const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:4452/api';let token='';
 async function start(){
  child=spawn(process.execPath,['--import','tsx','src/server.ts'],{cwd:root,env:{...process.env,DATABASE_URL:url.href,PORT:'4452'},stdio:'ignore',windowsHide:true});
  for(let i=0;i<100;i++){if(child.exitCode!==null)throw new Error('Isolated API exited');try{if((await fetch(base+'/health')).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Isolated API not ready');
 }
 async function stop(){if(child&&child.exitCode===null){const done=new Promise<void>(r=>child!.once('exit',()=>r()));child.kill();await done;}child=undefined;}
 async function req(method:string,path:string,data?:unknown,status=200){const response=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(data===undefined?{}:{'Content-Type':'application/json'})},body:data===undefined?undefined:JSON.stringify(data)});const body=await response.json();assert.equal(response.status,status,method+' '+path+': '+JSON.stringify(body));return body as any;}
 try{
  await owner.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const migrated=spawnSync(process.execPath,[createRequire(import.meta.url).resolve('prisma/build/index.js'),'migrate','deploy','--schema','prisma/schema.prisma'],{cwd:root,env:{...process.env,DATABASE_URL:url.href},encoding:'utf8'});assert.equal(migrated.status,0,'Migrations must deploy');
  db=new PrismaClient({datasourceUrl:url.href});const password=randomUUID();await db.user.create({data:{email:'groups@example.invalid',passwordHash:await bcrypt.hash(password,4),role:'ADMIN'}});
  await start();token=(await req('POST','/auth/login',{email:'groups@example.invalid',password})).token;
  const year=new Date().getUTCFullYear(),weight=await db.weightClass.findFirstOrThrow({where:{ageDivision:'U23',kilograms:74}});
  let season:any,event:any,groups:any[],state:any;
  const path=()=>`/events/${event.id}/competition/${weight.id}`;
  const score=(winnerId:string)=>({winnerId,method:'DECISION',athleteAPoints:4,athleteBPoints:2});
  await t.test('optional season association preserves independent athletes',async()=>{
   season=await req('POST','/admin/competition/seasons',{name:'Cycle '+randomUUID(),startsAt:`${year}-01-01`,endsAt:`${year}-12-31`,status:'LIVE'},201);
   event=await req('POST','/admin/events',{name:'Naryn integration',city:'Naryn',venue:'Arena',startsAt:`${year}-10-17T10:00:00Z`,ageDivision:'U23',weightClassIds:[weight.id],seasonId:season.id},201);
   groups=[];for(const name of ['A','B','C','D']){const ids=[];for(let n=1;n<=6;n++){const athlete=await req('POST','/admin/athletes',{firstName:name+n,lastName:'Group',city:'Naryn',dateOfBirth:`${year-20}-01-01`,weightClassId:weight.id},201);ids.push(athlete.id);await req('POST',`/admin/events/${event.id}/participants`,{athleteId:athlete.id,weightClassId:weight.id},201);}groups.push({name,athleteIds:ids});}
   assert.equal(await db!.athleteSeasonRegistration.count(),0);assert.equal((await req('GET','/competition/seasons')).find((s:any)=>s.id===season.id).events[0].id,event.id);
  });
  const payload=()=>({groups,startsAt:event.startsAt,intervalMinutes:6});
  await t.test('preview has no writes; concurrent generation creates exactly 60 bouts',async()=>{
   assert.equal((await req('POST','/admin'+path()+'/preview',payload())).total,60);assert.equal(await db!.match.count(),0);
   const duplicate=structuredClone(groups);duplicate[1].athleteIds[0]=duplicate[0].athleteIds[0];await req('POST','/admin'+path()+'/preview',{...payload(),groups:duplicate},400);
   for(const invalid of [duplicate,groups.map((g:any,i:number)=>({...g,athleteIds:i===0?[g.athleteIds[0],g.athleteIds[0],...g.athleteIds.slice(2)]:g.athleteIds}))]){
    const error=await req('POST','/admin'+path()+'/groups',{...payload(),groups:invalid},400);assert.match(error.error,/одно место/);
   }
   await req('POST','/admin'+path()+'/groups',{...payload(),groups:groups.map((g:any,i:number)=>i===0?{...g,athleteIds:g.athleteIds.slice(1)}:g)},400);
   const outsider=structuredClone(groups);outsider[0].athleteIds[0]='not-registered-in-category';await req('POST','/admin'+path()+'/groups',{...payload(),groups:outsider},400);
   assert.equal(await db!.match.count(),0);assert.equal(await db!.tournamentFormat.count(),0);
   const concurrent=await Promise.all([1,2].map(()=>fetch(base+'/admin'+path()+'/groups',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload())})));
   assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);
   state=await req('GET',path());assert.equal(state.bouts.length,60);assert.equal(await db!.match.count(),60);
   await req('POST','/admin'+path()+'/playoff',{hash:state.hash,confirm:true},409);
  });
  await t.test('public events and schedule filter real categories, rounds, groups and statuses',async()=>{
   const listed=(await req('GET','/events')).find((e:any)=>e.id===event.id);
   assert.equal(listed.name,event.name);assert.equal(listed.currentRound,1);assert.equal(listed.weightClasses.length,1);
   const filter=`/matches?eventId=${event.id}&weightClassId=${weight.id}`;
   assert.equal((await req('GET',filter+'&round=1')).total,12);
   const group=await req('GET',filter+'&round=1&group=A&status=UPCOMING');assert.equal(group.total,3);
   assert.equal(new Set(group.data.flatMap((m:any)=>[m.athleteAId,m.athleteBId])).size,6);
   assert.equal((await req('GET',filter+'&round=6')).total,0);
   assert.equal((await req('GET',filter+'&status=COMPLETED')).total,0);
   assert.equal((await req('GET',`/matches?eventId=${event.id}&weightClassId=missing`)).total,0);
   await req('GET',filter+'&round=10',undefined,400);await req('GET',filter+'&group=E',undefined,400);
   const live=state.bouts.find((b:any)=>b.round===2).match;
   await req('PATCH','/admin/competition/matches/'+live.id+'/status',{status:'LIVE',reason:'Start scheduled round'});
   assert.equal((await req('GET','/events')).find((e:any)=>e.id===event.id).currentRound,2);
   await req('PATCH','/admin/competition/matches/'+live.id+'/status',{status:'UPCOMING',reason:'Return fixture to schedule'});
  });
  await t.test('cancellation/reopening and immutable generated pair',async()=>{
   const m=state.bouts[0].match;await req('PATCH','/admin/competition/matches/'+m.id+'/status',{status:'CANCELLED',reason:'Test cancellation'});await req('POST','/admin/matches/'+m.id+'/result',score(m.athleteAId),409);
   await req('PATCH','/admin/competition/matches/'+m.id+'/status',{status:'UPCOMING',reason:'Resume scheduled match'});
   await req('PATCH','/admin/matches/'+m.id,{eventId:event.id,weightClassId:weight.id,athleteAId:m.athleteAId,athleteBId:m.athleteBId,ageDivision:'U23',scheduledAt:m.scheduledAt,status:'UPCOMING'},409);
  });
  await t.test('all 60 results, repeat, correction reason and separate group points',async()=>{
   for(const b of state.bouts){const ids=groups.find(g=>g.name===b.groupName).athleteIds;const winner=ids.indexOf(b.match.athleteAId)<ids.indexOf(b.match.athleteBId)?b.match.athleteAId:b.match.athleteBId;await req('POST','/admin/matches/'+b.match.id+'/result',score(winner));}
   state=await req('GET',path());assert.ok(state.complete);assert.equal(state.tables.A[0].wins,5);assert.equal(state.tables.A[0].points,15);assert.equal(state.tables.A[5].points,5);
   const b=state.bouts[0].match;await req('POST','/admin/matches/'+b.id+'/result',score(b.winnerId));
   await req('POST','/admin/matches/'+b.id+'/result',{...score(b.winnerId),method:'PIN'},400);
   await req('POST','/admin/matches/'+b.id+'/result',{...score(b.winnerId),method:'PIN',correctionReason:'Correct method from protocol'});
   await req('POST','/admin/matches/'+b.id+'/result',{...score(b.winnerId),correctionReason:'Restore protocol method'});
   assert.equal((await req('GET',path())).tables.A[5].points,5);
   const global=await req('GET','/rankings?weightClassId='+weight.id);assert.equal(global.find((r:any)=>r.athleteId===groups[0].athleteIds[5]).points,0);
   await req('POST','/admin'+path()+'/reset',{reason:'Attempt unsafe regrouping'},409);
  });
  await t.test('confirmation, transparent seeding and idempotent bracket generation',async()=>{
   state=await req('GET',path());await req('POST','/admin'+path()+'/confirm',{hash:'stale',reason:'Verified protocol'},409);
   await db!.$executeRawUnsafe(`CREATE FUNCTION fail_group_confirmation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'CONFIRM_GROUP_STANDINGS' THEN RAISE EXCEPTION 'injected audit failure'; END IF; RETURN NEW; END $$`);
   await db!.$executeRawUnsafe(`CREATE TRIGGER fail_group_audit BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION fail_group_confirmation()`);
   await req('POST','/admin'+path()+'/confirm',{hash:state.hash,reason:'Verified protocol'},500);
   assert.equal((await req('GET',path())).confirmed,false);
   await db!.$executeRawUnsafe(`DROP TRIGGER fail_group_audit ON "AuditLog"`);await db!.$executeRawUnsafe(`DROP FUNCTION fail_group_confirmation()`);
   await req('POST','/admin'+path()+'/confirm',{hash:state.hash,reason:'Verified protocol'});
   await req('POST','/admin'+path()+'/playoff',{hash:state.hash,confirm:true},201);await req('POST','/admin'+path()+'/playoff',{hash:state.hash,confirm:true},409);
   state=await req('GET',path());assert.equal(state.bouts.filter((b:any)=>b.phase==='PLAYOFF').length,15);assert.equal(state.bouts.filter((b:any)=>b.phase==='PLAYOFF'&&b.match).length,8);
   const selected=state.bouts.filter((b:any)=>b.phase==='PLAYOFF'&&b.round===1).flatMap((b:any)=>[b.match.athleteAId,b.match.athleteBId]);assert.equal(new Set(selected).size,16);assert.ok(groups.every(g=>g.athleteIds.slice(4).every((id:string)=>!selected.includes(id))));
   assert.equal((await req('GET',`/matches?eventId=${event.id}&round=6`)).total,8);
   assert.equal((await req('GET','/events')).find((e:any)=>e.id===event.id).currentRound,6);
  });
  await t.test('API process restart preserves groups, confirmations and bracket',async()=>{
   const before=JSON.stringify(state);await stop();await start();assert.equal(JSON.stringify(await req('GET',path())),before);
  });
  await t.test('automatic advancement, dependency rejection and rollback',async()=>{
   for(let round=1;round<=4;round++){
    state=await req('GET',path());const bouts=state.bouts.filter((b:any)=>b.phase==='PLAYOFF'&&b.round===round);assert.equal(bouts.length,16/2**round);
    for(const b of bouts){assert.ok(b.match);await req('POST','/admin/matches/'+b.match.id+'/result',score(b.match.athleteAId));}
   }
   state=await req('GET',path());assert.equal(state.bouts.filter((b:any)=>b.match?.status==='COMPLETED').length,75);
   const first=state.bouts.find((b:any)=>b.phase==='PLAYOFF'&&b.round===1),before=await db!.match.findUnique({where:{id:first.match.id}});
   await req('POST','/admin/matches/'+first.match.id+'/result',{...score(first.match.athleteBId),correctionReason:'Correct earlier winner'},409);
   assert.deepEqual(await db!.match.findUnique({where:{id:first.match.id}}),before);
   await req('DELETE','/admin/matches/'+state.bouts[0].match.id+'/result',{reason:'Attempt group correction'},409);
  });
  await t.test('cancel backwards, correct a group, retain old pairs, reconfirm and regenerate',async()=>{
   for(let round=4;round>=1;round--){state=await req('GET',path());for(const b of state.bouts.filter((b:any)=>b.phase==='PLAYOFF'&&b.round===round&&b.match?.status==='COMPLETED'))await req('DELETE','/admin/matches/'+b.match.id+'/result',{reason:'Protocol review before group correction'});}
   state=await req('GET',path());const group=state.bouts.find((b:any)=>b.phase==='GROUP');await req('DELETE','/admin/matches/'+group.match.id+'/result',{reason:'Review group protocol'});
   state=await req('GET',path());assert.equal(state.confirmed,false);assert.equal(state.bouts.filter((b:any)=>b.phase==='PLAYOFF').length,0);assert.ok(await db!.match.count({where:{status:'CANCELLED'}})>0);
   await req('POST','/admin/matches/'+group.match.id+'/result',score(group.match.winnerId));state=await req('GET',path());await req('POST','/admin'+path()+'/confirm',{hash:state.hash,reason:'Reviewed all protocols'});await req('POST','/admin'+path()+'/playoff',{hash:state.hash,confirm:true},201);
   assert.ok(await db!.auditLog.count({where:{action:'INVALIDATE_PLAYOFF'}})>0);
  });
  await t.test('three-way tie requires an explicit audited administrative order',async()=>{
   state=await req('GET',path());const ids=groups[0].athleteIds;
   const bout=state.bouts.find((b:any)=>b.phase==='GROUP'&&b.groupName==='A'&&[b.match.athleteAId,b.match.athleteBId].includes(ids[0])&&[b.match.athleteAId,b.match.athleteBId].includes(ids[2]));
   await req('POST','/admin/matches/'+bout.match.id+'/result',{...score(ids[2]),correctionReason:'Protocol establishes three-way tie'});
   state=await req('GET',path());assert.equal(state.tables.A.filter((r:any)=>r.rank===null).length,3);
   await req('POST','/admin'+path()+'/confirm',{hash:state.hash,reason:'No explicit decision'},409);
   await req('POST','/admin'+path()+'/confirm',{hash:state.hash,orders:{A:[ids[5],ids[1],ids[0],ids[3],ids[4],ids[2]]},reason:'Attempt to override earned places'},400);
   await req('POST','/admin'+path()+'/confirm',{hash:state.hash,orders:{A:[ids[2],ids[1],ids[0],...ids.slice(3)]},reason:'Judges decision recorded in protocol'});
   state=await req('GET',path());assert.equal(state.tables.A[0].athleteId,ids[2]);assert.equal(state.confirmed,true);
   const log=await db!.auditLog.findFirst({where:{action:'CONFIRM_GROUP_STANDINGS'},orderBy:{createdAt:'desc'}});assert.match(JSON.stringify(log?.metadata),/Judges decision/);
  });
 }finally{await stop();await db?.$disconnect();await owner.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await owner.$disconnect();}
});
