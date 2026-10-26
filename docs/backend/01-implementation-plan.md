# Backend implementation plan (NestJS + PostgreSQL, Clean + DDD)

Status: **in progress**, 2026-10-26. This plan supersedes the stack choice in `00-backend-design.md` §8; the product design (workspaces = tenants, roles, docs per sheet, revisions, collaboration levels, offline-first) still applies.

## Owner decisions (2026-10-26)
- Collaboration **level 2**: live updates, presence (who is on which level), soft lock, level assignment. No same-level co-editing (CRDT).
- Database: **PostgreSQL**, ORM **Drizzle** (schema in TypeScript, SQL migrations generated offline by drizzle-kit).
- Backend: **NestJS**, standard layout, **Clean architecture + DDD** following the concepts of `mguay22/clean-shop`. **No CQRS** (no command/query bus, no sagas): plain use-case classes.
- **Type-driven**: branded ids, value objects, `Result` instead of throwing in domain, zod at every boundary, a shared API contract used by both frontend and backend.
- Frontend: **TanStack Query** for server state, **Zustand** stays for the working copy of the open project.
- This round: write all the code. Docker or a real database is not needed yet (the owner runs it next round). Unit tests run without a database (in-memory adapters). Integration tests against Postgres are written and skipped automatically when no database is reachable.
- Everything that works today must keep working: **guest mode** (no login, project in this browser) stays the default until a user signs in.

## Repository layout

```
/                       Next.js app (unchanged location)
  src/domain/           BOQ engine, calculators, planning, journey — pure TS, shared with the backend
  src/domain/sync/      Project ⇄ documents mapping (doc keys), project summary — shared
  src/shared/contract/  API + realtime contract (zod schemas + types) — shared
  src/features/cloud/   frontend: API client, auth, workspaces, projects, sync engine, presence
backend/                NestJS app (own package.json)
  src/shared/domain/          Result, DomainError, branded ids, Clock, IdGenerator
  src/shared/application/     cross-module ports (WorkspaceAccess, RealtimePublisher, ActivityRecorder)
  src/shared/infrastructure/  database (Drizzle client, schema, transactions), config, crypto
  src/shared/presentation/    auth guard, @CurrentUser, zod pipe, error filter
  src/modules/<context>/
      domain/{entities,value-objects,events,policies}
      application/{ports,use-cases}
      infrastructure/adapters/   drizzle-*.repository.ts, in-memory-*.repository.ts, other adapters
      presentation/              controllers / gateways
      <context>.module.ts
  drizzle/              generated SQL migrations
  test/                 e2e (supertest, in-memory adapters) + integration (Postgres, auto-skip)
```

The backend compiles `src/domain`, `src/domain/sync` and `src/shared/contract` through path aliases
(`@contrack/domain/*`, `@contrack/contract/*`), so the server calculates totals with exactly the same code as the browser.

## Bounded contexts
| Module | Owns | Main use cases |
|---|---|---|
| identity | users, password hashes, refresh-token families | register (creates a personal workspace), login, refresh (rotation + reuse detection), logout, me |
| workspaces | workspaces, memberships, invitations, role policy | create company workspace, rename, list members, change role, remove member, leave, invite, revoke, accept invitation |
| projects | projects, project docs (optimistic concurrency), revisions, level assignments, activity | list/create (incl. upload of a guest project), open, rename, archive, delete, put/delete doc, create/list/get revision, assign level, activity feed |
| realtime | socket gateway, presence, event bus | join/leave project room, presence update + heartbeat, fan-out of doc/project/assignment events (in-memory bus; Postgres LISTEN/NOTIFY bus for several instances) |

## Key rules (business must never be wrong)
1. **Tenant isolation**: every project/doc/revision/assignment/activity query is scoped by `workspace_id`, and every use case first resolves the caller's role in that workspace (`WorkspaceAccess`). Not a member → `404` (do not reveal existence).
2. **Roles**: owner > admin > estimator > viewer (matrix in `workspaces/domain/policies/permissions.ts`). A workspace always keeps ≥1 owner. A personal workspace has exactly one member and cannot invite.
3. **Docs**: one row per `(project_id, doc_key)`; `version` starts at 1 and increases by 1 on every write. A write carries `baseVersion` (0 = doc does not exist yet); a mismatch → `409` with the current doc. `data = null` means "back to default" (row kept so versions stay monotonic).
4. **Validation by the shared domain**: the doc key must exist (calculator id, BOQ line key, planning sheet, `meta`, `journey`); the assembled project must compute with finite totals; doc ≤ 256 KB. Rejected → `422`.
5. **Summary**: after each write the server recomputes `computeProject` and stores `{constructionTotal, preConstructionTotal, levelsDone, levelsTotal}` on the project row (project lists never need the client to compute).
6. **Revisions** are immutable snapshots (assembled project + totals).
7. **Auth**: argon2id password hashes; short-lived JWT access token (15 min) in memory on the client; refresh token (30 days) in an httpOnly cookie, stored hashed, rotated on every use; reuse of a rotated token revokes the whole family.
8. **Realtime** never trusts the client: joining a room checks membership; presence carries only the level id; events are published only after the database commit.

## Frontend integration
- Next rewrites `/api/*` → backend, so the refresh cookie is same-origin. Socket.IO connects to the backend URL with the access token.
- Guest mode (today's behaviour) unchanged. Signed in: `/projects` lists workspace projects (TanStack Query); opening one loads its docs into the Zustand store (`binding = cloud`); a **sync engine** diffs the project after each change (`projectToDocs`), debounces per doc key, sends `PUT` with `baseVersion`, and on `409` takes the server version and tells the user. Remote `doc.updated` events apply immediately when the doc has no pending local edit.
- Presence: avatars on the level map; a warning banner on a level another member is on; assignee shown per level.
- "Upload this browser's project to the cloud" when a guest signs in.

## Phases of this round
1. Contract + domain sync mapping + backend skeleton (coordinator).
2. Modules in parallel (one agent each): identity, workspaces, projects, realtime, frontend cloud.
3. Integration pass (coordinator): wire modules, build, lint, typecheck.
4. Tests: unit (domain + use cases, in-memory adapters), e2e (HTTP + socket with in-memory adapters), integration (Postgres, auto-skip), frontend sync-engine tests. Review per phase.
