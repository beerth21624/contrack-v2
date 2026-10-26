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

## Showcase project (for customer demos)

`npm run db:seed:showcase` (after `npm run db:seed`) adds one complete, realistic job to "บริษัท ตัวอย่างก่อสร้าง จำกัด":
**บ้านพักอาศัย 1 ชั้น คุณวิชัย รุ่งเรืองศรี – หมู่บ้านร่มรื่นวิลล์ ศาลายา** (`src/domain/showcase/showcase-project.ts`).
- Every journey step passed (demolition marked "ไม่มีในโครงการนี้": empty plot), land inspection answered (one finding:
  low ground and poor drainage), the Excel v5 take-off with this job's header, fill, piles and site camp.
- Plan relative to the day you run it: started 105 days ago, actuals on the finished tasks, plastering 50 % done,
  about 57 % spent, "ช้ากว่าแผน 5 วัน", the roof frame 6.5 % over budget; installments placed on the cash flow.
- Rev 00 (first quotation) and Rev 01 (contract), steps assigned to the estimator and the admin, documents saved
  by owner / estimator / admin (activity).

It signs in as the demo accounts and goes through the running API (default `http://localhost:4000`; `-- --api <url>`,
or `-- --in-process` to start the API in the script on `DATABASE_URL`). It only touches the showcase project: run it again
and the project is updated in place (no duplicate; existing revisions kept). `-- --recreate` deletes that one project
and builds it again with fresh revisions and activity; `-- --today YYYY-MM-DD` plans relative to another day.
