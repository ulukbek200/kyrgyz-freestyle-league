import type {Prisma, Match, MatchScore, RankingRule} from '@prisma/client';
type Bout = Match & {score: MatchScore | null};
export function standings(bouts: Bout[], rule: RankingRule | null) {
 const win=rule?.winPoints??3,early=rule?.earlyWinBonus??1,loss=rule?.lossPoints??0,penalty=rule?.penaltyPoints??0,tie=rule?.tieBreakRule??'WINS_THEN_FEWER_LOSSES';
 const map=new Map<string,{athleteId:string;points:number;wins:number;losses:number;lastMatchId?:string}>();
 for(const b of bouts){for(const id of [b.athleteAId,b.athleteBId])if(!map.has(id))map.set(id,{athleteId:id,points:0,wins:0,losses:0});const winnerA=b.winnerId===b.athleteAId,w=map.get(b.winnerId!)!,l=map.get(winnerA?b.athleteBId:b.athleteAId)!,penA=b.score?.penaltiesA??0,penB=b.score?.penaltiesB??0;w.points+=win+(['TECHNICAL_FALL','PIN'].includes(b.method??'')?early:0)+(b.score?.bonus??0)-(winnerA?penA:penB)*penalty;w.wins++;w.lastMatchId=b.id;l.points+=loss-(winnerA?penB:penA)*penalty;l.losses++;l.lastMatchId=b.id}
 const rows=[...map.values()].sort((a,b)=>{const pts=b.points-a.points;if(pts)return pts;if(tie==='HEAD_TO_HEAD'){const meeting=[...bouts].reverse().find(m=>(m.athleteAId===a.athleteId&&m.athleteBId===b.athleteId)||(m.athleteAId===b.athleteId&&m.athleteBId===a.athleteId));if(meeting?.winnerId)return meeting.winnerId===a.athleteId?-1:1}if(tie==='FEWER_LOSSES_THEN_WINS')return a.losses-b.losses||b.wins-a.wins||a.athleteId.localeCompare(b.athleteId);return b.wins-a.wins||a.losses-b.losses||a.athleteId.localeCompare(b.athleteId)});
 return rows;
}
export async function recalculateRankings(tx:Prisma.TransactionClient,seasonId:string|null,weightClassId:string,eventId?:string){
 const rule=await tx.rankingRule.findUnique({where:{name:'default'}});
 const bouts=await tx.match.findMany({where:{...(seasonId?{seasonId}:{}),weightClassId,status:'COMPLETED',winnerId:{not:null}},include:{score:true},orderBy:[{scheduledAt:'asc'},{id:'asc'}]});
 const rows=standings(bouts,rule);
 await tx.ranking.deleteMany({where:{seasonId,weightClassId,athleteId:{notIn:rows.map(r=>r.athleteId)}}});
 for(let i=0;i<rows.length;i++){
  const r=rows[i]!,rank=i+1,old=await tx.ranking.findFirst({where:{seasonId,weightClassId,athleteId:r.athleteId}});
  if(old)await tx.ranking.update({where:{id:old.id},data:{...r,rank,previousRank:old.rank===rank?old.previousRank:old.rank}});
  else await tx.ranking.create({data:{...r,seasonId,weightClassId,rank}});
 }

 if(eventId){
  // Rebuild every event snapshot, since changing an old result changes later snapshots too.
  // An event's snapshot is the standings immediately after its last completed bout.
  await tx.rankingSnapshot.deleteMany({where:{seasonId,weightClassId}});
  const lastByEvent=new Map<string,number>();
  bouts.forEach((bout,i)=>lastByEvent.set(bout.eventId,i));
  for(const [snapshotEventId,last] of lastByEvent){
   const snapshot=standings(bouts.slice(0,last+1),rule);
   await tx.rankingSnapshot.createMany({data:snapshot.map((r,i)=>({seasonId,weightClassId,athleteId:r.athleteId,eventId:snapshotEventId,rank:i+1,points:r.points}))});
  }
 }
}
