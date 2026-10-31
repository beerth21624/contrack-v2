# Module 1 (จ้างช่วง) — HTTP API map and work-stream ownership

The single source of truth for paths. Schemas: `src/shared/contract/{modules,files,phone-auth,notifications}.ts` and
`src/shared/contract/subcontracting/*`. The browser calls `/api/<path>` (Next rewrite); the backend serves `<path>`.
All routes need a bearer token unless marked **public**. Errors: `ErrorResponse` with codes from `common.ts`.
Every subcontracting route goes through `ScAccess` (backend `src/modules/subcontracting/shared/sc-access.ts`):
non-member → 404 `not_found`, module off → 404 `module_disabled`, no permission → 403 `forbidden`.

Work streams: **B1** platform · **B2** identity/phone · **C1** sourcing · **C2** bidding · **C3** contracts
(backend) · **D1** buyer sourcing UI · **D2** buyer contracts UI · **D3** vendor UI (frontend).

## Platform (B1)
| Method | Path | Request → Response | Rule |
|---|---|---|---|
| GET | `/platform/modules` **public** | → `PlatformModulesDto` | env MODULES_ENABLED |
| GET | `/workspaces/:ws/modules` | → `WorkspaceModuleDto[]` (every MODULE_IDS entry, in order) | member (`workspace.read`) |
| PUT | `/workspaces/:ws/modules/:module` | `PutWorkspaceModuleRequest` → `WorkspaceModuleDto` | `modules.manage`; not offered by platform → 422; switching off with `ModuleUsage.activeWork(...).activeSubcontracts > 0` and no `confirm` → 409 `conflict` details `ModuleOffBlockers` |
| POST | `/files` | multipart: `file`, `purpose` (`FilePurpose`), optional `workspaceId` (ERP uploads) → `FileDto` (201) | signed in; ≤ `MAX_FILE_BYTES`; `ALLOWED_CONTENT_TYPES` else 422; `workspaceId` of a workspace the caller is not a member of → 404 |
| GET | `/files/:id/content?exp=&sig=` **public** | → bytes (Content-Type, inline) | HMAC signature + expiry, else 404 |
| GET | `/notifications?limit=` | → `NotificationListDto` | own only |
| POST | `/notifications/read` | `MarkNotificationsReadRequest` → 204 | own only |

## Identity / phone (B2)
All three answer 404 `module_disabled` when the platform does not offer `subcontracting` (so does POST /files).
| Method | Path | Request → Response | Rule |
|---|---|---|---|
| POST | `/auth/otp/check` **public** | `RequestOtpRequest` → `PhoneStatusResponse` | rate limited |
| POST | `/auth/otp/request` **public** | `RequestOtpRequest` → 204 | ≤ 1 per 60 s and ≤ 5 per hour per phone, ≤ 30 per hour per IP → 429 `rate_limited`; code by SMS (console in dev) |
| POST | `/auth/otp/verify` **public** | `VerifyOtpRequest` → `PhoneAuthResponse` + refresh cookie | wrong / expired / used code, or > 5 attempts → 401 `otp_invalid` (same answer for known and unknown phones); right code for a new phone without `displayName` → 422 details `{ reason: 'name_required' }` and the code stays usable; ≤ 60 verifies per hour per IP, ≤ 20 wrong codes per phone per 24 h → 429; calls `PhoneSignInHook` in the same transaction |
`/me` and every `UserDto` carry `phone` (null for e-mail users).

## Sourcing (C1)
Rules added after review: resend revokes every earlier link (only the newest works); resend ≤ 1 per 10 min and ≤ 5 per day per invitation, invitation/addendum SMS ≤ 100 per buyer workspace per day → 429 `rate_limited`; a BOQ line already in another live package of the project → 409 details `{ lineKeys }`; addendum after the bid deadline → 409 `{ reason: "deadline_passed" }` (extend first); claiming / linking an invitation needs the crew's verified phone to equal the invited phone → else 409 `{ reason: "phone_mismatch" }`; withdrawn invitations are `not_found` on vendor routes; in-app `sc.invitation` / `sc.addendum` carry no raw link (SMS only).
Buyer:
| Method | Path | Request → Response | Permission |
|---|---|---|---|
| GET | `/workspaces/:ws/vendor-list?trade=&q=&hidden=true\|false` | → `VendorListEntryDto[]` | `sc.read` |
| POST | `/workspaces/:ws/vendor-list` | `CreateVendorListEntryRequest` → `VendorListEntryDto` (201) | `sc.vendors.manage`; same phone in the list → 409 |
| POST | `/workspaces/:ws/vendor-list/import` | `ImportVendorListRequest` → `ImportVendorListResponse` | `sc.vendors.manage` |
| PATCH | `/subcontracting/vendor-list/:entryId` | `UpdateVendorListEntryRequest` → `VendorListEntryDto` | `sc.vendors.manage` |
| DELETE | `/subcontracting/vendor-list/:entryId` | → 204 | `sc.vendors.manage`; entry with invitations → 409 (hide instead) |
| GET | `/workspaces/:ws/vendors/:vendorWs/card` | → `VendorCardDto` | `sc.read`; only vendors in this buyer's list |
| GET | `/projects/:projectId/subcontracting/packages` | → `PackageSummaryDto[]` | `sc.read` |
| POST | `/projects/:projectId/subcontracting/packages` | `CreatePackageRequest` → `BuyerPackageDto` (201, draft) | `sc.packages.manage`; unknown BOQ keys → 422; `sourcingMode: 'open'` → 422 (phase 2) |
| GET | `/subcontracting/packages/:id` | → `BuyerPackageDto` | `sc.read` (estimates 0 / bestBidTotal null without `sc.readPrices`) |
| PATCH | `/subcontracting/packages/:id` | `UpdatePackageRequest` → `BuyerPackageDto` | `sc.packages.manage`; after send only `description` and a later `bidDeadline` |
| DELETE | `/subcontracting/packages/:id` | → 204 | draft only |
| POST | `/subcontracting/packages/:id/files` | `{ fileId }` → `BuyerPackageDto` | `sc.packages.manage`; file uploaded by the caller |
| DELETE | `/subcontracting/packages/:id/files/:fileId` | → `BuyerPackageDto` | draft only |
| POST | `/subcontracting/packages/:id/addendum` | `AddendumRequest` → `BuyerPackageDto` | sent, not awarded; version + 1; invitees notified |
| POST | `/subcontracting/packages/:id/extend` | `ExtendDeadlineRequest` → `BuyerPackageDto` | later than now and than the current deadline; expired → open |
| POST | `/subcontracting/packages/:id/cancel` | `CancelRequest` → `BuyerPackageDto` | before award |
| GET | `/subcontracting/packages/:id/invitations` | → `ScInvitationDto[]` | `sc.read` |
| POST | `/subcontracting/packages/:id/invitations` | `CreateInvitationsRequest` → `CreateInvitationsResponse` (201) | `sc.packages.manage`; sends a draft (status open); direct mode = exactly 1 invitee in total; rfq ≤ 8 |
| POST | `/subcontracting/invitations/:id/resend` | → `ResendInvitationResponse` | `sc.packages.manage` |
| POST | `/subcontracting/invitations/:id/withdraw` | → `ScInvitationDto` | `sc.packages.manage`; before award |
| GET | `/subcontracting/packages/:id/questions` | → `QuestionDto[]` | `sc.read` |
| POST | `/subcontracting/questions/:id/answer` | `AnswerQuestionRequest` → `QuestionDto` | `sc.packages.manage` |

Vendor / public:
| Method | Path | Request → Response | Rule |
|---|---|---|---|
| GET | `/s/:token` **public** | → `GuestPackageDto` | marks viewed (first time); token expired/withdrawn → 410 `invitation_invalid` |
| POST | `/s/:token/decline` **public** | `DeclineRequest` → 204 | before deadline |
| POST | `/s/:token/questions` **public** | `AskQuestionRequest` → `QuestionDto` | before deadline |
| POST | `/vendor/claim-invitation` | `{ token, workspaceId }` → `GuestPackageDto` | signed-in member of `workspaceId` with `vendor.read` that has a vendor profile: links the invitation to it |
| GET | `/vendor/me` | → `MyVendorsDto` | vendor workspaces of the caller |
| GET | `/vendor/profile?workspaceId=` | → `VendorProfileDto` | `vendor.read`; none → 404 |
| PUT | `/vendor/profile` | `PutVendorProfileRequest` → `VendorProfileDto` | `vendor.profile.edit` (creates when missing) |
| POST | `/vendor/portfolio?workspaceId=` | `CreatePortfolioItemRequest` → `PortfolioItemDto` (201) | `vendor.profile.edit` |
| DELETE | `/vendor/portfolio/:id` | → 204 | `vendor.profile.edit` |
| GET | `/vendor/invitations/:id` | → `GuestPackageDto` | `vendor.read` on the invitation's vendor workspace |
| POST | `/vendor/invitations/:id/decline` | `DeclineRequest` → 204 | `vendor.bid.submit` |
| POST | `/vendor/invitations/:id/questions` | `AskQuestionRequest` → `QuestionDto` | `vendor.bid.draft` |

## Bidding (C2)
Concurrent writes on one invitation (two submits, two first autosaves, submit vs award) → 409 conflict details `{ reason: "bid_changed" | "package_not_open" }` — never 500.
| Method | Path | Request → Response | Rule |
|---|---|---|---|
| GET | `/vendor/inbox?workspaceId=` | → `VendorInboxDto` | `vendor.read` |
| GET | `/vendor/invitations/:id/bid` | → `MyBidStateDto` | `vendor.read` |
| PUT | `/vendor/invitations/:id/bid-draft` | `SaveBidDraftRequest` → `BidDto` | `vendor.bid.draft`; package open, before deadline |
| POST | `/vendor/invitations/:id/bid` | `SubmitBidRequest` → `BidDto` (201) | `vendor.bid.submit`; open + before deadline + buyer module on; every non-excluded line priced (unit mode) |
| POST | `/vendor/invitations/:id/bid/withdraw` | → 204 | before deadline |
| GET / POST | `/vendor/invitations/:id/messages` | → `NegotiationMessageDto[]` / `SendMessageRequest` → `NegotiationMessageDto` | `vendor.read` / `vendor.bid.draft` |
| GET | `/subcontracting/packages/:id/bids` | → `BidDto[]` (every submitted version) | `sc.readPrices` |
| GET | `/subcontracting/packages/:id/leveling` | → `LevelingDto` | `sc.readPrices` |
| POST | `/subcontracting/invitations/:id/manual-bid` | `ManualBidRequest` → `BidDto` (201) | `sc.packages.manage`; `enteredByBuyer: true` |
| GET / POST | `/subcontracting/invitations/:id/messages` | → `NegotiationMessageDto[]` / `SendMessageRequest` → `NegotiationMessageDto` | `sc.read` / `sc.packages.manage` |
| POST | `/subcontracting/packages/:id/award` | `AwardRequest` → `AwardResponse` | `sc.award` (estimator when settings allow); each line → one bid; a lump bid wins all lines or nothing; a bid made before an addendum → 422 `bid_outdated` (vendor must resubmit); a part below 0 → 422 `negative_total`; package no longer open (double click, concurrent award, cancelled) → 409 `package_not_open`; a chosen bid changed meanwhile → 409 `bid_changed` |

## Contracts (C3)
| Method | Path | Request → Response | Rule |
|---|---|---|---|
| GET / PUT | `/workspaces/:ws/subcontracting/settings` | → / `PutSubcontractingSettingsRequest` → `SubcontractingSettingsDto` | `sc.read` / `sc.settings` |
| GET | `/subcontracting/checklists` | → `TradeChecklistsDto` | signed in |
| GET | `/projects/:projectId/subcontracting/overview` | → `ProcurementOverviewDto` | `sc.read` |
| GET | `/projects/:projectId/subcontracting/report` | → `ProcurementReportDto` | `sc.readPrices` |
| GET | `/projects/:projectId/subcontracting/subcontracts` | → `SubcontractSummaryDto[]` | `sc.read` |
| GET | `/workspaces/:ws/subcontracting/retention` | → `WorkspaceRetentionRow[]` | `sc.read` |
| GET | `/vendor/subcontracts?workspaceId=` | → `SubcontractSummaryDto[]` | `vendor.read` |
| GET | `/subcontracting/subcontracts/:id` | → `SubcontractDto` | buyer `sc.read` or vendor `vendor.read` (`viewerSide`) |
| GET / PUT | `/subcontracting/subcontracts/:id/document` | → / `UpdateContractDocumentRequest` → `ContractDocumentDto` | read: both sides; PUT: buyer `sc.award`, pending_acceptance only (version + 1) |
| POST | `/subcontracting/subcontracts/:id/accept` | `AcceptSubcontractRequest` → `SubcontractDto` | vendor `vendor.contract.act`; version must be the current one |
| POST | `/subcontracting/subcontracts/:id/request-change` | `RequestChangeRequest` → `SubcontractDto` | vendor `vendor.contract.act` |
| POST | `/subcontracting/subcontracts/:id/cancel` | `EndSubcontractRequest` → `SubcontractDto` | either side, pending_acceptance only; reopens the package |
| POST | `/subcontracting/subcontracts/:id/terminate` | `EndSubcontractRequest` → `SubcontractDto` | buyer `sc.award`, active only |
| POST | `/subcontracting/subcontracts/:id/complete` | → `SubcontractDto` | buyer `sc.claims.approve`; every installment paid |
| POST | `/subcontracting/subcontracts/:id/close` | → `SubcontractDto` | buyer `sc.payments.record`; completed + retention balance 0 |
| POST | `/subcontracting/subcontracts/:id/signed-scan` | `AttachScanRequest` → `SubcontractDto` | buyer `sc.packages.manage` |
| GET / POST | `/subcontracting/subcontracts/:id/variations` | → `VariationDto[]` / `ProposeVariationRequest` → `VariationDto` | read both; propose: buyer `sc.packages.manage` or vendor `vendor.contract.act`; active only |
| POST | `/subcontracting/variations/:id/respond` | `RespondVariationRequest` → `VariationDto` | the OTHER side |
| GET / POST | `/subcontracting/subcontracts/:id/claims` | → `ClaimDto[]` / `RequestClaimRequest` → `ClaimDto` | request: vendor `vendor.contract.act` or buyer `sc.claims.inspect` (on behalf) |
| POST | `/subcontracting/claims/:id/inspect` | `InspectClaimRequest` → `ClaimDto` | buyer `sc.claims.inspect` |
| POST | `/subcontracting/claims/:id/approve` | `ApproveClaimRequest` → `ClaimDto` | buyer `sc.claims.approve`; inspected pass / pass_with_fixes |
| POST | `/subcontracting/claims/:id/pay` | `PayClaimRequest` → `ClaimDto` | buyer `sc.payments.record`; approved |
| POST | `/subcontracting/claims/:id/reject` | `RejectClaimRequest` → `ClaimDto` | buyer `sc.claims.inspect` |
| GET | `/subcontracting/subcontracts/:id/retention` | → `RetentionEntryDto[]` | both sides |
| POST | `/subcontracting/subcontracts/:id/retention/release` · `/retention/forfeit` | `RetentionMoveRequest` → `RetentionEntryDto` | buyer `sc.payments.record`; ≤ balance |
| POST | `/subcontracting/subcontracts/:id/ratings` | `RatingRequest` → 204 | either side, once, completed/closed/terminated |

## Notifications (sent through `Notifier`, after the transaction committed)
Every payload has `href` (in-app path). Values are strings or numbers, already formatted for Thai readers
(money like `125,000 บาท`, dates like `30 ต.ค. 69 17:00`). Buyer side is reached with `toWorkspaceIds: [buyerWs]`,
vendor side with `toWorkspaceIds: [vendorWs]` when linked, plus `toPhone` (SMS) where marked.

| Template | Sent by | To | Payload keys |
|---|---|---|---|
| `sc.invitation` | C1 | vendor (+ `toPhone`, SMS) | buyerName, title, deadline, url (absolute /s/token link), href |
| `sc.addendum` | C1 | invitees (+ `toPhone`) | buyerName, title, url, href |
| `sc.question_asked` | C1 | buyer | title, href |
| `sc.question_answered` | C1 | invitees | title, href |
| `sc.declined` | C1 | buyer | vendorName, title, reason, href |
| `sc.package_cancelled` | C1 | invitees | buyerName, title, reason, href |
| `sc.deadline_soon` | C1 (sweep) | invitees without a bid | title, deadline, href |
| `sc.bid_received` | C2 | buyer | vendorName, title, href (no total: members without sc.readPrices also receive it) |
| `sc.message` | C2 | the other side | fromName, title, href |
| `sc.outcome_won` / `sc.outcome_lost` | C2 | invitees | buyerName, title, href |
| `sc.contract_to_accept` | C2 (award) / C3 (new document version) | vendor | buyerName, title, total, href |
| `sc.contract_accepted` / `sc.change_requested` | C3 | buyer | vendorName, title, href |
| `sc.claim_requested` | C3 | buyer | vendorName, title, installmentNo, href |
| `sc.inspection_result` | C3 | vendor | title, installmentNo, result, href |
| `sc.claim_paid` | C3 | vendor | title, installmentNo, amount, href |
| `sc.variation_proposed` / `sc.variation_answered` | C3 | the other side | title, amount, accepted (answered only), href |
| `sc.retention_due` | C3 (sweep) | both | title, amount, dueAt, href |

In-app links: buyer `/subcontracting/packages/:id`, `/subcontracting/packages/:id/leveling`,
`/subcontracting/contracts/:id`; vendor `/vendor/invitations/:id`, `/vendor/contracts/:id`.

## Web routes (frontend)
| Route | Owner | Content |
|---|---|---|
| `/subcontracting` | D1 | overview of the open cloud project (trades, status, coverage, to-do) |
| `/subcontracting/packages/new?trade=&section=` | D1 | 3-step package wizard |
| `/subcontracting/packages/[packageId]` | D1 | package page (invitees, lines, terms, files, Q&A, addendum, manual bid) |
| `/subcontracting/packages/[packageId]/leveling` | D1 | bid comparison + negotiate + award |
| `/subcontracting/vendors` | D1 | vendor list (ทะเบียนทีมช่าง) + import |
| `/workspace/modules` | D1 | module switches of the workspace |
| `/subcontracting/contracts` | D2 | contracts of the open project |
| `/subcontracting/contracts/[subcontractId]` | D2 | contract, installments, claims, variations, retention |
| `/subcontracting/contracts/[subcontractId]/print` | D2 | printable contract (Sarabun, browser print) |
| `/subcontracting/retention` | D2 | retention across the workspace |
| `/subcontracting/report` | D2 | estimate vs contracted vs paid |
| `/subcontracting/settings` | D2 | module settings (defaults, permissions, template) |
| `/s/[token]` | D3 | public invitation page (mobile first) |
| `/vendor/login` | D3 | phone + OTP |
| `/vendor` | D3 | inbox (invitations, bids, contracts) |
| `/vendor/invitations/[invitationId]` | D3 | package + bid form + Q&A + messages |
| `/vendor/contracts/[subcontractId]` | D3 | contract (accept / request change), claims, variations, retention |
| `/vendor/profile` | D3 | crew profile + portfolio |
Coordinator: menu entries, notification bell, the "จ้างช่วง" button on BOQ section headers, i18n keys.
