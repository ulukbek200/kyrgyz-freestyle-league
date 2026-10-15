import '../src/env.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import type {AddressInfo,Server} from 'node:net';
import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {openTestDatabase} from '../scripts/test-database.js';
import {bootstrapFirstAdmin} from '../src/bootstrapAdmin.js';

// Fixtures and fault injection are confined to a newly created schema, never public.
test('independent athletes and tournaments: isolated PostgreSQL HTTP API',async t=>{
 const owner=await openTestDatabase(),schema='kfl_it_'+randomUUID().replaceAll('-','');
 assert.match(schema,/^kfl_it_[a-f0-9]{32}$/);
 const url=new URL(process.env.TEST_DATABASE_URL!);url.searchParams.set('schema',schema);
 const previous=process.env.DATABASE_URL;
 let db:PrismaClient|undefined,appDb:PrismaClient|undefined,server:Server|undefined;
 try {
  await owner.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const require=createRequire(import.meta.url);
  const deploy=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema','prisma/schema.prisma'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env:{...process.env,DATABASE_URL:url.toString()},encoding:'utf8'});
  assert.equal(deploy.status,0,'Isolated migration deployment failed');
  db=new PrismaClient({datasourceUrl:url.toString()});process.env.DATABASE_URL=url.toString();
  const {app}=await import('../src/index.js');appDb=(await import('../src/db.js')).prisma;
  const http=app.listen(0,'127.0.0.1');server=http;await once(http,'listening');
  const base=`http://127.0.0.1:${(http.address() as AddressInfo).port}/api`;
  const password=randomUUID(),email='integration@example.invalid';
  await t.test('first administrator bootstrap is explicit, atomic and never overwrites accounts',async()=>{
   const input={email,password,database:url.pathname.slice(1),confirmation:'CREATE_FIRST_ADMIN'};
   await assert.rejects(()=>bootstrapFirstAdmin(db!,{...input,database:'wrong-database'}));assert.equal(await db!.user.count(),0);
   const created=await Promise.all([bootstrapFirstAdmin(db!,input),bootstrapFirstAdmin(db!,input)]);assert.equal(created.filter(v=>v.created).length,1);
   const original=await db!.user.findUniqueOrThrow({where:{email}});
   assert.deepEqual(await bootstrapFirstAdmin(db!,{...input,password:randomUUID()}),{created:false});assert.equal((await db!.user.findUniqueOrThrow({where:{email}})).passwordHash,original.passwordHash);
   await assert.rejects(()=>bootstrapFirstAdmin(db!,{...input,email:'another-admin@example.invalid'}));assert.equal(await db!.user.count(),1);
  });
  let token='',a:any,b:any,c:any,event:any,first:any,defense:any;
  const year=new Date().getUTCFullYear();
  const weight=await db.weightClass.findFirstOrThrow({where:{ageDivision:'U23',kilograms:65}}),junior=await db.weightClass.findFirstOrThrow({where:{ageDivision:'U17',kilograms:65}});
  async function req(method:string,path:string,data?:unknown,expected=200,bearer=token){
   const response=await fetch(base+path,{method,headers:{...(data===undefined?{}:{'Content-Type':'application/json'}),...(bearer?{Authorization:`Bearer ${bearer}`}:{})},body:data===undefined?undefined:JSON.stringify(data)});
   const body=await response.json() as any;assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(body)}`);return body;
  }
  const profile=(name:string)=>({firstName:name,lastName:'Integration',city:'Bishkek',dateOfBirth:`${year-20}-12-31`,weightClassId:weight.id,clubName:'Test club',coachName:'Test coach'});
  const tournament={name:'Integration tournament',city:'Bishkek',venue:'Arena',startsAt:`${year}-08-01T10:00:00Z`,ageDivision:'U23',weightClassIds:[weight.id],status:'PLANNED'};
  const score=(winnerId:string)=>({winnerId,method:'PIN',athleteAPoints:4,athleteBPoints:2});
  await t.test('admin login and protected access',async()=>{
   await req('POST','/auth/login',{email,password:'wrong-password'},401);token=(await req('POST','/auth/login',{email,password})).token;
   await req('GET','/admin/dashboard');await req('GET','/admin/dashboard',undefined,401,'');await req('GET','/admin/dashboard',undefined,401,'invalid');
  });
  await t.test('independent profiles have zero competitions and reuse typed affiliations',async()=>{
   a=await req('POST','/admin/athletes',profile('Alpha'),201);b=await req('POST','/admin/athletes',profile('Beta'),201);c=await req('POST','/admin/athletes',profile('Gamma'),201);
   assert.equal(await db!.season.count(),0);assert.equal(await db!.event.count(),0);assert.equal(await db!.tournamentParticipant.count(),0);
   const row=(await req('GET','/admin/athletes')).data.find((x:any)=>x.id===a.id);
   assert.deepEqual(row._count,{tournamentParticipants:0,matchesAsA:0,matchesAsB:0,wonMatches:0});assert.equal(row.rankings.length,0);
   assert.equal(a.clubId,b.clubId);assert.equal(a.coachId,b.coachId);
   await req('PATCH',`/admin/athletes/${a.id}`,{story:'Independent profile'});
   await req('POST','/admin/athletes',{...profile('Invalid'),weightClassId:junior.id},400);
  });
  await t.test('application approval creates an independent profile and is idempotent',async()=>{
   const body={firstName:'Applicant',lastName:'Integration',birthDate:`${year-20}-01-01`,city:'Bishkek',country:'Kyrgyzstan',phone:'+996555000000',email:'applicant@example.invalid',weightKg:64,weightClassId:weight.id,clubName:'Entered club',coachName:'Entered coach'};
   await req('POST','/applications',{...body,weightKg:66},400);
   const application=await req('POST','/applications',body,201);
   const approved=await req('PATCH',`/admin/applications/${application.id}`,{status:'APPROVED'});
   assert.equal((await req('PATCH',`/admin/applications/${application.id}`,{status:'APPROVED'})).athleteId,approved.athleteId);
   assert.equal(await db!.athlete.count({where:{firstName:'Applicant'}}),1);
   assert.equal(await db!.tournamentParticipant.count({where:{athleteId:approved.athleteId}}),0);
  });
  await t.test('tournament registration rejects duplicates; removal preserves athlete',async()=>{
   event=await req('POST','/admin/events',tournament,201);assert.equal(event.seasonId,null);
   await req('POST',`/admin/events/${event.id}/participants`,{athleteId:a.id,weightClassId:junior.id},400);assert.equal(await db!.tournamentParticipant.count(),0);
   for(const athlete of [a,b,c])await req('POST',`/admin/events/${event.id}/participants`,{athleteId:athlete.id,weightClassId:weight.id},201);
   await req('POST',`/admin/events/${event.id}/participants`,{athleteId:a.id,weightClassId:weight.id},409);
   await req('DELETE',`/admin/events/${event.id}/participants/${c.id}`);assert.ok(await db!.athlete.findUnique({where:{id:c.id}}));
   assert.equal((await req('GET',`/admin/events/${event.id}/participants`)).length,2);
   await req('PATCH',`/admin/events/${event.id}`,{...tournament,startsAt:`${year+1}-08-01T10:00:00Z`},409);
  });
  await t.test('pairing only accepts registered athletes; bouts preserve registration',async()=>{
   const pair={eventId:event.id,ageDivision:'U23',weightClassId:weight.id,athleteAId:a.id,athleteBId:b.id,isTitleFight:true,scheduledAt:`${year}-08-01T10:00:00Z`};
   await req('POST','/admin/matches',{...pair,athleteBId:c.id},400);assert.equal(await db!.match.count(),0);
   first=await req('POST','/admin/matches',pair,201);defense=await req('POST','/admin/matches',{...pair,scheduledAt:`${year}-08-01T11:00:00Z`},201);
   await req('POST','/admin/matches',pair,409);
   await req('POST','/admin/matches',{...pair,athleteAId:b.id,athleteBId:a.id},409);
   await req('PATCH',`/admin/matches/${defense.id}`,{...pair,status:'UPCOMING'},409);
   await req('PATCH',`/admin/matches/${defense.id}`,{...pair,scheduledAt:`${year}-08-01T11:00:00Z`,status:'CANCELLED'});
   await req('POST',`/admin/matches/${defense.id}/result`,score(a.id),409);
   await req('PATCH',`/admin/matches/${defense.id}`,{...pair,scheduledAt:`${year}-08-01T11:00:00Z`,status:'UPCOMING'});
   await req('DELETE',`/admin/events/${event.id}/participants/${a.id}`,undefined,409);
  });
  await t.test('score, standings, championship replay, correction and cancellation',async()=>{
   await req('POST',`/admin/matches/${first.id}/result`,score(a.id));await req('POST',`/admin/matches/${defense.id}/result`,score(a.id));
   await Promise.all([1,2].map(()=>req('POST',`/admin/matches/${defense.id}/result`,score(a.id))));
   assert.equal((await db!.championship.findFirstOrThrow({where:{isCurrent:true}})).defenses,1);
   assert.equal((await req('GET','/rankings')).find((x:any)=>x.athleteId===a.id).points,8);
   assert.equal((await req('GET',`/admin/events/${event.id}/results`))[0].wins,2);
   const row=(await req('GET','/admin/athletes')).data.find((x:any)=>x.id===a.id);assert.equal(row._count.wonMatches,2);
   await req('POST',`/admin/matches/${first.id}/result`,score(b.id));assert.equal(await db!.championship.count(),2);
   assert.equal((await db!.championship.findFirstOrThrow({where:{isCurrent:true}})).defenses,0);
   await req('DELETE',`/admin/matches/${defense.id}/result`);assert.equal((await db!.championship.findFirstOrThrow({where:{isCurrent:true}})).athleteId,b.id);
   await req('DELETE',`/admin/matches/${first.id}/result`);assert.equal(await db!.championship.count(),0);assert.equal(await db!.ranking.count(),0);assert.equal(await db!.matchScore.count(),0);
  });
  await t.test('failure rolls back winner, score, rankings and title atomically',async()=>{
   await db!.$executeRawUnsafe(`CREATE FUNCTION "${schema}".reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'intentional test failure'; END $$`);
   await db!.$executeRawUnsafe(`CREATE TRIGGER reject_result_audit BEFORE INSERT ON "${schema}"."AuditLog" FOR EACH ROW EXECUTE FUNCTION "${schema}".reject_audit()`);
   try{
    const body=await req('POST',`/admin/matches/${first.id}/result`,score(a.id),500);assert.ok(!JSON.stringify(body).includes('intentional test failure'));
    assert.equal((await db!.match.findUniqueOrThrow({where:{id:first.id}})).winnerId,null);
    assert.equal(await db!.matchScore.count(),0);assert.equal(await db!.ranking.count(),0);assert.equal(await db!.championship.count(),0);
   }finally{await db!.$executeRawUnsafe(`DROP TRIGGER reject_result_audit ON "${schema}"."AuditLog"`);}
  });
  await t.test('tournament year determines division and preserves earlier participation',async()=>{
   const young=await req('POST','/admin/athletes',{...profile('Junior'),dateOfBirth:`${year-17}-12-31`,weightClassId:junior.id},201);
   const now=await req('POST','/admin/events',{...tournament,name:'Junior event',ageDivision:'U17',weightClassIds:[junior.id]},201);
   const next=await req('POST','/admin/events',{...tournament,name:'Next year',startsAt:`${year+1}-08-01T10:00:00Z`},201);
   await req('POST',`/admin/events/${now.id}/participants`,{athleteId:young.id,weightClassId:junior.id},201);
   await req('POST',`/admin/events/${next.id}/participants`,{athleteId:young.id,weightClassId:weight.id},201);
   assert.deepEqual((await db!.tournamentParticipant.findMany({where:{athleteId:young.id},orderBy:{createdAt:'asc'}})).map(p=>p.ageDivision),['U17','U23']);
   await req('PATCH',`/admin/athletes/${young.id}`,{dateOfBirth:`${year-18}-01-01`},409);
   for(const path of ['/athletes',`/athletes/${young.id}`,'/matches','/rankings','/champions'])assert.doesNotMatch(JSON.stringify(await req('GET',path)),/"(dateOfBirth|birthDate|userId)":/);
   await req('POST',`/admin/events/${next.id}/cancel`);
   await req('POST',`/admin/events/${next.id}/participants`,{athleteId:a.id,weightClassId:weight.id},409);
   assert.equal(await db!.tournamentParticipant.count({where:{eventId:next.id}}),1);
  });
  await t.test('homepage picks nearest future planned event; banner is saved, replaced and cleared',async()=>{
   // Existing scenario events must not affect the controlled upcoming selection.
   await db!.event.updateMany({data:{status:'COMPLETED'}});
   assert.equal(await req('GET','/events/upcoming'),null);
   const day=(offset:number)=>new Date(Date.now()+offset*86400000).toISOString();
   await req('POST','/admin/events',{...tournament,name:'Past',startsAt:day(-1)},201);
   await req('POST','/admin/events',{...tournament,name:'Cancelled',startsAt:day(1),status:'CANCELLED'},201);
   await req('POST','/admin/events',{...tournament,name:'Completed',startsAt:day(1),status:'COMPLETED'},201);
   await req('POST','/admin/events',{...tournament,name:'Later',startsAt:day(5)},201);
   const payload={...tournament,name:'Nearest',startsAt:day(2),bannerUrl:'https://example.invalid/banner.jpg'};
   const nearest=await req('POST','/admin/events',payload,201);
   let featured=await req('GET','/events/upcoming');assert.equal(featured.id,nearest.id);assert.equal(featured.bannerUrl,payload.bannerUrl);
   await req('PATCH',`/admin/events/${nearest.id}`,{...payload,bannerUrl:'https://example.invalid/replaced.jpg'});
   featured=await req('GET','/events/upcoming');assert.equal(featured.bannerUrl,'https://example.invalid/replaced.jpg');
   await req('PATCH',`/admin/events/${nearest.id}`,{...payload,bannerUrl:'javascript:alert(1)'},400);
   await req('PATCH',`/admin/events/${nearest.id}`,{...payload,bannerUrl:null});assert.equal((await req('GET','/events/upcoming')).bannerUrl,null);
   await req('POST',`/admin/events/${nearest.id}/cancel`);assert.notEqual((await req('GET','/events/upcoming')).id,nearest.id);
  });
  await t.test('malformed banners are rejected on create/update; historical malformed data stays readable',async()=>{
   const count=await db!.event.count();
   for(const bannerUrl of ['http://','https://','javascript:alert(1)','https://user:secret@example.com/a'])await req('POST','/admin/events',{...tournament,bannerUrl},400);
   assert.equal(await db!.event.count(),count);
   await req('PATCH',`/admin/events/${event.id}`,{...tournament,bannerUrl:'http://'},400);
   await db!.event.update({where:{id:event.id},data:{bannerUrl:'http://',status:'PLANNED',startsAt:new Date(Date.now()+1000)}});
   assert.equal((await req('GET','/events/upcoming')).bannerUrl,'http://');
  });
  await t.test('cancelled tournament rejects new results but permits replay, correction and removal of existing history',async()=>{
   await req('POST',`/admin/matches/${first.id}/result`,score(a.id));
   const before=await db!.match.findUniqueOrThrow({where:{id:first.id},include:{score:true}});
   await db!.event.update({where:{id:event.id},data:{status:'COMPLETED'}});
   await req('POST',`/admin/matches/${defense.id}/result`,score(a.id),409);
   await req('POST',`/admin/events/${event.id}/cancel`);
   assert.deepEqual(await db!.match.findUniqueOrThrow({where:{id:first.id},include:{score:true}}),before);
   const history=await db!.championship.findMany({orderBy:{id:'asc'}});
   await req('POST',`/admin/matches/${defense.id}/result`,score(a.id),409);
   assert.equal(await db!.matchScore.count({where:{matchId:defense.id}}),0);
   assert.deepEqual(await db!.championship.findMany({orderBy:{id:'asc'}}),history);
   await req('POST',`/admin/matches/${first.id}/result`,score(a.id));
   assert.deepEqual(await db!.championship.findMany({orderBy:{id:'asc'}}),history);
   await req('POST',`/admin/matches/${first.id}/result`,score(b.id));
   assert.equal((await db!.match.findUniqueOrThrow({where:{id:first.id}})).winnerId,b.id);
   assert.equal((await db!.championship.findFirstOrThrow({where:{isCurrent:true,weightClassId:weight.id}})).athleteId,b.id);
   await req('DELETE',`/admin/matches/${first.id}/result`);
   await req('POST',`/admin/matches/${first.id}/result`,score(a.id),409);
   assert.equal(await db!.matchScore.count({where:{matchId:first.id}}),0);
   assert.equal(await db!.championship.count({where:{weightClassId:weight.id}}),0);
  });
  await t.test('current permissions, block/unblock and password change revoke old administrator sessions',async()=>{
   const account=await req('POST','/admin/users',{email:'revocation@example.invalid',password,role:'ADMIN'},201);
   const login=async(pass:string=password)=>(await req('POST','/auth/login',{email:account.email,password:pass})).token;
   const original=await login();
   // Also enforce permissions changed outside the user-management endpoint.
   await db!.user.update({where:{id:account.id},data:{role:'ATHLETE'}});
   await req('GET','/admin/athletes',undefined,403,original);
   await req('POST','/admin/events',tournament,403,original);
   await db!.user.update({where:{id:account.id},data:{role:'ADMIN'}});
   await req('PATCH',`/admin/users/${account.id}`,{isBlocked:true});
   await req('GET','/admin/session',undefined,401,original);
   const blocked=await req('POST','/auth/login',{email:account.email,password},401);
   const absent=await req('POST','/auth/login',{email:'absent@example.invalid',password},401);
   assert.deepEqual(blocked,absent);
   await req('PATCH',`/admin/users/${account.id}`,{isBlocked:false});
   await req('GET','/admin/athletes',undefined,401,original);
   const fresh=await login();
   await req('PATCH',`/admin/users/${account.id}`,{password:password+'new'});
   await req('GET','/admin/athletes',undefined,401,fresh);
   await req('POST','/auth/login',{email:account.email,password},401);
   const renewed=await login(password+'new');await req('GET','/admin/athletes',undefined,200,renewed);
   await db!.user.update({where:{id:account.id},data:{passwordHash:await bcrypt.hash(password,4)}});
   await req('GET','/admin/athletes',undefined,401,renewed);
   const last=await login();await req('PATCH',`/admin/users/${account.id}`,{role:'ATHLETE'});
   await req('GET','/admin/athletes',undefined,401,last);
   await req('GET','/admin/athletes',undefined,403,await login());
  });
  await t.test('public search, event detail, news visibility and input validation',async()=>{
   for(const path of ['/athletes','/admin/athletes'])assert.ok((await req('GET',path+'?search='+encodeURIComponent(a.firstName+' '+a.lastName))).data.some((row:any)=>row.id===a.id));
   await req('GET','/athletes?page=1.5',undefined,400);await req('GET','/matches?status=INVALID',undefined,400);
   const detail=await req('GET','/events/'+event.id);assert.equal(detail.id,event.id);assert.ok(detail.participants.length>=2);assert.doesNotMatch(JSON.stringify(detail),/"dateOfBirth":/);
   const bouts=await req('GET','/matches?eventId='+event.id);assert.ok(bouts.data.every((m:any)=>m.eventId===event.id));
   const summary=await req('GET','/summary');assert.equal(summary.athletes,await db!.athlete.count({where:{status:'ACTIVE'}}));
   const draft=await req('POST','/admin/media',{title:'Draft',slug:'draft-post',category:'News',excerpt:'Draft text'},201);
   await req('GET','/media/'+draft.id,undefined,404);
   await req('PATCH','/admin/media/'+draft.id,{publishedAt:new Date(Date.now()+86400000).toISOString()});await req('GET','/media/'+draft.id,undefined,404);
   assert.ok(!(await req('GET','/media')).some((p:any)=>p.id===draft.id));
   await req('PATCH','/admin/media/'+draft.id,{publishedAt:new Date(Date.now()-1000).toISOString()});assert.equal((await req('GET','/media/'+draft.id)).title,'Draft');
   await req('DELETE','/admin/media/'+draft.id);await req('GET','/media/'+draft.id,undefined,404);
  });
  await t.test('archiving removes athlete from public registry without deleting history',async()=>{
   const matches=await db!.match.findMany({orderBy:{id:'asc'}}),scores=await db!.matchScore.findMany({orderBy:{id:'asc'}});
   await req('PATCH','/admin/athletes/'+a.id,{status:'INACTIVE'});
   assert.ok(!(await req('GET','/athletes?search='+a.firstName)).data.some((row:any)=>row.id===a.id));
   assert.equal((await req('GET','/athletes/'+a.id)).id,a.id);
   assert.deepEqual(await db!.match.findMany({orderBy:{id:'asc'}}),matches);assert.deepEqual(await db!.matchScore.findMany({orderBy:{id:'asc'}}),scores);
   await req('PATCH','/admin/athletes/'+a.id,{status:'ACTIVE'});
  });
  await t.test('registrar creates athlete and uploads photo; admin operations stay forbidden',async()=>{
   const registrar=await req('POST','/admin/users',{email:'registrar@example.invalid',password,role:'REGISTRAR'},201);
   const regToken=(await req('POST','/auth/login',{email:registrar.email,password})).token;
   assert.equal((await req('GET','/admin/session',undefined,200,regToken)).role,'REGISTRAR');
   const lookups=await req('GET','/admin/lookups',undefined,200,regToken);assert.equal(lookups.athletes.length,0);assert.equal(lookups.events.length,0);assert.ok(lookups.weights.length);
   const registered=await req('POST','/admin/athletes',profile('Registered'),201,regToken);
   assert.equal((await db!.auditLog.findFirstOrThrow({where:{entityId:registered.id,action:'CREATE'}})).userId,registrar.id);
   const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7U8AAAAASUVORK5CYII=','base64');
   const uploaded=await fetch(base+'/admin/uploads',{method:'POST',headers:{Authorization:'Bearer '+regToken,'Content-Type':'image/png'},body:image});assert.equal(uploaded.status,201);const photo=await uploaded.json() as {url:string};
   assert.deepEqual(Buffer.from(await(await fetch(base.replace('/api','')+photo.url)).arrayBuffer()),image);
   await req('POST','/admin/athletes',{...profile('With photo'),imageUrl:photo.url},201,regToken);
   const before=await db!.match.findUnique({where:{id:first.id}}),ranking=await db!.ranking.findMany();
   for(const [method,path] of [['POST','/admin/matches/'+first.id+'/result'],['DELETE','/admin/matches/'+first.id+'/result'],['POST','/admin/rankings/recalculate'],['PATCH','/admin/ranking-rule'],['POST','/admin/events'],['PATCH','/admin/events/'+event.id],['POST','/admin/events/'+event.id+'/participants'],['POST','/admin/events/'+event.id+'/competition/'+weight.id+'/groups'],['POST','/admin/events/'+event.id+'/competition/'+weight.id+'/playoff'],['GET','/admin/users'],['POST','/admin/users'],['PATCH','/admin/users/'+registrar.id],['PATCH','/admin/athletes/'+registered.id],['DELETE','/admin/athletes/'+registered.id]])await req(method,path,method==='GET'?undefined:{},403,regToken);
   await req('POST','/admin/athletes',{...profile('Escalation'),role:'ADMIN'},403,regToken);
   assert.deepEqual(await db!.match.findUnique({where:{id:first.id}}),before);assert.deepEqual(await db!.ranking.findMany(),ranking);
   await req('PATCH','/admin/users/'+registrar.id,{isBlocked:true});await req('POST','/admin/athletes',profile('Blocked'),401,regToken);
   await req('GET','/ready');
  });
  await t.test('login account rate limit returns generic 429 for existing and unknown accounts',async()=>{
   const limited='limited@example.invalid';await db!.user.create({data:{email:limited,passwordHash:await bcrypt.hash(password,4)}});
   for(const address of [limited,'missing-limit@example.invalid']){
    for(let i=0;i<10;i++)await req('POST','/auth/login',{email:address,password:'wrong-password'},401);
    await req('POST','/auth/login',{email:address.toUpperCase(),password:'wrong-password'},429);
   }
  });
 }finally{
  if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));
  await appDb?.$disconnect();await db?.$disconnect();
  // Never delete public or any pre-existing schema: this exact name was generated above.
  try{await owner.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await owner.$disconnect();}
  if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;
 }
});
