import type {Prisma} from '@prisma/client';
import {z} from 'zod';

export const affiliationName=z.string().trim().max(250).transform(value=>value.replace(/\s+/g,' ')).nullable().optional();

// Call inside the athlete/application transaction so failed saves leave no directory entries.
export async function resolveAffiliations(tx:Prisma.TransactionClient,input:{
  clubName?:string|null;coachName?:string|null;clubId?:string|null;coachId?:string|null;
  city:string;country:string;
}){
  let clubId=input.clubId,coachId=input.coachId;
  if(input.clubName===undefined&&input.coachName===undefined)return {clubId,coachId};
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(734621908)`;
  if(input.clubName!==undefined){
    const name=input.clubName?.trim().replace(/\s+/g,' ');
    clubId=name?(await tx.club.findFirst({where:{name:{equals:name,mode:'insensitive'}},orderBy:{id:'asc'}})??await tx.club.create({data:{name,city:input.city,country:input.country}})).id:null;
  }
  if(input.coachName!==undefined){
    const name=input.coachName?.trim().replace(/\s+/g,' ');
    coachId=name?(await tx.coach.findFirst({where:{name:{equals:name,mode:'insensitive'},clubId:clubId??null},orderBy:{id:'asc'}})??await tx.coach.create({data:{name,clubId:clubId??null}})).id:null;
  }
  return {clubId,coachId};
}
