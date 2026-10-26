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
| DELETE | `/workspaces/:workspaceId` | → 204 | `workspace.delete` (company only; `personal_workspace` 409) |
| GET | `/workspaces/:workspaceId/members` | → `MemberDto[]` | `members.read` |
| PATCH | `/workspaces/:workspaceId/members/:userId` | `ChangeRoleRequest` → `MemberDto` | `members.changeRole`; only an owner gives/takes `owner`; admin cannot touch owners; never leave 0 owners (`last_owner`) |
| DELETE | `/workspaces/:workspaceId/members/:userId` | → 204 | `members.remove` (or yourself = leave); not the last owner; not in a personal workspace |
| GET | `/workspaces/:workspaceId/invitations` | → `InvitationDto[]` (pending only) | `members.invite` |
| POST | `/workspaces/:workspaceId/invitations` | `CreateInvitationRequest` → `CreateInvitationResponse` (201) | `members.invite`; company only; admin may invite admin/estimator/viewer |
| DELETE | `/workspaces/:workspaceId/invitations/:invitationId` | → 204 | `members.invite` |
| POST | `/invitations/accept` | `AcceptInvitationRequest` → `AcceptInvitationResponse` | signed-in user whose e-mail equals the invitation's; single use; not expired/revoked (`invitation_invalid` 410); already a member → keeps the stronger role |

## projects
| Method | Path | Body → Response | Permission |
|---|---|---|---|
| GET | `/workspaces/:workspaceId/projects?archived=true\|false` | → `ProjectDto[]` (default: not archived, newest update first) | `projects.read` |
| POST | `/workspaces/:workspaceId/projects` | `CreateProjectRequest` → `ProjectDetailDto` (201) | `projects.create`; optional `docs` = upload of a guest project (all validated) |
| GET | `/projects/:projectId` | → `ProjectDetailDto` | `projects.read` |
| PATCH | `/projects/:projectId` | `UpdateProjectRequest` → `ProjectDto` | rename `projects.edit`; archive/restore `projects.archive`; renaming an archived project → 409 `conflict` unless the same request restores it (`archived: false`); an unchanged value is a no-op (no activity, no event) |
| DELETE | `/projects/:projectId` | → 204 | `projects.delete`; viewers receive `project.deleted` |
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
| POST | `/workspaces/:workspaceId/rate-cards` | `CreateRateCardRequest` → `RateCardDto` (201) | `rateCards.create` (owner, admin, estimator); name taken or 50 active cards → 409 `conflict` with `RateCardConflictDetails` (`{ reason: 'name_taken', name }` / `{ reason: 'limit_reached', limit }`) |
| PATCH | `/workspaces/:workspaceId/rate-cards/:rateCardId` | `UpdateRateCardRequest` → `RateCardDto` | `rateCards.edit` (owner, admin); any subset of the fields, at least one (`note: null` clears it); an unchanged value is a no-op; an archived card → 404; name taken → 409 `conflict` (`name_taken`) |
| DELETE | `/workspaces/:workspaceId/rate-cards/:rateCardId` | → 204 | `rateCards.archive` (owner, admin); soft delete (`archived_at`); archiving an archived card again → 204 |

Not a member of the workspace → 404 on every route; a card of another workspace (or a malformed id) → 404.

## realtime (Socket.IO namespace `/realtime`, `io(url + '/realtime', { auth: { token } })`)
Events and payloads: `../src/shared/contract/realtime.ts`. A bad/missing token → the server disconnects.
`project.join` checks `projects.read`; after joining the client receives `presence.state`, then live
`doc.updated` / `project.updated` / `project.deleted` / `assignment.updated` / `presence.state` for that project.
`project.deleted` `{ projectId }` is sent after the delete committed: clients leave the project and drop queued edits.
