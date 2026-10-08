import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawGroups, validateDraw, roundRobin, groupStandings, competitionRulesSchema, assertQualification, validateSeeding, descendants } from '../src/modules/competition/competitionEngine';

const territories=Array.from({length:6},(_,i)=>'territory-'+i);
const entrants=territories.flatMap(territoryId=>Array.from({length:4},(_,i)=>({id:territoryId+'-athlete-'+i,territoryId})));
// Fixture values are deliberately supplied by the tests, never official defaults.
const rules=competitionRulesSchema.parse({winPoints:3,lossPoints:0,tieBreak:['points','wins','pointDifference']});

test('Naryn: 24 entrants form four groups with six distinct territories',()=>{
  const groups=drawGroups(entrants,territories,4,'recorded-seed');
  assert.equal(groups.length,4);assert.equal(new Set(groups.flat()).size,24);
  for(const group of groups){assert.equal(group.length,6);assert.equal(new Set(group.map(id=>entrants.find(e=>e.id===id)!.territoryId)).size,6);}
  assert.deepEqual(groups,drawGroups([...entrants].reverse(),[...territories].reverse(),4,'recorded-seed'));
});
test('Naryn: invalid manual draw, withdrawn entrants and incomplete quotas are rejected',()=>{
  const groups=drawGroups(entrants,territories,4,'seed');
  groups[0][0]=groups[1][0];assert.throws(()=>validateDraw(groups,entrants,territories,4));
  assert.throws(()=>drawGroups(entrants.slice(1),territories,4,'seed'));
  assert.throws(()=>drawGroups(entrants.map((e,i)=>({...e,withdrawn:i===0})),territories,4,'seed'));
});
test('Naryn: 168 entrants, 420 unique group bouts, five opponents and one bout per week',()=>{
  let total=0;
  for(let weight=0;weight<7;weight++){
    const athletes=entrants.map(e=>({...e,id:weight+':'+e.id}));
    const groups=drawGroups(athletes,territories,4,'season-seed');
    const matches=groups.flatMap(roundRobin);total+=matches.length;assert.equal(matches.length,60);
    const pairs=matches.map(m=>[m.athleteAId,m.athleteBId].sort().join('|'));assert.equal(new Set(pairs).size,60);
    for(const a of athletes){const bouts=matches.filter(m=>[m.athleteAId,m.athleteBId].includes(a.id));assert.equal(bouts.length,5);assert.equal(new Set(bouts.map(m=>m.round)).size,5);assert.equal(new Set(bouts.map(m=>m.athleteAId===a.id?m.athleteBId:m.athleteAId)).size,5);}
    assert.ok(matches.every(m=>m.athleteAId!==m.athleteBId));
  }
  assert.equal(total,420);
});
test('Naryn: Round Robin generation is deterministic and rejects invalid groups',()=>{
  assert.deepEqual(roundRobin(['a','b','c','d','e','f']),roundRobin(['a','b','c','d','e','f']));
  assert.throws(()=>roundRobin(['a','a']));assert.throws(()=>roundRobin(['a','b','c']));
});
test('Naryn: official result and correction recompute standings, scores and technical wins',()=>{
  const group=entrants.slice(0,2),[a,b]=group;
  const match={id:'m',athleteAId:a.id,athleteBId:b.id,winnerId:a.id,scoreA:10,scoreB:0,method:'TECHNICAL_SUPERIORITY'};
  let s=groupStandings(group,[match],rules,true);assert.equal(s.rows[0].athleteId,a.id);assert.equal(s.rows[0].wins,1);assert.equal(s.rows[0].techWins,1);assert.equal(s.rows[0].pointsFor,10);
  s=groupStandings(group,[{...match,winnerId:b.id,scoreA:0,scoreB:10}],rules,true);assert.equal(s.rows[0].athleteId,b.id);assert.equal(s.rows[1].losses,1);assert.equal(s.rows[1].techWins,0);
});
test('Naryn: unapproved rules and unresolved equalities cannot qualify athletes',()=>{
  const noRules=groupStandings(entrants.slice(0,6),[],null,false);assert.ok(noRules.rows.every(r=>r.points===null&&r.rank===null&&r.status==='PENDING'));
  const tied=groupStandings(entrants.slice(0,6),[],rules,true);assert.equal(tied.unresolved,true);assert.ok(tied.rows.every(r=>r.rank===1&&r.tied));
  for(const override of [{rulesApproved:false},{drawApproved:false},{confirmed:14},{unresolved:true}])assert.throws(()=>assertQualification({drawApproved:true,rulesApproved:true,expected:15,confirmed:15,unresolved:false,eligible:6,needed:4,...override}));
});
test('Naryn: explicit tie resolution gives four qualifiers per group, sixteen overall',()=>{
  let qualified=0;
  for(const ids of drawGroups(entrants,territories,4,'seed')){
    const group=ids.map(id=>entrants.find(e=>e.id===id)!);
    const s=groupStandings(group,[],rules,true,true,4,[ids]);
    assert.equal(s.unresolved,false);qualified+=s.rows.filter(r=>r.status==='QUALIFIED').length;
    assert.equal(s.rows.filter(r=>r.status==='ELIMINATED').length,2);
  }
  assert.equal(qualified,16);
});
test('Naryn: seeding is configurable and duplicate or missing qualifiers are rejected',()=>{
  const pairs=['A','B'].flatMap((group,i)=>[1,2,3,4].map(rank=>({a:{group,rank},b:{group:i===0?'D':'C',rank:5-rank}})));
  assert.deepEqual(validateSeeding(pairs,['A','B','C','D'],4),pairs);
  assert.throws(()=>validateSeeding(pairs.slice(1),['A','B','C','D'],4));
  assert.throws(()=>validateSeeding([...pairs.slice(1),pairs[1]],['A','B','C','D'],4));
});
test('Naryn: affected bracket descendants are found without touching unrelated branches',()=>{
  const slots=[{id:'a',sourceAId:null,sourceBId:null,completed:true},{id:'b',sourceAId:null,sourceBId:null,completed:true},{id:'q',sourceAId:'a',sourceBId:'b',completed:true},{id:'f',sourceAId:'q',sourceBId:'other',completed:false},{id:'other',sourceAId:null,sourceBId:null,completed:true}];
  assert.deepEqual(descendants('a',slots),['q','f']);assert.throws(()=>descendants('a',[...slots,{id:'a',sourceAId:'f',sourceBId:null,completed:false}]));
});
