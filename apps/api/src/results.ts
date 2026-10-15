import type {Prisma} from '@prisma/client';
import {z} from 'zod';
import {HttpError} from './http.js';
import {recalculateRankings} from './rankingEngine.js';
import {rebuildChampionships} from './championships.js';
import {afterCompetitionResult,systemAvailable} from './tournamentSystem.js';

export const resultSchema = z.object({
  correctionReason:z.string().trim().min(5).max(2000).optional(),
  winnerId: z.string(), method: z.enum(['DECISION', 'TECHNICAL_FALL', 'PIN', 'FORFEIT']),
  athleteAPoints: z.number().int().nonnegative(), athleteBPoints: z.number().int().nonnegative(),
  periodOneA: z.number().int().nonnegative().default(0), periodOneB: z.number().int().nonnegative().default(0),
  periodTwoA: z.number().int().nonnegative().default(0), periodTwoB: z.number().int().nonnegative().default(0),
  penaltiesA: z.number().int().nonnegative().default(0), penaltiesB: z.number().int().nonnegative().default(0),
  bonus: z.number().int().nonnegative().default(0), summary: z.string().optional(),
});

// Caller supplies an interactive transaction; the category row serializes concurrent results,
// including results of different matches that affect the same belt and standings.
export async function changeResult(tx: Prisma.TransactionClient, id: string,
  result: z.infer<typeof resultSchema> | null, userId: string, cancellationReason?:string) {
  // Event first: advancing a bracket may update several dependent match rows.
  const initial = await tx.match.findUnique({where: {id}});
  if (!initial) throw new HttpError(404, 'Match not found');
  await tx.$queryRaw`SELECT "id" FROM "Event" WHERE "id" = ${initial.eventId} FOR UPDATE`;
  await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${id} FOR NO KEY UPDATE`;
  const event = await tx.event.findUnique({where:{id:initial.eventId}});
  if (!event) throw new HttpError(404, 'Tournament not found');
  await tx.$queryRaw`SELECT "id" FROM "WeightClass" WHERE "id" = ${initial.weightClassId} FOR UPDATE`;
  const match = await tx.match.findUnique({where: {id}});
  if (!match) throw new HttpError(404, 'Match not found');
  if(match.eventId!==initial.eventId||match.weightClassId!==initial.weightClassId)throw new HttpError(409,'Схватка изменена параллельно. Обновите страницу');
  const generated=await systemAvailable(tx)?await tx.tournamentBout.findUnique({where:{matchId:id}}):null;
  const reason=result?.correctionReason??cancellationReason;
  const previousScore=generated&&match.status==='COMPLETED'?await tx.matchScore.findUnique({where:{matchId:id}}):null;
  const identical=result&&previousScore&&result.winnerId===match.winnerId&&result.method===match.method&&(result.summary??null)===match.summary&&Object.entries(previousScore).every(([key,value])=>key==='id'||key==='matchId'||value===(result as Record<string,unknown>)[key]);
  if(generated&&match.status==='COMPLETED'&&!identical&&(!reason||reason.trim().length<5))throw new HttpError(400,'Для исправления или отмены результата укажите причину (не менее 5 символов)');
  if (result && ((['CANCELLED','COMPLETED'].includes(event.status) && match.status !== 'COMPLETED') || match.status==='CANCELLED')) {
    throw new HttpError(409, 'Нельзя добавить новый результат в закрытый турнир или отменённую схватку');
  }
  if (result && ![match.athleteAId, match.athleteBId].includes(result.winnerId)) {
    throw new HttpError(400, 'Winner must be a participant of this match');
  }
  let updated;
  if (result) {
    const {winnerId, method, summary, correctionReason:_reason, ...score} = result;
    updated = await tx.match.update({where: {id}, data: {status: 'COMPLETED', winnerId, method, summary}});
    await tx.matchScore.upsert({where: {matchId: id}, create: {matchId: id, ...score}, update: score});
  } else {
    updated = await tx.match.update({where: {id}, data: {status: 'UPCOMING', winnerId: null, method: null, summary: null}});
    await tx.matchScore.deleteMany({where: {matchId: id}});
  }
  await afterCompetitionResult(tx,id,userId,match.status!==updated.status||match.winnerId!==updated.winnerId||match.method!==updated.method);
  await recalculateRankings(tx, match.seasonId, match.weightClassId, match.eventId);
  if(match.seasonId)await recalculateRankings(tx,null,match.weightClassId,match.eventId);
  if (match.isTitleFight) await rebuildChampionships(tx, match.weightClassId);
  await tx.notification.create({data: {type: result ? 'MATCH_COMPLETED' : 'MATCH_RESULT_CANCELLED',
    message: result ? 'Match completed; rankings recalculated' : 'Match result cancelled; rankings recalculated'}});
  await tx.auditLog.create({data: {userId, action: result ? 'SET_RESULT' : 'CANCEL_RESULT', entity: 'Match', entityId: id,metadata:{reason:reason??null,before:{winnerId:match.winnerId,method:match.method,status:match.status},after:{winnerId:updated.winnerId,method:updated.method,status:updated.status}}}});
  return updated;
}
