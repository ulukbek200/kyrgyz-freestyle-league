import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { athleteBrief } from '../../lib/utils';
import { check, division, Tx } from './configurationService';
import { competitionRulesSchema, groupStandings, OfficialResult } from './competitionEngine';

export const fixtureInclude = {
  group:true,seedA:{include:{athlete:athleteBrief,territory:true}},seedB:{include:{athlete:athleteBrief,territory:true}},
  match:{include:{athleteA:athleteBrief,athleteB:athleteBrief,periods:{orderBy:{period:'asc' as const}}}},
  event:true,division:{include:{weightClass:true}},
} satisfies Prisma.CompetitionFixtureInclude;

export async function standings(divisionId:string,tx:Tx=prisma,publicOnly=false){
  const d=await division(tx,divisionId);
  if(publicOnly)check(d.competition.isPublished,'Competition not found',404);
  const rules=d.competition.ruleset?.config?competitionRulesSchema.parse(d.competition.ruleset.config):null;
  const fixtures=await tx.competitionFixture.findMany({where:{divisionId,stage:'GROUP',...(publicOnly?{event:{isPublished:true}}:{})},include:{match:true}});
  const groups=d.groups.map(g=>{
    const groupFixtures=fixtures.filter(f=>f.groupId===g.id);
    const results=groupFixtures.filter(f=>f.confirmedAt&&f.match?.status==='COMPLETED').map(f=>f.match!) as OfficialResult[];
    const allVisible=results.length===g.members.length*(g.members.length-1)/2;
    const resolutions=publicOnly&&!allVisible?[]:(d.tieOrders as Record<string,string[][]>|null)?.[g.code]??[];
    const entrants=g.members.map(m=>({id:m.participant.athleteId,territoryId:m.participant.territoryId,withdrawn:!!m.participant.withdrawnAt}));
    const expected=g.members.length*(g.members.length-1)/2;
    const qualified=!!d.qualificationApprovedAt&&results.length===expected;
    const table=groupStandings(entrants,results,rules,!!d.competition.ruleset?.approvedAt,qualified,d.competition.advanceCount,resolutions);
    return {id:g.id,code:g.code,...table,expectedMatches:expected,confirmedMatches:results.length,
      rows:table.rows.map(row=>{const m=g.members.find(m=>m.participant.athleteId===row.athleteId)!;const a=m.participant.athlete;return {...row,participantId:m.participantId,athlete:{id:a.id,slug:a.slug,firstName:a.firstName,lastName:a.lastName,photoUrl:a.photoUrl},territory:m.participant.territory};})};
  });
  return {divisionId,weightClass:d.weightClass,revision:d.revision,drawApprovedAt:d.drawApprovedAt,rulesApprovedAt:d.competition.ruleset?.approvedAt??null,
    qualificationApprovedAt:d.qualificationApprovedAt,groups:publicOnly&&!d.drawApprovedAt?[]:groups,
    expectedMatches:groups.reduce((n,g)=>n+g.expectedMatches,0),confirmedMatches:groups.reduce((n,g)=>n+g.confirmedMatches,0),
    unresolved:groups.some(g=>g.unresolved),advanceCount:d.competition.advanceCount};
}

export async function competitionView(id:string,publicOnly=false){
  const c=await prisma.competition.findFirst({where:{OR:[{id},{season:{slug:id}}],...(publicOnly?{isPublished:true}:{})},include:{
    season:{include:{weightClasses:{include:{weightClass:true}},events:{where:publicOnly?{isPublished:true}:{},orderBy:{date:'asc'}}}},
    ageCategory:true,territories:{include:{territory:true}},ruleset:true,
    divisions:{include:{weightClass:true,placements:{where:publicOnly?{basisFixture:{event:{isPublished:true}}}:{},include:{participant:{include:{athlete:athleteBrief,territory:true}}}}}},
    participants:{include:{athlete:athleteBrief,territory:true,weightClass:true,member:{include:{group:true}}}},
  }});
  check(c,'Competition not found',404);
  const currentWeek=Math.max(1,Math.floor((Date.now()-+c.season.startDate)/(7*86400000))+1);
  const visibleDivisions=publicOnly?c.divisions.map(d=>({id:d.id,competitionId:d.competitionId,weightClassId:d.weightClassId,weightClass:d.weightClass,drawApprovedAt:d.drawApprovedAt,bracketApprovedAt:d.bracketApprovedAt,placementsApprovedAt:d.placements.length===5?d.placementsApprovedAt:null,placements:d.placements.length===5?d.placements:[]})):c.divisions;
  return {...c,divisions:visibleDivisions,participants:publicOnly?c.participants.map(p=>({...p,member:c.divisions.find(d=>d.weightClassId===p.weightClassId)?.drawApprovedAt?p.member:null})):c.participants,currentWeek,nextEvent:c.season.events.find(e=>+e.date>=Date.now())??null,
    expectedAthletes:c.territories.length*c.territoryQuota*c.divisions.length,
    expectedGroupMatches:c.divisions.length*c.groupCodes.length*c.territories.length*(c.territories.length-1)/2,
    rulesStatus:c.ruleset?.approvedAt?'APPROVED':'PENDING APPROVAL',
    classificationStatus:c.classificationApprovedAt?'APPROVED':'PENDING CLASSIFICATION'};
}

export async function schedule(competitionId:string,filters:Record<string,unknown>,publicOnly=false){
  const where:Prisma.CompetitionFixtureWhereInput={division:{competitionId,...(publicOnly?{competition:{isPublished:true}}:{}),...(filters.weightClassId?{weightClassId:String(filters.weightClassId)}:{})}};
  if(filters.week)where.week=Number(filters.week);
  if(filters.group)where.group={code:String(filters.group)};
  if(filters.eventId)where.eventId=String(filters.eventId);
  if(filters.stage)where.stage=String(filters.stage);
  if(publicOnly)where.event={isPublished:true};
  if(filters.results==='true')where.confirmedAt={not:null};
  if(filters.athleteId)where.match={OR:[{athleteAId:String(filters.athleteId)},{athleteBId:String(filters.athleteId)}]};
  const rows=await prisma.competitionFixture.findMany({where,include:fixtureInclude,orderBy:[{week:'asc'},{scheduledAt:'asc'},{position:'asc'}]});
  if(!filters.territoryId)return rows;
  const ids=new Set((await prisma.competitionParticipant.findMany({where:{competitionId,territoryId:String(filters.territoryId)},select:{athleteId:true}})).map(p=>p.athleteId));
  return rows.filter(f=>f.match&&(ids.has(f.match.athleteAId)||ids.has(f.match.athleteBId)));
}

export async function bracketView(divisionId:string,publicOnly=false){
  const d=await division(prisma,divisionId);if(publicOnly)check(d.competition.isPublished,'Competition not found',404);
  const fixtures=await prisma.competitionFixture.findMany({where:{divisionId,stage:{not:'GROUP'}},include:fixtureInclude,orderBy:[{round:'asc'},{position:'asc'}]});
  const visible=new Map<string,boolean>();
  const projected=fixtures.map(f=>{
    const sourcesVisible=(!f.sourceAId||visible.get(f.sourceAId))&&(!f.sourceBId||visible.get(f.sourceBId));
    const show=!publicOnly||(f.event?.isPublished&&sourcesVisible);
    visible.set(f.id,!!show&&!!f.confirmedAt);
    return show?f:{...f,matchId:null,match:null,eventId:null,event:null,confirmedAt:null,scheduledAt:null,callTime:null,matNumber:null};
  });
  const table=publicOnly?await standings(divisionId,prisma,true):null;
  const visibleQualification=!publicOnly||(table!.expectedMatches>0&&table!.confirmedMatches===table!.expectedMatches);
  const placements=d.placementsApprovedAt?await prisma.competitionPlacement.findMany({where:{divisionId},include:{participant:{include:{athlete:athleteBrief,territory:true}}},orderBy:{place:'asc'}}):[];
  const showPlacements=visibleQualification&&placements.length===5&&(!publicOnly||placements.every(p=>visible.get(p.basisFixtureId)));
  return {divisionId,approvedAt:d.bracketApprovedAt,qualificationApprovedAt:d.qualificationApprovedAt,
    fixtures:visibleQualification?projected:[],classificationStatus:showPlacements?'APPROVED':'PENDING CLASSIFICATION',placements:showPlacements?placements:[]};
}

export function youtubeId(url:string){
  let u:URL;try{u=new URL(url);}catch{throw new Error('Invalid YouTube URL');}
  check(u.protocol==='https:'&&!u.username&&!u.password,'Use an HTTPS YouTube link',400);
  const host=u.hostname.replace(/^www\./,'');
  const id=host==='youtu.be'?u.pathname.slice(1):['youtube.com','m.youtube.com'].includes(host)?u.searchParams.get('v')??u.pathname.match(/^\/(?:live|embed)\/([^/]+)/)?.[1]:null;
  check(id&&/^[A-Za-z0-9_-]{11}$/.test(id),'Invalid YouTube video ID',400);return id;
}
