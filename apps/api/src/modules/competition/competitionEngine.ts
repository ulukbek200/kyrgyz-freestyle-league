import { createHash } from 'node:crypto';
import { z } from 'zod';

export const METHODS = ['POINTS', 'TECHNICAL_SUPERIORITY', 'PIN', 'FORFEIT', 'DISQUALIFICATION', 'INJURY'] as const;
export const criteria = ['points', 'wins', 'headToHead', 'pointDifference', 'pointsFor', 'pins', 'techWins'] as const;
export const competitionRulesSchema = z.object({
  winPoints: z.number().int().min(0).max(100),
  lossPoints: z.number().int().min(0).max(100),
  methodBonus: z.record(z.enum(METHODS), z.number().int().min(0).max(100)).default({}),
  tieBreak: z.array(z.enum(criteria)).min(1).max(criteria.length).refine(v => new Set(v).size === v.length, 'Duplicate ranking criterion'),
}).strict();
export type CompetitionRules = z.infer<typeof competitionRulesSchema>;
export interface Entrant { id: string; territoryId: string; withdrawn?: boolean }
export interface OfficialResult { id: string; athleteAId: string; athleteBId: string; winnerId: string; scoreA: number; scoreB: number; method: string }
export interface Standing {
  athleteId: string; territoryId: string; matches: number; wins: number; losses: number;
  points: number | null; pointsFor: number; pointsAgainst: number; pointDifference: number;
  pins: number; techWins: number; rank: number | null; tied: boolean;
  status: 'PENDING' | 'QUALIFIED' | 'ELIMINATED' | 'WITHDRAWN'; recentResults: Array<{matchId:string;result:'W'|'L'}>;
}

function requireCondition(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function validateDraw(groups: string[][], entrants: Entrant[], territories: string[], groupCount: number) {
  requireCondition(groups.length === groupCount, 'Incorrect group count');
  requireCondition(territories.length >= 2 && new Set(territories).size === territories.length, 'Territories must be distinct');
  const byId = new Map(entrants.map(e => [e.id, e]));
  requireCondition(byId.size === entrants.length && entrants.length === groupCount * territories.length, 'Incomplete or duplicated participants');
  const assigned = groups.flat();
  requireCondition(assigned.length === entrants.length && new Set(assigned).size === assigned.length, 'Participants must occur once');
  for (const group of groups) {
    requireCondition(group.length === territories.length, 'Incorrect group size');
    const represented = group.map(id => { const e = byId.get(id); requireCondition(e && !e.withdrawn, 'Participant missing or withdrawn'); return e.territoryId; });
    requireCondition(new Set(represented).size === territories.length && represented.every(t => territories.includes(t)), 'Each territory needs exactly one representative in every group');
  }
  return groups;
}

/** A recorded seed and participant IDs reproduce exactly the same draw. */
export function drawGroups(entrants: Entrant[], territories: string[], groupCount: number, seed: string) {
  requireCondition(seed.trim().length > 0, 'Draw seed required');
  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  for (const territoryId of [...territories].sort()) {
    const order = entrants.filter(e => e.territoryId === territoryId).sort((a,b) => {
      const key = (id:string) => createHash('sha256').update(seed+'\0'+territoryId+'\0'+id).digest('hex');
      return key(a.id).localeCompare(key(b.id)) || a.id.localeCompare(b.id);
    });
    requireCondition(order.length === groupCount, 'Each territory must supply one athlete per group');
    order.forEach((e,i) => groups[i].push(e.id));
  }
  return validateDraw(groups, entrants, territories, groupCount);
}

/** Circle method: n-1 rounds, n/2 bouts each, one appearance per athlete per round. */
export function roundRobin(ids: string[]) {
  requireCondition(ids.length >= 2 && ids.length % 2 === 0 && new Set(ids).size === ids.length, 'Round Robin requires distinct participants and an even group size');
  const ring = [...ids], result: Array<{round:number;position:number;athleteAId:string;athleteBId:string}> = [];
  for (let round = 1; round < ids.length; round++) {
    for (let i = 0; i < ring.length / 2; i++) {
      const pair = [ring[i], ring[ring.length-1-i]];
      if (round % 2 === 0) pair.reverse();
      result.push({ round, position:i+1, athleteAId:pair[0], athleteBId:pair[1] });
    }
    ring.splice(1, 0, ring.pop()!);
  }
  return result;
}

export function groupStandings(entrants: Entrant[], results: OfficialResult[], rules: CompetitionRules | null,
  approved: boolean, qualified = false, advanceCount = 4, tieOrders: string[][] = []) {
  const rows = new Map<string,Standing>(entrants.map(e => [e.id, {athleteId:e.id, territoryId:e.territoryId,
    matches:0,wins:0,losses:0,points:rules?0:null,pointsFor:0,pointsAgainst:0,pointDifference:0,pins:0,techWins:0,
    rank:null,tied:false,status:e.withdrawn?'WITHDRAWN':'PENDING',recentResults:[]} ]));
  const seen = new Set<string>();
  for (const m of results) {
    const a = rows.get(m.athleteAId), b = rows.get(m.athleteBId);
    requireCondition(a && b && a !== b && [a.athleteId,b.athleteId].includes(m.winnerId), 'Invalid group result participants');
    requireCondition(!seen.has(m.id), 'Duplicate official result'); seen.add(m.id);
    for (const [row, scored, conceded] of [[a,m.scoreA,m.scoreB],[b,m.scoreB,m.scoreA]] as const) {
      const won = row.athleteId === m.winnerId;
      row.matches++; row.wins += +won; row.losses += +!won; row.pointsFor += scored; row.pointsAgainst += conceded;
      row.pointDifference = row.pointsFor-row.pointsAgainst;
      if (won && m.method === 'PIN') row.pins++;
      if (won && m.method === 'TECHNICAL_SUPERIORITY') row.techWins++;
      if (rules) row.points! += won ? rules.winPoints+(rules.methodBonus[m.method as keyof typeof rules.methodBonus] ?? 0) : rules.lossPoints;
      row.recentResults.push({matchId:m.id,result:won?'W':'L'});
    }
  }
  const active = [...rows.values()].filter(r=>r.status!=='WITHDRAWN');
  function partition(bucket: Standing[], index: number): Standing[][] {
    if (bucket.length <= 1) return [bucket];
    if (!rules || index === rules.tieBreak.length) {
      const ids = bucket.map(r=>r.athleteId);
      const resolution = tieOrders.find(order=>order.length===ids.length && new Set(order).size===ids.length && order.every(id=>ids.includes(id)));
      return resolution ? resolution.map(id=>[rows.get(id)!]) : [[...bucket].sort((a,b)=>a.athleteId.localeCompare(b.athleteId))];
    }
    const criterion = rules.tieBreak[index];
    const ids = new Set(bucket.map(r=>r.athleteId));
    const value = (r:Standing) => criterion === 'headToHead'
      ? results.filter(m=>ids.has(m.athleteAId)&&ids.has(m.athleteBId)&&m.winnerId===r.athleteId).length
      : r[criterion] ?? 0;
    const groups = new Map<number,Standing[]>();
    for (const r of bucket) { const k = value(r); groups.set(k,[...(groups.get(k)??[]),r]); }
    return [...groups.keys()].sort((a,b)=>b-a).flatMap(k=>partition(groups.get(k)!,index+1));
  }
  const ordered: Standing[] = []; let position = 1;
  for (const bucket of partition(active,0)) {
    for (const r of bucket) {
      r.rank = rules ? position : null; r.tied = bucket.length>1;
      if (qualified && approved && !r.tied) r.status = position <= advanceCount ? 'QUALIFIED' : 'ELIMINATED';
      ordered.push(r);
    }
    position += bucket.length;
  }
  ordered.push(...[...rows.values()].filter(r=>r.status==='WITHDRAWN').sort((a,b)=>a.athleteId.localeCompare(b.athleteId)));
  return {rows:ordered,provisional:!approved,unresolved:ordered.some(r=>r.tied),rulesApproved:approved};
}

export type SeedPair = { a:{group:string;rank:number}; b:{group:string;rank:number} };
export function validateSeeding(pairs: SeedPair[], groupCodes: string[], advanceCount: number) {
  const total = groupCodes.length * advanceCount;
  requireCondition(total >= 2 && (total & (total-1)) === 0, 'Playoff participant count must be a power of two');
  const slots = pairs.flatMap(p=>[p.a,p.b]);
  requireCondition(slots.length === total, 'Every qualified position must be seeded');
  requireCondition(new Set(slots.map(s=>s.group+':'+s.rank)).size===total, 'Duplicate seed');
  requireCondition(slots.every(s=>groupCodes.includes(s.group)&&Number.isInteger(s.rank)&&s.rank>=1&&s.rank<=advanceCount), 'Invalid seed');
  return pairs;
}

export function assertQualification(input: {drawApproved:boolean;rulesApproved:boolean;expected:number;confirmed:number;unresolved:boolean;eligible:number;needed:number}) {
  requireCondition(input.drawApproved, 'Draw is not approved');
  requireCondition(input.rulesApproved, 'Competition rules are not approved');
  requireCondition(input.expected>0 && input.confirmed===input.expected, 'Every group result must be officially confirmed');
  requireCondition(!input.unresolved, 'Unresolved ties block qualification');
  requireCondition(input.eligible>=input.needed, 'Insufficient eligible athletes');
}

export interface DependencySlot {id:string;sourceAId:string|null;sourceBId:string|null;completed:boolean}
export function descendants(id:string, slots:DependencySlot[]) {
  const found = new Set<string>(), queue = [id];
  while (queue.length) {
    const current = queue.shift()!;
    for (const slot of slots) if (slot.sourceAId===current||slot.sourceBId===current) {
      requireCondition(slot.id!==id, 'Bracket cycle detected');
      if (!found.has(slot.id)) {found.add(slot.id);queue.push(slot.id);}
    }
  }
  return [...found];
}
