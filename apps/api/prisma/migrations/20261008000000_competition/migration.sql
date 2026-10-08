-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "countsForLeagueRanking" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Territory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionAgeCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,

    CONSTRAINT "CompetitionAgeCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "ageCategoryId" TEXT NOT NULL,
    "ageReferenceDate" TIMESTAMP(3),
    "groupCodes" TEXT[],
    "territoryQuota" INTEGER NOT NULL,
    "advanceCount" INTEGER NOT NULL,
    "groupWeeks" INTEGER NOT NULL,
    "firstPlayoffWeek" INTEGER NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "seeding" JSONB,
    "classificationRules" JSONB,
    "classificationApprovedAt" TIMESTAMP(3),
    "youtubeUrl" TEXT,
    "liveActive" BOOLEAN NOT NULL DEFAULT false,
    "currentFixtureId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionTerritory" (
    "competitionId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,

    CONSTRAINT "CompetitionTerritory_pkey" PRIMARY KEY ("competitionId","territoryId")
);

-- CreateTable
CREATE TABLE "CompetitionParticipant" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "weightClassId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawalReason" TEXT,

    CONSTRAINT "CompetitionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionDivision" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "weightClassId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "drawSeed" TEXT,
    "drawApprovedAt" TIMESTAMP(3),
    "tieOrders" JSONB,
    "qualification" JSONB,
    "qualificationApprovedAt" TIMESTAMP(3),
    "bracketApprovedAt" TIMESTAMP(3),
    "placementsApprovedAt" TIMESTAMP(3),

    CONSTRAINT "CompetitionDivision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionGroup" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "CompetitionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionGroupMember" (
    "groupId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CompetitionGroupMember_pkey" PRIMARY KEY ("groupId","participantId")
);

-- CreateTable
CREATE TABLE "CompetitionRuleset" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "config" JSONB,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetitionRuleset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionFixture" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "round" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "groupId" TEXT,
    "matchId" TEXT,
    "sourceAId" TEXT,
    "sourceBId" TEXT,
    "outcomeA" TEXT NOT NULL DEFAULT 'WINNER',
    "outcomeB" TEXT NOT NULL DEFAULT 'WINNER',
    "seedAId" TEXT,
    "seedBId" TEXT,
    "eventId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "callTime" TIMESTAMP(3),
    "matNumber" TEXT,
    "estimatedStart" BOOLEAN NOT NULL DEFAULT true,
    "confirmedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetitionFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionApproval" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "divisionId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionPlacement" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "place" INTEGER NOT NULL,
    "participantId" TEXT NOT NULL,
    "basisFixtureId" TEXT NOT NULL,

    CONSTRAINT "CompetitionPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Territory_region_name_key" ON "Territory"("region", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Competition_seasonId_key" ON "Competition"("seasonId");

-- CreateIndex
CREATE INDEX "CompetitionParticipant_competitionId_weightClassId_territor_idx" ON "CompetitionParticipant"("competitionId", "weightClassId", "territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionParticipant_competitionId_athleteId_key" ON "CompetitionParticipant"("competitionId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionDivision_competitionId_weightClassId_key" ON "CompetitionDivision"("competitionId", "weightClassId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionGroup_divisionId_code_key" ON "CompetitionGroup"("divisionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionGroupMember_participantId_key" ON "CompetitionGroupMember"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionGroupMember_groupId_position_key" ON "CompetitionGroupMember"("groupId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionRuleset_competitionId_key" ON "CompetitionRuleset"("competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionFixture_matchId_key" ON "CompetitionFixture"("matchId");

-- CreateIndex
CREATE INDEX "CompetitionFixture_divisionId_week_stage_idx" ON "CompetitionFixture"("divisionId", "week", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionFixture_divisionId_key_key" ON "CompetitionFixture"("divisionId", "key");

-- CreateIndex
CREATE INDEX "CompetitionApproval_competitionId_createdAt_idx" ON "CompetitionApproval"("competitionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionPlacement_divisionId_place_key" ON "CompetitionPlacement"("divisionId", "place");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionPlacement_divisionId_participantId_key" ON "CompetitionPlacement"("divisionId", "participantId");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_ageCategoryId_fkey" FOREIGN KEY ("ageCategoryId") REFERENCES "CompetitionAgeCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_currentFixtureId_fkey" FOREIGN KEY ("currentFixtureId") REFERENCES "CompetitionFixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionTerritory" ADD CONSTRAINT "CompetitionTerritory_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionTerritory" ADD CONSTRAINT "CompetitionTerritory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "WeightClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipant" ADD CONSTRAINT "CompetitionParticipant_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionDivision" ADD CONSTRAINT "CompetitionDivision_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionDivision" ADD CONSTRAINT "CompetitionDivision_weightClassId_fkey" FOREIGN KEY ("weightClassId") REFERENCES "WeightClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionGroup" ADD CONSTRAINT "CompetitionGroup_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "CompetitionDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionGroupMember" ADD CONSTRAINT "CompetitionGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompetitionGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionGroupMember" ADD CONSTRAINT "CompetitionGroupMember_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CompetitionParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionRuleset" ADD CONSTRAINT "CompetitionRuleset_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "CompetitionDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CompetitionGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_sourceAId_fkey" FOREIGN KEY ("sourceAId") REFERENCES "CompetitionFixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_sourceBId_fkey" FOREIGN KEY ("sourceBId") REFERENCES "CompetitionFixture"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_seedAId_fkey" FOREIGN KEY ("seedAId") REFERENCES "CompetitionParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_seedBId_fkey" FOREIGN KEY ("seedBId") REFERENCES "CompetitionParticipant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionFixture" ADD CONSTRAINT "CompetitionFixture_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionApproval" ADD CONSTRAINT "CompetitionApproval_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionApproval" ADD CONSTRAINT "CompetitionApproval_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "CompetitionDivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionApproval" ADD CONSTRAINT "CompetitionApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPlacement" ADD CONSTRAINT "CompetitionPlacement_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "CompetitionDivision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPlacement" ADD CONSTRAINT "CompetitionPlacement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "CompetitionParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionPlacement" ADD CONSTRAINT "CompetitionPlacement_basisFixtureId_fkey" FOREIGN KEY ("basisFixtureId") REFERENCES "CompetitionFixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
