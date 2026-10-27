# ConTrack Robot Framework suite (E2E UI, API, database)

Test plan and coverage map: [`docs/qa/TEST_PLAN.md`](../../docs/qa/TEST_PLAN.md).
Robot Framework reference used to write this suite: [`docs/ROBOT_STANDARDS.md`](docs/ROBOT_STANDARDS.md).

## Layout

```
tests/robot/
  requirements.txt        pinned Python packages (robotframework 7.5, Browser 20.6, Requests, pabot, robocop, psycopg)
  variables/env.py        BASE_URL, API_URL, DATABASE_URL, demo accounts (override with -v NAME:value or E2E_* env)
  libraries/
    ContrackLibrary.py    unique data, Thai numbers, engine expected values (tools/expected.ts), guest storage, SMS/OTP from the API log
    ContrackDb.py         parameterised read-only SQL checks + guarded reset of a *_e2e database
  resources/
    common.resource       browser/context lifecycle, guest project seeding, input-by-aria-label helpers, AntD helpers
    journey.resource      journey levels: go to, confirm, skip, totals vs engine
    api.resource          RequestsLibrary sessions per user, register/login, workspaces, projects
    db.resource           common row lookups
    pages/<area>.resource page-object keywords of one feature area (owned by that area's suites)
  suites/
    00_smoke.robot        everything answers; screen = engine
    api/                  HTTP API + database checks (no browser)
    ui/                   browser flows
  tools/expected.ts       the BOQ engine as a CLI: project JSON in, totals per level/section/planning out
  env/                    .env files of the E2E backend (port 4200, db contrack_e2e) and web app (port 3200)
```

## Environment (local only, separate from your dev servers)

| Piece | Where |
|---|---|
| Web app | http://localhost:3200 (`API_URL=http://localhost:4200 next dev -p 3200` in this checkout) |
| API | http://localhost:4200 (`node --env-file=tests/robot/env/backend.e2e.env backend/dist/backend/src/main.js > tests/robot/logs/e2e-api.log`) |
| Database | `postgres://contrack:contrack@localhost:5432/contrack_e2e` (docker `backend-postgres-1`) |
| Demo data | `node --env-file=tests/robot/env/backend.e2e.env backend/dist/backend/src/cli/seed-demo.js` (accounts in `backend/SEED.md`) |

One-time setup (Windows, from `tests/robot`):

```powershell
py -3.12 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\rfbrowser init chromium
```

Run (from `tests/robot`, with `PYTHONUTF8=1`):

```powershell
.venv\Scripts\robot -d results suites                       # everything
.venv\Scripts\robot -d results -i smoke suites              # smoke only
.venv\Scripts\pabot --processes 4 -d results suites         # parallel by suite
.venv\Scripts\robot -d results --dryrun suites              # syntax / keyword check, no browser
.venv\Scripts\robocop check .                               # lint
```

## Rules for every suite (read before writing a test)

1. **Independent tests.** Each UI test opens its own context (`Open Fresh Context`), so localStorage and cookies are
   fresh. Never rely on another test having run. API tests create their own users and workspaces
   (`Register User Via API`, `Create Company Workspace Via API`); unique names come from `Unique Name` / `Unique Email`.
2. **Never mutate shared seed data.** The demo accounts (`owner@contrack.test` …) may be *read* and signed in with,
   but do not change their roles, rename their workspace, archive or delete their projects. Create your own.
   Never call `Reset E2E Database` from a suite: it is for a full clean run only (scripts).
3. **Expected values come from the engine, not from copy-pasted numbers.** Use `Compute Expected` on the project
   the app saved (`Expected For Current Guest Project`) or on a project you built, then compare the screen.
   Hard-code a number only when it is a business rule you can name (e.g. the sample house = 1,855,162 baht,
   a lump sum of 7,500 baht) and say where it comes from in `[Documentation]`.
4. **Selectors, in this order:** aria-label (`Input By Label`), role + accessible name, visible Thai text, then a
   stable CSS class of Ant Design (`.ant-modal`, `.ant-select-dropdown`). No XPath by position, no generated class
   names, no `force=True`. If an element has no accessible name and you need it, report it (the coordinator adds a
   `data-testid` / aria-label in the app).
5. **No sleeps.** Browser auto-waits; use `Wait For Elements State`, `Wait For Condition`, assertion retries.
   `Sleep` is not allowed.
6. **Every test states its expectation**: assertion operators (`Get Text    sel    ==    x`), `expected_status=`
   on every HTTP call, a DB row read back after every write that matters.
7. **Tags:** `Test Tags` per file with the area (`journey`, `boq`, `planning`, `api`, `db`, `auth`, `team`,
   `subcontracting` …) plus `smoke` for the critical path, `edge` for edge cases, `negative` for invalid input or
   forbidden actions, `security` for permission/tenant checks, `slow` for anything over a minute.
8. **Naming:** test names are sentences that say the expected behaviour ("Viewer Cannot Edit A Level"), keywords
   are Title Case verbs ("Fill Footing Row"). 4-space separators, sections in the standard order.
9. **A failing test is a finding.** If the app is wrong, do not weaken the test: tag it `bug` and write in
   `[Documentation]` what you did, what you expected, what happened. The coordinator fixes the app.
10. **Files you own** are only the ones your brief names. Shared resources and libraries belong to the coordinator:
    put area keywords in `resources/pages/<area>.resource`; ask for a shared keyword in your report.
