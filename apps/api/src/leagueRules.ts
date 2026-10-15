import type {Prisma} from '@prisma/client';
import {HttpError} from './http.js';

export function selectWeightClass<T extends {id: string; kilograms: number}>(classes: T[], weightKg: number): T {
  const selected = [...classes].filter(c => c.kilograms >= weightKg)
    .sort((a, b) => a.kilograms - b.kilograms || a.id.localeCompare(b.id))[0];
  if (!Number.isFinite(weightKg) || weightKg <= 0 || !selected) {
    throw new HttpError(400, 'No suitable weight class for this athlete. Create a category at or above the actual weight.');
  }
  return selected;
}

export async function createActiveSeason(tx: Prisma.TransactionClient, data: {
  seasonYear?:number; name: string; description?: string; startsAt: Date; endsAt?: Date;
}) {
  if (data.endsAt && data.endsAt < data.startsAt) throw new HttpError(400, 'Season end must not precede its start');
  await tx.$executeRaw`LOCK TABLE "Season" IN SHARE ROW EXCLUSIVE MODE`;
  await tx.season.updateMany({where: {isActive: true}, data: {isActive: false}});
  return tx.season.create({data: {...data, isActive: true}});
}
