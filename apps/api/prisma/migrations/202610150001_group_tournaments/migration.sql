-- Additive migration: no existing sports data is rewritten or removed.
CREATE TABLE "SeasonCycle" (
 "seasonId" TEXT PRIMARY KEY,
 "status" TEXT NOT NULL DEFAULT 'PLANNED' CHECK ("status" IN ('PLANNED','LIVE','COMPLETED','CANCELLED')),
 "summary" TEXT,
 CONSTRAINT "SeasonCycle_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "TournamentFormat" (
 "id" TEXT PRIMARY KEY,
 "eventId" TEXT NOT NULL,
 "weightClassId" TEXT NOT NULL,
 "groups" JSONB NOT NULL,
 "decisions" JSONB NOT NULL DEFAULT '{}',
 "confirmedHash" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "TournamentFormat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TournamentFormat_eventId_weightClassId_fkey" FOREIGN KEY ("eventId","weightClassId") REFERENCES "EventWeightClass"("eventId","weightClassId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TournamentFormat_eventId_weightClassId_key" ON "TournamentFormat"("eventId","weightClassId");
CREATE TABLE "TournamentBout" (
 "id" TEXT PRIMARY KEY,
 "formatId" TEXT NOT NULL,
 "phase" TEXT NOT NULL CHECK ("phase" IN ('GROUP','PLAYOFF')),
 "groupName" TEXT NOT NULL DEFAULT '',
 "round" INTEGER NOT NULL CHECK ("round">0),
 "position" INTEGER NOT NULL CHECK ("position">0),
 "seedAId" TEXT,
 "seedBId" TEXT,
 "matchId" TEXT,
 CONSTRAINT "TournamentBout_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "TournamentFormat"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TournamentBout_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TournamentBout_matchId_key" ON "TournamentBout"("matchId");
CREATE UNIQUE INDEX "TournamentBout_formatId_phase_groupName_round_position_key" ON "TournamentBout"("formatId","phase","groupName","round","position");
