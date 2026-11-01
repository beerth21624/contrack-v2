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

### Crews and people (module `workforce`)

When the API offers the `workforce` module (`MODULES_ENABLED=workforce`; `--in-process` switches it on), the same script
also fills the company's ทีมช่างและบุคลากร (`src/cli/seed-workforce.ts`); against a server without the module it prints
"workforce: skipped" and does the rest.
- **Rate cards** (created if missing): ชุด A งานทั่วไป 800/500, ชุด B หลังคา ไฟฟ้า ฝ้า สี 1,000/600,
  ทีมไฟฟ้า ช่างพงษ์ 1,200/650.
- **12 people**: site supervisor **คุณประเสริฐ ช่างแก้ว**, crew leaders (ช่างสมชาย, ช่างแดง, ช่างพงษ์, ช่างวิทย์, ช่างเอก,
  ช่างหมู) and a few named members, with roles, employment types, phones and daily wages (visible to owner/admin only).
- **6 crews**, headcounts taken from the showcase's Man-Day: ทีมโครงสร้างช่างสมชาย (ชุด A), ทีมหลังคาช่างหมู (ชุด B),
  ทีมก่อฉาบช่างแดง (ชุด A), ทีมไฟฟ้าช่างพงษ์ (its own card), ทีมประปาช่างวิทย์ (typed 2,500 บาท/วัน), ทีมทาสีช่างเอก (ชุด B).
- **Assignments** on the showcase's planned tasks, on its schedule days (structure 1.2–2.5, roof 3.1–3.3, masonry 4.1/5.1,
  electrical 4.2/5.2/8.1, plumbing 8.2/8.4, painting 6.5/7.2/8.6), and the supervisor on the project.
- **บ้านคุณสมศรี (เริ่มจากแบบ)** (created if missing) gets the structure crew earlier and **ทีมก่อฉาบช่างแดง** on brickwork
  from 2 days after today, while it is still plastering คุณวิชัย's house: 3 overlapping days, for W2's conflict detection.
- **Waiting windows (ช่วงรอ, W2)** on the showcase (`SHOWCASE_TASK_LAGS`): the job runs through the rainy season, so two
  waits differ from the defaults: **5.1 ฉาบปูน 21 days** "ช่วงฝนตก ปูนแห้งช้า" (default 14) and **1.5 ฐานราก 10 days**
  "ฝนตกระหว่างบ่ม" (default 7). Every other task keeps its default (nothing stored). บ้านคุณสมศรี gets none.

Re-running matches rate cards, people and crews by name and assignments by (project, task, crew): no duplicates; moved
plan days are updated in place. The waits are matched by task: the seed's two tasks are set back to the seed's values,
any other override someone added to the showcase is kept, and nothing is written when they already match (PUT
`/task-lags` replaces the whole list, so the seed reads it first and sends the merged list).

### ERP sample data (modules `project-hub` …)

When `MODULES_ENABLED` lists the ERP modules (`project-hub,portal,boq-control,quotations,contracts,billing,variations,procurement,site-diary,labour,job-cost,payables,handover`;
`--in-process` honours `MODULES_ENABLED` from the environment, default `workforce` = no ERP data), the same script also runs `src/cli/seed-erp.ts`.
Without `project-hub` it prints "erp: skipped" and the rest of the showcase is exactly as before. The ERP step switches the modules on for the
company with the 30-day trials (`POST /workspaces/:id/modules/:module/trial`, no platform admin needed; falls back to the plain switch when the
server runs with `ENTITLEMENTS=open`) and then goes through the HTTP API as the owner:
- **Company profile** (บริษัท ตัวอย่างก่อสร้าง จำกัด: tax id, head-office branch, address, VAT 7 %, bank account, PromptPay, BE document years).
- **3 customers**: คุณมานะ ตั้งใจ (individual), บริษัท รุ่งเรืองพัฒนา จำกัด (juristic), เทศบาลตำบลศาลายา (government). Matched by Thai name.
- **Project "บ้านพักอาศัย ERP ตัวอย่าง – คุณมานะ ตั้งใจ"** (the Excel v5 sample house, its own project so the showcase house stays editable):
  hub fields + project code → quotation issued and accepted (this locks the baseline and the cost codes) → main contract (progress billing, advance 10 %,
  retention 5 %, 12 months warranty) signed → advance invoice paid → claim 1 (30 %, certified, invoiced, **paid**) and claim 2 (55 %, invoiced, **open**) →
  one accepted variation order (sliding door) → 2 suppliers, a site purchase request, an RFQ with 2 quotes, the award, a PO issued and a goods receipt →
  5 submitted daily reports with weather, manpower, progress and an issue → timesheets of the same days, a wage advance and a paid pay period →
  a supplier bill from the PO and a service bill with 3 % withholding, approved and paid in one payment run (voucher + 50 ทวิ).
- Not seeded: handover and closeout (accepting the handover moves the project to the warranty phase and completes the contract, which would end the
  live demo of claims and costs) — do those on the screen in front of the customer.
- Idempotent at project level: once the ERP project exists the step prints "erp: already seeded" and creates nothing. A run that failed half-way
  leaves a partial project (the showcase itself is complete; the failure is printed as a warning): delete that project in the app (or archive it)
  and run again. A project with posted money events cannot be deleted (409 `financial_events_exist`), so archive it (the seed only looks at active projects).
- The server clock decides the document dates; the script plans relative to `--today`, so use it on a server whose clock agrees (the default).
