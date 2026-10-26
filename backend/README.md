# ConTrack API

NestJS + PostgreSQL (Drizzle) backend for ConTrack: sign-in, workspaces (tenants) with teams and roles,
cloud projects with live collaboration (presence, soft lock, level assignment).

- Design: `../docs/backend/00-backend-design.md` · Plan: `../docs/backend/01-implementation-plan.md`
- Conventions (Clean + DDD): `CONVENTIONS.md` · Routes: `API.md`
- Shared with the web app: BOQ engine `../src/domain`, API contract `../src/shared/contract`

## Run

```bash
cp .env.example .env            # set JWT_ACCESS_SECRET
npm install
docker compose up -d            # PostgreSQL 16 (contrack + contrack_test)
#   …or, without Docker / admin rights: npm run db:local   (same port, user and databases; keep it running)
npm run db:migrate              # apply ./drizzle migrations
npm run db:seed                 # demo accounts + projects (see SEED.md); -- --reset to start over
npm run start:dev               # http://localhost:4000 (health: GET /health)
```

The database must be UTF8 (Thai text); the API refuses to start otherwise.

Try without a database: set `PERSISTENCE=memory` in `.env` (data is lost on restart).

Web app (repo root): `npm run dev` — `/api/*` is proxied to `API_URL` (default http://localhost:4000).

## Test

```bash
npm test             # unit: domain + use cases, in-memory adapters (no database)
npm run test:e2e     # whole app over HTTP + Socket.IO, in-memory persistence
npm run test:int     # Drizzle adapters on TEST_DATABASE_URL (suites skip when PostgreSQL is not reachable)
npm run typecheck && npm run lint
```

## Schema changes

Edit `src/shared/infrastructure/database/schema.ts`, then `npm run db:generate -- --name <change>` (writes SQL
to `./drizzle`, no database needed) and commit the migration.

## Production

`npm run build && npm start` (dist/backend/src/main.js). Required: `NODE_ENV=production`, `COOKIE_SECURE=true`,
a strong `JWT_ACCESS_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`; `REALTIME_BUS=postgres` when running more than one
instance. Run `npm run db:migrate` before starting a new version. Business modules are off unless listed in
`MODULES_ENABLED` (comma-separated, e.g. `MODULES_ENABLED=workforce`; see API.md "platform").
