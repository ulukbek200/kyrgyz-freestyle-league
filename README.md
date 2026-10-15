# Nomad Wrestling League

## Team access and hosting preparation

See [KFL Stage 1 report and Render/Vercel setup](KFL_TEAM_STAGE1_REPORT.md) for REGISTRAR access, safe first-admin bootstrap, persistent uploads, readiness, isolated tests and deployment prerequisites.

Foundation for a multi-season freestyle wrestling league. React/Vite frontend, Express/Prisma REST API, and PostgreSQL.

## KFL Admin Control Center 3.0
The management panel is available at `/admin`. See [implemented operations, API additions, verification and limitations](docs/ADMIN-CONTROL-CENTER-3.md).

For the editor connection fix and the exact frontend root/port audit, see [editor diagnostics](docs/EDITOR-DIAGNOSIS.md). On this Windows local test environment, `npm run dev:editor` starts this repository on port 5173 with its isolated API on 4401 and refuses occupied ports.

## Stage 2: verified local database
See [local PostgreSQL, API test results and admin readiness](docs/STAGE2.md). The isolated test database uses port 55432; do not use the destructive demo seed.

## Run locally
See [stage 1 setup, migrations and verification](docs/STAGE1.md).

Copy the root `.env.example` to `.env`, configure PostgreSQL credentials and a random JWT secret (32+ characters). Run `npm ci`, `npm run db:generate`, and follow the migration instructions for a new or existing database. Then run `npm run dev`.

Checks: `npm run typecheck`, `npm test`, `npm run build`. Production API: `npm --workspace apps/api start`.

Do not run `db:seed` against real data: it deletes league records and resets the demo administrator password.

Public API reads: athletes, rankings, seasons, weight classes, events, matches, champions and media. Public writes: POST /api/applications. Administrative endpoints require an authenticated current role: ADMIN has management access; REGISTRAR has only the explicit athlete-registration/upload and supporting-read allowlist. Results recalculate standings transactionally through RankingRule and write idempotent event snapshots.
