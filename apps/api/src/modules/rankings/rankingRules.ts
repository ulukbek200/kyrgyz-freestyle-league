import type { MatchMethod } from '@prisma/client';
import { z } from 'zod';

export const rankingRulesSchema = z.object({
  winPoints: z.number().int().min(0).max(1000).optional(),
  lossPoints: z.number().int().min(0).max(1000).optional(),
  penaltyPoints: z.number().int().min(0).max(1000).optional(),
  methodBonus: z.object({ POINTS: z.number().int(), TECHNICAL_SUPERIORITY: z.number().int(), PIN: z.number().int(),
    FORFEIT: z.number().int(), DISQUALIFICATION: z.number().int(), INJURY: z.number().int() }).partial().optional(),
  tieBreakers: z.array(z.enum(['points', 'wins', 'headToHead', 'techWins', 'pins', 'pointDiff'])).min(1).max(6)
    .refine(v => new Set(v).size === v.length, 'Duplicate tie breakers').optional(),
}).strict();

export type TieBreaker = 'points' | 'wins' | 'headToHead' | 'techWins' | 'pins' | 'pointDiff';

export interface RankingRules {
  winPoints: number;
  lossPoints: number;
  methodBonus: Record<MatchMethod, number>;
  penaltyPoints: number; // сколько очков снимается за каждое штрафное
  tieBreakers: TieBreaker[];
}

export interface RankedMatch {
  id: string;
  athleteAId: string;
  athleteBId: string;
  winnerId: string;
  method: MatchMethod;
  scoreA: number;
  scoreB: number;
  penaltiesA: number;
  penaltiesB: number;
}

export interface Standing {
  athleteId: string;
  rank: number;
  points: number;
  wins: number;
  losses: number;
  techWins: number;
  pins: number;
  pointDiff: number;
}

/** Значения по умолчанию. Season.rankingRules (JSON) переопределяет любое поле. */
export const RANKING_DEFAULTS: RankingRules = {
  winPoints: 3,
  lossPoints: 0,
  methodBonus: { POINTS: 0, TECHNICAL_SUPERIORITY: 1, PIN: 2, FORFEIT: 0, DISQUALIFICATION: 0, INJURY: 0 },
  penaltyPoints: 0,
  tieBreakers: ['points', 'wins', 'headToHead', 'techWins', 'pins'],
};
