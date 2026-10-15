-- Refuse ambiguous legacy data. An administrator must choose the active season first.
-- This migration never deletes records or silently chooses a season.
CREATE UNIQUE INDEX "Season_single_active" ON "Season" ("isActive") WHERE "isActive" = true;
