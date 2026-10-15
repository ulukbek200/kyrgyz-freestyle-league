import {athleteSearch} from './publicQueries.js';
import {tournamentSystem,systemAvailable} from './tournamentSystem.js';
import {tournaments,validateTournamentMatch} from './tournaments.js';
import {DIVISIONS, divisionSchema, profileEligibility, getAgeDivision} from './ageDivisions.js';
import express from 'express';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {randomUUID} from 'node:crypto';
import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Prisma} from '@prisma/client';
import {prisma} from './db.js';
import {authenticate} from './auth.js';
import {asyncHandler as run, HttpError} from './http.js';
import {adminAccess} from './adminAccess.js';
import {uploadDirectory} from './storage.js';
export {uploadDirectory} from './storage.js';
import {recalculateRankings} from './rankingEngine.js';
import {affiliationName,resolveAffiliations} from './affiliations.js';


export const adminManagement = express.Router();
const router = adminManagement;
router.use(authenticate, adminAccess);
router.use(tournaments);
router.use(tournamentSystem);
const id = z.string().min(1);
const text = z.string().trim().min(1).max(250);
const optionalText = z.string().trim().max(10000).nullable().optional();
const imageUrl = z.string().max(2048).refine(v => /^https?:\/\//i.test(v) || /^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(v), 'Укажите ссылку http(s) или загрузите фотографию').nullable().optional();
function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, 'Проверьте поля формы: ' + result.error.issues[0]?.message);
  return result.data;
}
async function change<T>(userId: string, action: string, entity: string, entityId: string | undefined, task: (tx: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const value = await task(tx);
    await tx.auditLog.create({data: {userId, action, entity, entityId: entityId ?? (value as {id?: string})?.id}});
    return value;
  }, {timeout: 30000});
}
const athleteSchema = z.object({firstName: text, lastName: text, city: text, country: text.default('Kyrgyzstan'), nationality: text.default('KG'),
  clubName:affiliationName,coachName:affiliationName,
  dateOfBirth:z.coerce.date(),ageDivision:divisionSchema.optional(),weightClassId: id, clubId: id.nullable().optional(), coachId: id.nullable().optional(), nickname: optionalText,
  story: optionalText, imageUrl, status: z.enum(['PENDING','ACTIVE','INACTIVE','SUSPENDED','RETIRED']).default('ACTIVE')});
router.get('/age-reference',run(async(_q,r)=>r.json({year:new Date().getUTCFullYear()})));
router.get('/age-divisions',run(async(_q,r)=>r.json(DIVISIONS)));
router.get('/session', run(async(q,r) => {
  const user = await prisma.user.findUnique({where:{id:q.user!.id},select:{id:true,email:true,role:true}});
  if (!user || !['ADMIN','REGISTRAR'].includes(user.role)) throw new HttpError(403,'Доступ администратора необходим');
  r.json(user);
}));
router.get('/lookups', run(async(_q,r) => {
  if(_q.user!.role==='REGISTRAR'){r.json({athletes:[],clubs:[],coaches:[],events:[],weights:await prisma.weightClass.findMany({where:{ageDivision:{not:null}},orderBy:{kilograms:'asc'}})});return;}
  const [athletes,clubs,coaches,weights,events] = await Promise.all([
    prisma.athlete.findMany({where:{status:'ACTIVE'},select:{id:true,firstName:true,lastName:true,weightClassId:true,status:true,tournamentParticipants:true,dateOfBirth:true},orderBy:{lastName:'asc'}}),
    prisma.club.findMany({orderBy:{name:'asc'}}), prisma.coach.findMany({orderBy:{name:'asc'}}),
    prisma.weightClass.findMany({orderBy:{kilograms:'asc'}}),prisma.event.findMany({orderBy:{startsAt:'desc'}}),
  ]);r.json({athletes,clubs,coaches,weights,events});
}));
router.get('/dashboard',run(async(_q,r)=>{
  const [athletes,totalAthletes,matches,events,applications,upcoming,completed,champions,media,activity,nextEvents] = await Promise.all([
    prisma.athlete.count({where:{status:'ACTIVE'}}),prisma.athlete.count(),prisma.match.count(),prisma.event.count(),
    prisma.application.count({where:{status:{in:['PENDING','REVIEW']}}}),prisma.match.count({where:{status:'UPCOMING'}}),prisma.match.count({where:{status:'COMPLETED'}}),
    prisma.championship.count({where:{isCurrent:true}}),prisma.mediaPost.count(),
    prisma.auditLog.findMany({take:10,orderBy:{createdAt:'desc'},include:{user:{select:{email:true}}}}),
    prisma.event.findMany({where:{startsAt:{gte:new Date()}},take:3,orderBy:{startsAt:'asc'},include:{_count:{select:{matches:true}}}}),
  ]);r.json({athletes,totalAthletes,matches,events,applications,upcoming,completed,champions,media,activity,nextEvents});
}));
router.get('/athletes',run(async(q,r)=>{
  const page=Math.max(1,Math.trunc(Number(q.query.page)||1)),limit=Math.max(1,Math.min(100,Math.trunc(Number(q.query.limit)||20)));
  const status=z.enum(['PENDING','ACTIVE','INACTIVE','SUSPENDED','RETIRED']).optional().parse(q.query.status||undefined);
  const search=String(q.query.search||'');
  const where:Prisma.AthleteWhereInput={...(status?{status}:{}),...(q.query.weightClassId?{weightClassId:String(q.query.weightClassId)}:{}),...(q.query.ageDivision?{weightClass:{ageDivision:divisionSchema.parse(q.query.ageDivision)}}:{}),
    ...athleteSearch(search),...(q.query.clubId?{clubId:String(q.query.clubId)}:{})};
  const [data,total]=await Promise.all([prisma.athlete.findMany({where,skip:(page-1)*limit,take:limit,orderBy:{lastName:'asc'},
    include:{club:true,coach:true,weightClass:true,tournamentParticipants:{include:{event:true,weightClass:true}},_count:{select:{tournamentParticipants:true,matchesAsA:{where:{status:'COMPLETED'}},matchesAsB:{where:{status:'COMPLETED'}},wonMatches:{where:{status:'COMPLETED'}}}},rankings:{where:{seasonId:null}}}}),prisma.athlete.count({where})]);r.json({data,total,page,limit});
}));
router.post('/athletes',run(async(q,r)=>{
  if(q.user!.role==='REGISTRAR'&&((q.body.status&&q.body.status!=='ACTIVE')||q.body.userId||q.body.role))throw new HttpError(403,'Регистратор может только создать активный профиль спортсмена');
  const {ageDivision,clubName,coachName,...data}=parse(athleteSchema,q.body);
  r.status(201).json(await change(q.user!.id,'CREATE','Athlete',undefined,async tx=>{
    await profileEligibility(tx,{...data,ageDivision});
    const affiliations=await resolveAffiliations(tx,{...data,clubName,coachName});
    const athlete=await tx.athlete.create({data:{...data,...affiliations}});
    return athlete;
  }));
}));
router.patch('/athletes/:id',run(async(q,r)=>{
  const {ageDivision,clubName,coachName,...data}=parse(athleteSchema.partial(),q.body),athleteId=String(q.params.id);
  r.json(await change(q.user!.id,'UPDATE','Athlete',athleteId,async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "Athlete" WHERE "id"=${athleteId} FOR UPDATE`;
    const old=await tx.athlete.findUniqueOrThrow({where:{id:athleteId},include:{tournamentParticipants:{include:{event:true}},registrations:{include:{season:true}}}});
    const birth=data.dateOfBirth??old.dateOfBirth;
    const birthChanged=data.dateOfBirth&&data.dateOfBirth.getTime()!==old.dateOfBirth?.getTime();
    if(birthChanged&&old.registrations.some(reg=>!reg.season.seasonYear||getAgeDivision(data.dateOfBirth!,reg.season.seasonYear)!==reg.ageDivision))throw new HttpError(409,'Дата рождения конфликтует с архивной историей. Требуется отдельная сверка результатов.');
    if(birthChanged&&old.tournamentParticipants.some(p=>!p.ageDivision||getAgeDivision(data.dateOfBirth!,p.event.startsAt.getUTCFullYear())!==p.ageDivision))throw new HttpError(409,'Дата рождения конфликтует с историей участия в турнирах. Требуется сверка протоколов.');
    if((data.dateOfBirth&&data.dateOfBirth.getTime()!==old.dateOfBirth?.getTime())||(data.weightClassId&&data.weightClassId!==old.weightClassId)){
      const weightClassId=data.weightClassId??old.weightClassId;
      if(!birth||!weightClassId)throw new HttpError(400,'Укажите дату рождения и весовую категорию');
      await profileEligibility(tx,{dateOfBirth:birth,weightClassId,ageDivision});
    }
    const affiliations=await resolveAffiliations(tx,{...old,...data,clubName,coachName});
    return tx.athlete.update({where:{id:athleteId},data:{...data,...affiliations}});
  }));
}));
router.get('/matches',run(async(q,r)=>{
  const where:Prisma.MatchWhereInput={...(q.query.eventId?{eventId:String(q.query.eventId)}:{}),...(q.query.seasonId?{seasonId:String(q.query.seasonId)}:{})};
  if(q.query.ageDivision)where.ageDivision=divisionSchema.parse(q.query.ageDivision);
  if(q.query.titleOnly==='true')where.isTitleFight=true;
  if(q.query.weightClassId)where.weightClassId=String(q.query.weightClassId);
  if(q.query.status)where.status=parse(z.enum(['UPCOMING','LIVE','COMPLETED','CANCELLED']),q.query.status);
  const page=Math.max(1,Math.trunc(Number(q.query.page)||1)),limit=20;
  const [data,total]=await Promise.all([prisma.match.findMany({where,skip:(page-1)*limit,take:limit,orderBy:{scheduledAt:'desc'},include:{event:true,season:true,weightClass:true,athleteA:true,athleteB:true,winner:true,score:true}}),prisma.match.count({where})]);
  r.json({data,total,page,limit});
}));
const matchSchema=z.object({ageDivision:divisionSchema,eventId:id,weightClassId:id,athleteAId:id,athleteBId:id,scheduledAt:z.coerce.date(),isTitleFight:z.boolean().default(false)});
router.post('/matches',run(async(q,r)=>{
  const data=parse(matchSchema,q.body);
  r.status(201).json(await change(q.user!.id,'CREATE','Match',undefined,async tx=>{const event=await validateTournamentMatch(tx,data);if(await systemAvailable(tx)&&await tx.tournamentFormat.findUnique({where:{eventId_weightClassId:{eventId:data.eventId,weightClassId:data.weightClassId}}}))throw new HttpError(409,'В категории используется сетка. Создавайте схватки через групповой турнир');if(await tx.match.findFirst({where:{eventId:data.eventId,scheduledAt:data.scheduledAt,OR:[{athleteAId:data.athleteAId,athleteBId:data.athleteBId},{athleteAId:data.athleteBId,athleteBId:data.athleteAId}]}}))throw new HttpError(409,'Такая пара уже запланирована на это время');return tx.match.create({data:{...data,seasonId:event.seasonId}});}));
}));
router.patch('/matches/:id',run(async(q,r)=>{
  const data=parse(matchSchema.extend({status:z.enum(['UPCOMING','LIVE','CANCELLED'])}),q.body),matchId=String(q.params.id);
  r.json(await change(q.user!.id,'UPDATE','Match',matchId,async tx=>{
    const old=await tx.match.findUniqueOrThrow({where:{id:matchId}});
    // Event -> match -> weight, consistent with bracket/result transactions.
    for(const eventId of [...new Set([old.eventId,data.eventId])].sort())await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id"=${eventId} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id"=${matchId} FOR NO KEY UPDATE`;
    for(const weightId of [...new Set([old.weightClassId,data.weightClassId])].sort())await tx.$queryRaw`SELECT "id" FROM "WeightClass" WHERE "id"=${weightId} FOR UPDATE`;
    const current=await tx.match.findUniqueOrThrow({where:{id:matchId}});
    if(current.eventId!==old.eventId||current.weightClassId!==old.weightClassId)throw new HttpError(409,'Схватка изменена параллельно. Обновите страницу');
      if(await systemAvailable(tx)&&await tx.tournamentBout.findUnique({where:{matchId}}))throw new HttpError(409,'Пары сетки управляются в разделе группового турнира');
    if(current.status==='COMPLETED')throw new HttpError(409,'Сначала отмените результат завершённой схватки');
    const event=await validateTournamentMatch(tx,data);if(await tx.match.findFirst({where:{id:{not:matchId},eventId:data.eventId,scheduledAt:data.scheduledAt,OR:[{athleteAId:data.athleteAId,athleteBId:data.athleteBId},{athleteAId:data.athleteBId,athleteBId:data.athleteAId}]}}))throw new HttpError(409,'Такая пара уже запланирована на это время');return tx.match.update({where:{id:matchId},data:{...data,seasonId:event.seasonId}});
  }));
}));
router.post('/rankings/recalculate',run(async(q,r)=>{
  const data=parse(z.object({weightClassId:id}),q.body);
  r.json(await change(q.user!.id,'RECALCULATE','Ranking',data.weightClassId,async tx=>{
    await tx.weightClass.findUniqueOrThrow({where:{id:data.weightClassId}});
    await tx.$queryRaw`SELECT "id" FROM "WeightClass" WHERE "id"=${data.weightClassId} FOR UPDATE`;
    await recalculateRankings(tx,null,data.weightClassId,'manual');return {success:true};
  }));
}));
router.get('/championships',run(async(q,r)=>{
  r.json(await prisma.championship.findMany({where:{...(q.query.weightClassId?{weightClassId:String(q.query.weightClassId)}:{})},
    include:{athlete:true,season:true,weightClass:true},orderBy:{wonAt:'desc'}}));
}));
const mediaSchema=z.object({title:text,slug:z.string().min(2).max(160).regex(/^[a-z0-9-]+$/,'Адрес: латинские буквы, цифры и дефис'),category:text,excerpt:z.string().trim().min(1).max(10000),imageUrl,publishedAt:z.coerce.date().nullable().optional(),athleteId:id.nullable().optional()});
router.get('/media',run(async(_q,r)=>{r.json(await prisma.mediaPost.findMany({orderBy:[{publishedAt:'desc'},{id:'desc'}]}));}));
router.post('/media',run(async(q,r)=>{const data=parse(mediaSchema,q.body);r.status(201).json(await change(q.user!.id,'CREATE','MediaPost',undefined,tx=>tx.mediaPost.create({data})));}));
router.patch('/media/:id',run(async(q,r)=>{const data=parse(mediaSchema.partial(),q.body);r.json(await change(q.user!.id,'UPDATE','MediaPost',String(q.params.id),tx=>tx.mediaPost.update({where:{id:String(q.params.id)},data})));}));
router.delete('/media/:id',run(async(q,r)=>{await change(q.user!.id,'DELETE','MediaPost',String(q.params.id),tx=>tx.mediaPost.delete({where:{id:String(q.params.id)}}));r.json({success:true});}));
router.post('/uploads',express.raw({type:['image/png','image/jpeg','image/webp'],limit:'5mb'}),run(async(q,r)=>{
  const data=q.body as Buffer;
  if(!Buffer.isBuffer(data)||data.length<12)throw new HttpError(400,'Загрузите изображение PNG, JPEG или WebP до 5 МБ');
  const ext=data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':data[0]===255&&data[1]===216&&data[2]===255?'jpg':data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP'?'webp':null;
  if(!ext)throw new HttpError(400,'Файл не является поддерживаемым изображением');
  await mkdir(uploadDirectory,{recursive:true});const name=`${randomUUID()}.${ext}`;
  await writeFile(join(uploadDirectory,name),data,{flag:'wx'});
  r.status(201).json({url:`/uploads/${name}`});
}));
const clubSchema=z.object({name:text,city:text,country:text.default('Kyrgyzstan')});
const coachSchema=z.object({name:text,clubId:id.nullable().optional()});
router.get('/clubs',run(async(_q,r)=>{r.json(await prisma.club.findMany({include:{_count:{select:{athletes:true,coaches:true}}},orderBy:{name:'asc'}}));}));
router.post('/clubs',run(async(q,r)=>{const data=parse(clubSchema,q.body);r.status(201).json(await change(q.user!.id,'CREATE','Club',undefined,tx=>tx.club.create({data})));}));
router.patch('/clubs/:id',run(async(q,r)=>{const data=parse(clubSchema.partial(),q.body);r.json(await change(q.user!.id,'UPDATE','Club',String(q.params.id),tx=>tx.club.update({where:{id:String(q.params.id)},data})));}));
router.get('/coaches',run(async(_q,r)=>{r.json(await prisma.coach.findMany({include:{club:true,_count:{select:{athletes:true}}},orderBy:{name:'asc'}}));}));
router.post('/coaches',run(async(q,r)=>{const data=parse(coachSchema,q.body);r.status(201).json(await change(q.user!.id,'CREATE','Coach',undefined,tx=>tx.coach.create({data})));}));
router.patch('/coaches/:id',run(async(q,r)=>{const data=parse(coachSchema.partial(),q.body);r.json(await change(q.user!.id,'UPDATE','Coach',String(q.params.id),tx=>tx.coach.update({where:{id:String(q.params.id)},data})));}));
router.get('/users',run(async(_q,r)=>{r.json(await prisma.user.findMany({select:{id:true,email:true,role:true,isBlocked:true,createdAt:true},orderBy:{createdAt:'desc'}}));}));
router.patch('/users/:id',run(async(q,r)=>{
  const data=parse(z.object({role:z.enum(['ADMIN','REGISTRAR','MODERATOR','ATHLETE']).optional(),isBlocked:z.boolean().optional(),password:z.string().min(12).max(200).optional()}).strict().refine(value=>Object.keys(value).length>0),q.body);
  const {password,...fields}=data;
  const passwordHash=password?await bcrypt.hash(password,12):undefined;
  r.json(await change(q.user!.id,'UPDATE_SECURITY','User',String(q.params.id),tx=>tx.user.update({where:{id:String(q.params.id)},data:{...fields,...(passwordHash?{passwordHash}:{}),sessionVersion:{increment:1}},select:{id:true,email:true,role:true,isBlocked:true,createdAt:true}})));
}));
router.post('/users',run(async(q,r)=>{
  const {password,...user}=parse(z.object({email:z.string().email().transform(s=>s.toLowerCase()),password:z.string().min(12).max(200),role:z.enum(['ADMIN','REGISTRAR','MODERATOR','ATHLETE'])}),q.body);
  const passwordHash=await bcrypt.hash(password,12);
  r.status(201).json(await change(q.user!.id,'CREATE','User',undefined,tx=>tx.user.create({data:{...user,passwordHash},select:{id:true,email:true,role:true,createdAt:true}})));
}));
router.use(((error:unknown,_q,r,next)=>{
  const code=(error as {code?:string})?.code;
  if(code==='P2002')return r.status(409).json({error:'Запись с таким именем или адресом уже существует'});
  if(code==='P2025')return r.status(404).json({error:'Запись не найдена'});
  if(code==='P2003')return r.status(409).json({error:'Связанная запись недоступна. Обновите страницу и повторите действие.'});
  if(error instanceof z.ZodError)return r.status(400).json({error:'Проверьте параметры запроса'});
  if((error as {status?:number})?.status===413)return r.status(413).json({error:'Файл слишком большой. Максимум 5 МБ.'});
  next(error);
}) as express.ErrorRequestHandler);
