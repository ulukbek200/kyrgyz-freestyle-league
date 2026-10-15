import {prisma} from './db.js';
import {systemAvailable} from './tournamentSystem.js';

// Read existing brackets only. Opening the calendar must never generate rounds.
export async function currentEventRounds(eventIds:string[]){
 const result=new Map<string,number>();
 if(!eventIds.length||!await systemAvailable(prisma))return result;
 const bouts=await prisma.tournamentBout.findMany({
  where:{format:{eventId:{in:eventIds}},match:{status:{in:['LIVE','UPCOMING']}}},
  select:{phase:true,round:true,format:{select:{eventId:true}},match:{select:{status:true}}},
 });
 const live=new Set(bouts.filter(b=>b.match?.status==='LIVE').map(b=>b.format.eventId));
 for(const b of bouts){
  if(live.has(b.format.eventId)&&b.match?.status!=='LIVE')continue;
  const round=b.round+(b.phase==='PLAYOFF'?5:0),id=b.format.eventId;
  result.set(id,Math.min(result.get(id)??round,round));
 }
 return result;
}
