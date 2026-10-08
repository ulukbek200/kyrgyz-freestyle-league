import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { writeTransaction } from '../../lib/transaction';
import { approval, check, division, json } from './configurationService';
import { advanceBracket } from './competitionService';

const source=z.object({fixtureId:z.string().min(1),outcome:z.enum(['WINNER','LOSER'])});
export async function addClassificationMatch(divisionId:string,input:unknown,userId:string){
  const d=z.object({key:z.string().regex(/^CLASS:[A-Za-z0-9_-]{1,50}$/),a:source,b:source,week:z.number().int().min(1).max(104),eventId:z.string(),scheduledAt:z.coerce.date(),callTime:z.coerce.date().nullable().optional(),matNumber:z.string().max(30).optional()}).strict().parse(input);
  return writeTransaction(async tx=>{const div=await division(tx,divisionId);check(div.bracketApprovedAt,'Generate the approved main bracket first');check(!div.placementsApprovedAt,'Final placements are approved');
    const parents=await tx.competitionFixture.findMany({where:{id:{in:[d.a.fixtureId,d.b.fixtureId]},divisionId,stage:{not:'GROUP'}}});
    check(parents.length===new Set([d.a.fixtureId,d.b.fixtureId]).size,'Classification sources must belong to this bracket',400);
    check(d.a.fixtureId!==d.b.fixtureId||d.a.outcome!==d.b.outcome,'An athlete cannot be paired with themselves',400);
    check(parents.every(p=>p.week<=d.week),'Classification week precedes a source stage',400);
    const event=await tx.event.findUniqueOrThrow({where:{id:d.eventId}});check(event.seasonId===div.competition.seasonId,'Event/season mismatch',400);
    check(!d.callTime||d.callTime<=d.scheduledAt,'Call Time must not follow fight time',400);
    const f=await tx.competitionFixture.create({data:{divisionId,key:d.key,stage:'CLASSIFICATION',week:d.week,round:Math.max(...parents.map(p=>p.round))+1,position:1,sourceAId:d.a.fixtureId,outcomeA:d.a.outcome,sourceBId:d.b.fixtureId,outcomeB:d.b.outcome,eventId:d.eventId,scheduledAt:d.scheduledAt,callTime:d.callTime,matNumber:d.matNumber}});
    await advanceBracket(tx,divisionId);await approval(tx,div.competitionId,divisionId,userId,'classification.match.create',div.revision,d);return f;});
}
export const classificationSchema=z.object({places:z.array(z.object({place:z.number().int().min(3).max(5),fixtureKey:z.string().min(1),outcome:z.enum(['WINNER','LOSER'])})).length(3),reason:z.string().trim().min(8).max(2000)}).strict();
export async function approveClassification(competitionId:string,input:unknown,userId:string){
  const d=classificationSchema.parse(input);check(new Set(d.places.map(p=>p.place)).size===3,'Specify places 3, 4 and 5 exactly once',400);
  check(new Set(d.places.map(p=>p.fixtureKey+':'+p.outcome)).size===3,'Each placement needs a distinct source outcome',400);
  return writeTransaction(async tx=>{const c=await tx.competition.findUniqueOrThrow({where:{id:competitionId}});
    check(!await tx.competitionDivision.count({where:{competitionId,placementsApprovedAt:{not:null}}}),'Final placements are already approved');
    check(!await tx.competitionFixture.count({where:{division:{competitionId},stage:'CLASSIFICATION',confirmedAt:{not:null}}}),'Classification rules are locked after classification results');
    await tx.competition.update({where:{id:competitionId},data:{classificationRules:json(d.places),classificationApprovedAt:new Date()}});
    await approval(tx,c.id,null,userId,'classification.rules.approve',0,{before:c.classificationRules,after:d.places},d.reason);return {approved:true};});
}
export async function approvePlacements(divisionId:string,input:unknown,userId:string){
  const d=z.object({revision:z.number().int(),reason:z.string().trim().min(8).max(2000)}).strict().parse(input);
  return writeTransaction(async tx=>{const div=await division(tx,divisionId);check(div.revision===d.revision,'Results changed; reload');check(div.competition.classificationApprovedAt&&div.competition.classificationRules,'PENDING CLASSIFICATION: approve the classification scheme first');
    const fixtures=await tx.competitionFixture.findMany({where:{divisionId,stage:{not:'GROUP'}},include:{match:true}});
    const final=fixtures.find(f=>f.stage==='FINAL');check(final?.confirmedAt&&final.match?.status==='COMPLETED','Final result is not officially confirmed');
    const rules=div.competition.classificationRules as Array<{place:number;fixtureKey:string;outcome:string}>;
    const assignments=[{place:1,fixtureKey:final.key,outcome:'WINNER'},{place:2,fixtureKey:final.key,outcome:'LOSER'},...rules];
    const rows: Prisma.CompetitionPlacementCreateManyInput[]=[];
    for(const assignment of assignments){const f=fixtures.find(f=>f.key===assignment.fixtureKey);check(f?.confirmedAt&&f.match?.status==='COMPLETED'&&f.match.winnerId,'A classification source result is missing');
      const athleteId=assignment.outcome==='WINNER'?f.match.winnerId:f.match.winnerId===f.match.athleteAId?f.match.athleteBId:f.match.athleteAId;
      const participant=await tx.competitionParticipant.findUniqueOrThrow({where:{competitionId_athleteId:{competitionId:div.competitionId,athleteId}}});
      check(!participant.withdrawnAt,'A withdrawn participant cannot receive an approved placement');rows.push({divisionId,place:assignment.place,participantId:participant.id,basisFixtureId:f.id});}
    check(new Set(rows.map(r=>r.participantId)).size===5,'Classification does not yield five distinct athletes');
    await tx.competitionPlacement.deleteMany({where:{divisionId}});await tx.competitionPlacement.createMany({data:rows});
    await tx.competitionDivision.update({where:{id:divisionId},data:{placementsApprovedAt:new Date()}});
    await approval(tx,div.competitionId,divisionId,userId,'placements.approve',div.revision,rows,d.reason);return rows;});
}
