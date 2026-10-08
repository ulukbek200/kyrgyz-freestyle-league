import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/** Shared write lock: also covers cross-category moves and corrections to old events. */
export function writeTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(74623190)`;
    return fn(tx);
  }, { timeout: 60000, maxWait: 15000 });
}

export function logAudit(tx: Prisma.TransactionClient, userId: string, action: string, entity: string, entityId: string, meta?: unknown) {
  return tx.auditLog.create({ data: { userId, action, entity, entityId,
    ...(meta === undefined ? {} : { meta: JSON.parse(JSON.stringify(meta)) }) } });
}
