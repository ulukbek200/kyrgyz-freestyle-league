import {Router} from 'express';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {prisma} from './db.js';
import {asyncHandler as run,HttpError} from './http.js';
import {lockEvent} from './tournaments.js';
import {previewGroups} from './groupSchedule.js';
import {groupStandings,playoffSeeds} from './groupStandings.js';
import {profileEligibility} from './ageDivisions.js';

type Tx=Prisma.TransactionClient;
const groupsSchema=z.array(z.object({name:z.enum(['A','B','C','D']),athleteIds:z.array(z.string().min(1)).length(6)})).length(4);
const assignmentSchema=z.object({groups:groupsSchema,startsAt:z.coerce.date(),intervalMinutes:z.number().int().min(1).max(120).default(6)});
const matchInclude={athleteA:{include:{club:true}},athleteB:{include:{club:true}},score:true} as const;
export async function systemAvailable(tx:Tx){const rows=await tx.$queryRaw<{present:boolean}[]>`SELECT to_regclass('"TournamentFormat"') IS NOT NULL AS present`;return rows[0].present;}
async function requireSystem(tx:Tx){if(!await systemAvailable(tx))throw new HttpError(503,'Турнирная система ожидает применения миграции администратором');}
function fingerprint(bouts:{match:any}[]){return createHash('sha256').update(JSON.stringify(bouts.map(b=>[b.match?.id,b.match?.status,b.match?.winnerId,b.match?.method]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))).digest('hex');}
async function audit(tx:Tx,userId:string,action:string,id:string,metadata:Prisma.InputJsonValue={}){await tx.auditLog.create({data:{userId,action,entity:'TournamentFormat',entityId:id,metadata}});}
async function formatData(tx:Tx,eventId:string,weightClassId:string){
 const format=await tx.tournamentFormat.findUnique({where:{eventId_weightClassId:{eventId,weightClassId}},include:{bouts:{include:{match:{include:matchInclude}},orderBy:[{phase:'asc'},{groupName:'asc'},{round:'asc'},{position:'asc'}]}}});
 if(!format)return null;
 const groups=groupsSchema.parse(format.groups),groupBouts=format.bouts.filter(b=>b.phase==='GROUP'),hash=fingerprint(groupBouts);
 const decisions=format.decisions as {hash?:string;orders?:Record<string,string[]>};
 const tables=Object.fromEntries(groups.map(g=>[g.name,groupStandings(g.athleteIds,groupBouts.filter(b=>b.groupName===g.name&&b.match).map(b=>b.match!),decisions.hash===hash?decisions.orders?.[g.name]:undefined)]));
 const athletes=await tx.athlete.findMany({where:{id:{in:groups.flatMap(g=>g.athleteIds)}},select:{id:true,firstName:true,lastName:true,club:{select:{name:true}}}});
 return {...format,groups,tables,athletes,hash,complete:groupBouts.length===60&&groupBouts.every(b=>b.match?.status==='COMPLETED'),confirmed:format.confirmedHash===hash};
}
async function writable(tx:Tx,eventId:string){await requireSystem(tx);const event=await lockEvent(tx,eventId);if(!['PLANNED','LIVE'].includes(event.status))throw new HttpError(409,'Турнир закрыт для изменения формата');return event;}
async function checkedPreview(tx:Tx,eventId:string,weightClassId:string,body:unknown){
 const event=await writable(tx,eventId),data=assignmentSchema.parse(body),groups=[...data.groups].sort((a,b)=>a.name.localeCompare(b.name));
 let preview;try{preview=previewGroups(groups);}catch(e){throw new HttpError(400,(e as Error).message);}
 const ids=groups.flatMap(g=>g.athleteIds);
 for(const id of [...ids].sort())await tx.$queryRaw`SELECT "id" FROM "Athlete" WHERE "id"=${id} FOR UPDATE`;
 const participants=await tx.tournamentParticipant.findMany({where:{eventId,weightClassId,status:'ACTIVE',athlete:{status:'ACTIVE'}},include:{athlete:true}});
 if(participants.length!==24||participants.some(p=>!ids.includes(p.athleteId)))throw new HttpError(400,'Для шаблона нужны ровно 24 допущенных участника выбранной категории, каждый в одной группе');
 if(!event.weightClasses.some(w=>w.weightClassId===weightClassId))throw new HttpError(400,'Категория отсутствует в турнире');
 if(!event.ageDivision)throw new HttpError(400,'Укажите дивизион турнира');
 for(const p of participants){
  if(!p.athlete.dateOfBirth||p.ageDivision!==event.ageDivision)throw new HttpError(400,'Участник требует повторной проверки допуска');
  await profileEligibility(tx,{dateOfBirth:p.athlete.dateOfBirth,weightClassId,ageDivision:event.ageDivision},event.startsAt.getUTCFullYear());
 }
 return {event,data,preview};
}

export const tournamentSystem=Router();
export const publicTournamentSystem=Router();
const cycleSchema=z.object({name:z.string().trim().min(2).max(250),description:z.string().max(10000).nullable().optional(),startsAt:z.coerce.date(),endsAt:z.coerce.date().nullable().optional(),status:z.enum(['PLANNED','LIVE','COMPLETED','CANCELLED']),summary:z.string().max(10000).nullable().optional()}).refine(v=>!v.endsAt||v.endsAt>=v.startsAt,'Дата окончания раньше начала');
publicTournamentSystem.get('/competition/seasons',run(async(_q,r)=>{
 await requireSystem(prisma);r.json(await prisma.season.findMany({include:{cycle:true,events:{include:{_count:{select:{matches:true,participants:true}}}}},orderBy:{startsAt:'desc'}}));
}));
for(const verb of ['post','patch'] as const)tournamentSystem[verb]('/competition/seasons'+(verb==='patch'?'/:id':''),run(async(q,r)=>{
 const {status,summary,...data}=cycleSchema.parse(q.body);await requireSystem(prisma);
 const season=await prisma.$transaction(async tx=>{
  const season=verb==='post'?await tx.season.create({data}):await tx.season.update({where:{id:String(q.params.id)},data});
  await tx.seasonCycle.upsert({where:{seasonId:season.id},create:{seasonId:season.id,status,summary},update:{status,summary}});
  await tx.auditLog.create({data:{userId:q.user!.id,action:verb==='post'?'CREATE':'UPDATE',entity:'Season',entityId:season.id,metadata:{status}}});return season;
 });r.status(verb==='post'?201:200).json(season);
}));
tournamentSystem.post('/events/:id/competition/:weightId/reset',run(async(q,r)=>{
 const {reason}=z.object({reason:z.string().trim().min(5).max(2000)}).parse(q.body);
 r.json(await prisma.$transaction(async tx=>{
  const eventId=String(q.params.id);await writable(tx,eventId);const f=await formatData(tx,eventId,String(q.params.weightId));if(!f)throw new HttpError(404,'Группы не созданы');
  if(f.bouts.some(b=>b.match&&['LIVE','COMPLETED'].includes(b.match.status)))throw new HttpError(409,'Для перераспределения сначала отмените результаты и остановите начатые схватки. История будет сохранена');
  for(const b of f.bouts)if(b.match)await retireMatch(tx,b.match.id);
  await audit(tx,q.user!.id,'RESET_GROUPS',f.id,{reason,groups:f.groups,retainedMatches:f.bouts.map(b=>b.matchId)});
  await tx.tournamentBout.deleteMany({where:{formatId:f.id}});await tx.tournamentFormat.delete({where:{id:f.id}});return {success:true};
 },{timeout:30000}));
}));
tournamentSystem.patch('/competition/matches/:id/status',run(async(q,r)=>{
 const {status,reason}=z.object({status:z.enum(['UPCOMING','LIVE','CANCELLED']),reason:z.string().trim().min(5).max(2000)}).parse(q.body);
 r.json(await prisma.$transaction(async tx=>{
  await requireSystem(tx);const bout=await tx.tournamentBout.findUnique({where:{matchId:String(q.params.id)},include:{match:true,format:true}});if(!bout?.match)throw new HttpError(404,'Схватка сетки не найдена');
  await writable(tx,bout.format.eventId);await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id"=${bout.match.id} FOR NO KEY UPDATE`;
  const match=await tx.match.findUniqueOrThrow({where:{id:bout.match.id}});if(match.status==='COMPLETED')throw new HttpError(409,'Сначала отмените результат');
  const updated=await tx.match.update({where:{id:match.id},data:{status}});await afterCompetitionResult(tx,match.id,q.user!.id,status!==match.status);await audit(tx,q.user!.id,'CHANGE_BOUT_STATUS',bout.formatId,{matchId:match.id,status,reason});return updated;
 }));
}));
publicTournamentSystem.get('/events/:id/competition/:weightId',run(async(q,r)=>{
 await requireSystem(prisma);r.json(await formatData(prisma,String(q.params.id),String(q.params.weightId)));
}));
tournamentSystem.post('/events/:id/competition/:weightId/preview',run(async(q,r)=>{
 r.json(await prisma.$transaction(async tx=>{const p=await checkedPreview(tx,String(q.params.id),String(q.params.weightId),q.body);return {groups:p.preview,total:60,qualify:4,playoffMatches:15,scoring:'DECISION: 3–1; PIN / TECHNICAL_FALL / FORFEIT: 4–1',startsAt:p.data.startsAt,intervalMinutes:p.data.intervalMinutes};}));
}));
tournamentSystem.post('/events/:id/competition/:weightId/groups',run(async(q,r)=>{
 const eventId=String(q.params.id),weightClassId=String(q.params.weightId);
 r.status(201).json(await prisma.$transaction(async tx=>{
  const {event,data,preview}=await checkedPreview(tx,eventId,weightClassId,q.body);
  if(await tx.tournamentFormat.findUnique({where:{eventId_weightClassId:{eventId,weightClassId}}}))throw new HttpError(409,'Группы уже сформированы; повторная генерация запрещена');
  if(await tx.match.count({where:{eventId,weightClassId,status:{not:'CANCELLED'}}}))throw new HttpError(409,'В категории уже есть схватки; автоматическое объединение с группами запрещено');
  const format=await tx.tournamentFormat.create({data:{eventId,weightClassId,groups:preview.map(g=>({name:g.name,athleteIds:g.athleteIds}))}});
  for(const [groupIndex,group] of preview.entries())for(const pair of group.schedule){
   const offset=((pair.round-1)*12+groupIndex*3+pair.bout-1)*data.intervalMinutes*60000;
   const match=await tx.match.create({data:{eventId,weightClassId,ageDivision:event.ageDivision,athleteAId:pair.athleteAId,athleteBId:pair.athleteBId,scheduledAt:new Date(data.startsAt.getTime()+offset)}});
   await tx.tournamentBout.create({data:{formatId:format.id,phase:'GROUP',groupName:group.name,round:pair.round,position:pair.bout,matchId:match.id}});
  }
  await audit(tx,q.user!.id,'GENERATE_GROUPS',format.id,{groups:preview.map(g=>({name:g.name,athleteIds:g.athleteIds})),intervalMinutes:data.intervalMinutes});return format;
 },{timeout:30000}));
}));
tournamentSystem.post('/events/:id/competition/:weightId/confirm',run(async(q,r)=>{
 const data=z.object({hash:z.string(),orders:z.record(z.array(z.string())).default({}),reason:z.string().trim().min(5).max(2000)}).parse(q.body);
 r.json(await prisma.$transaction(async tx=>{
  const eventId=String(q.params.id);await writable(tx,eventId);const f=await formatData(tx,eventId,String(q.params.weightId));
  if(!f||!f.complete)throw new HttpError(409,'Сначала завершите все 60 групповых схваток');
  if(f.hash!==data.hash)throw new HttpError(409,'Результаты изменились. Обновите таблицу');
  if(f.bouts.some(b=>b.phase==='PLAYOFF'))throw new HttpError(409,'Сетка уже сформирована');
  for(const group of f.groups){const order=data.orders[group.name];if(order&&(order.length!==6||new Set(order).size!==6||order.some(id=>!group.athleteIds.includes(id))))throw new HttpError(400,'Укажите полный уникальный порядок спортсменов группы');
   const table=groupStandings(group.athleteIds,f.bouts.filter(b=>b.phase==='GROUP'&&b.groupName===group.name).map(b=>b.match!),order);
   if(table.some(row=>row.rank===null))throw new HttpError(409,'Требуется решение администратора для равных мест');
   if(order&&table.some((row,i)=>row.athleteId!==order[i]))throw new HttpError(400,'Решение может менять только неразрешённые равные места');
  }
  const result=await tx.tournamentFormat.update({where:{id:f.id},data:{decisions:{hash:f.hash,orders:data.orders,reason:data.reason},confirmedHash:f.hash}});
  await audit(tx,q.user!.id,'CONFIRM_GROUP_STANDINGS',f.id,{...data});return result;
 }));
}));
tournamentSystem.post('/events/:id/competition/:weightId/playoff',run(async(q,r)=>{
 const data=z.object({hash:z.string(),confirm:z.literal(true)}).parse(q.body);
 r.status(201).json(await prisma.$transaction(async tx=>{
  const eventId=String(q.params.id);await writable(tx,eventId);const f=await formatData(tx,eventId,String(q.params.weightId));
  if(!f?.complete||!f.confirmed||f.hash!==data.hash)throw new HttpError(409,'Сначала подтвердите актуальные итоговые места');
  if(f.bouts.some(b=>b.phase==='PLAYOFF'))throw new HttpError(409,'Плей-офф уже создан');
  const seeds=playoffSeeds(f.tables);
  for(let round=1;round<=4;round++)for(let position=1;position<=16/(2**round);position++){
   const seed=round===1?seeds[position-1]:undefined;
   await tx.tournamentBout.create({data:{formatId:f.id,phase:'PLAYOFF',round,position,seedAId:seed?.athleteAId,seedBId:seed?.athleteBId}});
  }
  await syncPlayoff(tx,f.id);await audit(tx,q.user!.id,'GENERATE_PLAYOFF',f.id,{seeds});return {success:true};
 },{timeout:30000}));
}));

async function retireMatch(tx:Tx,id:string){await tx.match.update({where:{id},data:{status:'CANCELLED'}});}
export async function syncPlayoff(tx:Tx,formatId:string){
 const format=await tx.tournamentFormat.findUniqueOrThrow({where:{id:formatId},include:{event:true}});
 const bouts=await tx.tournamentBout.findMany({where:{formatId,phase:'PLAYOFF'},include:{match:true},orderBy:[{round:'asc'},{position:'asc'}]});
 const base=await tx.match.findFirst({where:{tournamentBout:{formatId,phase:'GROUP'}},orderBy:{scheduledAt:'desc'}});
 for(const slot of bouts){
  const prev=(p:number)=>bouts.find(b=>b.round===slot.round-1&&b.position===p)?.match;
  const a=slot.round===1?slot.seedAId:prev(slot.position*2-1)?.status==='COMPLETED'?prev(slot.position*2-1)?.winnerId:null;
  const b=slot.round===1?slot.seedBId:prev(slot.position*2)?.status==='COMPLETED'?prev(slot.position*2)?.winnerId:null;
  if(slot.match&&slot.match.athleteAId===a&&slot.match.athleteBId===b)continue;
  if(slot.match){
   if(['COMPLETED','LIVE'].includes(slot.match.status))throw new HttpError(409,'Зависимая схватка уже начата. Сначала отмените результаты следующих раундов в обратном порядке');
   await retireMatch(tx,slot.match.id);await tx.tournamentBout.update({where:{id:slot.id},data:{matchId:null}});slot.match=null;
  }
  if(a&&b){
   slot.match=await tx.match.create({data:{eventId:format.eventId,weightClassId:format.weightClassId,ageDivision:format.event.ageDivision,athleteAId:a,athleteBId:b,scheduledAt:new Date((base?.scheduledAt??format.event.startsAt).getTime()+(slot.round*16+slot.position)*360000)}});
   await tx.tournamentBout.update({where:{id:slot.id},data:{matchId:slot.match.id}});
  }
 }
}

/** Called within the existing result transaction. No generated results are silently discarded. */
export async function afterCompetitionResult(tx:Tx,matchId:string,userId:string,changed:boolean){
 if(!await systemAvailable(tx))return;
 const bout=await tx.tournamentBout.findUnique({where:{matchId}});if(!bout||!changed)return;
 if(bout.phase==='GROUP'){
  const playoffs=await tx.tournamentBout.findMany({where:{formatId:bout.formatId,phase:'PLAYOFF'},include:{match:true}});
  if(playoffs.some(b=>b.match&&['COMPLETED','LIVE'].includes(b.match.status)))throw new HttpError(409,'Перед исправлением групп отмените результаты плей-офф в обратном порядке');
  for(const b of playoffs)if(b.match)await retireMatch(tx,b.match.id);
  await tx.tournamentBout.deleteMany({where:{formatId:bout.formatId,phase:'PLAYOFF'}});
  await tx.tournamentFormat.update({where:{id:bout.formatId},data:{confirmedHash:null,decisions:{}}});
  if(playoffs.length)await audit(tx,userId,'INVALIDATE_PLAYOFF',bout.formatId,{matchId,retainedCancelledMatches:playoffs.filter(b=>b.match).map(b=>b.match!.id)});
 }else await syncPlayoff(tx,bout.formatId);
}
