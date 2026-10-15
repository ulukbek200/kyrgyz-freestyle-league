export type GroupResult={id:string;athleteAId:string;athleteBId:string;winnerId:string|null;status:string;method:string|null};
export type GroupRow={athleteId:string;played:number;wins:number;losses:number;earlyWins:number;points:number;rank:number|null;tie:string[]};
export function groupStandings(ids:string[],matches:GroupResult[],approvedOrder?:string[]):GroupRow[]{
  const rows=ids.map(athleteId=>({athleteId,played:0,wins:0,losses:0,earlyWins:0,points:0,rank:null as number|null,tie:[] as string[]}));
  const lookup=new Map(rows.map(r=>[r.athleteId,r]));
  const completed=matches.filter(m=>m.status==='COMPLETED'&&m.winnerId);
  for(const m of completed){
    if(!lookup.has(m.athleteAId)||!lookup.has(m.athleteBId)||![m.athleteAId,m.athleteBId].includes(m.winnerId!))throw new Error('Некорректный результат группы');
    const winner=lookup.get(m.winnerId!)!,loser=lookup.get(m.winnerId===m.athleteAId?m.athleteBId:m.athleteAId)!;
    // A technical forfeit is an early win; this is disclosed in the format preview.
    const early=m.method!=='DECISION';
    winner.played++;winner.wins++;winner.earlyWins+=Number(early);winner.points+=early?4:3;
    loser.played++;loser.losses++;loser.points++;
  }
  rows.sort((a,b)=>b.points-a.points||b.wins-a.wins);
  for(let start=0;start<rows.length;){
    let end=start+1;while(end<rows.length&&rows[end].points===rows[start].points&&rows[end].wins===rows[start].wins)end++;
    const block=rows.slice(start,end);
    if(block.length===2){
      const head=completed.find(m=>[m.athleteAId,m.athleteBId].includes(block[0].athleteId)&&[m.athleteAId,m.athleteBId].includes(block[1].athleteId));
      if(head){block.sort(a=>a.athleteId===head.winnerId?-1:1);block.forEach((r,i)=>r.rank=start+i+1);rows.splice(start,block.length,...block);start=end;continue;}
    }
    block.sort((a,b)=>b.earlyWins-a.earlyWins);
    for(let i=0;i<block.length;){
      let j=i+1;while(j<block.length&&block[j].earlyWins===block[i].earlyWins)j++;
      const tied=block.slice(i,j);
      if(tied.length>1){
        const tie=tied.map(r=>r.athleteId).sort();
        if(approvedOrder&&tie.every(id=>approvedOrder.includes(id))){tied.sort((a,b)=>approvedOrder.indexOf(a.athleteId)-approvedOrder.indexOf(b.athleteId));tied.forEach((r,k)=>{r.rank=start+i+k+1;r.tie=tie;});}
        else tied.forEach(r=>{r.rank=null;r.tie=tie;});
      }else tied[0].rank=start+i+1;
      block.splice(i,j-i,...tied);i=j;
    }
    rows.splice(start,block.length,...block);start=end;
  }
  return rows;
}

// Fixed, reviewed seeding: each group sends one athlete into each quarter.
// Members of the same group cannot meet before a semi-final.
export const SEED_PAIRS=[['A1','B4'],['C2','D3'],['B1','A4'],['D2','C3'],['C1','D4'],['A2','B3'],['D1','C4'],['B2','A3']] as const;
export function playoffSeeds(groups:Record<string,GroupRow[]>){
  const pick=(seed:string)=>{const row=groups[seed[0]]?.find(r=>r.rank===Number(seed[1]));if(!row)throw new Error('Сначала утвердите итоговые места всех групп');return row.athleteId;};
  return SEED_PAIRS.map(([a,b],i)=>({round:1,position:i+1,seedA:a,seedB:b,athleteAId:pick(a),athleteBId:pick(b)}));
}
