import {test} from 'node:test';
import assert from 'node:assert/strict';
import {previewGroups,roundRobin} from '../src/groupSchedule.js';

test('Naryn preview: 24 athletes, four groups, five rounds and exactly 60 unique bouts',()=>{
  const groups=['A','B','C','D'].map(name=>({name,athleteIds:Array.from({length:6},(_,i)=>name+i)}));
  const preview=previewGroups(groups);
  assert.equal(preview.flatMap(g=>g.schedule).length,60);
  for(const group of preview){
    assert.equal(group.schedule.length,15);
    assert.equal(new Set(group.schedule.map(m=>[m.athleteAId,m.athleteBId].sort().join(':'))).size,15);
    for(let round=1;round<=5;round++){
      const bouts=group.schedule.filter(m=>m.round===round);
      assert.equal(bouts.length,3);
      assert.equal(new Set(bouts.flatMap(m=>[m.athleteAId,m.athleteBId])).size,6);
    }
    for(const athlete of group.athleteIds)assert.equal(group.schedule.filter(m=>m.athleteAId===athlete||m.athleteBId===athlete).length,5);
  }
  assert.deepEqual(previewGroups(groups),preview);
  assert.deepEqual(groups[0].athleteIds,['A0','A1','A2','A3','A4','A5']);
});

test('round robin covers every unordered pair once for even and odd group sizes',()=>{
  for(let size=2;size<=32;size++){
    const ids=Array.from({length:size},(_,i)=>String(i)),schedule=roundRobin(ids);
    assert.equal(schedule.length,size*(size-1)/2);
    assert.equal(new Set(schedule.map(m=>[m.athleteAId,m.athleteBId].sort().join(':'))).size,schedule.length);
    for(const round of new Set(schedule.map(m=>m.round))){
      const players=schedule.filter(m=>m.round===round).flatMap(m=>[m.athleteAId,m.athleteBId]);
      assert.equal(players.length,new Set(players).size);
    }
  }
});

test('preview rejects repeated athletes, invalid group sizes and duplicate group names',()=>{
  assert.throws(()=>roundRobin(['a','a']));assert.throws(()=>roundRobin(['a']));
  assert.throws(()=>roundRobin(['a','']));
  assert.throws(()=>previewGroups([{name:'A',athleteIds:['a','b']},{name:'B',athleteIds:['a','c']}]));
  assert.throws(()=>previewGroups([{name:'A',athleteIds:['a','b']},{name:' A ',athleteIds:['c','d']}]));
});
