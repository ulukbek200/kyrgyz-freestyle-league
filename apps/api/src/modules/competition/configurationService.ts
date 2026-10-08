import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { HttpError, slugify, uniqueSuffix } from '../../lib/utils';
import { writeTransaction, logAudit } from '../../lib/transaction';
import { competitionRulesSchema, drawGroups, validateDraw, validateSeeding } from './competitionEngine';

export type Tx = Prisma.TransactionClient;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export function check(condition: unknown, message: string, status = 409): asserts condition { if (!condition) throw new HttpError(status, message); }
export function domain<T>(fn:()=>T):T {try{return fn();}catch(e){throw new HttpError(400,(e as Error).message);}}
const identifier=z.string().min(1).max(150);
const reason=z.string().trim().min(8).max(2000);
const seedPair=z.object({a:z.object({group:identifier,rank:z.number().int().positive()}),b:z.object({group:identifier,rank:z.number().int().positive()})});
export const configSchema=z.object({
  name:z.string().trim().min(3).max(150),region:z.string().trim().min(2).max(150),startDate:z.coerce.date(),
  ageCategoryId:identifier,ageReferenceDate:z.coerce.date().nullable().optional(),
  territoryIds:z.array(identifier).min(2).max(32),weightClassIds:z.array(identifier).min(1).max(32),
  groupCodes:z.array(z.string().regex(/^[A-Z][A-Z0-9]{0,7}$/)).min(2).max(16),
  territoryQuota:z.number().int().min(2).max(16),advanceCount:z.number().int().min(1).max(16),
  groupWeeks:z.number().int().min(1).max(31),firstPlayoffWeek:z.number().int().min(2).max(52),
  seeding:z.array(seedPair).optional(),isPublished:z.boolean().default(false),
}).strict();
export const divisionInclude = {
  competition: { include: { territories: true, ageCategory: true, ruleset: true, season: true } },
  weightClass: true,
  groups: {
    orderBy: { code: 'asc' as const },
    include: { members: { orderBy: { position: 'asc' as const }, include: { participant: { include: { athlete: true, territory: true } } } } },
  },
};
export async function division(tx:Tx,id:string,competitionId?:string){
  const d=await tx.competitionDivision.findUnique({where:{id},include:divisionInclude});
  check(d&&(!competitionId||d.competitionId===competitionId),'Competition division not found',404);return d;
}
export async function approval(tx:Tx,competitionId:string,divisionId:string|null,userId:string,action:string,revision:number,snapshot:unknown,why?:string){
  await tx.competitionApproval.create({data:{competitionId,divisionId,userId,action,revision,snapshot:json(snapshot),reason:why}});
  await logAudit(tx,userId,'competition.'+action,'Competition',competitionId,{divisionId,revision,reason:why,snapshot});
}
function unique(values:string[]){return new Set(values).size===values.length;}

export async function saveTerritory(id:string|undefined,input:unknown,userId:string){
  const d=z.object({name:z.string().trim().min(2).max(100),region:z.string().trim().min(2).max(100),isActive:z.boolean().default(true)}).strict().parse(input);
  return writeTransaction(async tx=>{const row=id?await tx.territory.update({where:{id},data:d}):await tx.territory.create({data:d});await logAudit(tx,userId,'competition.territory.save','Territory',row.id,d);return row;});
}
export async function saveAgeCategory(id:string|undefined,input:unknown,userId:string){
  const d=z.object({name:z.string().trim().min(2).max(80),minAge:z.number().int().min(0).max(100).nullable(),maxAge:z.number().int().min(0).max(100).nullable()}).strict().parse(input);
  check(d.minAge===null||d.maxAge===null||d.minAge<=d.maxAge,'Invalid age range',400);
  return writeTransaction(async tx=>{if(id)check(!await tx.competitionParticipant.count({where:{competition:{ageCategoryId:id}}}),'Age category is in use; create a new policy to preserve eligibility history');const row=id?await tx.competitionAgeCategory.update({where:{id},data:d}):await tx.competitionAgeCategory.create({data:d});await logAudit(tx,userId,'competition.age.save','CompetitionAgeCategory',row.id,d);return row;});
}
export async function saveCompetition(id:string|undefined,input:unknown,userId:string){
  const d=configSchema.parse(input);
  check(unique(d.territoryIds)&&unique(d.weightClassIds)&&unique(d.groupCodes),'Duplicate configuration entry',400);
  check(d.territoryIds.length%2===0&&d.territoryQuota===d.groupCodes.length,'Each territory must supply one athlete per group; an even territory count is required',400);
  check(d.groupWeeks===d.territoryIds.length-1&&d.firstPlayoffWeek>d.groupWeeks,'Round Robin weeks must equal group size minus one; playoffs start after groups',400);
  check(d.advanceCount<=d.territoryIds.length,'Too many qualifiers per group',400);
  if(d.seeding)domain(()=>validateSeeding(d.seeding!,d.groupCodes,d.advanceCount));
  return writeTransaction(async tx=>{
    const age=await tx.competitionAgeCategory.findUniqueOrThrow({where:{id:d.ageCategoryId}});
    check(age.minAge===null&&age.maxAge===null||d.ageReferenceDate,'Set the age reference date for age eligibility',400);
    check(await tx.territory.count({where:{id:{in:d.territoryIds},isActive:true}})===d.territoryIds.length,'Invalid or inactive territory',400);
    check(await tx.weightClass.count({where:{id:{in:d.weightClassIds}}})===d.weightClassIds.length,'Invalid weight class',400);
    const old=id?await tx.competition.findUniqueOrThrow({where:{id},include:{season:true,territories:true,divisions:true}}):null;
    const effectiveSeeding = d.seeding === undefined ? (old?.seeding ?? undefined) : d.seeding;
    if(old){
      const structural=old.region!==d.region||old.ageCategoryId!==d.ageCategoryId||String(old.ageReferenceDate)!==String(d.ageReferenceDate??null)||JSON.stringify(old.groupCodes)!==JSON.stringify(d.groupCodes)||old.advanceCount!==d.advanceCount||old.territoryQuota!==d.territoryQuota||old.groupWeeks!==d.groupWeeks||old.firstPlayoffWeek!==d.firstPlayoffWeek||JSON.stringify(old.territories.map(t=>t.territoryId).sort())!==JSON.stringify([...d.territoryIds].sort())||JSON.stringify(old.divisions.map(x=>x.weightClassId).sort())!==JSON.stringify([...d.weightClassIds].sort());
      check(!structural||!await tx.competitionParticipant.count({where:{competitionId:old.id}}),'Structural configuration is locked after participants are registered');
      const onlyPublicationChange = old.isPublished !== d.isPublished
        && old.region === d.region
        && old.ageCategoryId === d.ageCategoryId
        && String(old.ageReferenceDate) === String(d.ageReferenceDate ?? null)
        && JSON.stringify(old.groupCodes) === JSON.stringify(d.groupCodes)
        && old.territoryQuota === d.territoryQuota
        && old.advanceCount === d.advanceCount
        && old.groupWeeks === d.groupWeeks
        && old.firstPlayoffWeek === d.firstPlayoffWeek
        && old.season.name === d.name
        && String(old.season.startDate) === String(d.startDate)
        && JSON.stringify(old.territories.map(x=>x.territoryId).sort()) === JSON.stringify([...d.territoryIds].sort())
        && JSON.stringify(old.divisions.map(x=>x.weightClassId).sort()) === JSON.stringify([...d.weightClassIds].sort());
      check(onlyPublicationChange || !old.divisions.some(x=>x.bracketApprovedAt)||JSON.stringify(old.seeding)===JSON.stringify(effectiveSeeding??null),'Seeding is locked after bracket approval');
    }
    const season=old?await tx.season.update({where:{id:old.seasonId},data:{name:d.name,startDate:d.startDate}}):await tx.season.create({data:{name:d.name,slug:slugify(d.name)+'-'+uniqueSuffix(),startDate:d.startDate}});
    const data={region:d.region,ageCategoryId:d.ageCategoryId,ageReferenceDate:d.ageReferenceDate,groupCodes:d.groupCodes,territoryQuota:d.territoryQuota,advanceCount:d.advanceCount,groupWeeks:d.groupWeeks,firstPlayoffWeek:d.firstPlayoffWeek,isPublished:d.isPublished,seeding:effectiveSeeding?json(effectiveSeeding):Prisma.DbNull};
    const c=old?await tx.competition.update({where:{id:old.id},data}):await tx.competition.create({data:{...data,seasonId:season.id,ruleset:{create:{}}}});
    await tx.competitionTerritory.deleteMany({where:{competitionId:c.id}});
    await tx.competitionTerritory.createMany({data:d.territoryIds.map(territoryId=>({competitionId:c.id,territoryId}))});
    for(const weightClassId of d.weightClassIds){await tx.seasonWeightClass.upsert({where:{seasonId_weightClassId:{seasonId:season.id,weightClassId}},create:{seasonId:season.id,weightClassId},update:{}});await tx.competitionDivision.upsert({where:{competitionId_weightClassId:{competitionId:c.id,weightClassId}},create:{competitionId:c.id,weightClassId},update:{}});}
    await tx.competitionDivision.deleteMany({where:{competitionId:c.id,weightClassId:{notIn:d.weightClassIds}}});
    await tx.seasonWeightClass.deleteMany({where:{seasonId:season.id,weightClassId:{notIn:d.weightClassIds}}});
    await approval(tx,c.id,null,userId,'configuration.save',0,{before:old,after:d});return c;
  });
}

export async function saveParticipant(competitionId:string,input:unknown,userId:string){
  const d=z.object({athleteId:identifier,territoryId:identifier,weightClassId:identifier}).strict().parse(input);
  return writeTransaction(async tx=>{
    const c=await tx.competition.findUniqueOrThrow({where:{id:competitionId},include:{ageCategory:true,territories:true}});
    const div=await tx.competitionDivision.findUniqueOrThrow({where:{competitionId_weightClassId:{competitionId,weightClassId:d.weightClassId}}});
    check(!div.drawApprovedAt,'Approved draw: use the draw amendment process');
    const a=await tx.athlete.findUniqueOrThrow({where:{id:d.athleteId}});
    check(a.status==='ACTIVE'&&!a.isArchived&&a.weightClassId===d.weightClassId,'Athlete is not eligible for this weight class',400);
    check(c.territories.some(t=>t.territoryId===d.territoryId),'Territory does not belong to this competition',400);
    if(c.ageReferenceDate&&(c.ageCategory.minAge!==null||c.ageCategory.maxAge!==null)){
      check(a.birthDate,'Birth date is required for age eligibility',400);
      let age=c.ageReferenceDate.getUTCFullYear()-a.birthDate.getUTCFullYear();
      if(c.ageReferenceDate.getUTCMonth()<a.birthDate.getUTCMonth()||(c.ageReferenceDate.getUTCMonth()===a.birthDate.getUTCMonth()&&c.ageReferenceDate.getUTCDate()<a.birthDate.getUTCDate()))age--;
      check((c.ageCategory.minAge===null||age>=c.ageCategory.minAge)&&(c.ageCategory.maxAge===null||age<=c.ageCategory.maxAge),'Athlete is outside the approved age range',400);
    }
    const old=await tx.competitionParticipant.findUnique({where:{competitionId_athleteId:{competitionId,athleteId:d.athleteId}}});
    if(old){const oldDiv=await tx.competitionDivision.findUniqueOrThrow({where:{competitionId_weightClassId:{competitionId,weightClassId:old.weightClassId}}});check(!oldDiv.drawApprovedAt,'Existing group membership is approved');check(!await tx.competitionGroupMember.findUnique({where:{participantId:old.id}}),'Redraw the draft after changing participant allocation');}
    check(await tx.competitionParticipant.count({where:{competitionId,weightClassId:d.weightClassId,territoryId:d.territoryId,withdrawnAt:null,...(old?{id:{not:old.id}}:{})}})<c.territoryQuota,'Territory quota is full',400);
    const p=await tx.competitionParticipant.upsert({where:{competitionId_athleteId:{competitionId,athleteId:d.athleteId}},create:{competitionId,...d},update:d});
    await tx.seasonAthlete.upsert({where:{seasonId_athleteId:{seasonId:c.seasonId,athleteId:a.id}},create:{seasonId:c.seasonId,athleteId:a.id},update:{}});
    await approval(tx,competitionId,div.id,userId,'participant.save',div.revision,{before:old,after:p});return p;
  });
}

export async function drawPreview(divisionId:string,seed:string){
  const d=await division(prisma,divisionId);
  const entrants=await prisma.competitionParticipant.findMany({where:{competitionId:d.competitionId,weightClassId:d.weightClassId,withdrawnAt:null},include:{athlete:true,territory:true}});
  const groups=domain(()=>drawGroups(entrants.map(p=>({id:p.id,territoryId:p.territoryId})),d.competition.territories.map(t=>t.territoryId),d.competition.groupCodes.length,seed));
  return {seed,revision:d.revision,groups:d.competition.groupCodes.map((code,i)=>({code,participantIds:groups[i]})),participants:entrants};
}
export async function saveDraw(divisionId:string,input:unknown,userId:string){
  const d=z.object({seed:z.string().min(1).max(100),revision:z.number().int(),groups:z.array(z.object({code:identifier,participantIds:z.array(identifier)})),amend:z.boolean().default(false),reason:reason.optional()}).strict().parse(input);
  return writeTransaction(async tx=>{
    const div=await division(tx,divisionId);check(div.revision===d.revision,'Draw changed; reload before saving');
    if(div.drawApprovedAt){check(d.amend&&d.reason,'Approved draw requires an explicit amendment and reason');check(!await tx.competitionFixture.count({where:{divisionId,match:{status:{in:['COMPLETED','LIVE']}}}}),'A played/live draw cannot be replaced; resolve results first');}
    check(!await tx.competitionFixture.count({where:{divisionId}}),'Existing schedule must be explicitly retired before changing groups');
    const entrants=await tx.competitionParticipant.findMany({where:{competitionId:div.competitionId,weightClassId:div.weightClassId,withdrawnAt:null}});
    check(unique(d.groups.map(g=>g.code))&&d.groups.length===div.competition.groupCodes.length&&d.groups.every(g=>div.competition.groupCodes.includes(g.code)),'Invalid group codes',400);
    domain(()=>validateDraw(d.groups.map(g=>g.participantIds),entrants.map(p=>({id:p.id,territoryId:p.territoryId})),div.competition.territories.map(t=>t.territoryId),div.competition.groupCodes.length));
    await tx.competitionGroupMember.deleteMany({where:{group:{divisionId}}});
    for(const g of d.groups){const group=await tx.competitionGroup.upsert({where:{divisionId_code:{divisionId,code:g.code}},create:{divisionId,code:g.code},update:{}});await tx.competitionGroupMember.createMany({data:g.participantIds.map((participantId,position)=>({groupId:group.id,participantId,position}))});}
    const changed=await tx.competitionDivision.update({where:{id:divisionId},data:{drawSeed:d.seed,drawApprovedAt:null,revision:{increment:1},tieOrders:Prisma.DbNull,qualification:Prisma.DbNull,qualificationApprovedAt:null}});
    await approval(tx,div.competitionId,divisionId,userId,d.amend?'draw.amend':'draw.save',changed.revision,{before:div.groups,after:d.groups},d.reason);return changed;
  });
}
export async function approveDraw(divisionId:string,input:unknown,userId:string){
  const {revision}=z.object({revision:z.number().int()}).strict().parse(input);
  return writeTransaction(async tx=>{const d=await division(tx,divisionId);check(d.revision===revision,'Draw changed; reload');
    const entrants=d.groups.flatMap(g=>g.members.map(m=>({id:m.participantId,territoryId:m.participant.territoryId,withdrawn:!!m.participant.withdrawnAt})));
    domain(()=>validateDraw(d.groups.map(g=>g.members.map(m=>m.participantId)),entrants,d.competition.territories.map(t=>t.territoryId),d.competition.groupCodes.length));
    check(d.groups.every(g=>g.members.every(m=>m.participant.athlete.status==='ACTIVE'&&!m.participant.athlete.isArchived&&m.participant.athlete.weightClassId===d.weightClassId)),'Ineligible participant in draw');
    await tx.competitionDivision.update({where:{id:divisionId},data:{drawApprovedAt:new Date()}});
    await approval(tx,d.competitionId,divisionId,userId,'draw.approve',revision,d.groups);return {approved:true};});
}
export async function saveRules(competitionId:string,input:unknown,userId:string,approve=false){
  const d=z.object({config:competitionRulesSchema,revision:z.number().int()}).strict().parse(input);
  return writeTransaction(async tx=>{
    const existing=await tx.competitionRuleset.findUniqueOrThrow({where:{competitionId}});check(existing.revision===d.revision,'Rules changed; reload');
    check(!existing.approvedAt||!await tx.competitionFixture.count({where:{division:{competitionId},confirmedAt:{not:null}}}),'Approved rules are locked after official results');
    const r=await tx.competitionRuleset.update({where:{competitionId},data:{config:json(d.config),approvedAt:approve?new Date():null,revision:{increment:1}}});
    await approval(tx,competitionId,null,userId,approve?'rules.approve':'rules.save',r.revision,d.config);return r;
  });
}
