import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { slugify, uniqueSuffix } from '../../lib/utils';
import { writeTransaction } from '../../lib/transaction';
import { resultSchema, submitResultTx, validateAdmission } from '../matches/matchService';
import { approval, check, division, domain, json, Tx } from './configurationService';
import { assertQualification, descendants, roundRobin, validateSeeding, SeedPair } from './competitionEngine';
import { standings, youtubeId } from './competitionViews';

const reason=z.string().trim().min(8).max(2000);
const scheduleSchema=z.object({eventId:z.string().min(1),scheduledAt:z.coerce.date(),callTime:z.coerce.date().nullable().optional(),matNumber:z.string().trim().min(1).max(30).nullable().optional(),estimatedStart:z.boolean().default(true)}).strict();
async function fixture(tx:Tx,id:string){const f=await tx.competitionFixture.findUnique({where:{id},include:{match:true,division:{include:{competition:true}},seedA:true,seedB:true}});check(f,'Fixture not found',404);return f;}
async function eventForWeek(tx:Tx,c:{id:string;seasonId:string},week:number){
  const season=await tx.season.findUniqueOrThrow({where:{id:c.seasonId}});
  const name=season.name+' — Week '+week;
  const existing=await tx.event.findFirst({where:{seasonId:c.seasonId,name}});if(existing)return existing;
  return tx.event.create({data:{seasonId:c.seasonId,name,slug:slugify(name)+'-'+uniqueSuffix(),date:new Date(+season.startDate+(week-1)*7*86400000),isPublished:false}});
}
async function createSlotMatch(tx:Tx,f:Awaited<ReturnType<typeof fixture>>,athleteAId:string,athleteBId:string){
  check(f.eventId&&f.scheduledAt,'Assign an event and scheduled time first');
  const event=await tx.event.findUniqueOrThrow({where:{id:f.eventId}});check(event.seasonId===f.division.competition.seasonId,'Event belongs to another season',400);
  const scope={seasonId:event.seasonId,weightClassId:f.division.weightClassId,athleteAId,athleteBId};
  await validateAdmission(tx,scope);
  const match=await tx.match.create({data:{...scope,eventId:event.id,scheduledAt:f.scheduledAt,type:'REGULAR',countsForLeagueRanking:false}});
  await tx.competitionFixture.update({where:{id:f.id},data:{matchId:match.id}});return match;
}
export async function generateRoundRobin(divisionId:string,input:unknown,userId:string){
  const d=z.object({revision:z.number().int(),weeks:z.array(z.object({week:z.number().int().positive(),eventId:z.string().min(1)})).optional()}).strict().parse(input);
  return writeTransaction(async tx=>{
    const div=await division(tx,divisionId);check(div.revision===d.revision&&div.drawApprovedAt,'An approved, current draw is required');
    check(!await tx.competitionFixture.count({where:{divisionId}}),'Schedule already exists');
    if(d.weeks)check(d.weeks.length===div.competition.groupWeeks&&new Set(d.weeks.map(w=>w.week)).size===d.weeks.length&&d.weeks.every(w=>w.week>=1&&w.week<=div.competition.groupWeeks),'Provide one event for every group week',400);
    const events=new Map<number,Awaited<ReturnType<typeof eventForWeek>>>();
    for(let week=1;week<=div.competition.groupWeeks;week++){
      const ref=d.weeks?.find(w=>w.week===week);
      const event=ref?await tx.event.findUniqueOrThrow({where:{id:ref.eventId}}):await eventForWeek(tx,div.competition,week);
      check(event.seasonId===div.competition.seasonId,'Event belongs to another season',400);events.set(week,event);
    }
    for(const g of div.groups){
      const pairs=domain(()=>roundRobin(g.members.map(m=>m.participant.athleteId)));
      for(const pair of pairs){
        const event=events.get(pair.round)!;
        const f=await tx.competitionFixture.create({data:{divisionId,groupId:g.id,key:'GROUP:'+g.code+':'+pair.round+':'+pair.position,stage:'GROUP',week:pair.round,round:pair.round,position:pair.position,eventId:event.id,scheduledAt:event.date,
          seedAId:g.members.find(m=>m.participant.athleteId===pair.athleteAId)!.participantId,seedBId:g.members.find(m=>m.participant.athleteId===pair.athleteBId)!.participantId}});
        await createSlotMatch(tx,await fixture(tx,f.id),pair.athleteAId,pair.athleteBId);
      }
    }
    await approval(tx,div.competitionId,divisionId,userId,'schedule.generate',div.revision,{matches:div.groups.length*div.competition.territories.length*(div.competition.territories.length-1)/2});
    return {created:await tx.competitionFixture.count({where:{divisionId}})};
  });
}
export async function retireDraftSchedule(divisionId:string,input:unknown,userId:string){
  const d=z.object({reason}).strict().parse(input);
  return writeTransaction(async tx=>{const div=await division(tx,divisionId);const list=await tx.competitionFixture.findMany({where:{divisionId},include:{match:true}});
    check(list.every(f=>!f.confirmedAt&&!['COMPLETED','LIVE'].includes(f.match?.status??'')),'Only an unplayed schedule can be retired');
    check(!div.bracketApprovedAt,'An approved bracket cannot be retired as a group draft');
    await approval(tx,div.competitionId,divisionId,userId,'schedule.retire',div.revision,list,d.reason);
    await tx.match.updateMany({where:{id:{in:list.flatMap(f=>f.matchId?[f.matchId]:[])}},data:{status:'CANCELLED'}});
    await tx.competition.updateMany({where:{currentFixtureId:{in:list.map(f=>f.id)}},data:{currentFixtureId:null,liveActive:false}});
    await tx.competitionFixture.deleteMany({where:{divisionId}});
    await tx.competitionDivision.update({where:{id:divisionId},data:{drawApprovedAt:null,revision:{increment:1}}});return {retired:list.length};});
}

export async function updateSchedule(id:string,input:unknown,userId:string){
  const d=scheduleSchema.parse(input);
  return writeTransaction(async tx=>{const f=await fixture(tx,id);check(!f.confirmedAt&&f.match?.status!=='COMPLETED','A confirmed fixture cannot be rescheduled');
    const event=await tx.event.findUniqueOrThrow({where:{id:d.eventId}});check(event.seasonId===f.division.competition.seasonId,'Event/season mismatch',400);
    check(!d.callTime||d.callTime<=d.scheduledAt,'Call Time cannot be after the estimated fight time',400);
    await tx.competitionFixture.update({where:{id},data:{...d,revision:{increment:1}}});
    if(f.matchId)await tx.match.update({where:{id:f.matchId},data:{eventId:d.eventId,scheduledAt:d.scheduledAt}});
    await approval(tx,f.division.competitionId,f.divisionId,userId,'fixture.schedule',f.revision+1,{before:f,after:d});return {saved:true};});
}
async function sourceAthlete(tx:Tx,sourceId:string|null,outcome:string,seedId:string|null){
  if(seedId){const p=await tx.competitionParticipant.findUniqueOrThrow({where:{id:seedId}});return p.withdrawnAt?null:p.athleteId;}
  if(!sourceId)return null;
  const f=await tx.competitionFixture.findUniqueOrThrow({where:{id:sourceId},include:{match:true}});const m=f.match;
  if(!f.confirmedAt||m?.status!=='COMPLETED'||!m.winnerId)return null;
  return outcome==='LOSER'?(m.winnerId===m.athleteAId?m.athleteBId:m.athleteAId):m.winnerId;
}
export async function advanceBracket(tx:Tx,divisionId:string){
  const list=await tx.competitionFixture.findMany({where:{divisionId,stage:{not:'GROUP'}},orderBy:[{round:'asc'},{position:'asc'}]});
  for(const row of list){
    const f=await fixture(tx,row.id);
    const a=await sourceAthlete(tx,f.sourceAId,f.outcomeA,f.seedAId),b=await sourceAthlete(tx,f.sourceBId,f.outcomeB,f.seedBId);
    if(f.confirmedAt){check(a===f.match?.athleteAId&&b===f.match?.athleteBId,'A played downstream match requires an explicit administrative decision');continue;}
    if(f.match?.status==='CANCELLED')continue;
    if(a&&b){
      check(a!==b,'A playoff match cannot pair an athlete with themselves');
      if(!f.matchId)await createSlotMatch(tx,f,a,b);
      else if(f.match?.athleteAId!==a||f.match?.athleteBId!==b){await validateAdmission(tx,{seasonId:f.division.competition.seasonId,weightClassId:f.division.weightClassId,athleteAId:a,athleteBId:b});await tx.match.update({where:{id:f.matchId},data:{athleteAId:a,athleteBId:b,status:'UPCOMING',winnerId:null,method:null,scoreA:null,scoreB:null,penaltiesA:0,penaltiesB:0,periods:{deleteMany:{}}}});}
    } else if(f.matchId){
      // Keep the historical source row for audit; retire the outdated projection.
      await tx.match.update({where:{id:f.matchId},data:{status:'CANCELLED',winnerId:null,method:null,scoreA:null,scoreB:null,periods:{deleteMany:{}}}});
      await tx.competitionFixture.update({where:{id:f.id},data:{matchId:null}});
    }
  }
}

export async function resultImpact(id:string){
  const f=await fixture(prisma,id);const all=await prisma.competitionFixture.findMany({where:{divisionId:f.divisionId},include:{match:true}});
  const affected=f.stage==='GROUP'?all.filter(x=>x.stage!=='GROUP').map(x=>x.id):descendants(id,all.map(x=>({...x,completed:!!x.confirmedAt})));
  return {revision:f.revision,affected:all.filter(x=>affected.includes(x.id)),played:all.filter(x=>affected.includes(x.id)&&(x.confirmedAt||x.match?.status==='LIVE')).map(x=>x.id)};
}
const resultInput=z.object({result:resultSchema,revision:z.number().int(),reason:reason.optional(),annulDependentIds:z.array(z.string()).optional()}).strict();
async function annulDependents(tx:Tx,f:Awaited<ReturnType<typeof fixture>>,ids:string[]|undefined,why:string|undefined,userId:string){
  const all=await tx.competitionFixture.findMany({where:{divisionId:f.divisionId},include:{match:{include:{periods:true}}}});
  const affected=f.stage==='GROUP'?all.filter(x=>x.stage!=='GROUP').map(x=>x.id):descendants(f.id,all.map(x=>({...x,completed:!!x.confirmedAt})));
  const played=all.filter(x=>affected.includes(x.id)&&(x.confirmedAt||x.match?.status==='LIVE'));
  if(played.length){check(why&&ids&&ids.length===played.length&&played.every(x=>ids.includes(x.id)),'Played dependent matches block this correction; review and explicitly annul exactly those fixtures');
    await approval(tx,f.division.competitionId,f.divisionId,userId,'dependents.annul',f.revision,played,why);
    for(const x of played){await tx.competitionFixture.update({where:{id:x.id},data:{confirmedAt:null,revision:{increment:1}}});if(x.matchId)await tx.match.update({where:{id:x.matchId},data:{status:'UPCOMING',winnerId:null,method:null,scoreA:null,scoreB:null,periods:{deleteMany:{}}}});}
  }
  if(f.stage==='GROUP'&&affected.length){
    // Qualification must be approved again before any bracket can be used.
    await approval(tx,f.division.competitionId,f.divisionId,userId,'bracket.invalidate',f.revision,all.filter(x=>affected.includes(x.id)),why);
    for(const x of all.filter(x=>affected.includes(x.id))){if(x.matchId)await tx.match.update({where:{id:x.matchId},data:{status:'CANCELLED',winnerId:null,method:null,scoreA:null,scoreB:null,periods:{deleteMany:{}}}});}
    await tx.competitionPlacement.deleteMany({where:{divisionId:f.divisionId}});
    await tx.competition.updateMany({where:{currentFixtureId:{in:affected}},data:{currentFixtureId:null,liveActive:false}});
    await tx.competitionFixture.updateMany({where:{id:{in:affected}},data:{sourceAId:null,sourceBId:null}});
    await tx.competitionFixture.deleteMany({where:{id:{in:affected}}});
    await tx.competitionDivision.update({where:{id:f.divisionId},data:{bracketApprovedAt:null}});
  }
  await tx.competitionPlacement.deleteMany({where:{divisionId:f.divisionId}});
  await tx.competitionDivision.update({where:{id:f.divisionId},data:{placementsApprovedAt:null,...(f.stage==='GROUP'?{qualification:Prisma.DbNull,qualificationApprovedAt:null,tieOrders:Prisma.DbNull}:{}),revision:{increment:1}}});
}
export async function confirmResult(id:string,input:unknown,userId:string){
  const d=resultInput.parse(input);
  return writeTransaction(async tx=>{const f=await fixture(tx,id);check(f.revision===d.revision,'Result changed; reload');check(f.matchId,'Both participants must be known before a result is entered');
    if(f.confirmedAt)check(d.reason,'Correction requires a reason');
    const participants=await tx.competitionParticipant.findMany({where:{competitionId:f.division.competitionId,athleteId:{in:[f.match!.athleteAId,f.match!.athleteBId]}}});
    check(participants.length===2&&participants.every(p=>!p.withdrawnAt||(d.result.method==='FORFEIT'&&p.athleteId!==d.result.winnerId)),'Withdrawn athletes require an explicit forfeit result',400);
    if(f.stage==='GROUP'||!f.confirmedAt||f.match!.winnerId!==d.result.winnerId)await annulDependents(tx,f,d.annulDependentIds,d.reason,userId);
    else {await tx.competitionPlacement.deleteMany({where:{divisionId:f.divisionId}});await tx.competitionDivision.update({where:{id:f.divisionId},data:{placementsApprovedAt:null,revision:{increment:1}}});}
    const updated=await submitResultTx(tx,f.matchId,d.result,userId,true);
    await tx.competitionFixture.update({where:{id},data:{confirmedAt:new Date(),revision:{increment:1}}});
    await advanceBracket(tx,f.divisionId);
    await approval(tx,f.division.competitionId,f.divisionId,userId,f.confirmedAt?'result.correct':'result.confirm',f.revision+1,{before:f.match,after:updated},d.reason);
    return {resultSaved:true,groupStandingsUpdated:true,officialLeagueRankingChanged:false};});
}
export async function fixtureStatus(id:string,input:unknown,userId:string){
  const d=z.object({status:z.enum(['UPCOMING','LIVE','CANCELLED']),revision:z.number().int(),reason,annulDependentIds:z.array(z.string()).optional()}).strict().parse(input);
  return writeTransaction(async tx=>{const f=await fixture(tx,id);check(f.revision===d.revision&&f.matchId,'Fixture changed or has no participants');
    if(f.confirmedAt||d.status==='CANCELLED')await annulDependents(tx,f,d.annulDependentIds,d.reason,userId);
    await tx.match.update({where:{id:f.matchId},data:{status:d.status,winnerId:null,method:null,scoreA:null,scoreB:null,periods:{deleteMany:{}}}});
    await tx.competitionFixture.update({where:{id},data:{confirmedAt:null,revision:{increment:1}}});await advanceBracket(tx,f.divisionId);
    await approval(tx,f.division.competitionId,f.divisionId,userId,'fixture.status',f.revision+1,{before:f,after:d},d.reason);return {saved:true};});
}

export async function resolveTies(divisionId:string,input:unknown,userId:string){
  const d=z.object({revision:z.number().int(),groupCode:z.string(),orders:z.array(z.array(z.string()).min(2)),reason}).strict().parse(input);
  return writeTransaction(async tx=>{const div=await division(tx,divisionId);check(div.revision===d.revision&&!div.bracketApprovedAt,'Reload or resolve the existing bracket first');
    const table=await standings(divisionId,tx);check(table.rulesApprovedAt&&table.expectedMatches===table.confirmedMatches,'Approve rules and all group results before resolving ties');
    const group=table.groups.find(g=>g.code===d.groupCode);check(group,'Unknown group',400);
    const tiedRanks=[...new Set(group.rows.filter(r=>r.tied).map(r=>r.rank))];
    check(d.orders.length===tiedRanks.length&&d.orders.every(order=>new Set(order).size===order.length&&tiedRanks.some(rank=>{const ids=group.rows.filter(r=>r.rank===rank).map(r=>r.athleteId);return ids.length===order.length&&order.every(id=>ids.includes(id));})),'Resolve each tied set exactly once',400);
    const orders={...(div.tieOrders as Record<string,string[][]>??{}),[d.groupCode]:d.orders};
    await tx.competitionDivision.update({where:{id:divisionId},data:{tieOrders:json(orders),qualification:Prisma.DbNull,qualificationApprovedAt:null}});
    await approval(tx,div.competitionId,divisionId,userId,'ties.resolve',div.revision,orders,d.reason);return {saved:true};});
}
export async function approveQualification(divisionId:string,input:unknown,userId:string){
  const d=z.object({revision:z.number().int()}).strict().parse(input);
  return writeTransaction(async tx=>{const div=await division(tx,divisionId);check(div.revision===d.revision&&!div.bracketApprovedAt,'Reload or resolve the existing bracket first');const table=await standings(divisionId,tx);
    for(const g of table.groups)domain(()=>assertQualification({drawApproved:!!div.drawApprovedAt,rulesApproved:!!table.rulesApprovedAt,expected:g.expectedMatches,confirmed:g.confirmedMatches,unresolved:g.unresolved,eligible:g.rows.filter(r=>r.status!=='WITHDRAWN').length,needed:div.competition.advanceCount}));
    check(table.groups.length===div.competition.groupCodes.length,'All groups are required');
    const qualified=table.groups.map(g=>({code:g.code,rows:g.rows.filter(r=>r.status!=='WITHDRAWN').slice(0,div.competition.advanceCount).map(r=>({rank:r.rank,participantId:r.participantId,athleteId:r.athleteId}))}));
    await tx.competitionDivision.update({where:{id:divisionId},data:{qualification:json({revision:div.revision,groups:qualified}),qualificationApprovedAt:new Date()}});
    await approval(tx,div.competitionId,divisionId,userId,'qualification.approve',div.revision,qualified);return qualified;});
}

export async function generateBracket(divisionId:string,input:unknown,userId:string){
  const d=z.object({revision:z.number().int()}).strict().parse(input);
  return writeTransaction(async tx=>{const div=await division(tx,divisionId);check(div.revision===d.revision&&div.qualificationApprovedAt&&div.qualification,'Approve current group tables first');check(!div.bracketApprovedAt,'Bracket already exists');
    const seeds=div.competition.seeding as SeedPair[]|null;check(seeds,'Approve a seeding configuration first');domain(()=>validateSeeding(seeds,div.competition.groupCodes,div.competition.advanceCount));
    const qualification=div.qualification as any;check(qualification.revision===div.revision,'Qualification is stale');
    let previous:string[]=[];let count=seeds.length;let round=1;
    while(count>=1){const week=div.competition.firstPlayoffWeek+round-1,event=await eventForWeek(tx,div.competition,week);const current:string[]=[];
      for(let i=0;i<count;i++){
        const stage=count===1?'FINAL':count===2?'SEMIFINAL':count===4?'QUARTERFINAL':'ROUND_OF_'+(count*2);
        const seed=round===1?seeds[i]:null;
        const entrant=(s:{group:string;rank:number})=>qualification.groups.find((g:any)=>g.code===s.group)?.rows.find((r:any)=>r.rank===s.rank)?.participantId;
        if(seed)check(entrant(seed.a)&&entrant(seed.b),'Qualification does not contain a configured seed');
        const f=await tx.competitionFixture.create({data:{divisionId,key:stage+':'+(i+1),stage,week,round,position:i+1,eventId:event.id,scheduledAt:event.date,...(seed?{seedAId:entrant(seed.a),seedBId:entrant(seed.b)}:{sourceAId:previous[i*2],sourceBId:previous[i*2+1]})}});current.push(f.id);
      }
      previous=current;count/=2;round++;
    }
    await tx.competitionDivision.update({where:{id:divisionId},data:{bracketApprovedAt:new Date()}});await advanceBracket(tx,divisionId);
    await approval(tx,div.competitionId,divisionId,userId,'bracket.generate',div.revision,seeds);return {created:true};});
}

export async function withdrawParticipant(id:string,input:unknown,userId:string){
  const d=z.object({reason}).strict().parse(input);
  return writeTransaction(async tx=>{const p=await tx.competitionParticipant.findUniqueOrThrow({where:{id}});const div=await tx.competitionDivision.findUniqueOrThrow({where:{competitionId_weightClassId:{competitionId:p.competitionId,weightClassId:p.weightClassId}}});
    check(!div.bracketApprovedAt,'Resolve the approved bracket before withdrawing a participant');
    await tx.competitionParticipant.update({where:{id},data:{withdrawnAt:new Date(),withdrawalReason:d.reason}});
    await tx.competitionDivision.update({where:{id:div.id},data:{qualification:Prisma.DbNull,qualificationApprovedAt:null,tieOrders:Prisma.DbNull,revision:{increment:1}}});
    await approval(tx,p.competitionId,div.id,userId,'participant.withdraw',div.revision+1,p,d.reason);return {withdrawn:true};});
}

export async function saveLive(competitionId:string,input:unknown,userId:string){
  const d=z.object({youtubeUrl:z.string().url().nullable(),liveActive:z.boolean(),currentFixtureId:z.string().nullable()}).strict().parse(input);
  if(d.youtubeUrl)domain(()=>youtubeId(d.youtubeUrl!));check(!d.liveActive||d.youtubeUrl,'Live requires a YouTube URL',400);
  return writeTransaction(async tx=>{if(d.currentFixtureId){const f=await fixture(tx,d.currentFixtureId);check(f.division.competitionId===competitionId&&f.matchId&&['UPCOMING','LIVE'].includes(f.match!.status),'Select an upcoming/live match of this competition',400);}
    const c=await tx.competition.update({where:{id:competitionId},data:d});await approval(tx,competitionId,null,userId,'live.save',0,d);return c;});
}
