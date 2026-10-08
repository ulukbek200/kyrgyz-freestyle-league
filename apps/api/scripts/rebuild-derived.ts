import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { writeTransaction } from '../src/lib/transaction';
import { recalculate } from '../src/modules/rankings/rankingService';
import { rebuildTitles } from '../src/modules/champions/titleService';

async function main() {
  await writeTransaction(async tx => {
    const seasons = await tx.season.findMany(), weights = await tx.weightClass.findMany();
    for (const s of seasons) for (const w of weights) await recalculate(s.id, w.id, tx);
    for (const w of weights) await rebuildTitles(w.id, tx);
  });
  console.log('Rankings, snapshots and titles rebuilt from saved results.');
}
main().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
