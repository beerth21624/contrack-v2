# HTTP API (all JSON; schemas in `../src/shared/contract`)

Every route needs `Authorization: Bearer <accessToken>` unless marked **public**. Errors are `ErrorResponse`
`{ code, message, details? }` with the status from `STATUS_OF` (`src/shared/presentation/http.ts`).

## identity
| Method | Path | Body → Response | Notes |
|---|---|---|---|
| POST | `/auth/register` **public** | `RegisterRequest` → `AuthResponse` (201) | creates the user + personal workspace (owner); sets refresh cookie. `email_taken` 409 |
| POST | `/auth/login` **public** | `LoginRequest` → `AuthResponse` | `invalid_credentials` 401 (same answer for unknown e-mail and wrong password) |
| POST | `/auth/refresh` **public** | cookie `contrack_rt` → `AuthResponse` | rotates the refresh token; a token rotated ≤ 30 s ago (another tab refreshing at the same moment) gets a sibling token in the same family; reuse of a rotated token after that revokes the family → `invalid_token` 401 (the cookie is cleared) |
| POST | `/auth/logout` **public** | cookie → 204 | revokes the token family, clears the cookie |
| GET | `/me` | → `MeResponse` | user + workspaces with roles |

Refresh cookie: `contrack_rt`, httpOnly, SameSite=Lax, Secure when `COOKIE_SECURE`, Path=`REFRESH_COOKIE_PATH` (default `/api/auth`,
the path the browser sees through the Next rewrite `/api/*` → backend; `/auth` when the browser calls the API directly),
Max-Age = refresh TTL.

## workspaces
| Method | Path | Body → Response | Permission |
|---|---|---|---|
| GET | `/workspaces` | → `WorkspaceDto[]` | member |
| POST | `/workspaces` | `CreateWorkspaceRequest` → `WorkspaceDto` (201) | any user (becomes owner of a company workspace) |
| GET | `/workspaces/:workspaceId` | → `WorkspaceDto` | `workspace.read` |
| PATCH | `/workspaces/:workspaceId` | `RenameWorkspaceRequest` → `WorkspaceDto` | `workspace.rename` |
| DELETE | `/workspaces/:workspaceId` | → 204 | `workspace.delete` (company only; `personal_workspace` 409); issued ERP documents (other than project codes) → 409 `{ reason: 'document_issued_exists', blockers }` |
| GET | `/workspaces/:workspaceId/members` | → `MemberDto[]` | `members.read` |
| PATCH | `/workspaces/:workspaceId/members/:userId` | `ChangeRoleRequest` → `MemberDto` | `members.changeRole`; only an owner gives/takes `owner`; admin cannot touch owners; never leave 0 owners (`last_owner`) |
| DELETE | `/workspaces/:workspaceId/members/:userId` | → 204 | `members.remove` (or yourself = leave); not the last owner; not in a personal workspace |
| GET | `/workspaces/:workspaceId/invitations` | → `InvitationDto[]` (pending only) | `members.invite` |
| POST | `/workspaces/:workspaceId/invitations` | `CreateInvitationRequest` → `CreateInvitationResponse` (201) | `members.invite`; company only; admin may invite admin/estimator/viewer and the ERP roles pm/purchasing/accounting/foreman (rank 1; the web offers them only while `project-hub` is active) |
| DELETE | `/workspaces/:workspaceId/invitations/:invitationId` | → 204 | `members.invite` |
| POST | `/invitations/accept` | `AcceptInvitationRequest` → `AcceptInvitationResponse` | signed-in user whose e-mail equals the invitation's; single use; not expired/revoked (`invitation_invalid` 410); already a member → keeps the stronger role |

## projects
| Method | Path | Body → Response | Permission |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/projects?archived=true\|false` | → `ProjectDto[]` (default: not archived, newest update first) | `projects.read` |
| POST | `/workspaces/:workspaceId/projects` | `CreateProjectRequest` → `ProjectDetailDto` (201) | `projects.create`; optional `docs` = upload of a guest project (all validated) |
| GET | `/projects/:projectId` | → `ProjectDetailDto` | `projects.read` |
| PATCH | `/projects/:projectId` | `UpdateProjectRequest` → `ProjectDto` | rename `projects.edit`; archive/restore `projects.archive`; renaming an archived project → 409 `conflict` unless the same request restores it (`archived: false`); an unchanged value is a no-op (no activity, no event) |
| DELETE | `/projects/:projectId` | → 204 | `projects.delete`; viewers receive `project.deleted`; issued ERP documents of the project (other than its code) → 409 `{ reason: 'document_issued_exists', blockers }` |
| PUT | `/projects/:projectId/docs/:docKey` | `PutDocRequest` → `PutDocResponse` | `projects.edit`; `version_conflict` 409 with `VersionConflictDetails`; a bad `docKey` (fails `docKeySchema` or names no calculator / BOQ line / sheet), invalid or oversize data (> `MAX_DOC_BYTES`), or a project that stops computing → 422 `unprocessable`; archived → 409 `conflict` |
| GET | `/projects/:projectId/revisions` | → `RevisionDto[]` (newest first) | `projects.read` |
| POST | `/projects/:projectId/revisions` | `CreateRevisionRequest` → `RevisionDto` (201) | `revisions.create`; label unique per project (`conflict`) |
| GET | `/projects/:projectId/revisions/:revisionId` | → `RevisionDetailDto` | `projects.read` |
| GET | `/projects/:projectId/assignments` | → `LevelAssignmentDto[]` | `projects.read` |
| PUT | `/projects/:projectId/assignments/:levelId` | `PutAssignmentRequest` → `LevelAssignmentDto \| null` | `levels.assign`; a level id not in the journey → 422 `unprocessable`; an assignee who is not a member of the workspace → 422 `unprocessable`; `userId: null` removes it (answers JSON `null`) |
| GET | `/projects/:projectId/activity?before=<id>&limit=50` | → `ActivityDto[]` (newest first) | `projects.read` |

## rate cards (workspace library of daily wage sets, คลังอัตราค่าแรงของบริษัท)
Schemas: `../src/shared/contract/rate-cards.ts`. A card is `{ name, skilledRate, labourerRate, note }`; rates are **whole
baht per day** (integers 0–100,000), name trimmed 1–60 characters, note trimmed ≤ 500 (blank → `null`). Names are unique
per workspace among active cards, ignoring case; an archived card frees its name. A workspace keeps at most
`MAX_ACTIVE_RATE_CARDS` (50) active cards. Projects copy the rates of the card they pick, so editing or archiving a card
never changes a project. No realtime event: clients refetch after their own writes.

| Method | Path | Body → Response | Permission |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/rate-cards` | → `RateCardDto[]` (active only, oldest first) | `rateCards.read` (every role) |
| POST | `/workspaces/:workspaceId/rate-cards` | `CreateRateCardRequest` → `RateCardDto` (201) | `rateCards.create` (owner, admin, estimator, pm); name taken or 50 active cards → 409 `conflict` with `RateCardConflictDetails` (`{ reason: 'name_taken', name }` / `{ reason: 'limit_reached', limit }`) |
| PATCH | `/workspaces/:workspaceId/rate-cards/:rateCardId` | `UpdateRateCardRequest` → `RateCardDto` | `rateCards.edit` (owner, admin); any subset of the fields, at least one (`note: null` clears it); an unchanged value is a no-op; an archived card → 404; name taken → 409 `conflict` (`name_taken`) |
| DELETE | `/workspaces/:workspaceId/rate-cards/:rateCardId` | → 204 | `rateCards.archive` (owner, admin); soft delete (`archived_at`); archiving an archived card again → 204 |

## platform (business modules that can be switched on and off)
Schemas: `../src/shared/contract/modules.ts`. Env `MODULES_ENABLED` = comma-separated module ids (`MODULE_IDS`);
empty (the default) = ConTrack is plain BOQ estimation. An unknown id refuses the start. A module that is off answers
**404 `module_disabled`** on every one of its routes, signed in or not (`ModuleGuard`, a global guard that runs before
authentication; controllers are marked `@RequiresModule('<id>')`, `src/shared/presentation/modules.ts`). Its tables and
data are kept, and deleting a project still removes its rows.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/platform/modules` **public** | → `PlatformModulesDto` `{ modules }` | what this server offers (MODULE_IDS order) |
| GET | `/workspaces/:workspaceId/modules` | → `WorkspaceModuleDto[]` (MODULE_IDS order) | every member; `available` (env), `enabled` (switch), `entitlement`, `active` (all four layers), `missingDependencies`, `trialAvailable` |
| PUT | `/workspaces/:workspaceId/modules/:module` | `PutWorkspaceModuleRequest` `{ enabled, confirm? }` → `WorkspaceModuleDto` | `modules.manage`; not offered → 422; on: not entitled → 422 `{ reason: 'not_entitled' }`, a dependency not active → 422 `{ reason: 'missing_dependencies', missing }`; off while switched-on modules depend on it or it has running work (`ModuleWorkRegistry`) and no `confirm` → 409 `ModuleOffBlockers` `{ reason: 'has_dependents', dependents, work, activeSubcontracts? }`; with `confirm` the dependents are switched off too |
| POST | `/workspaces/:workspaceId/modules/:module/trial` | → `StartTrialResponse` `{ module, started, modules }` (200) | `modules.manage`; once per module per workspace: `trial` entitlement for `trialDays` (30), switches it (and its dependencies) on, and starts the trial of each dependency the workspace is not entitled to; not offered / no trial (`reason: 'no_trial'`) / a dependency that cannot be used (`missing_dependencies`) → 422; `trial_used` / `already_entitled` / `entitlement_revoked` → 409 |
| GET | `/platform/admin/status` | → `{ admin }` (200 for every signed-in user) | `admin` = the user's e-mail (case-insensitive) is in `PLATFORM_ADMIN_EMAILS` |
| GET | `/platform/admin/workspaces?q=&limit=` | → `AdminWorkspaceDto[]` (newest first; `q` = part of the name or the exact id; `limit` 1–100, default 25) with the stored grant of every module that needs an entitlement | platform admin only; others and an empty `PLATFORM_ADMIN_EMAILS` → 404 `not_found` |
| PUT | `/platform/admin/workspaces/:workspaceId/entitlements/:module` | `{ status: purchased\|trial\|beta\|revoked, expiresAt?: iso\|null, note? }` → `AdminEntitlementDto` | platform admin only (else 404); `trial` needs `expiresAt` (400); a module without entitlement → 422 `no_entitlement_needed`; unknown workspace → 404; the workspace's module cache is invalidated at once; an admin trial counts as the workspace's trial (`trialUsedAt`) |

**Four layers** (`docs/erp/01-architecture.md` §4.3): `active` = offered (`MODULES_ENABLED`) and entitled (legacy
modules always; else `ENTITLEMENTS=open`, or an unexpired purchased / trial / beta row in `workspace_entitlements`) and
switched on (`workspace_modules`) and every dependency (`src/shared/contract/module-registry.ts`) active. Env
`ENTITLEMENTS` = `enforce` | `open` (default enforce in production, open elsewhere); `PLATFORM_ADMIN_EMAILS` (WP-07).
ERP use cases authorize through `ModuleAccess` (`src/shared/application/module-access.ts`): not_found → module_disabled → forbidden.

## approvals and audit (ERP foundation, gated by `project-hub`; WP-08)
Schemas: `../src/shared/contract/erp/approvals.ts`, `erp/audit.ts`. Requests are created only inside other modules
(`Approvals.request` port, `docs/erp/01-architecture.md` §6): a solo workspace is approved at once (`auto`, `autoReason`).
Every route: not a member → 404 `not_found`; `project-hub` not active → 404 `module_disabled`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/approvals?status=&mine=&limit=&before=` | → `ApprovalListDto` `{ items, nextBefore }` (newest first) | every member; `mine=true` = pending requests the caller may decide (`canDecide`); otherwise all (`audit.read`) or the caller's own / the ones their role may decide; `before` = `nextBefore` of the previous page |
| POST | `/approvals/:requestId/decide` | `{ decision: approved\|rejected, note? }` → `ApprovalRequestDto` (200) | the caller's role must be an approver of the request and not its requester (unless the policy's `selfApprove`) → else 403; not pending → 409 `{ reason: 'invalid_transition' }`; the owning module's handler runs in the same transaction (its error rolls the decision back and is returned) |
| GET | `/workspaces/:workspaceId/approval-policies` | → `ApprovalPolicyDto[]` (APPROVAL_SUBJECTS order; `isDefault` = no saved row) | `company.read` |
| PUT | `/workspaces/:workspaceId/approval-policies/:subject` | `PutApprovalPolicyRequest` `{ enabled, minAmount, approverRoles, selfApprove }` → `ApprovalPolicyDto` | `company.manage`; unknown subject → 404; `owner` is always added to `approverRoles`; new requests only |
| GET | `/workspaces/:workspaceId/audit?entityType=&entityId=&limit=&before=` | → `AuditListDto` `{ items, nextBefore }` (newest first, `before` = event id) | `audit.read`; append-only trail (approvals, approval policies, entitlements, …) |

## document numbering (ERP foundation, gated by `project-hub`; WP-11)
Schemas: `../src/shared/contract/erp/numbering.ts`. Numbers are issued only inside other modules (`DocumentNumbering.issue`
port, `docs/erp/01-architecture.md` §8). Every route: not a member → 404 `not_found`; `project-hub` not active → 404 `module_disabled`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/numbering` | → `NumberingSeriesDto[]` (DOC_TYPES order) | `company.read`; `nextNumber` = preview for today (reserves nothing), `issuedInPeriod` > 0 = locked |
| PUT | `/workspaces/:workspaceId/numbering/:docType` | `PutNumberingSeriesRequest` `{ prefix, pattern, reset, yearStyle }` → `NumberingSeriesDto` | `company.manage`; unknown docType → 404; bad pattern → 422 `{ reason: 'invalid_pattern', problems }`; any change while today's period has numbers → 409 `{ reason: 'period_has_documents' }` |

## workforce: crews and people (ทีมช่างและบุคลากร), business module `workforce` (W1)
Schemas: `../src/shared/contract/workforce.ts`; design: `../docs/workforce/00-crew-management-design.md`. Every route below
answers 404 `module_disabled` while `workforce` is not in `MODULES_ENABLED`. Not a member of the workspace (or of the
project's workspace) → 404 on every route; ids of another workspace (or malformed ids) → 404. No realtime event: clients
refetch after their own writes.

**Permissions** (`src/shared/contract/permissions.ts`, re-exported by `src/shared/domain/permissions.ts`): `workforce.read`
every role; `workforce.manage` (people and crews: create, edit, archive) owner, admin and pm; `workforce.assign` (crew
assignments and site supervisors) owner, admin, estimator, pm and foreman. **Wages** are hidden in the response mapper by
role: a person's `dailyWage` only for owner/admin/accounting (`workforce.seeWages`); a crew's `dailyCost` and
`dailyCostOverride` for owner/admin/estimator/pm/accounting (`workforce.seeCrewCost`).
Hidden values are `null` with `wagesHidden: true`.

**Rules.** People and crews are archived (soft delete, `archived_at`) and leave the lists; lists show active ones, oldest
first. Crew names are unique among the workspace's active crews, ignoring case (an archived crew frees its name); people may
share a name. Limits: `MAX_ACTIVE_PEOPLE` (500) and `MAX_ACTIVE_CREWS` (100) active per workspace, `MAX_CREW_HEADCOUNT`
(200) per count and named members. Writes of one workspace are serialised by a transaction-scoped advisory lock, so limits,
names and the in-use check cannot be raced. A crew's `dailyCost` = `dailyCostOverride` if set, else
`skilledCount × card.skilledRate + labourerCount × card.labourerRate` from its rate card, else `null` (a card archived
after it was picked still prices the crew). Days are `'YYYY-MM-DD'` calendar days (real dates; `2026-02-30` → 400);
"today" is the Bangkok day (UTC+7).

**Body references** (`leaderId`, `memberIds`, `rateCardId`, an assignment's `crewId`, supervisors' `personIds`) must be
active and of the same workspace, else **422 `unprocessable`** with details `{ field, ids }` (the stale ids). On a crew
PATCH only changed references are checked (a crew keeps a rate card archived after it was picked). An assignment's
`projectId` of another workspace or unknown → **404**; an archived project → **409 `conflict`** (no details) on every
assignment write and on PUT supervisors.

**409 details** (`WorkforceConflictDetails`): `{ reason: 'name_taken', name }`, `{ reason: 'limit_reached', limit }`,
`{ reason: 'in_use', assignments }`.

| Method | Path | Body → Response | Permission / notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/people` | → `PersonDto[]` (active, oldest first) | `workforce.read` |
| POST | `/workspaces/:workspaceId/people` | `CreatePersonRequest` → `PersonDto` (201) | `workforce.manage`; 500 active → 409 `limit_reached` |
| PATCH | `/workspaces/:workspaceId/people/:personId` | `UpdatePersonRequest` → `PersonDto` | `workforce.manage`; any subset, at least one (null clears an optional field); unchanged → no-op; archived → 404 |
| DELETE | `/workspaces/:workspaceId/people/:personId` | → 204 | `workforce.manage`; archive. Refused with 409 `in_use` while a crew the person **leads or belongs to** has an assignment ending today or later. Otherwise the person is **taken out of every crew (leader → null, removed from members) and off every project's supervisors**, then archived. Again → 204 |
| GET | `/workspaces/:workspaceId/crews` | → `CrewDto[]` (active, oldest first) | `workforce.read` |
| POST | `/workspaces/:workspaceId/crews` | `CreateCrewRequest` → `CrewDto` (201) | `workforce.manage`; name taken → 409 `name_taken`; 100 active → 409 `limit_reached`; members deduplicated, order kept |
| PATCH | `/workspaces/:workspaceId/crews/:crewId` | `UpdateCrewRequest` → `CrewDto` | `workforce.manage`; any subset (`memberIds` replaces the list); archived → 404 |
| DELETE | `/workspaces/:workspaceId/crews/:crewId` | → 204 | `workforce.manage`; archive. Refused with 409 `in_use` while the crew has an assignment ending today or later (past ones stay as history). Again → 204 |
| GET | `/workspaces/:workspaceId/crew-assignments?projectId&crewId&from&to` | → `CrewAssignmentDto[]` (by start, end, creation) | `workforce.read`; every filter optional; `from`/`to` keep the assignments whose days **overlap** `[from, to]` (`end ≥ from` and `start ≤ to`); `from > to` → 400; a project / crew of another workspace matches nothing |
| POST | `/workspaces/:workspaceId/crew-assignments` | `CreateCrewAssignmentRequest` → `CrewAssignmentDto` (201) | `workforce.assign`; the project must be of this workspace (404) and not archived (409); the crew active (422); `taskId` is a plan task id (`"1.1"` … `"8.6"`, format checked only); `start ≤ end`. **Overlapping assignments of one crew are allowed** (the UI warns) |
| PATCH | `/workspaces/:workspaceId/crew-assignments/:assignmentId` | `UpdateCrewAssignmentRequest` → `CrewAssignmentDto` | `workforce.assign`; days, crew, note (the project and task stay); the merged range keeps `start ≤ end` (400); the crew it ends up with must be active (422: an assignment of an archived crew can only move to another crew) |
| DELETE | `/workspaces/:workspaceId/crew-assignments/:assignmentId` | → 204 | `workforce.assign`; hard delete |
| GET | `/projects/:projectId/supervisors` | → `ProjectSupervisorsDto` `{ projectId, personIds }` | `workforce.read` in the project's workspace (also for an archived project) |
| PUT | `/projects/:projectId/supervisors` | `PutProjectSupervisorsRequest` `{ personIds }` (≤ 20) → `ProjectSupervisorsDto` | `workforce.assign`; replaces the list (order kept, duplicates dropped, `[]` clears) |
| GET | `/projects/:projectId/task-lags` | → `ProjectTaskLagsDto` `{ projectId, lags }` | `workforce.read` (every role) in the project's workspace, also for an archived project; `lags` in numeric task order (`"1.9"` before `"1.10"`); `[]` for a project that kept every default |
| PUT | `/projects/:projectId/task-lags` | `PutProjectTaskLagsRequest` `{ lags }` (≤ 64) → `ProjectTaskLagsDto` | `workforce.assign` (owner/admin/estimator/pm/foreman); **replaces all** of the project's overrides (tasks left out are deleted, `[]` clears them); archived project → 409 `conflict` |
| GET | `/workspaces/:workspaceId/task-lags` | → `WorkspaceTaskLagsDto` `[{ projectId, lags }]` | `workforce.read`; every **non-archived** project of the workspace **that has at least one override** (a project without one is left out: its waits are all the defaults), by project id, each in task order. For the crew board |

### Waiting windows after planned tasks (ช่วงรอ, W2)
Concrete curing, plaster drying before paint, …: the days the work waits after a planned task before the next step.
Schemas: `taskLagSchema`, `projectTaskLagsDtoSchema`, `putProjectTaskLagsRequestSchema`, `workspaceTaskLagsDtoSchema`
in `../src/shared/contract/workforce.ts`. **The server stores only a project's overrides and never applies the defaults**
(`../src/domain/workforce/task-lags.ts`, e.g. 1.5 ฐานราก 7 days, 5.1 ฉาบปูน 14 days): the client computes the effective
wait (the override, else the default, else 0). Waits never move the S-Curve dates.
- A lag is `{ taskId, days, note? }`: `taskId` a plan task id (`/^[1-9]\.[1-9]\d?$/`, format checked only), `days` a whole
  number `0 … MAX_TASK_LAG_DAYS` (90; `0` = no wait, a valid override of a non-zero default), `note` ≤ 200 characters,
  trimmed, blank → `null` (responses always carry `note`, `null` when there is none).
- PUT validation → **400 `validation_failed`**: days out of range or not an integer, a bad task id, a note over 200, more
  than 64 lags, or **the same `taskId` twice** (the contract's refine; the use case checks it again).
- PUT is serialised per workspace by the workforce advisory lock, so two concurrent PUTs never merge: the result is one of
  them. A changed or new row is stamped `updated_by` / `updated_at`; an unchanged row keeps its stamp.
- Not a member, a project of another workspace, an unknown or malformed id → 404 `not_found`.
- Table `project_task_lags` (migration `0003_task_lags`): `(project_id, workspace_id)` composite FK to `projects`
  `ON DELETE CASCADE`, primary key `(project_id, task_id)`, `days` check `between 0 and 90`, task-id and note-length checks,
  `updated_by` (a user id, no FK, like `project_docs.updated_by`), `updated_at`; index `(workspace_id, project_id)`.

Deleting a project deletes its crew assignments, supervisors and task waits (FK `ON DELETE CASCADE` on
`(project_id, workspace_id)`, and explicitly through `ProjectDependents` in the same transaction). Tables: `people`, `crews`,
`crew_members`, `crew_assignments`, `project_supervisors` (migration `0002_workforce`), `project_task_lags` (migration
`0003_task_lags`); every child row names `(…_id, workspace_id)` together, so it can only reference rows of its own workspace.

Not a member of the workspace → 404 on every route; a card of another workspace (or a malformed id) → 404.

## realtime (Socket.IO namespace `/realtime`, `io(url + '/realtime', { auth: { token } })`)
Events and payloads: `../src/shared/contract/realtime.ts`. A bad/missing token → the server disconnects.
`project.join` checks `projects.read`; after joining the client receives `presence.state`, then live
`doc.updated` / `project.updated` / `project.deleted` / `assignment.updated` / `presence.state` for that project.
`project.deleted` `{ projectId }` is sent after the delete committed: clients leave the project and drop queued edits.

## ai-assist (module `ai-assist`: `../src/shared/contract/ai-assist.ts`)
Typed decisions from a decision model (Jev by TypeSafe AI; env `JEV_API_KEY`, `JEV_MODEL`, `JEV_BASE_URL`). The model never
computes BOQ numbers; every answer is a proposal the user confirms. Nothing is written. Both routes need the caller to be a
member of the workspace (any role) and the module on for the platform **and** the workspace, else 404 `module_disabled`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/ai/boq-review` | `BoqReviewRequest` → `BoqReviewResponse` (200) | two questions per row (`<key>_flag` noul, `<key>_kind` choice); rows are sent in chunks of 25 (50 questions, the model's per-call cap), ≤ 3 calls in flight; only rows with probability ≥ `AI_REVIEW_MIN` come back, most probable first; a row flagged with kind `none` gets the most probable real kind; `usage` is summed over the calls |
| POST | `/workspaces/:workspaceId/ai/match-items` | `MatchItemsRequest` → `MatchItemsResponse` (200) | one call, one choice per input; criteria keys are the trimmed catalogue texts (blanks / duplicates dropped), `item` is the original catalogue text; `none` or an unknown option → `item: null` |

Model errors: `ai_unavailable` 503 (no `JEV_API_KEY`, key rejected, unreachable / timeout after one retry, or an answer that
fails validation), `ai_quota` 402 (no credits), `rate_limited` 429, `unprocessable` 422 (request rejected or too large for the model).
`NODE_ENV=test` wires a scripted `FakeDecisionAdapter` (`src/modules/ai-assist/testing`), reachable in e2e through `app.get(DecisionPort)`.

## company profile (ERP foundation, gated by `project-hub`; WP-12)
Schemas: `../src/shared/contract/erp/company.ts`. Port `CompanyProfiles` (`get`, `snapshot(ws, language)`) for other modules.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/company` | → `CompanyProfileDto` (`isDefault` = nothing saved; Thai legal name = workspace name then; images as `FileDto` with signed links) | `company.read` |
| PUT | `/workspaces/:workspaceId/company` | `PutCompanyProfileRequest` (the whole profile) → `CompanyProfileDto` | `company.manage`; tax id with a wrong check digit → 400 `validation_failed` (`reason: 'invalid_tax_id'`); newly attached images must be uploaded by the caller (purposes `company_logo` / `company_stamp` / `company_signature`); audited `company_profile` / `set` |

## customers (ERP foundation, gated by `project-hub`; WP-13)
Schemas: `../src/shared/contract/erp/customers.ts`. Port `CustomerLookup` (`find`, `findMany`, `snapshot(ws, id, language)`) for other modules.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/customers?q=&kind=&archived=&limit=` | → `CustomerDto[]` | `customers.read`; `q` matches names, tax id, contact, phone, email, LINE id; active customers unless `archived=true`; sorted by name |
| POST | `/workspaces/:workspaceId/customers` | `CreateCustomerRequest` → `CustomerDto` | `customers.manage`; neither `nameTh` nor `nameEn` → 400; same tax id + branch as an active customer → 409 `duplicate_customer` |
| GET | `/customers/:customerId` | → `CustomerDto` | `customers.read`; a customer of a workspace the caller is not in → 404 |
| PATCH | `/customers/:customerId` | `PatchCustomerRequest` → `CustomerDto` | `customers.manage`; archived → 409 `customer_archived` |
| POST | `/customers/:customerId/archive` · `/restore` | → `CustomerDto` | `customers.manage`; idempotent; restore onto a taken tax id + branch → 409 `duplicate_customer`; audited `customer` / `create\|update\|archive\|restore` |

## customer-links (ERP foundation; WP-14)
Schemas: `../src/shared/contract/erp/customer-links.ts`. Registry `CustomerLinkHandlers` (core): the owner module of a subject registers `{permission, view, respond?}` in `onModuleInit`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/customer-links` | `CreateCustomerLinkRequest` → `CreateCustomerLinkResponse` (`{url, token, link}`) | gated by `project-hub`; permission = the subject handler's; no handler / subject not in the workspace → 404; `expiresInDays` 1–365 (default 30); the raw token is returned only here |
| GET | `/workspaces/:workspaceId/customer-links?subjectType=&subjectId=` | → `CustomerLinkDto[]` | newest first; handler permission |
| POST | `/customer-links/:linkId/revoke` | → `CustomerLinkDto` | idempotent; handler permission; audited `customer_link` / `share\|revoke\|respond` |
| GET | `/public/links/:token` | → `CustomerLinkViewDto` | **no auth**; wrong / expired / revoked token, `project-hub` not active, no handler or subject gone → the same 404; counts the view; 30 requests / 10 min per token + IP → 429 |
| POST | `/public/links/:token/respond` | `RespondRequest` `{action, name, note}` → `CustomerLinkViewDto` | **no auth**; view-only subject → 422 `respond_not_supported`; action the subject does not take → 422 `action_not_supported`; answered already → 409 `already_responded`; document no longer answerable → 409 `invalid_transition`; stores name, note, IP, user agent, time |

## project hub (module `project-hub`; WP-15)
Schemas: `../src/shared/contract/erp/hub.ts`. The hub columns live on `projects` but only the hub module reads/writes them; `ProjectDto` and the `/projects` routes are unchanged. Registry `HubRollups` (core): a module registers `(workspaceId, projectIds) => Map<projectId, Partial<ProjectRollup>>`; only sources of active modules are called. Port `ProjectLifecycle.advance(ws, projectId, to, by)` moves a status forward only.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/hub/projects?status=a,b&q=&customerId=&type=&archived=` | → `HubProjectDto[]` | `projects.read`; batch (constant number of queries); `type` matches the effective type (project's or company default); `q` matches name, code, customer, site address |
| GET | `/workspaces/:workspaceId/hub/summary` | → `HubSummaryDto` | `projects.read`; active projects; money totals null while no module supplies them |
| GET | `/projects/:projectId/hub` | → `HubProjectDetailDto` | `projects.read`; + effective type/settings, manager name, `canEdit`, `nextStatuses` |
| PATCH | `/projects/:projectId/hub` | `UpdateHubProjectRequest` → `HubProjectDetailDto` | `projects.edit`; archived → 409 `project_archived`; customer of another workspace → 404; manager not a member → 400; off-table status → 409 `invalid_transition`; `closed → warranty` owner only (403); code in use → 409 `duplicate_project_code`; `settings` merged, `settingsReset` removes keys; audited `project` / `status_change\|hub_update` |
| POST | `/projects/:projectId/hub/code` | → `HubProjectDetailDto` | `projects.edit`; next `project` number (DocumentNumbering, dated today in Bangkok); has a code → 409 `project_code_exists` |

## BOQ history (module `boq-control`; WP-17)
Schemas: `../src/shared/contract/erp/boq-control.ts`. One `boq_versions` row (+ `boq_version_sections`, `boq_version_lines`) per project revision: made in the revision's transaction by a `RevisionHooks` hook while `boq-control` is active, and lazily (oldest first) for revisions without one when versions are read. Lines = BOQ item rows with qty ≠ 0 or total ≠ 0, amounts rounded per line (D-05). Ports from projects: `RevisionWriter.create(ws, projectId, {label, note, by})` (no permission check, joins the caller's `uow.run`), `RevisionLookup`. Every route: `projects.read`; not a member → 404 `not_found`; `boq-control` not active → 404 `module_disabled`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/boq-versions` | → `BoqVersionDto[]` | newest first; backfills missing versions first |
| GET | `/boq-versions/:versionId` | → `BoqVersionDetailDto` | sections (section order) + lines (BOQ order) |
| GET | `/projects/:projectId/boq-versions/compare?from=&to=` | → `BoqVersionCompareDto` | `to` = a version id of the same project or `live` (current documents, not stored; `to: null` in the answer); lines `added\|removed\|changed\|same` + Δqty/Δtotal, per-section and total deltas; version of another project → 404 |

## Baseline + cost codes (module `boq-control`; WP-18)
Schemas: `../src/shared/contract/erp/boq-control.ts`. Locking freezes one BOQ version (`boq_versions.kind = 'baseline'`) and upserts `project_cost_codes` from its lines by `code` (= `line_key`): ids never change across re-baselines, baseline codes whose line is gone become `omitted`. While a baseline is active (and `boq-control` active) `PUT /projects/:id/docs/:docKey` for `calc:*`, `boq:*`, `journey` → 409 `conflict` reason `baseline_locked` (registry `BoqEditLocks`); `meta` / `planning:*` stay writable. Ports for other modules: `BaselineControl` (`lock` inside the caller's transaction, `status`, `baselineProject`), `CostCodeLookup` (`findMany`, `listByProject`, `applyVariation`, `setReportedProgress`, `setCertifiedProgress`, `allocateContractAmounts`); registry `BaselineUnlockGuards`. Not a member → 404; module not active → 404 `module_disabled`; lock / unlock audited (`project_baseline`).

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/baseline` | → `BaselineStatusDto` | `projects.read`; `{locked, baseline, history (newest first), costCodeCount, unlockBlockers}` |
| POST | `/projects/:projectId/baseline` | `LockBaselineRequest` → `BaselineStatusDto` (201) | `boq.baseline.lock`; no `versionId` = new revision `BASELINE-<n>` of the current documents; already locked → 409 `baseline_already_locked`; version of another project → 404; archived → 409 `project_archived`; BOQ does not compute → 422 |
| POST | `/projects/:projectId/baseline/unlock` | `UnlockBaselineRequest` → `BaselineStatusDto` (200) | `boq.baseline.unlock`; not locked → 409 `baseline_not_locked`; a guard blocker → 409 `baseline_unlock_blocked` with `details.blockers[]`; cost codes are kept |
| GET | `/projects/:projectId/cost-codes` | → `CostCodeDto[]` | `projects.read`; baseline → variation → manual, BOQ order; cost fields null without `cost.read` |

## Cost ledger + financial events (ERP foundation, gated by `project-hub`; WP-20)
Schemas: `../src/shared/contract/erp/ledger.ts`. Both tables are append-only and written only through the ports `CostLedger` (`post`, `reverse`, `reverseSource`, `totalsByCostCode`, `totalsByProject`, `entriesBySource`, `openCommitments`) and `FinancialEvents` (`post`, `reverse`, `list`, `bySource`) inside the caller's transaction; a correction is a new row with negated amounts and `reversesId` (one reversal per row: 409 `already_reversed` / `reversal_entry`). `committedOpen = Σ commit + Σ commit_release` (per `commitment_ref` + cost code never below 0: 422 `commitment_exceeded`), `actual = Σ actual`. A project with financial events cannot be deleted (409 `financial_events_exist`); ledger rows block a baseline unlock (blocker `ledger`). Not a member → 404; module not active → 404 `module_disabled`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/cost-ledger?costCodeId=` | → `CostLedgerDto` | `cost.read`; entries oldest first + totals per cost code and overall (of the selection) |
| GET | `/workspaces/:workspaceId/fin-events?from=&to=&type=&projectId=` | → `FinEventDto[]` | `tax.reports` (every type) or `billing.read` (`ar.*` only); dates inclusive; `type` comma-separated `FIN_EVENT_TYPES`; oldest first |

## Quotations (module `quotations`; WP-23)
Schemas: `../src/shared/contract/erp/quotations.ts`; pricing `../src/domain/quotation`. Read `quotations.read`, edit / new version / cancel `quotations.manage`, issue / record an answer `quotations.issue`. Without `quotations.seeMargins` every `cost*` / `margin*` field, the section rates and `pricing.defaults` are left out (`seesMargins: false`). Amounts are always priced on the server. Not a member → 404; module not active → 404 `module_disabled`; archived project → 409 `project_archived` on writes. Customer links: `subjectType: 'quotation'`, `subjectId` = the **version** id (issued versions answerable; drafts / cancelled → 404). Daily sweep `quotations.expire`: issued versions past `validUntil` → `expired`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/quotations` | → `QuotationDto[]` | newest first, every version summarised |
| POST | `/projects/:projectId/quotations` | `CreateQuotationRequest` → `QuotationVersionDto` (201) | from `boqVersionId`, or a new revision `QT-<n>` of the current BOQ; terms from the project's commercial settings; customer default = the project's |
| GET | `/quotations/:quotationId` | → `QuotationDto` | |
| GET | `/quotations/:quotationId/compare?from=&to=` | → `QuotationCompareDto` | both versions of that quotation |
| POST | `/quotations/:quotationId/versions` | `NewQuotationVersionRequest` → `QuotationVersionDto` (201) | copy (default the latest) or `fromBoq` / `boqVersionId` rebuild; open draft → 409 `draft_exists`; accepted → 409 `invalid_transition` |
| GET | `/quotation-versions/:versionId` | → `QuotationVersionDto` | sections, lines, government parts, snapshots once issued |
| PATCH | `/quotation-versions/:versionId` | `PatchQuotationVersionRequest` → `QuotationVersionDto` | draft only: issued → 409 `already_issued`, waiting → 409 `approval_pending`; pricing problem → 400 `details.reason` (`QUOTATION_PRICING_ISSUES`) |
| POST | `/quotation-versions/:versionId/issue` | `IssueQuotationVersionRequest` → `QuotationVersionDto` (200) | approval `quotation.issue` (auto-skip → `issued` now, else `pending_approval`); first issue numbers `QT…` (docType `quotation`, subject = quotation id), later ones `${base}-R<n>`; earlier issued versions → `superseded`; project → `quoted` |
| POST | `/quotation-versions/:versionId/cancel` | → `QuotationVersionDto` (200) | draft or pending approval (the request is cancelled) |
| POST | `/quotation-versions/:versionId/record-response` | `RecordQuotationResponseRequest` → `QuotationVersionDto` (200) | issued only; accept → `accepted`, project `won`, other issued versions `superseded`; members notified |

## Main contracts (module `contracts`; WP-26)
Schemas: `../src/shared/contract/erp/main-contracts.ts`; template `../src/domain/erp/main-contract-template.ts`. Read `contracts.read`, everything else `contracts.manage`. One effective (not cancelled / terminated) contract per project. Amounts exclude VAT. `quotedMarginPct` is left out without `quotations.seeMargins`. Milestone `no` 0 = the advance payment (from `terms.advancePct`); work / final milestones 1…n with amounts `allocate(value, pct[])`; `status` `planned` reads as `claimable` once its trigger is met. Not a member → 404; module not active → 404 `module_disabled`; archived project → 409 `project_archived` on writes. Daily sweep `contracts.guarantee-expiring`: `guarantee.expiring` once per active guarantee within 30 days of its expiry.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/main-contract` | → `ProjectMainContractDto` | `{contract: effective or null, ended: [...]}` |
| POST | `/projects/:projectId/main-contract` | `CreateMainContractRequest` → `MainContractDto` (201) | from `quotationId` (accepted only, else 409 `quotation_not_accepted`; value = `vatBase`, milestones from its payment terms) or empty (`customerId` + `originalValue`); terms from the project's settings; existing contract → 409 `contract_exists`; no customer → 422 `customer_required` |
| GET | `/main-contracts/:contractId` | → `MainContractDto` | |
| PATCH | `/main-contracts/:contractId` | `PatchMainContractRequest` → `MainContractDto` | draft only (signed → 409 `already_issued`); bodies sanitized; value / advance change re-plans the milestone amounts |
| PUT | `/main-contracts/:contractId/milestones` | `PutContractMilestonesRequest` → `MainContractDto` | draft only; shares ≠ 100% → 400; unknown cost code → 404 |
| POST | `/main-contracts/:contractId/sign` | `SignMainContractRequest` → `SignMainContractResponse` (200) | number `CT…`; baseline locked from the quotation's BOQ version when not locked yet (else kept); Σ cost code `contract_amount` = `originalValue`; project → `in_progress`; milestone contract without milestones → 422 `milestones_required` |
| POST | `/main-contracts/:contractId/terminate` | `{reason, date?}` → `MainContractDto` (200) | signed only |
| POST | `/main-contracts/:contractId/cancel` | → `MainContractDto` (200) | draft only |
| POST | `/main-contracts/:contractId/close` | `{date?}` → `MainContractDto` (200) | completed only; an active guarantee → 409 `guarantees_active` |
| POST | `/main-contracts/:contractId/signed-scan` | `{fileIds}` → `MainContractDto` (200) | files of purpose `main_contract_scan` uploaded by the caller |
| GET | `/main-contracts/:contractId/guarantees` | → `ContractGuaranteeDto[]` | |
| POST | `/main-contracts/:contractId/guarantees` | `CreateGuaranteeRequest` → `ContractGuaranteeDto` (201) | draft / signed / completed contract; files `guarantee_scan` |
| PATCH | `/guarantees/:guaranteeId` | `PatchGuaranteeRequest` → `ContractGuaranteeDto` | return = `{status: 'returned'}` (`returnedAt` default today) |

## Billing (module `billing`; WP-29, WP-30)
Schemas: `../src/shared/contract/erp/billing.ts`; formulas `../src/domain/billing/*`. Read `billing.read`, everything else `billing.manage`. Every amount is computed by the server (never sent by the client). Claim states `draft → (pending_approval →) submitted → certified → invoiced`, `draft | pending_approval | submitted → cancelled`; one open (draft / pending_approval / submitted) claim per contract (409 `claim_open`). Claims need a signed (or completed) contract (409 `contract_not_signed`). Not a member → 404; module not active → 404 `module_disabled`; archived project → 409 `project_archived` on writes. Money events (`fin_events`, source `ar_invoice`): claim invoice → `ar.invoiced` (+ `ar.retention_withheld`, `ar.advance_recovered`, `ar.penalty` with the amount in `net`), advance → `ar.advance_invoiced`, retention release → `ar.retention_released`; void reverses them.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/main-contracts/:contractId/claims` | → `ArClaimSummaryDto[]` | by claim no |
| POST | `/main-contracts/:contractId/claims` | `CreateArClaimRequest` → `ArClaimDto` (201) | progress: a line per active cost code with `contract_amount + vo_contract_amount ≠ 0`, cum % = max(reported, previous); milestone: `milestoneId` of a claimable work / final milestone (409 `milestone_not_claimable`; `manual` ones count as claimable), milestone → `claimed` |
| GET | `/claims/:claimId` | → `ArClaimDto` | with lines (cost code text, reported progress) |
| PATCH | `/claims/:claimId` | `PatchArClaimRequest` → `ArClaimDto` | draft / submitted; lines merged by cost code (400 `unknown_cost_code`, `progress_out_of_range`, `progress_below_previous` without note); penalty above the cap left → 422 `penalty_cap_exceeded` (`details.max`) |
| POST | `/claims/:claimId/submit` | → `ArClaimDto` (200) | draft → approval `claim.submit` (auto → submitted, else pending_approval); amount ≤ 0 → 422 `claim_amount_not_positive` |
| POST | `/claims/:claimId/certify` | `CertifyArClaimRequest` → `ArClaimDto` (200) | submitted → certified; `lines` may still be adjusted |
| POST | `/claims/:claimId/invoice` | `InvoiceArClaimRequest` → `InvoiceDto` (200) | certified → invoiced: invoice issued (`INV…`), retention withheld / advance recovered ledger rows, certified progress on cost codes, milestone → `invoiced` |
| POST | `/claims/:claimId/cancel` | → `ArClaimDto` (200) | milestone back to `claimable` |
| GET | `/projects/:projectId/invoices` | → `InvoiceDto[]` | newest first |
| GET | `/invoices/:invoiceId` | → `InvoiceDto` | |
| POST | `/main-contracts/:contractId/advance-invoice` | `CreateAdvanceInvoiceRequest` → `InvoiceDto` (201) | draft; signed contract, `advancePct > 0` (else 422 `no_advance`), none yet (409 `advance_invoice_exists`); VAT + WHT on the advance |
| POST | `/main-contracts/:contractId/retention-release-invoice` | `{amount, issueDate?, dueDate?, language?, note?}` → `InvoiceDto` (201) | draft, no VAT / WHT; amount ≤ held − other drafts (422 `retention_release_exceeds_balance`) |
| POST | `/invoices/:invoiceId/issue` | `{issueDate?, dueDate?}` → `InvoiceDto` (200) | draft → issued (`INV…`, snapshots); advance: milestone 0 → invoiced; retention release: ledger `released` |
| POST | `/invoices/:invoiceId/void` | `{reason}` → `InvoiceDto` (200) | draft / issued with nothing received (else 409 `invoice_has_receipts`); number voided, events reversed, its ledger rows removed; claim back to `certified` |
| GET | `/main-contracts/:contractId/retention` | → `ContractRetentionDto` | totals, cap, release plan (`retentionRelease`), entries |
| GET | `/main-contracts/:contractId/advance` | → `ContractAdvanceDto` | totals, the advance invoice, `canCreateInvoice` |

### Receipts, tax invoices, credit notes, receivables (WP-30)
Record / void receipts, tax invoices, credit notes `billing.receive`; the reads `billing.read`. A receipt (`RC…`) settles invoices (`invoice` / `advance_invoice`, issued or partially paid) of one customer (422 `customer_mismatch`); per invoice `settled = cash + wht` (the customer's WHT); above what is due (`payable + whtExpected − paidAmount`) → 422 `overpayment` (`details.invoiceId`, `outstanding`). When the company is VAT registered (default of `issueTaxInvoice`) each claim / advance invoice gets a tax invoice (`TI…`, `kind='tax_invoice'`, `source='receipt'`, `relatedInvoiceId`) for its share (`src/domain/billing/tax-invoice.ts`; the receipt that pays it takes the rest, so Σ TI = the invoice); `issueTaxInvoice: true` while not registered → 422 `not_vat_registered`; a juristic customer without tax id → 422 `customer_tax_id_required`. Advance invoice received → `ar_advance_entries` `received` (its net share); paid → milestone `paid`. Events (source `ar_receipt`): `ar.receipt` per invoice (`net` = settled, `cash`, `wht`, direction `in`), `ar.wht_withheld_by_customer` (`net` = wht); tax invoices `ar.tax_invoiced` (source `ar_invoice`), credit notes `ar.credit_noted`. Files: purposes `payment_slip`, `customer_wht_certificate`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| POST | `/workspaces/:workspaceId/receipts` | `CreateReceiptRequest` → `ReceiptDto` (201) | 400 `duplicate_invoice`, `receipt_amount_not_positive`; 422 `date_before_last_issued` (RC / TI dated before the latest) |
| GET | `/receipts/:receiptId` | → `ReceiptDto` | allocations, tax invoices, `canVoid` |
| POST | `/receipts/:receiptId/void` | `{reason}` → `ReceiptDto` (200) | same Bangkok day it was recorded only (409 `receipt_void_window`); its tax invoices voided (409 `has_credit_notes`), events reversed, invoices / advance ledger / milestone back |
| POST | `/invoices/:invoiceId/tax-invoice` | `{issueDate?, language?, note?}` → `InvoiceDto` (201) | ahead of payment, for everything not on a TI yet; 422 `not_vat_registered`, `customer_tax_id_required`, `tax_invoice_not_applicable` (retention release, TI, CN); 409 `tax_invoice_complete` |
| POST | `/invoices/:invoiceId/credit-note` | `{amount, reason, issueDate?, language?}` → `InvoiceDto` (201) | on an issued tax invoice (422 `credit_note_needs_tax_invoice`); `amount` without VAT ≤ what is not credited (422 `credit_note_exceeds`, `details.available`); `CN…`; does not change what the customer owes on the invoice |
| GET | `/invoices/:invoiceId/promptpay` | → `InvoicePromptPayDto` | open invoice; `amount` = cash still to pay (WHT share left out); 422 `promptpay_not_set` / `promptpay_invalid` |
| GET | `/workspaces/:workspaceId/receivables/aging` | → `ArAgingDto` | open invoices by days past due (Bangkok today): `current`, `1_30`, `31_60`, `61_90`, `over_90`; per customer |
| GET | `/customers/:customerId/statement?from&to` | → `CustomerStatementDto` | invoices (debit = payable + whtExpected) and issued receipts (credit = settled), running balance, open invoices |

Customer link subject `invoice` (view only, `billing.read` to share): `InvoiceLinkPayload` (invoice, outstanding, PromptPay payload, bank accounts). Daily sweeps: `billing.invoice-due` (`invoice.due_soon` once from 3 days before the due date; `invoice.overdue` on days 1, 7, 30 after it) and `billing.retention-release-due` (`retention.release_due` once per release stage that is due), to members with `billing.read`. Hub roll-up: `billedToDate`, `receivedToDate`, `overdueReceivable`. Port `BillingTotals.totalsByProject` (billed, received, retentionHeld, advanceOutstanding).

## Variation orders (module `variations`; WP-33)
Schemas: `../src/shared/contract/erp/variations.ts`; pricing `../src/domain/variations/{pricing,sandbox}.ts`. Read `variations.read`, everything else `variations.manage`; cost fields (`costTotal`, line `costMatUnit` / `costLabUnit` / `costAmount`) only for `variations.manage`. A VO needs the project's signed main contract (409 `contract_not_signed`); `billing='next_claim'` on a milestone-billed contract → 422 `invalid_billing_option` (default: `next_claim` on progress, `spread` on milestone). Sell price of a line = cost × the sell factor of its BOQ section in the contract's quotation version (no quotation → default rates); VAT at the contract's rate. Amounts are signed and computed by the server. Accepting (customer link `variation` accept / reject, or recorded) needs `requestedByName`, `requestedDate` and the link answer or ≥ 1 evidence item (422 `evidence_required`), then in one transaction: contract `current_value += sellTotal`, `extension_days`, `finish_date`, milestones by `billing`; cost codes `vo_qty` / `vo_cost` / `budget_total` / `vo_contract_amount` (new items → `VO{seq}-{n}`); project `planned_finish` moved; notice `variation.accepted` / `variation.rejected`. Files: purpose `variation_evidence`.

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/variations` | → `VariationOrderSummaryDto[]` | newest first |
| POST | `/projects/:projectId/variations` | `CreateVariationOrderRequest` → `VariationOrderDto` (201) | draft; `seqNo` per contract |
| GET | `/variations/:variationId` | → `VariationOrderDto` | lines, evidence, sandbox |
| PATCH | `/variations/:variationId` | `PatchVariationOrderRequest` → `VariationOrderDto` | draft only (409 `approval_pending` / `already_issued`) |
| PUT | `/variations/:variationId/lines` | `{lines}` → `VariationOrderDto` | draft; replaces the manual lines (calculator lines kept); unknown cost code → 404 |
| POST | `/variations/:variationId/compute` | `{sandbox?}` → `VariationOrderDto` (200) | draft; sandbox over the baseline snapshot (409 `baseline_not_locked`) → calculator lines replaced (manual kept) |
| POST | `/variations/:variationId/evidence` | `{kind, fileId?, note?, takenAt?}` → `VariationOrderDto` (201) | until answered; the file must be the caller's upload |
| DELETE | `/variation-evidence/:evidenceId` | → 204 | until answered |
| POST | `/variations/:variationId/submit` | → `VariationOrderDto` (200) | approval `variation.submit` → `submitted` (number `VO…`, customer snapshot) or `pending_approval` |
| POST | `/variations/:variationId/record-response` | `{action: accept\|reject, name, note?, at?}` → `VariationOrderDto` (200) | submitted only |
| POST | `/variations/:variationId/withdraw` | → `VariationOrderDto` (200) | submitted → withdrawn; pending_approval → draft |
| POST | `/variations/:variationId/cancel` | → `VariationOrderDto` (200) | draft / pending_approval → cancelled |

## Suppliers (module `procurement`; WP-37)
Schemas: `../src/shared/contract/erp/suppliers.ts`. Port `SupplierLookup` (`find`, `findMany`, `snapshot(ws, id, language)`, `locate`) for procurement / payables; subcontracting provides `ScVendorDirectory` (`listEntries(ws)`, [] while subcontracting is off). Global search lists suppliers (`suppliers.read`). Price history is procurement's (WP-39).

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/suppliers?q=&kind=&trade=&archived=&limit=` | → `SupplierDto[]` | `suppliers.read`; `q` matches names, tax id, contact, phone, email, LINE id; active unless `archived=true`; sorted by name |
| POST | `/workspaces/:workspaceId/suppliers` | `CreateSupplierRequest` → `SupplierDto` | `suppliers.manage`; no name → 400; same tax id + branch as an active supplier → 409 `duplicate_supplier` |
| POST | `/workspaces/:workspaceId/suppliers/import-sc` | → `ImportScSuppliersDto` (200) | `suppliers.manage`; one `subcontractor` supplier per visible vendor-list entry not linked yet (`scVendorListEntryId`); re-running creates nothing; subcontracting off → `created: 0` |
| GET | `/suppliers/:supplierId` | → `SupplierDto` | `suppliers.read`; another workspace's supplier → 404 |
| PATCH | `/suppliers/:supplierId` | `PatchSupplierRequest` → `SupplierDto` | `suppliers.manage`; archived → 409 `supplier_archived` |
| POST | `/suppliers/:supplierId/archive` · `/restore` | → `SupplierDto` (200) | `suppliers.manage`; idempotent; restore onto a taken tax id + branch → 409 `duplicate_supplier` |
| GET | `/suppliers/:supplierId/ratings` | → `SupplierRatingDto[]` | `suppliers.read`; newest first (100) |
| POST | `/suppliers/:supplierId/ratings` | `{score 1–5, note?, projectId?, sourceType?, sourceId?}` → `SupplierRatedDto` (201) | `suppliers.manage`; `rating` (average, 2 decimals) / `ratingCount` recomputed from every score; audited `supplier` / `create_supplier\|update_supplier\|archive\|restore\|rate\|import_sc` |

## Purchase requests + RFQs (module `procurement`; WP-38)
Schemas: `../src/shared/contract/erp/procurement.ts`. Pure: `src/domain/procurement/budget-check.ts` (`budgetWarnings`, `materialBudgetOf`), `compare.ts` (`compareQuotes`, `quoteTotals`). Read `procurement.read`; PR writes `procurement.request`; RFQ writes `procurement.manage`. Approval `purchase_request.approve` (handler in procurement); portal task `purchase_request_to_order` (approved / partially ordered PRs, `procurement.manage`). Audited `purchase_request` (`create|update|submit|approved|approval_rejected|cancel`) and `rfq` (`create|update|invite|send|cancel|quote|award`).

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/purchase-requests` | → `PurchaseRequestSummaryDto[]` | newest first |
| POST | `/projects/:projectId/purchase-requests` | `CreatePurchaseRequestRequest` → `PurchaseRequestDto` (201) | `source:'boq'` + `costCodeIds`: one line per code at `baseline_qty + vo_qty − requested by other live PRs` (≥ 0); typed `lines` after; unknown cost code → 404; `budgetWarnings` computed on every save |
| GET · PATCH | `/purchase-requests/:requestId` | `PatchPurchaseRequestRequest` → `PurchaseRequestDto` | PATCH draft only (`lines` replaces all); pending → 409 `approval_pending` |
| POST | `/purchase-requests/:requestId/submit` | `{overrideReason?}` → `PurchaseRequestDto` (200) | no lines → 422 `no_lines`; qty ≤ 0 → 422 `quantity_not_positive`; warnings without reason → 422 `override_reason_required` (`details.warnings`); number `PR…`, then approval: auto → `approved`, else `pending_approval` |
| POST | `/purchase-requests/:requestId/cancel` | → `PurchaseRequestDto` (200) | draft / pending_approval (approval cancelled) / approved not on an open RFQ (409 `request_in_rfq`) |
| GET | `/projects/:projectId/rfqs` | → `RfqSummaryDto[]` | with line / supplier / quote counts |
| POST | `/projects/:projectId/rfqs` | `CreateRfqRequest` → `RfqDto` (201) | lines of approved PRs of the project (409 `request_not_approved`), qty = `qty − ordered_qty` (≤ 0 → 422 `nothing_remaining`); `budgetUnitPrice` = PR estimate; suppliers of the workspace (404) not archived (409 `supplier_archived`) |
| GET · PATCH | `/rfqs/:rfqId` | `PatchRfqRequest` → `RfqDto` | PATCH draft only |
| PUT | `/rfqs/:rfqId/suppliers` | `{supplierIds}` → `RfqDto` | draft / sent; removing one who quoted → 409 `supplier_quoted` |
| POST | `/rfqs/:rfqId/send` · `/cancel` | → `RfqDto` (200) | send: draft, ≥ 1 line (`no_lines`) and supplier (`no_suppliers`), number `RFQ…`; cancel: draft / sent |
| PUT | `/rfqs/:rfqId/quotes/:supplierId` | `PutRfqQuoteRequest` → `RfqDto` | RFQ sent, supplier invited; amount = qty × unit price; VAT 7 % only for a VAT-registered supplier (split when `pricesIncludeVat`); unknown line → 422 `unknown_rfq_line`; `declined: true` drops the quote; files purpose `supplier_quote` |
| GET | `/rfqs/:rfqId/compare` | → `RfqCompareDto` | without VAT; lowest unit price per line; `normalizedTotal` counts lines not offered at qty × `budgetUnitPrice`; suppliers sorted by it |
| POST | `/rfqs/:rfqId/award` | `{supplierId}` → `{awardedSupplierId, orderId}` (200) | RFQ sent, supplier quoted (409 `supplier_not_quoted`) and not archived (409 `supplier_archived`) → `awarded` + a PO draft (WP-39) with the lines offered (unit price without VAT) |

## Purchase orders + goods receipts (module `procurement`; WP-39)
Schemas: `../src/shared/contract/erp/procurement.ts` (PO/GR part). Pure: `src/domain/procurement/order-totals.ts` (`orderTotals`, `lineNetAmounts`, `receiptValue`), `three-way-match.ts` (`threeWayMatch`). Read `procurement.read`; PO writes `procurement.manage`; receipts `procurement.receive`. Approval `purchase_order.issue` (handler in procurement). Ledger: issue → `commit` per line (amount after the header discount, `sourceType purchase_order`, ref = PO line); GR confirm → `commit_release` − / `actual` + (`sourceType goods_receipt`, ref = PO line); close → `commit_release` of what stays open; cancel (nothing received) → `reverseSource`. Notices `purchase_order.issued` (members with `procurement.receive`) and `goods.short_delivery` (rejected / damaged / short; members with `procurement.manage`). Hub `openPurchaseOrders` (issued / partially received); portal task `purchase_order_to_receive` (`procurement.receive`). Port `PurchaseOrders` (`find`, `linesWithReceived`, `markBilled`) for payables. Audited `purchase_order` (`create|update|submit|issue|approval_rejected|receive|close|cancel`) and `goods_receipt` (`create|confirm|cancel`).

| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/projects/:projectId/purchase-orders` | → `PurchaseOrderSummaryDto[]` | newest first |
| POST | `/projects/:projectId/purchase-orders` | `CreatePurchaseOrderRequest` → `PurchaseOrderDto` (201) | draft; supplier of the workspace (404) not archived (409 `supplier_archived`); `requestLineIds` (approved PR lines of the project, 409 `request_not_approved`; qty = not ordered yet, 422 `nothing_remaining`) then typed `lines`; VAT 7 % by default only for a VAT-registered supplier; discount > subtotal → 422 `discount_exceeds_subtotal` |
| GET | `/workspaces/:workspaceId/purchase-orders?status=a,b` | → `PurchaseOrderSummaryDto[]` | every project; unknown status → 400 |
| GET · PATCH | `/purchase-orders/:orderId` | `PatchPurchaseOrderRequest` → `PurchaseOrderDto` | PATCH draft only (`lines` replaces all); `budgetWarnings` computed on every save |
| POST | `/purchase-orders/:orderId/issue` | `{overrideReason?}` → `PurchaseOrderDto` (200) | draft; no lines → 422 `no_lines`; warnings without reason → 422 `override_reason_required` (`details.warnings`); approval with `amount: null` when warned (never below the threshold) else subtotal − discount; auto → number `PO…` + snapshot + commitments + PR lines ordered (PR → `partially_ordered`/`ordered`) + RFQ `closed`; else `pending_approval` (rejected → back to `draft`) |
| POST | `/purchase-orders/:orderId/cancel` | → `PurchaseOrderDto` (200) | draft / pending_approval / issued with nothing received (else 409 `goods_received` / `invalid_transition`): commitments reversed, PR un-ordered, number voided |
| POST | `/purchase-orders/:orderId/close` | → `PurchaseOrderDto` (200) | issued / partially_received / received: open commitment released, draft receipts cancelled |
| GET | `/suppliers/:supplierId/price-history?q=` | → `SupplierPriceHistoryItem[]` | lines of the supplier's issued POs (description contains `q`), newest first, ≤ 200 |
| GET | `/purchase-orders/:orderId/receipts` | → `GoodsReceiptDto[]` | oldest first |
| POST | `/purchase-orders/:orderId/receipts` | `CreateGoodsReceiptRequest` → `GoodsReceiptDto` (201) | PO issued / partially_received; unknown line → 422 `unknown_order_line`; received beyond ordered → 422 `over_received`; all zero → 422 `nothing_received`; photos purpose `delivery_note_photo` / `goods_photo` (`{fileId, takenAt, caption}`) |
| POST | `/goods-receipts/:receiptId/confirm` · `/cancel` | → `GoodsReceiptDto` (200) | confirm: draft, number `GR…`, value `net × qty / ordered` (the receipt completing a line takes what is open), PO → `partially_received` / `received`; cancel: draft only |
