-- Additive: existing accounts and all historical records are preserved.
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false,
                   ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
