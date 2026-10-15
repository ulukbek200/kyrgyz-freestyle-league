-- Preserve legacy seasons, registrations, scores and rankings. No destructive data operations.
CREATE TYPE "EventStatus" AS ENUM ('PLANNED','LIVE','COMPLETED','CANCELLED');
ALTER TABLE "Event" ALTER COLUMN "seasonId" DROP NOT NULL;
ALTER TABLE "Match" ALTER COLUMN "seasonId" DROP NOT NULL;
ALTER TABLE "Ranking" ALTER COLUMN "seasonId" DROP NOT NULL;
ALTER TABLE "RankingSnapshot" ALTER COLUMN "seasonId" DROP NOT NULL;
ALTER TABLE "Championship" ALTER COLUMN "seasonId" DROP NOT NULL;
ALTER TABLE "Event" ADD COLUMN "city" TEXT NOT NULL DEFAULT '', ADD COLUMN "description" TEXT,
 ADD COLUMN "status" "EventStatus" NOT NULL DEFAULT 'PLANNED';
CREATE UNIQUE INDEX "Ranking_league_weight_athlete" ON "Ranking"("weightClassId","athleteId") WHERE "seasonId" IS NULL;
CREATE TABLE "EventWeightClass" (
 "eventId" TEXT NOT NULL, "weightClassId" TEXT NOT NULL,
 CONSTRAINT "EventWeightClass_pkey" PRIMARY KEY ("eventId","weightClassId"),
 CONSTRAINT "EventWeightClass_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "EventWeightClass_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "WeightClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "TournamentParticipant" (
 "id" TEXT NOT NULL PRIMARY KEY, "eventId" TEXT NOT NULL, "athleteId" TEXT NOT NULL,
 "weightClassId" TEXT, "ageDivision" "AgeDivision", "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TournamentParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TournamentParticipant_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TournamentParticipant_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "WeightClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TournamentParticipant_eventId_athleteId_key" ON "TournamentParticipant"("eventId","athleteId");
CREATE INDEX "TournamentParticipant_eventId_weightClassId_idx" ON "TournamentParticipant"("eventId","weightClassId");
INSERT INTO "EventWeightClass" ("eventId","weightClassId") SELECT DISTINCT "eventId","weightClassId" FROM "Match";
-- Before this migration every canonical weight of the event's division was available.
INSERT INTO "EventWeightClass" ("eventId","weightClassId")
 SELECT e.id,w.id FROM "Event" e JOIN "WeightClass" w ON e."ageDivision"=w."ageDivision"
 ON CONFLICT DO NOTHING;
-- Recover participation from actual matches, never from the athlete's current category.
WITH entries AS (
 SELECT "eventId","athleteAId" athlete,"weightClassId","ageDivision" FROM "Match"
 UNION ALL SELECT "eventId","athleteBId","weightClassId","ageDivision" FROM "Match"
), grouped AS (
 SELECT "eventId",athlete,COUNT(DISTINCT "weightClassId") weights,MIN("weightClassId") weight,
 COUNT(DISTINCT "ageDivision") divisions,MIN("ageDivision"::text) division FROM entries GROUP BY "eventId",athlete
)
INSERT INTO "TournamentParticipant" ("id","eventId","athleteId","weightClassId","ageDivision","status")
SELECT 'legacy-'||md5("eventId"||':'||athlete),"eventId",athlete,CASE WHEN weights=1 THEN weight END,
 CASE WHEN divisions=1 THEN division::"AgeDivision" END,'NEEDS_REVIEW' FROM grouped;
-- Existing classified matches remain editable without converting historical season data.
CREATE OR REPLACE FUNCTION kfl_check_match_division() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."ageDivision" IS NULL THEN RETURN NEW; END IF;
 IF NEW."athleteAId"=NEW."athleteBId" OR NOT EXISTS(SELECT 1 FROM "Event" WHERE id=NEW."eventId" AND "ageDivision"=NEW."ageDivision")
 OR NOT EXISTS(SELECT 1 FROM "EventWeightClass" WHERE "eventId"=NEW."eventId" AND "weightClassId"=NEW."weightClassId")
 OR (SELECT count(*) FROM "TournamentParticipant" WHERE "athleteId" IN (NEW."athleteAId",NEW."athleteBId") AND "eventId"=NEW."eventId" AND "ageDivision"=NEW."ageDivision" AND "weightClassId"=NEW."weightClassId" AND status='ACTIVE')<>2 THEN
  RAISE EXCEPTION 'Match requires compatible tournament participants' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
