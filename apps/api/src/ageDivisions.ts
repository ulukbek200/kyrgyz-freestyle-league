import type {AgeDivision, Prisma} from '@prisma/client';
import {z} from 'zod';
import {HttpError} from './http.js';

export const divisionSchema=z.enum(['U17','U23']);
export const DIVISIONS=[
  {id:'U17' as const,name:'Младший дивизион',minAge:16,maxAge:17,weights:[45,48,51,55,60,65,70]},
  {id:'U23' as const,name:'Старший дивизион',minAge:18,maxAge:23,weights:[57,61,65,70,74]},
];
export function getSeasonAge(dateOfBirth:Date,seasonYear:number):number {
  if(!Number.isInteger(seasonYear)||seasonYear<1900||seasonYear>2200||!Number.isFinite(dateOfBirth.getTime()))throw new HttpError(400,'Укажите корректные дату рождения и год сезона');
  return seasonYear-dateOfBirth.getUTCFullYear();
}
export function getAgeDivision(dateOfBirth:Date,seasonYear:number):AgeDivision|null {
  const age=getSeasonAge(dateOfBirth,seasonYear);
  return DIVISIONS.find(d=>age>=d.minAge&&age<=d.maxAge)?.id??null;
}
export function validWeight(division:AgeDivision,kilograms:number) {
  return DIVISIONS.find(d=>d.id===division)!.weights.includes(kilograms);
}
export async function profileEligibility(tx:Prisma.TransactionClient,input:{dateOfBirth:Date;weightClassId:string;ageDivision?:AgeDivision;weightKg?:number},referenceYear=new Date().getUTCFullYear()) {
  const ageDivision=getAgeDivision(input.dateOfBirth,referenceYear);
  if(!ageDivision)throw new HttpError(400,`По году рождения участие в U17/U23 в ${referenceYear} году недоступно`);
  if(input.ageDivision&&input.ageDivision!==ageDivision)throw new HttpError(400,`Дата рождения соответствует ${ageDivision}`);
  const weight=await tx.weightClass.findUnique({where:{id:input.weightClassId}});
  if(!weight||weight.ageDivision!==ageDivision||!validWeight(ageDivision,weight.kilograms))throw new HttpError(400,'Весовая категория не соответствует возрастному дивизиону');
  if(input.weightKg!==undefined&&input.weightKg>weight.kilograms)throw new HttpError(400,'Фактический вес превышает предел категории');
  return {ageDivision,weight};
}
export async function eligibility(tx:Prisma.TransactionClient,input:{dateOfBirth:Date;seasonId:string;weightClassId:string;ageDivision?:AgeDivision;weightKg?:number}) {
  const [season,weight]=await Promise.all([tx.season.findUnique({where:{id:input.seasonId}}),tx.weightClass.findUnique({where:{id:input.weightClassId}})]);
  if(!season?.seasonYear)throw new HttpError(400,'Выберите сезон с указанным годом соревнований');
  const ageDivision=getAgeDivision(input.dateOfBirth,season.seasonYear);
  if(!ageDivision)throw new HttpError(400,'По вашему году рождения участие в дивизионах U17 и U23 в выбранном сезоне недоступно');
  if(input.ageDivision&&input.ageDivision!==ageDivision)throw new HttpError(400,`Дата рождения соответствует ${ageDivision}. Переключите дивизион.`);
  if(!weight||weight.ageDivision!==ageDivision||!validWeight(ageDivision,weight.kilograms))throw new HttpError(400,'Весовая категория не соответствует возрастному дивизиону');
  if(input.weightKg!==undefined&&input.weightKg>weight.kilograms)throw new HttpError(400,'Фактический вес превышает предел выбранной категории');
  return {ageDivision,season,weight};
}
export async function registerAthlete(tx:Prisma.TransactionClient,input:{athleteId:string;dateOfBirth:Date;seasonId:string;weightClassId:string;ageDivision?:AgeDivision}) {
  const {ageDivision}=await eligibility(tx,input);
  const old=await tx.athleteSeasonRegistration.findUnique({where:{athleteId_seasonId:{athleteId:input.athleteId,seasonId:input.seasonId}}});
  if(old&&(old.weightClassId!==input.weightClassId||old.ageDivision!==ageDivision)&&await tx.match.count({where:{seasonId:input.seasonId,OR:[{athleteAId:input.athleteId},{athleteBId:input.athleteId}]}}))throw new HttpError(409,'В сезоне уже есть схватки. Изменение регистрации требует отдельной сверки истории.');
  const data={athleteId:input.athleteId,seasonId:input.seasonId,weightClassId:input.weightClassId,ageDivision,status:'ACTIVE' as const};
  return tx.athleteSeasonRegistration.upsert({where:{athleteId_seasonId:{athleteId:input.athleteId,seasonId:input.seasonId}},create:data,update:data});
}
export async function validateDivisionMatch(tx:Prisma.TransactionClient,data:{seasonId:string;eventId:string;weightClassId:string;athleteAId:string;athleteBId:string;ageDivision:AgeDivision}) {
  if(data.athleteAId===data.athleteBId)throw new HttpError(400,'Выберите двух разных спортсменов');
  // Profile edits and pair creation serialize on the same athlete rows.
  const ids=[data.athleteAId,data.athleteBId].sort();
  for(const athleteId of ids)await tx.$queryRaw`SELECT "id" FROM "Athlete" WHERE "id"=${athleteId} FOR UPDATE`;
  const event=await tx.event.findUnique({where:{id:data.eventId}});
  if(!event||event.seasonId!==data.seasonId||event.ageDivision!==data.ageDivision)throw new HttpError(400,'Сезон и дивизион схватки должны соответствовать турниру');
  for(const athleteId of ids){
    const athlete=await tx.athlete.findUnique({where:{id:athleteId}});
    const registration=await tx.athleteSeasonRegistration.findUnique({where:{athleteId_seasonId:{athleteId,seasonId:data.seasonId}}});
    if(!athlete?.dateOfBirth||athlete.status!=='ACTIVE'||!registration||registration.status!=='ACTIVE'||registration.ageDivision!==data.ageDivision||registration.weightClassId!==data.weightClassId)throw new HttpError(400,'Нужны два активных спортсмена с регистрацией в одном сезоне, дивизионе и весе');
    await eligibility(tx,{...data,dateOfBirth:athlete.dateOfBirth});
  }
}

// Public endpoints must never expose birth dates or account links, including nested athletes.
export function publicData(value:unknown):unknown {
  if(value instanceof Date)return value;
  if(Array.isArray(value))return value.map(publicData);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>!['dateOfBirth','birthDate','userId','registrations'].includes(key)).map(([key,v])=>[key,publicData(v)]));
  return value;
}
