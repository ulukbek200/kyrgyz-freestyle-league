-- Preserve existing enum values and data. Existing installations may already have
-- these two columns from a local db push; fresh installations do not.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "ticketUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "streamUrl" TEXT;

CREATE TABLE "SeasonWeightClass" (
  "seasonId" TEXT NOT NULL,
  "weightClassId" TEXT NOT NULL,
  CONSTRAINT "SeasonWeightClass_pkey" PRIMARY KEY ("seasonId", "weightClassId"),
  CONSTRAINT "SeasonWeightClass_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SeasonWeightClass_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "WeightClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "SeasonWeightClass" ("seasonId", "weightClassId")
SELECT "seasonId", "weightClassId" FROM "Match"
UNION SELECT s."seasonId", a."weightClassId" FROM "SeasonAthlete" s JOIN "Athlete" a ON a.id = s."athleteId";

CREATE UNIQUE INDEX "Event_id_seasonId_key" ON "Event"("id", "seasonId");
ALTER TABLE "Match" DROP CONSTRAINT "Match_eventId_fkey";
ALTER TABLE "Match" ADD CONSTRAINT "Match_eventId_seasonId_fkey"
  FOREIGN KEY ("eventId", "seasonId") REFERENCES "Event"("id", "seasonId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_distinct_athletes" CHECK ("athleteAId" <> "athleteBId");
ALTER TABLE "Match" ADD CONSTRAINT "Match_valid_winner" CHECK ("winnerId" IS NULL OR "winnerId" IN ("athleteAId", "athleteBId"));
ALTER TABLE "Match" ADD CONSTRAINT "Match_completed_result" CHECK (
  "status" <> 'COMPLETED' OR ("winnerId" IS NOT NULL AND "method" IS NOT NULL AND "scoreA" IS NOT NULL AND "scoreB" IS NOT NULL)
);
ALTER TABLE "Match" ADD CONSTRAINT "Match_nonnegative_scores" CHECK (
  ("scoreA" IS NULL OR "scoreA" >= 0) AND ("scoreB" IS NULL OR "scoreB" >= 0) AND "penaltiesA" >= 0 AND "penaltiesB" >= 0
);
CREATE UNIQUE INDEX "Application_athleteId_key" ON "Application"("athleteId");
ALTER TABLE "Application" ADD CONSTRAINT "Application_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
