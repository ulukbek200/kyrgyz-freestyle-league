import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getAgeDivision,getSeasonAge,validWeight,publicData,DIVISIONS} from '../src/ageDivisions.js';

for(const [year,expected] of [[2010,'U17'],[2009,'U17'],[2008,'U23'],[2003,'U23'],[2011,null],[2002,null]] as const){
  test(`birth ${year}, season 2026: ${expected??'ineligible'}`,()=>assert.equal(getAgeDivision(new Date(`${year}-06-15`),2026),expected));
}
test('calendar age ignores month/day and wall clock',()=>{
  assert.equal(getAgeDivision(new Date('2009-01-01'),2026),getAgeDivision(new Date('2009-12-31'),2026));
  assert.equal(getSeasonAge(new Date('2009-12-31'),2026),17);
  assert.equal(getAgeDivision(new Date('2009-12-31'),2027),'U23');
  assert.equal(getAgeDivision(new Date('2009-12-31'),2026),'U17');
});
test('canonical categories distinguish divisions',()=>{
  assert.equal(validWeight('U17',45),true);assert.equal(validWeight('U17',57),false);
  assert.equal(validWeight('U23',57),true);assert.equal(validWeight('U23',45),false);
  assert.deepEqual(DIVISIONS.map(d=>d.weights.length),[7,5]);
});
test('public serializer strips nested private athlete fields',()=>{
  assert.deepEqual(publicData({athlete:{firstName:'A',dateOfBirth:new Date(),userId:'private'},matches:[{athleteA:{birthDate:'private',id:'a'}}]}),{athlete:{firstName:'A'},matches:[{athleteA:{id:'a'}}]});
});
