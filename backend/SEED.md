# Demo data (local testing only)

`npm run db:seed` creates these accounts and projects through the real API (`scripts/seed-demo.ts`).
`npm run db:seed -- --reset` wipes every table and seeds again.

**Password for every demo account: `ContrackDemo#2026`** (local test data — never use these accounts on a server
other people can reach).

| E-mail | Role | What you can try |
|---|---|---|
| owner@contrack.test | owner of "บริษัท ตัวอย่างก่อสร้าง จำกัด" (+ own personal workspace) | everything: members, roles, invitations, revisions, assigning levels |
| admin@contrack.test | admin | manage members (not the owner), assign levels, all projects |
| estimator@contrack.test | estimator | fill levels, create projects, issue revisions; assigned the electrical levels |
| viewer@contrack.test | viewer | read-only: sees projects and BOQ, edits are blocked |
| solo@contrack.test | personal workspace only | a contractor working alone |

Projects in the company workspace:
- **บ้านตัวอย่าง Excel v5 (ทีม)** — the Excel v5 sample house, 9 levels marked (demolition skipped), revision "Rev 00",
  electrical levels assigned to the estimator, roofing levels to the admin.
- **บ้านคุณสมศรี (เริ่มจากแบบ)** — a project started from a plan: header filled, fill level 16 × 20 × 0.5 m.
- **โครงการเก่า ปี 2568 (เก็บถาวร)** — archived (tab "เก็บถาวร").

Try live collaboration: sign in as owner in one browser and estimator in another (or a private window), open the
same project, go to the same level.
