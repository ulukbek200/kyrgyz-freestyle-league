import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { env } from '../src/env';

if (!/^hardening_test_[0-9a-f]{16}$/.test(process.env.TEST_SCHEMA??'') || new URL(process.env.DATABASE_URL!).searchParams.get('schema')!==process.env.TEST_SCHEMA) throw new Error('Isolated schema required');
let server:ReturnType<typeof app.listen>,base:string,token:string,c:any,divisions:any[],config:any;
const weights:any[]=[],territories:any[]=[],participants:any[]=[];
let leagueBefore:string;
const rules={winPoints:0,lossPoints:0,methodBonus:{},tieBreak:['points']};
const seeding=['A','B'].flatMap((group,i)=>[1,2,3,4].map(rank=>({a:{group,rank},b:{group:i===0?'D':'C',rank:5-rank}})));
async function req(method:string,path:string,body?:unknown,expected:number|number[]=200,auth=true){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.ok((Array.isArray(expected)?expected:[expected]).includes(r.status),`${method} ${path}: ${r.status} ${JSON.stringify(data)}`);return data as any;}
const path=(suffix='')=>'/admin/competitions/'+c.id+suffix;
const dp=(id:string,suffix='')=>path('/divisions/'+id+suffix);
async function getFixture(id:string){return prisma.competitionFixture.findUniqueOrThrow({where:{id},include:{match:true}});}
async function result(id:string,winnerId?:string,extra:any={}){const f=await getFixture(id);const m=f.match!;const winner=winnerId??m.athleteAId;return req('POST',path('/fixtures/'+id+'/result'),{revision:f.revision,result:{winnerId:winner,method:'POINTS',scoreA:winner===m.athleteAId?3:0,scoreB:winner===m.athleteBId?3:0},...(f.confirmedAt?{reason:'QA correction with recorded evidence'}:{}),...extra});}
before(async()=>{
  const user=await prisma.user.create({data:{name:'Competition QA',email:'competition@example.test',passwordHash:'unused',role:'ADMIN'}});token=jwt.sign({id:user.id,role:'ADMIN'},env.JWT_SECRET);
  server=app.listen(0,'127.0.0.1');await once(server,'listening');base='http://127.0.0.1:'+(server.address() as any).port+'/api';
  for(let i=0;i<6;i++)territories.push(await req('POST','/admin/competitions/territories',{name:'QA territory '+i,region:'QA Naryn'},201));
  for(const kg of [45,48,51,55,60,65,70])weights.push(await req('POST','/admin/weight-classes',{name:'QA Naryn '+kg,maxKg:kg},201));
  const age=await req('POST','/admin/competitions/age-categories',{name:'QA U17',minAge:14,maxAge:16},201);
  config={name:'QA Naryn U17 Season',region:'QA Naryn',startDate:'2026-06-01',ageCategoryId:age.id,ageReferenceDate:'2026-01-01',territoryIds:territories.map(t=>t.id),weightClassIds:weights.map(w=>w.id),groupCodes:['A','B','C','D'],territoryQuota:4,advanceCount:4,groupWeeks:5,firstPlayoffWeek:6,seeding,isPublished:false};
  c=await req('POST','/admin/competitions',config,201);
  for(const w of weights)for(const t of territories)for(let n=0;n<4;n++){
    const a=await req('POST','/admin/athletes',{firstName:'QA '+w.maxKg+' '+t.name,lastName:String(n),birthDate:'2010-03-01',weightClassId:w.id},201);
    participants.push(await req('POST',path('/participants'),{athleteId:a.id,territoryId:t.id,weightClassId:w.id},201));
  }
  divisions=(await req('GET',path())).divisions;
  // Existing independent league records must survive every tournament operation.
  const season=await req('POST','/admin/seasons',{name:'Independent league',startDate:'2026-01-01',weightClassIds:[weights[0].id]},201);
  for(const p of participants.slice(0,2))await req('POST','/admin/seasons/'+season.id+'/athletes',{athleteId:p.athleteId});
  const event=await req('POST','/admin/events',{name:'Independent league event',seasonId:season.id,date:'2026-01-02',isPublished:true},201);
  const match=await req('POST','/admin/matches',{eventId:event.id,weightClassId:weights[0].id,athleteAId:participants[0].athleteId,athleteBId:participants[1].athleteId,scheduledAt:'2026-01-02T10:00:00Z'},201);
  await req('POST','/admin/matches/'+match.id+'/result',{winnerId:match.athleteAId,method:'POINTS',scoreA:3,scoreB:0});
  leagueBefore=JSON.stringify(await prisma.ranking.findMany({orderBy:{id:'asc'}}));
});
after(async()=>{server?.close();await prisma.$disconnect();});

test('competition 01: access control, private competition and age/quota validation',async()=>{
  await req('GET','/admin/competitions',undefined,401,false);await req('GET','/competitions/'+c.id,undefined,404,false);
  const old=await req('POST','/admin/athletes',{firstName:'Too old',lastName:'QA',birthDate:'1990-01-01',weightClassId:weights[0].id},201);
  await req('POST',path('/participants'),{athleteId:old.id,territoryId:territories[0].id,weightClassId:weights[0].id},400);
  const extra=await req('POST','/admin/athletes',{firstName:'Extra',lastName:'QA',birthDate:'2010-01-01',weightClassId:weights[0].id},201);
  await req('POST',path('/participants'),{athleteId:extra.id,territoryId:territories[0].id,weightClassId:weights[0].id},400);
});
test('competition 02: deterministic preview, draft and approved draw give four groups of six',async()=>{
  for(const d of divisions){const preview=await req('POST',dp(d.id,'/draw/preview'),{seed:'recorded seed'});const again=await req('POST',dp(d.id,'/draw/preview'),{seed:'recorded seed'});assert.deepEqual(preview,again);
    await req('PUT',dp(d.id,'/draw'),{seed:preview.seed,revision:preview.revision,groups:preview.groups});
    await req('POST',dp(d.id,'/draw/approve'),{revision:preview.revision+1});
    const groups=await prisma.competitionGroup.findMany({where:{divisionId:d.id},include:{members:{include:{participant:true}}}});assert.equal(groups.length,4);for(const g of groups){assert.equal(g.members.length,6);assert.equal(new Set(g.members.map(m=>m.participant.territoryId)).size,6);}
    await req('PUT',dp(d.id,'/draw'),{seed:preview.seed,revision:preview.revision+1,groups:preview.groups},409);
  }
});
test('competition 03: exactly 420 bouts, unique opponents and one group bout per athlete per week',async()=>{
  for(const d of divisions){const current=await req('GET',dp(d.id,'/standings'));assert.equal((await req('POST',dp(d.id,'/schedule/generate'),{revision:current.revision})).created,60);await req('POST',dp(d.id,'/schedule/generate'),{revision:current.revision},409);}
  const list=await req('GET',path('/schedule'));assert.equal(list.length,420);
  for(const p of participants){const bouts=list.filter((f:any)=>[f.match.athleteAId,f.match.athleteBId].includes(p.athleteId));assert.equal(bouts.length,5);assert.equal(new Set(bouts.map((f:any)=>f.week)).size,5);assert.equal(new Set(bouts.map((f:any)=>f.match.athleteAId===p.athleteId?f.match.athleteBId:f.match.athleteAId)).size,5);}
});
test('competition 04: rules, incomplete results and unapproved tables block qualification/bracket',async()=>{
  const d=divisions[0],s=await req('GET',dp(d.id,'/standings'));await req('POST',dp(d.id,'/qualification/approve'),{revision:s.revision},400);await req('POST',dp(d.id,'/bracket/generate'),{revision:s.revision},409);
  await req('PUT',path('/rules'),{config:rules,revision:0});
});
test('competition 05: group result updates stats but leaves official league ranking untouched',async()=>{
  const f=await prisma.competitionFixture.findFirstOrThrow({where:{divisionId:divisions[0].id,stage:'GROUP'},include:{match:true}});await result(f.id);
  const s=await req('GET',dp(divisions[0].id,'/standings'));const rows=s.groups.flatMap((g:any)=>g.rows);assert.equal(rows.find((r:any)=>r.athleteId===f.match!.athleteAId).wins,1);assert.equal(s.groups[0].provisional,true);
  assert.equal(JSON.stringify(await prisma.ranking.findMany({orderBy:{id:'asc'}})),leagueBefore);assert.equal(await prisma.championship.count({where:{seasonId:c.seasonId}}),0);
  await req('POST','/admin/matches/'+f.matchId+'/result',{winnerId:f.match!.athleteAId,method:'POINTS',scoreA:3,scoreB:0},409);
});
test('competition 06: correction recomputes group wins/losses and records the reason',async()=>{
  const f=await prisma.competitionFixture.findFirstOrThrow({where:{divisionId:divisions[0].id,confirmedAt:{not:null}},include:{match:true}});await result(f.id,f.match!.athleteBId);
  const rows=(await req('GET',dp(divisions[0].id,'/standings'))).groups.flatMap((g:any)=>g.rows);assert.equal(rows.find((r:any)=>r.athleteId===f.match!.athleteAId).losses,1);assert.equal(rows.find((r:any)=>r.athleteId===f.match!.athleteBId).wins,1);
  assert.equal(await prisma.competitionApproval.count({where:{competitionId:c.id,action:'result.correct'}}),1);
});
test('competition 07: all group results can be recorded provisionally, ties still block qualification',async()=>{
  const list=await prisma.competitionFixture.findMany({where:{divisionId:divisions[0].id,stage:'GROUP',confirmedAt:null}});for(const f of list)await result(f.id);
  const s=await req('GET',dp(divisions[0].id,'/standings'));assert.equal(s.confirmedMatches,60);assert.equal(s.unresolved,true);await req('POST',dp(divisions[0].id,'/qualification/approve'),{revision:s.revision},400);
});
test('competition 08: initial rules approval is explicit; unresolved ties still block final bracket',async()=>{
  await req('POST',path('/rules/approve'),{config:rules,revision:1});const s=await req('GET',dp(divisions[0].id,'/standings'));assert.ok(s.rulesApprovedAt);await req('POST',dp(divisions[0].id,'/qualification/approve'),{revision:s.revision},400);
  await req('PUT',path('/rules'),{config:{...rules,winPoints:3},revision:2},409);
});
test('competition 09: recorded tie decisions and approval qualify exactly sixteen athletes',async()=>{
  const id=divisions[0].id;let s=await req('GET',dp(id,'/standings'));for(const g of s.groups)await req('POST',dp(id,'/ties'),{revision:s.revision,groupCode:g.code,orders:[g.rows.map((r:any)=>r.athleteId)],reason:'QA sports director explicit tie decision'});
  s=await req('GET',dp(id,'/standings'));assert.equal(s.unresolved,false);await req('POST',dp(id,'/qualification/approve'),{revision:s.revision});s=await req('GET',dp(id,'/standings'));assert.equal(s.groups.flatMap((g:any)=>g.rows).filter((r:any)=>r.status==='QUALIFIED').length,16);assert.equal(s.groups.flatMap((g:any)=>g.rows).filter((r:any)=>r.status==='ELIMINATED').length,8);
});
test('competition 10: configured bracket has rounds in weeks six to nine',async()=>{
  const id=divisions[0].id,s=await req('GET',dp(id,'/standings'));await req('POST',dp(id,'/bracket/generate'),{revision:s.revision});const b=await req('GET',dp(id,'/bracket'));assert.equal(b.fixtures.length,15);assert.deepEqual([...new Set(b.fixtures.map((f:any)=>f.week))],[6,7,8,9]);assert.equal(b.fixtures.filter((f:any)=>f.matchId).length,8);
});
test('competition 11: winners advance to quarterfinal with correct participants',async()=>{
  const first=await prisma.competitionFixture.findMany({where:{divisionId:divisions[0].id,round:1,stage:{not:'GROUP'}},orderBy:{position:'asc'},include:{match:true}});
  await result(first[0].id);await result(first[1].id);
  const q=await prisma.competitionFixture.findFirstOrThrow({where:{sourceAId:first[0].id},include:{match:true}});assert.equal(q.match!.athleteAId,first[0].match!.athleteAId);assert.equal(q.match!.athleteBId,first[1].match!.athleteAId);await result(q.id);
});
test('competition 12: played downstream round blocks correction atomically',async()=>{
  const f=await prisma.competitionFixture.findFirstOrThrow({where:{divisionId:divisions[0].id,stage:'ROUND_OF_16',position:1},include:{match:true}});const before=JSON.stringify(await prisma.match.findMany({where:{seasonId:c.seasonId},orderBy:{id:'asc'}}));
  await req('POST',path('/fixtures/'+f.id+'/result'),{revision:f.revision,reason:'QA requested correction',result:{winnerId:f.match!.athleteBId,method:'POINTS',scoreA:0,scoreB:3}},409);
  assert.equal(JSON.stringify(await prisma.match.findMany({where:{seasonId:c.seasonId},orderBy:{id:'asc'}})),before);
});
test('competition 13: explicit downstream annulment updates participants and preserves audit history',async()=>{
  const f=await prisma.competitionFixture.findFirstOrThrow({where:{divisionId:divisions[0].id,stage:'ROUND_OF_16',position:1},include:{match:true}});const impact=await req('GET',path('/fixtures/'+f.id+'/impact'));assert.equal(impact.played.length,1);
  await result(f.id,f.match!.athleteBId,{annulDependentIds:impact.played});const q=await getFixture(impact.played[0]);assert.equal(q.confirmedAt,null);assert.equal(q.match!.athleteAId,f.match!.athleteBId);assert.equal(q.match!.winnerId,null);assert.equal(await prisma.competitionApproval.count({where:{action:'dependents.annul',competitionId:c.id}}),1);
});
test('competition 14: group correction cannot silently invalidate a played bracket',async()=>{
  const f=await prisma.competitionFixture.findFirstOrThrow({where:{divisionId:divisions[0].id,stage:'GROUP'},include:{match:true}});await req('POST',path('/fixtures/'+f.id+'/result'),{revision:f.revision,reason:'QA group correction',result:{winnerId:f.match!.athleteBId,method:'POINTS',scoreA:0,scoreB:3}},409);
});
test('competition 15: final alone never assigns places three to five',async()=>{
  for(let round=1;round<=4;round++){const list=await prisma.competitionFixture.findMany({where:{divisionId:divisions[0].id,stage:{not:'GROUP'},round,confirmedAt:null}});for(const f of list)await result(f.id);}
  const b=await req('GET',dp(divisions[0].id,'/bracket'));assert.equal(b.classificationStatus,'PENDING CLASSIFICATION');assert.equal(b.placements.length,0);
  const s=await req('GET',dp(divisions[0].id,'/standings'));await req('POST',dp(divisions[0].id,'/placements/approve'),{revision:s.revision,reason:'QA premature placement approval'},409);
});
test('competition 16: configured classification bouts determine five distinct approved places',async()=>{
  const id=divisions[0].id,all=await prisma.competitionFixture.findMany({where:{divisionId:id,stage:{not:'GROUP'}},orderBy:{position:'asc'}}),sf=all.filter(f=>f.stage==='SEMIFINAL'),qf=all.filter(f=>f.stage==='QUARTERFINAL'),final=all.find(f=>f.stage==='FINAL')!;
  const create=async(key:string,a:string,b:string,outcome:'WINNER'|'LOSER')=>req('POST',dp(id,'/classification/matches'),{key,a:{fixtureId:a,outcome},b:{fixtureId:b,outcome},week:9,eventId:final.eventId,scheduledAt:final.scheduledAt},201);
  const bronze=await create('CLASS:bronze',sf[0].id,sf[1].id,'LOSER'),a=await create('CLASS:fifth-a',qf[0].id,qf[1].id,'LOSER'),b=await create('CLASS:fifth-b',qf[2].id,qf[3].id,'LOSER'),fifth=await create('CLASS:fifth',a.id,b.id,'WINNER');
  await req('POST',path('/classification/approve'),{places:[{place:3,fixtureKey:'CLASS:bronze',outcome:'WINNER'},{place:4,fixtureKey:'CLASS:bronze',outcome:'LOSER'},{place:5,fixtureKey:'CLASS:fifth',outcome:'WINNER'}],reason:'QA approved classification scheme'});
  for(const f of [bronze,a,b,fifth])await result(f.id);
  const s=await req('GET',dp(id,'/standings'));const placements=await req('POST',dp(id,'/placements/approve'),{revision:s.revision,reason:'QA director approves verified final placements'});assert.equal(placements.length,5);assert.equal(new Set(placements.map((p:any)=>p.participantId)).size,5);
});
test('competition 17: publication, official ranking and other seasons remain isolated',async()=>{
  assert.equal(JSON.stringify(await prisma.ranking.findMany({orderBy:{id:'asc'}})),leagueBefore);
  assert.equal(await prisma.ranking.count({where:{seasonId:c.seasonId}}),0);assert.equal(await prisma.championship.count({where:{seasonId:c.seasonId}}),0);
  await req('PATCH',path(),{...config,isPublished:true});const list=await req('GET','/competitions/'+c.id+'/schedule',undefined,200,false);assert.equal(list.length,0);
  const events=await prisma.event.findMany({where:{seasonId:c.seasonId}});for(const e of events)await req('PATCH','/admin/events/'+e.id,{isPublished:true});
  const publicGroups=await req('GET','/competitions/'+c.id+'/groups?weightClassId='+divisions[0].weightClassId,undefined,200,false);assert.equal(publicGroups[0].confirmedMatches,60);
  const b=await req('GET','/competitions/'+c.id+'/bracket?weightClassId='+divisions[0].weightClassId,undefined,200,false);assert.equal(b[0].placements.length,5);
  const final=await prisma.competitionFixture.findFirstOrThrow({where:{divisionId:divisions[0].id,stage:'FINAL'}});await req('PATCH','/admin/events/'+final.eventId,{isPublished:false});
  const hidden=await req('GET','/competitions/'+c.id+'/bracket?weightClassId='+divisions[0].weightClassId,undefined,200,false);assert.equal(hidden[0].placements.length,0);assert.equal(hidden[0].fixtures.find((f:any)=>f.id===final.id).match,null);
  await req('PATCH',path(),{...config,isPublished:false});await req('GET','/events/'+events[0].id,undefined,404,false);
});
