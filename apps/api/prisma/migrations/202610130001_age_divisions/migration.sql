-- Additive migration. NULL means unclassified legacy data, never an assumed division.
CREATE TYPE "AgeDivision" AS ENUM ('U17', 'U23');
CREATE TYPE "RegistrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'NEEDS_REVIEW');
ALTER TABLE "Athlete" ADD COLUMN "dateOfBirth" DATE;
ALTER TABLE "Season" ADD COLUMN "seasonYear" INTEGER;
ALTER TABLE "Season" ADD CONSTRAINT "Season_year_check" CHECK ("seasonYear" BETWEEN 1900 AND 2200);
ALTER TABLE "WeightClass" ADD COLUMN "ageDivision" "AgeDivision";
CREATE UNIQUE INDEX "WeightClass_ageDivision_kilograms_key" ON "WeightClass"("ageDivision", "kilograms");
CREATE UNIQUE INDEX "WeightClass_id_ageDivision_key" ON "WeightClass"("id", "ageDivision");
ALTER TABLE "WeightClass" ADD CONSTRAINT "WeightClass_division_weights_check" CHECK (
 "ageDivision" IS NULL OR
 ("ageDivision"='U17' AND "kilograms" IN (45,48,51,55,60,65,70)) OR
 ("ageDivision"='U23' AND "kilograms" IN (57,61,65,70,74)));
ALTER TABLE "Event" ADD COLUMN "ageDivision" "AgeDivision";
ALTER TABLE "Match" ADD COLUMN "ageDivision" "AgeDivision";
ALTER TABLE "Application" ADD COLUMN "seasonId" TEXT, ADD COLUMN "weightClassId" TEXT, ADD COLUMN "ageDivision" "AgeDivision";
ALTER TABLE "Application" ADD CONSTRAINT "Application_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "WeightClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "AthleteSeasonRegistration" (
 "id" TEXT NOT NULL PRIMARY KEY, "athleteId" TEXT NOT NULL, "seasonId" TEXT NOT NULL,
 "ageDivision" "AgeDivision" NOT NULL, "weightClassId" TEXT NOT NULL,
 "status" "RegistrationStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "AthleteSeasonRegistration_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "AthleteSeasonRegistration_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "AthleteSeasonRegistration_weightClassId_ageDivision_fkey" FOREIGN KEY ("weightClassId", "ageDivision") REFERENCES "WeightClass"("id", "ageDivision") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AthleteSeasonRegistration_athleteId_seasonId_key" ON "AthleteSeasonRegistration"("athleteId", "seasonId");
CREATE INDEX "AthleteSeasonRegistration_seasonId_ageDivision_weightClassId_idx" ON "AthleteSeasonRegistration"("seasonId", "ageDivision", "weightClassId");
-- Birth dates can be recovered only from unanimously agreeing approved linked applications.
UPDATE "Athlete" a SET "dateOfBirth"=source.dob FROM (
 SELECT "athleteId", MIN("birthDate"::date) dob FROM "Application"
 WHERE "status"='APPROVED' AND "athleteId" IS NOT NULL
 GROUP BY "athleteId" HAVING COUNT(DISTINCT "birthDate"::date)=1
) source WHERE a."id"=source."athleteId" AND a."dateOfBirth" IS NULL;
-- Do not infer season years, tournament divisions or historic weight mappings.
-- Populate only the approved canonical catalog; keep all pre-existing categories.
INSERT INTO "WeightClass" ("id","name","kilograms","order","ageDivision")
SELECT 'kfl-'||lower(d.division)||'-'||w.kg, d.division||' · '||w.kg||' кг',w.kg,w.kg,d.division::"AgeDivision"
FROM (VALUES ('U17',ARRAY[45,48,51,55,60,65,70]),('U23',ARRAY[57,61,65,70,74])) d(division,weights)
CROSS JOIN LATERAL unnest(d.weights) w(kg);

-- Database-level checks for classified registrations and matches, including direct SQL writes.
CREATE FUNCTION kfl_check_registration() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE age INTEGER;
BEGIN
 SELECT s."seasonYear"-EXTRACT(YEAR FROM a."dateOfBirth")::int INTO age
 FROM "Athlete" a CROSS JOIN "Season" s WHERE a.id=NEW."athleteId" AND s.id=NEW."seasonId";
 IF age IS NULL OR NOT ((NEW."ageDivision"='U17' AND age BETWEEN 16 AND 17) OR (NEW."ageDivision"='U23' AND age BETWEEN 18 AND 23)) THEN
  RAISE EXCEPTION 'Invalid season age for registration' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (OLD."ageDivision",OLD."weightClassId",OLD."seasonId",OLD."athleteId") IS DISTINCT FROM (NEW."ageDivision",NEW."weightClassId",NEW."seasonId",NEW."athleteId") AND EXISTS(SELECT 1 FROM "Match" WHERE "seasonId"=OLD."seasonId" AND ("athleteAId"=OLD."athleteId" OR "athleteBId"=OLD."athleteId")) THEN
  RAISE EXCEPTION 'Registration has match history' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kfl_registration_check BEFORE INSERT OR UPDATE ON "AthleteSeasonRegistration" FOR EACH ROW EXECUTE FUNCTION kfl_check_registration();
CREATE FUNCTION kfl_check_match_division() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."ageDivision" IS NULL THEN RETURN NEW; END IF;
 IF NEW."athleteAId"=NEW."athleteBId" OR NOT EXISTS(SELECT 1 FROM "Event" WHERE id=NEW."eventId" AND "seasonId"=NEW."seasonId" AND "ageDivision"=NEW."ageDivision")
 OR (SELECT count(*) FROM "AthleteSeasonRegistration" WHERE "athleteId" IN (NEW."athleteAId",NEW."athleteBId") AND "seasonId"=NEW."seasonId" AND "ageDivision"=NEW."ageDivision" AND "weightClassId"=NEW."weightClassId")<>2 THEN
  RAISE EXCEPTION 'Incompatible match division or registration' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER kfl_match_division_check BEFORE INSERT OR UPDATE OF "seasonId","eventId","ageDivision","weightClassId","athleteAId","athleteBId" ON "Match" FOR EACH ROW EXECUTE FUNCTION kfl_check_match_division();
