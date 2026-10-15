import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Prisma} from '@prisma/client';
import {profileEligibility} from '../src/ageDivisions.js';
import {validateTournamentMatch} from '../src/tournaments.js';

function fixture(year=2026) {
 const weights=[{id:'u17',ageDivision:'U17',kilograms:65},{id:'u23',ageDivision:'U23',kilograms:65}];
 const event={id:'event',ageDivision:'U17',startsAt:new Date(`${year}-08-01Z`),status:'PLANNED',weightClasses:[{weightClassId:'u17'}]};
 const participants=new Map(['a','b'].map(id=>[id,{athleteId:id,status:'ACTIVE',weightClassId:'u17',ageDivision:'U17',athlete:{status:'ACTIVE',dateOfBirth:new Date('2009-12-31Z')}}]));
 const tx={
  $queryRaw:async(sql:TemplateStringsArray)=>sql.join('').includes('to_regclass')?[{present:false}]:[],event:{findUnique:async()=>event},
  weightClass:{findUnique:async({where}:any)=>weights.find(w=>w.id===where.id)},
  tournamentParticipant:{findUnique:async({where}:any)=>participants.get(where.eventId_athleteId.athleteId)},
 } as unknown as Prisma.TransactionClient;
 return {tx,event,participants};
}
const pair={eventId:'event',ageDivision:'U17' as const,weightClassId:'u17',athleteAId:'a',athleteBId:'b'};
test('profile creation needs only current-year eligibility; no season or participation queries',async()=>{
 const {tx}=fixture();const year=new Date().getUTCFullYear();
 assert.equal((await profileEligibility(tx,{dateOfBirth:new Date(`${year-17}-12-31Z`),weightClassId:'u17'})).ageDivision,'U17');
});
test('participation uses tournament year and permits transition without rewriting history',async()=>{
 const {tx}=fixture();const dateOfBirth=new Date('2009-12-31Z');
 assert.equal((await profileEligibility(tx,{dateOfBirth,weightClassId:'u17'},2026)).ageDivision,'U17');
 assert.equal((await profileEligibility(tx,{dateOfBirth,weightClassId:'u23'},2027)).ageDivision,'U23');
 await assert.rejects(profileEligibility(tx,{dateOfBirth,weightClassId:'u17'},2027),/категория/);
});
test('ineligible ages, mismatched division and excess actual weight are rejected',async()=>{
 const {tx}=fixture();
 for(const dateOfBirth of [new Date('2011-01-01Z'),new Date('2002-01-01Z')])await assert.rejects(profileEligibility(tx,{dateOfBirth,weightClassId:'u17'},2026));
 await assert.rejects(profileEligibility(tx,{dateOfBirth:new Date('2009-01-01Z'),weightClassId:'u17',ageDivision:'U23'},2026));
 await assert.rejects(profileEligibility(tx,{dateOfBirth:new Date('2009-01-01Z'),weightClassId:'u17',weightKg:66},2026));
});
test('match requires two active, registered participants in an allowed category',async()=>{
 const f=fixture();assert.equal((await validateTournamentMatch(f.tx,pair)).id,'event');
 await assert.rejects(validateTournamentMatch(f.tx,{...pair,athleteBId:'a'}));
 await assert.rejects(validateTournamentMatch(f.tx,{...pair,weightClassId:'u23'}));
 f.participants.delete('b');await assert.rejects(validateTournamentMatch(f.tx,pair));
});
test('closed tournaments and age-incompatible registrations reject new pairings',async()=>{
 const f=fixture();f.event.status='CANCELLED';await assert.rejects(validateTournamentMatch(f.tx,pair));
 f.event.status='COMPLETED';await assert.rejects(validateTournamentMatch(f.tx,pair));
 f.event.status='PLANNED';f.event.startsAt=new Date('2027-08-01Z');await assert.rejects(validateTournamentMatch(f.tx,pair));
 f.event.startsAt=new Date('2026-08-01Z');f.participants.get('a')!.status='NEEDS_REVIEW';await assert.rejects(validateTournamentMatch(f.tx,pair));
});
