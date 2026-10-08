# Hardening / stabilization

## Baseline (2026-10-06)

- API build fails: inline Prisma enums (P1012).
- Web build fails: missing EventHero import.
- Initial migration lacks Event.ticketUrl / streamUrl.
- Titles are irreversible side effects; corrections/cancellation leave stale reigns.
- Ranking calculation drops matches against athletes excluded by current eligibility.
- Match PATCH, roster/profile changes and application approval are not atomic.
- Admin uses public athlete/event lists; archived athletes cannot be restored.
- No season category selection or complete roster UI; backend admission checks missing.
- Hidden events leak through detail/search/match/related endpoints.
- JWT role/status remains trusted after account changes.
- Result editor sends empty periods, destroying existing scores.
- Media editing/publishing/deletion and automated tests are missing.

## Domain decisions

- Only ACTIVE, non-archived athletes in a season roster and selected weight class can enter new matches.
- Current rankings use current eligible roster; historical snapshots use actual match participants and the match's stored season/category. Historical result corrections remain possible after retirement or category changes.
- Titles belong to a weight class across seasons, retaining the existing league-wide belt model. Completed non-REGULAR matches are title decisions; replay order is scheduledAt, id. A defense with no preceding reign (e.g. after annulment) establishes a vacant title. A different winner starts a new reign.
- Public statistical projections replay published events only. Administrative derived tables include all saved results. Unpublishing must not leak hidden results through ranks, champions, snapshots or profiles.
- Sports/admin mutations use one PostgreSQL advisory transaction lock. This intentionally serializes writes for this MVP and prevents races between results, roster changes, publication changes and approvals.
- Existing enum values remain unchanged. UI label BACKSTAGE maps to BEHIND_THE_SCENES.
- Integration tests use an isolated generated PostgreSQL schema, never seed/reset the application database.

## FIXED

- All Prisma enums formatted without renaming values; real EventHero imported.
- Title history/defenses/current champion replay from completed title matches in chronological order. Stable IDs prevent duplicate reigns on repeat saves. Cancellation, deletion, type/category changes and corrections rebuild affected title history.
- Historical opponents stay in the ranking accumulator. Current table eligibility is separate from historical snapshots. Archive, suspension, retirement, inactivity, category changes and roster removal do not erase opponents' results.
- Match create/edit/result/delete and event moves are transactional. Both old/new season-category pairs rebuild; event/season consistency also has a composite database foreign key. Replacing participants of a completed match requires explicitly reopening/cancelling it, clearing the old result.
- Admin athlete list includes every status and archive, filters and pagination; restore, profile editing and history are available.
- Season category selection, roster listing/add/remove, server-side admission checks, and roster-based match selection are implemented. Removal with pending matches returns a conflict.
- Application approval is atomic and idempotent, with a shared transaction lock, conditional state update and a unique athlete link. Errors roll back athlete creation and approval.
- Public event/match/search/season/profile queries and statistical projections include published events only; admin lists include unpublished records.
- Auth checks current user existence, isActive and role in the database for every protected request.
- Result editor loads existing periods, supports adding/removing/editing up to four periods (including Period 1/2/3), and never replaces them with an implicit empty array. Server validates period totals; omission preserves existing data.
- Media supports create/edit/publish/unpublish/delete. Public media displays full published text as plain text. BACKSTAGE is an input/UI alias for the unchanged BEHIND_THE_SCENES enum.
- Added reproducible unit/integration infrastructure and maintenance checks/rebuild commands. Seed now requires explicit ALLOW_DESTRUCTIVE_SEED=yes.

## TESTED

Final verification on 2026-10-06:

| Check | Result |
| --- | --- |
| prisma format / validate / generate | PASS |
| API TypeScript build | PASS |
| Web TypeScript + Vite production build | PASS (bundle-size warning) |
| npm run typecheck (both workspaces) | PASS |
| Unit tests | 8 passed, 0 failed |
| PostgreSQL HTTP integration scenarios | 15 passed, 0 failed |
| Fresh-schema application of both migrations | PASS on every integration run |
| Existing local database migration | PASS |
| Existing local data integrity checks | 7 checks, all zero violations |
| Separate manual HTTP walkthrough | PASS |
| Browser/UI walkthrough | NOT VERIFIED: browser execution tool fails before startup with missing sandboxPolicy |

Integration coverage: first title, defense, challenger, correction of old winners and later defenses, cancellation, deletion, idempotency; all athlete eligibility changes; period preservation and invalid totals; season/category/event moves; direct DB integrity violations; roster admission failures; concurrent result writes; concurrent application approval; transaction rollback after a source update; disabled user/stale role; publication filtering including indirect statistical leaks; media lifecycle.

Manual HTTP walkthrough used an isolated QA schema, real HTTP login and endpoints:
create active season → create/select category → create/add A/B/C → event → regular match → three-period result A=1W/3pts → correct winner B=1W/3pts → title fight → correct title winner → archive A → B retains 2W/6pts → next event and B-vs-C UPCOMING match. QA server and temporary schema were removed afterward. This was an HTTP walkthrough, not a visual browser test.

Local source counts before and after migration/test execution: 1 athlete, 0 matches, 1 application. No application seed/reset was run.

After verification, the local dev API was restarted on port 4000; frontend remained on 5173. Final HTTP smoke checks for health/home/athletes/events/champions/media all returned 200. API stderr was empty. Development logs are in ignored `.logs/`.

## REMAINING RISKS

- Visual form interactions and layout still need a browser pass; no browser screenshots or UI-test success is claimed.
- Public rankings/title history replay published results on read. Correctness is prioritized; large seasons will need profiling and a cache/materialized public projection.
- One advisory lock serializes sports/admin writes. This prevents races in the current app but limits write throughput; rebuilds have a 60-second transaction timeout.
- Writes performed directly in the database bypass service-level roster/admission rules. Database checks protect essential match/result links; use the API for sports mutations and db:rebuild after approved direct data repairs.
- Vite reports the existing Ant Design chunk above 500 kB (~1.2 MB uncompressed). No design/dependency overhaul was performed.
- Domain policy retained: one league-wide belt per category across seasons. After annulment of an opening fight, the next saved title decision can establish the vacant belt. Any different sporting policy should be specified before changing replay rules.

## DATABASE/MIGRATION CHANGES

New migration: `apps/api/prisma/migrations/20261006000000_hardening/migration.sql`.

- Add Event.ticketUrl/streamUrl if absent, fixing initial migration/schema drift.
- Add SeasonWeightClass and backfill category selection from existing matches/rosters.
- Add Event(id, seasonId) unique key and composite Match(eventId, seasonId) foreign key, cascading event season moves.
- Add checks for distinct participants, winner belonging to the match, complete result for COMPLETED status, and nonnegative scores/penalties.
- Add Application.athleteId unique index and foreign key.
- Enum values and the existing initial migration are unchanged. Historical source records are not deleted. Derived tables were rebuilt using the maintenance command.

## COMMANDS EXECUTED

```text
npm exec -w @league/api -- prisma format
npm exec -w @league/api -- prisma validate
npm exec -w @league/api -- prisma generate
npm exec -w @league/api -- tsc --noEmit
npm run build
npm run build -w @league/api
npm run typecheck
npm run test:unit
npm run test:integration
npm test
npm run db:check -w @league/api
npm run db:deploy
npm run db:rebuild -w @league/api
npm run db:format -w @league/api
npm run db:validate -w @league/api
node tests/run-integration.cjs --manual  (cwd: apps/api)
```

The first client-generation attempt hit Windows EPERM because running development APIs held the Prisma DLL. Only this project's tsx API processes were stopped; generation then passed. Final test/build results above refer to successful subsequent runs.

## FILES CHANGED

```text
.gitignore
README.md
HARDENING.md
package.json
apps/api/package.json
apps/api/prisma/schema.prisma
apps/api/prisma/seed.ts
apps/api/prisma/migrations/20261006000000_hardening/migration.sql (new)
apps/api/src/lib/transaction.ts (new)
apps/api/src/lib/utils.ts
apps/api/src/middleware/auth.ts
apps/api/src/middleware/errorHandler.ts
apps/api/src/modules/rankings/rankingEngine.ts
apps/api/src/modules/rankings/rankingRules.ts
apps/api/src/modules/rankings/rankingService.ts
apps/api/src/modules/champions/titleService.ts
apps/api/src/modules/matches/matchService.ts
apps/api/src/modules/admin/adminService.ts (new)
apps/api/src/modules/public/publicViews.ts (new)
apps/api/src/routes/admin.ts
apps/api/src/routes/adminManagement.ts (new)
apps/api/src/routes/public.ts
apps/api/scripts/check-data.ts (new)
apps/api/scripts/rebuild-derived.ts (new)
apps/api/tests/unit.test.ts (new)
apps/api/tests/integration.test.ts (new)
apps/api/tests/run-integration.cjs (new)
apps/api/tests/manual-server.ts (new)
apps/web/package.json
apps/web/src/pages/Events.tsx
apps/web/src/pages/admin/Admin.tsx
apps/web/src/pages/admin/Management.tsx (new)
```
