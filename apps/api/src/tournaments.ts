import {bannerUrlSchema} from './bannerUrl.js';
import {systemAvailable} from './tournamentSystem.js';
import {Router} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@prisma/client';
import {prisma} from './db.js';
import {asyncHandler as run,HttpError} from './http.js';
import {divisionSchema,profileEligibility} from './ageDivisions.js';
import {standings} from './rankingEngine.js';

export const tournaments=Router();
const eventSchema=z.object({seasonId:z.string().min(1).nullable().optional(),bannerUrl:bannerUrlSchema,name:z.string().trim().min(2).max(250),slug:z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/).optional(),city:z.string().trim().min(1).max(250),venue:z.string().trim().min(1).max(250),startsAt:z.coerce.date(),ageDivision:divisionSchema,description:z.string().trim().max(10000).nullable().optional(),status:z.enum(['PLANNED','LIVE','COMPLETED','CANCELLED']).default('PLANNED'),weightClassIds:z.array(z.string().min(1)).min(1).refine(ids=>new Set(ids).size===ids.length)});
async function categories(tx:Prisma.TransactionClient,ageDivision:'U17'|'U23',ids:string[]){
 if(await tx.weightClass.count({where:{id:{in:ids},ageDivision}})!==ids.length)throw new HttpError(400,'Выберите категории возрастного дивизиона турнира');
}
const include={weightClasses:{include:{weightClass:true}},_count:{select:{participants:true,matches:true}}} as const;
export async function lockEvent(tx:Prisma.TransactionClient,eventId:string){
 await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id"=${eventId} FOR UPDATE`;
 const event=await tx.event.findUnique({where:{id:eventId},include:{weightClasses:true}});
 if(!event)throw new HttpError(404,'Турнир не найден');return event;
}
tournaments.get('/events/:id',run(async(q,r)=>{
 const event=await prisma.event.findUnique({where:{id:String(q.params.id)},include});if(!event)throw new HttpError(404,'Турнир не найден');r.json(event);
}));
tournaments.post('/events',run(async(q,r)=>{
 const {weightClassIds,...data}=eventSchema.parse(q.body);
 r.status(201).json(await prisma.$transaction(async tx=>{
  await categories(tx,data.ageDivision,weightClassIds);
  const event=await tx.event.create({data:{...data,slug:data.slug??`kfl-${randomUUID()}`,weightClasses:{create:weightClassIds.map(weightClassId=>({weightClassId}))}},include});
  await tx.auditLog.create({data:{userId:q.user!.id,action:'CREATE',entity:'Event',entityId:event.id}});return event;
 }));
}));
tournaments.patch('/events/:id',run(async(q,r)=>{
 const {weightClassIds,...data}=eventSchema.parse(q.body),id=String(q.params.id);
 r.json(await prisma.$transaction(async tx=>{
  const old=await lockEvent(tx,id);await categories(tx,data.ageDivision,weightClassIds);
  if((old.ageDivision!==data.ageDivision||old.startsAt.getUTCFullYear()!==data.startsAt.getUTCFullYear())&&await tx.tournamentParticipant.count({where:{eventId:id}}))throw new HttpError(409,'В турнире есть участники. Изменение года или дивизиона требует сверки регистраций.');
  if(await tx.tournamentParticipant.count({where:{eventId:id,weightClassId:{notIn:weightClassIds}}}))throw new HttpError(409,'Нельзя убрать категорию с зарегистрированными участниками');
  if(await tx.match.count({where:{eventId:id,weightClassId:{notIn:weightClassIds}}}))throw new HttpError(409,'Нельзя убрать категорию с историей схваток');
  await tx.eventWeightClass.deleteMany({where:{eventId:id,weightClassId:{notIn:weightClassIds}}});
  await tx.eventWeightClass.createMany({data:weightClassIds.map(weightClassId=>({eventId:id,weightClassId})),skipDuplicates:true});
  const event=await tx.event.update({where:{id},data,include});await tx.auditLog.create({data:{userId:q.user!.id,action:'UPDATE',entity:'Event',entityId:id}});return event;
 }));
}));
tournaments.post('/events/:id/cancel',run(async(q,r)=>{
 const id=String(q.params.id);r.json(await prisma.$transaction(async tx=>{
  await lockEvent(tx,id);const event=await tx.event.update({where:{id},data:{status:'CANCELLED'}});
  await tx.auditLog.create({data:{userId:q.user!.id,action:'UPDATE',entity:'Event',entityId:id,metadata:{status:'CANCELLED'}}});return event;
 }));
}));
tournaments.get('/events/:id/participants',run(async(q,r)=>{await requireEvent(String(q.params.id));r.json(await prisma.tournamentParticipant.findMany({where:{eventId:String(q.params.id)},include:{athlete:{include:{club:true,coach:true}},weightClass:true},orderBy:{athlete:{lastName:'asc'}}}));}));
tournaments.post('/events/:id/participants',run(async(q,r)=>{
 const body=z.object({athleteId:z.string().min(1),weightClassId:z.string().min(1)}).parse(q.body),eventId=String(q.params.id);
 r.status(201).json(await prisma.$transaction(async tx=>{
  const event=await lockEvent(tx,eventId);
  if(await systemAvailable(tx)&&await tx.tournamentFormat.findUnique({where:{eventId_weightClassId:{eventId,weightClassId:body.weightClassId}}}))throw new HttpError(409,'Группы категории уже сформированы. Для изменения состава используйте процедуру перераспределения');
  if(!['PLANNED','LIVE'].includes(event.status))throw new HttpError(409,'Регистрация в завершённый или отменённый турнир закрыта');
  if(await tx.tournamentParticipant.findUnique({where:{eventId_athleteId:{eventId,athleteId:body.athleteId}}}))throw new HttpError(409,'Спортсмен уже зарегистрирован в этом турнире');
  await tx.$queryRaw`SELECT "id" FROM "Athlete" WHERE "id"=${body.athleteId} FOR UPDATE`;
  const athlete=await tx.athlete.findUnique({where:{id:body.athleteId}});
  if(!athlete?.dateOfBirth||athlete.status!=='ACTIVE')throw new HttpError(400,'Нужен активный спортсмен с указанной датой рождения');
  if(!event.ageDivision||!event.weightClasses.some(w=>w.weightClassId===body.weightClassId))throw new HttpError(400,'Категория отсутствует в турнире');
  const {ageDivision}=await profileEligibility(tx,{dateOfBirth:athlete.dateOfBirth,weightClassId:body.weightClassId,ageDivision:event.ageDivision},event.startsAt.getUTCFullYear());
  const participant=await tx.tournamentParticipant.create({data:{...body,eventId,ageDivision}});
  await tx.auditLog.create({data:{userId:q.user!.id,action:'CREATE',entity:'TournamentParticipant',entityId:participant.id}});return participant;
 }));
}));
tournaments.delete('/events/:id/participants/:athleteId',run(async(q,r)=>{
 const eventId=String(q.params.id),athleteId=String(q.params.athleteId);
 await prisma.$transaction(async tx=>{
  await lockEvent(tx,eventId);
  if(await tx.match.count({where:{eventId,OR:[{athleteAId:athleteId},{athleteBId:athleteId}]}}))throw new HttpError(409,'У участника есть схватки. Его регистрацию нужно сохранить для истории.');
  const participant=await tx.tournamentParticipant.delete({where:{eventId_athleteId:{eventId,athleteId}}});
  await tx.auditLog.create({data:{userId:q.user!.id,action:'DELETE',entity:'TournamentParticipant',entityId:participant.id}});
 });r.json({success:true});
}));
async function requireEvent(id:string){if(!await prisma.event.findUnique({where:{id},select:{id:true}}))throw new HttpError(404,'Турнир не найден');}
tournaments.get('/events/:id/results',run(async(q,r)=>{
 await requireEvent(String(q.params.id));
 const bouts=await prisma.match.findMany({where:{eventId:String(q.params.id),status:'COMPLETED',winnerId:{not:null}},include:{score:true,weightClass:true},orderBy:[{scheduledAt:'asc'},{id:'asc'}]});
 const rule=await prisma.rankingRule.findUnique({where:{name:'default'}}),rows=[];
 for(const weightClassId of [...new Set(bouts.map(b=>b.weightClassId))]){
  const categoryBouts=bouts.filter(b=>b.weightClassId===weightClassId);
  for(const [index,row] of standings(categoryBouts,rule).entries())rows.push({...row,id:`${weightClassId}-${row.athleteId}`,rank:index+1,weightClass:categoryBouts[0].weightClass,athlete:await prisma.athlete.findUnique({where:{id:row.athleteId},include:{club:true}})});
 }r.json(rows);
}));
export async function validateTournamentMatch(tx:Prisma.TransactionClient,data:{eventId:string;weightClassId:string;athleteAId:string;athleteBId:string;ageDivision:'U17'|'U23'}){
 const event=await lockEvent(tx,data.eventId);
 if(await systemAvailable(tx)&&await tx.tournamentFormat.findUnique({where:{eventId_weightClassId:{eventId:data.eventId,weightClassId:data.weightClassId}}}))throw new HttpError(409,'В этой категории пары формируются только через сетку турнира');
 if(!['PLANNED','LIVE'].includes(event.status))throw new HttpError(409,'Состав схваток завершённого или отменённого турнира закрыт');
 if(event.ageDivision!==data.ageDivision||!event.weightClasses.some(w=>w.weightClassId===data.weightClassId))throw new HttpError(400,'Дивизион и вес должны соответствовать турниру');
 if(data.athleteAId===data.athleteBId)throw new HttpError(400,'Выберите двух разных участников');
 for(const athleteId of [data.athleteAId,data.athleteBId].sort()){
  await tx.$queryRaw`SELECT "id" FROM "Athlete" WHERE "id"=${athleteId} FOR UPDATE`;
  const participant=await tx.tournamentParticipant.findUnique({where:{eventId_athleteId:{eventId:event.id,athleteId}},include:{athlete:true}});
  if(!participant||participant.status!=='ACTIVE'||participant.athlete.status!=='ACTIVE'||!participant.athlete.dateOfBirth||participant.weightClassId!==data.weightClassId||participant.ageDivision!==data.ageDivision)throw new HttpError(400,'Выберите зарегистрированных участников турнира одной категории');
  await profileEligibility(tx,{dateOfBirth:participant.athlete.dateOfBirth,weightClassId:data.weightClassId,ageDivision:data.ageDivision},event.startsAt.getUTCFullYear());
 }
 return event;
}
