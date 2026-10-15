import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupStandings,playoffSeeds,SEED_PAIRS,type GroupResult} from '../src/groupStandings.js';
const bout=(a:string,b:string,winner:string,method='DECISION'):GroupResult=>({id:a+b,athleteAId:a,athleteBId:b,winnerId:winner,status:'COMPLETED',method});
test('group points are independent: early 4/1, decision 3/1, each win counts once',()=>{
 const rows=groupStandings(['a','b','c'],[bout('a','b','a','PIN'),bout('a','c','a')]);
 assert.deepEqual(rows.find(r=>r.athleteId==='a'),{athleteId:'a',points:7,wins:2,losses:0,played:2,earlyWins:1,rank:1,tie:[]});
 assert.equal(rows.find(r=>r.athleteId==='b')?.points,1);
 assert.equal(rows.find(r=>r.athleteId==='c')?.losses,1);
});
test('replay is deterministic; correction and cancelled bouts are recalculated from source',()=>{
 const input=[bout('a','b','a','PIN')];assert.deepEqual(groupStandings(['a','b'],input),groupStandings(['a','b'],input));
 assert.equal(groupStandings(['a','b'],[bout('a','b','b')])[0].athleteId,'b');
 assert.ok(groupStandings(['a','b'],[{...input[0],status:'CANCELLED'}]).every(r=>r.points===0&&r.played===0&&r.rank===null));
});
test('three-way cycle remains unresolved, never sorted by arbitrary pairwise head-to-head',()=>{
 const matches=[bout('a','b','a'),bout('b','c','b'),bout('c','a','c')];
 const rows=groupStandings(['a','b','c'],matches);assert.ok(rows.every(r=>r.rank===null&&r.tie.length===3));
 assert.deepEqual(groupStandings(['a','b','c'],matches,['c','a','b']).map(r=>[r.athleteId,r.rank]),[['c',1],['a',2],['b',3]]);
});
test('two tied athletes use their personal meeting before early-win count',()=>{
 const matches=[bout('a','b','a'),bout('a','c','c'),bout('b','c','b'),bout('a','d','a'),bout('b','d','b')];
 const rows=groupStandings(['a','b','c','d'],matches);assert.ok(rows.find(r=>r.athleteId==='a')!.rank!<rows.find(r=>r.athleteId==='b')!.rank!);
});
test('top four from A-D yield sixteen unique qualifiers, with no preliminary round',()=>{
 const groups=Object.fromEntries(['A','B','C','D'].map(g=>[g,Array.from({length:6},(_,i)=>({athleteId:g+(i+1),rank:i+1,points:0,wins:0,losses:0,played:0,earlyWins:0,tie:[]}))]));
 const seeds=playoffSeeds(groups);assert.equal(seeds.length,8);
 assert.equal(new Set(seeds.flatMap(s=>[s.athleteAId,s.athleteBId])).size,16);
 assert.ok(seeds.every(s=>!/[56]/.test(s.athleteAId+s.athleteBId)));
 for(let i=0;i<8;i+=2)assert.equal(new Set(SEED_PAIRS.slice(i,i+2).flat().map(s=>s[0])).size,4);
 groups.A[0].rank=0;assert.throws(()=>playoffSeeds(groups));
});
