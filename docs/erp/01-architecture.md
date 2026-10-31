# 01 — สถาปัตยกรรม ERP บนโค้ดเดิม

สถานะ: ข้อกำหนดทางเทคนิค ทุก WP ต้องทำตาม · 2026-10-31
ข้อเท็จจริงในเอกสารนี้ตรวจกับโค้ดแล้ว (branch `epic/erp` ที่ commit `9319ac2`) ถ้าโค้ดเปลี่ยนไปแล้ว ให้เชื่อโค้ดและบันทึกใน `PROGRESS.md`

---

## 0. ภาพรวมของสิ่งที่มีอยู่ (ข้อเท็จจริงที่ตรวจแล้ว)

| ส่วน | ที่อยู่ | สาระที่ต้องรู้ |
|---|---|---|
| Backend | `backend/` NestJS 11 + Drizzle 0.45 + zod | `AppModule.forRoot` ใน `backend/src/app.module.ts` import ทุกโมดูลเสมอ การเปิด/ปิดใช้ flag ไม่ใช่การ import แบบมีเงื่อนไข |
| Global guard | `ModuleGuard` → `AuthGuard` → `ErrorFilter` | `ModuleGuard` (`backend/src/shared/presentation/modules.ts`) ตรวจแค่ชั้น release (env) ผ่าน `@RequiresModule(id)` |
| กฎ backend | `backend/CONVENTIONS.md` | presentation → application → domain, ข้ามโมดูลผ่าน abstract class ใน `backend/src/shared/application/ports.ts` เท่านั้น, use case คืน `Result<T, DomainError>`, เวลาและ id มาจาก `Clock` / `IdGenerator`, เขียนหลายแถวใช้ `uow.run` |
| สิทธิ์ | `backend/src/shared/domain/permissions.ts` (`Permission`, `MATRIX`, `can`, `roleRank`) | web มีสำเนาที่ `src/features/cloud/permissions.ts` ซึ่ง **ตกหล่น** `rateCards.*` และ `workforce.*` |
| Contract | `src/shared/contract/*` (zod ล้วน) | backend import เป็น `@contrack/contract`, web import เป็น `@/shared/contract` |
| Pure domain | `src/domain/*` | backend import เป็น `@contrack/domain/*` (เช่น `computeProject`) |
| Schema | `backend/src/shared/infrastructure/database/schema*.ts` | ไฟล์ใหม่ต้องเพิ่มทั้งใน `database.ts` (merge `schema`) และ `backend/drizzle.config.ts` |
| Migration | `backend/drizzle/0000…0005` | ถัดไปคือ `0006_*` สร้างด้วย `cd backend && npm run db:generate -- --name <name>` |
| Persistence | `persistence(Port, () => new InMemoryX(), ctx => new DrizzleX(ctx))` ใน `backend/src/shared/infrastructure/core.module.ts` | ทุก port ต้องมี adapter ทั้ง in-memory และ drizzle |
| Module flags | `MODULE_IDS` ใน `src/shared/contract/modules.ts`; `ModuleFlags` port; `RepositoryModuleFlags`; ตาราง `workspace_modules` | ตอนนี้มี 2 ชั้น (env + toggle) |
| Files | `FileService` port; `FILE_PURPOSES` ใน `src/shared/contract/files.ts`; `FILE_PURPOSE_MODULE` | `UploadFileInput.workspaceId` มีอยู่แล้ว (nullable) |
| Notifications | `Notifier.notify` port; `notifications` (เก็บ `title`/`body` เป็นข้อความที่เรนเดอร์แล้ว); `notification_deliveries` outbox | template เป็น union ปิดแบบ `sc.*`; ข้อความไทยอยู่ที่ `notification-templates.ts`; `lineUserId` ยังเป็น `null` เสมอ (TODO ใน `drizzle-recipient-directory.adapter.ts`) |
| Project | ตาราง `projects` มีแค่ name/start/summary/archived ไม่มีลูกค้า สถานะ หรือวันที่ | เอกสารโครงการอยู่ใน `project_docs` ตาม doc key |
| ประวัติ BOQ | `project_revisions` (snapshot ทั้งโครงการเป็น jsonb + `totals`) | API `GET/POST /projects/:id/revisions` UI `src/features/cloud/revisions/RevisionButtons.tsx` |
| Frontend | Next 16 App Router, antd 6, Tailwind v4, react-query, zustand, next-intl (ใช้แค่ 2 ไฟล์) | เมนูเขียนตายตัวใน `src/components/AppLayoutUI.tsx`; `/` redirect ไป `/journey` |
| Registry ใน core | `ProjectDependents` (สร้างใน `CoreModule`) | ต้นแบบของ registry ใหม่ทุกตัวใน §11 |
| `ModuleUsage` (จะถูกแทน) | ประกาศใน `ports.ts`; provide ใน `backend/src/modules/subcontracting/contracts/contracts.parts.ts` (`RepositoryModuleUsage`); ใช้ใน `set-workspace-module.use-case.ts` | test kit ที่อ้างถึง: `backend/src/modules/platform/testing/platform-test-kit.ts` (`FakeModuleUsage`), `backend/src/modules/subcontracting/contracts/testing/contracts-test-kit.ts` |
| Fake ของ port กลาง | `backend/src/shared/testing/platform-fakes.ts` (`FakeWorkspaceDirectory` ฯลฯ) | เพิ่ม method ใน port กลางเมื่อไร ต้องเพิ่มใน fake ด้วย ไม่งั้น typecheck พัง |
| Engine version | `ENGINE_VERSION = 'excel-v5'` อยู่ใน `backend/src/modules/projects/domain/entities/project.entity.ts` (backend เท่านั้น) | โมดูลอื่นห้าม import; WP-17 ย้ายค่าคงที่ไป `src/domain/project.ts` แล้วให้ entity re-export |
| Doc keys ของโครงการ | `src/domain/sync/doc-keys.ts`: `meta`, `journey`, `calc:<id>`, `boq:<lineKey>`, `planning:<sheet>` | `journey` (ข้ามงาน "ไม่มีในโครงการนี้") ทำให้ปริมาณ BOQ เปลี่ยนด้วย |
| `src/app/page.tsx` | อยู่ **นอก** route group `(app)` จึงไม่มี `CloudProviders` (react-query/session) | `HomeRedirect` ต้องครอบ `CloudProviders` เอง (§3.2) |

---

## 1. แพตเทิร์นโมดูล backend ของ ERP

### 1.1 โฟลเดอร์

แต่ละโมดูล ERP เป็นโฟลเดอร์เดียวใต้ `backend/src/modules/<module-folder>/` ตาม `backend/CONVENTIONS.md`:

```
backend/src/modules/<module-folder>/
  domain/
    entities/<thing>.entity.ts          private constructor + static create(...) / rehydrate(...)
    value-objects/<x>.value-object.ts   static create(raw): Result<X, DomainError>
    policies/<rule>.policy.ts           กฎล้วน ไม่มี IO
    <module>-ids.ts                     branded ids เฉพาะโมดูล (แบบ subcontracting/shared/ids.ts)
    <module>-state.ts                   state machine: ตาราง transition + requireStatus()
  application/
    ports/<thing>.repository.ts         abstract class
    use-cases/<verb-noun>.use-case.ts   @Injectable() execute(input): Promise<Result<Out, DomainError>>
    <module>-views.ts                   entity → DTO (หรือใช้ presentation/*.mapper.ts)
  infrastructure/adapters/
    drizzle-<thing>.repository.ts       ใช้ this.ctx.executor และกรอง workspace_id ทุก query
    in-memory-<thing>.repository.ts     structuredClone และเลียนแบบ unique constraint
  presentation/
    <module>.controller.ts              @RequiresModule('<id>') + ZodPipe + unwrap
  <module>.module.ts                    @Global() @Module, export เฉพาะ port ที่โมดูลอื่นใช้
```

### 1.2 ชื่อโฟลเดอร์ ModuleId และ prefix ตาราง (ตายตัว ห้ามเปลี่ยน)

| โฟลเดอร์ backend | ModuleId ที่คุม | prefix ตาราง | ไฟล์ schema | contract | frontend feature |
|---|---|---|---|---|---|
| `platform` (มีอยู่ ขยาย) | — (foundation) | ไม่มี prefix | `schema-platform.ts` (เพิ่ม `workspace_entitlements`, `user_channel_links`) | `modules.ts`, `module-registry.ts` | `src/features/modules/`, `src/features/erp/admin/` |
| `numbering` | foundation | `doc_number_*`, `issued_documents` | `schema-erp-core.ts` | `erp/numbering.ts` | `src/features/erp/numbering/` |
| `approvals` | foundation | `approval_*` | `schema-erp-core.ts` | `erp/approvals.ts` | `src/features/erp/approvals/` |
| `audit` | foundation | `audit_events` | `schema-erp-core.ts` | `erp/audit.ts` | (ใช้ใน `erp/shared`) |
| `company` | foundation | `company_profiles` | `schema-erp-core.ts` | `erp/company.ts` | `src/features/erp/company/` |
| `customers` | foundation | `customers` | `schema-erp-core.ts` | `erp/customers.ts` | `src/features/erp/customers/` |
| `customer-links` | foundation | `customer_links` | `schema-erp-core.ts` | `erp/customer-links.ts` | `src/features/erp/customer-links/`, route `(public)` |
| `hub` | `project-hub` | (เพิ่มคอลัมน์ใน `projects`) | `schema.ts` | `erp/hub.ts` | `src/features/erp/hub/` |
| `boq-control` | `boq-control` | `boq_*`, `project_baselines`, `project_cost_codes` | `schema-boq-control.ts` | `erp/boq-control.ts` | `src/features/erp/boq-control/` |
| `ledger` | foundation | `cost_ledger_entries`, `fin_events` | `schema-ledger.ts` | `erp/ledger.ts` | — |
| `price-reference` | foundation (ใช้ใน `quotations`/BOQ) | `price_reference_*` | `schema-erp-core.ts` | `erp/price-reference.ts` | `src/features/erp/price-reference/` |
| `quotations` | `quotations` | `qt_` | `schema-quotations.ts` | `erp/quotations.ts` | `src/features/erp/quotations/` |
| `main-contracts` | `contracts` | `mc_` | `schema-contracts-billing.ts` | `erp/main-contracts.ts` | `src/features/erp/contracts/` |
| `billing` | `billing` | `ar_` | `schema-contracts-billing.ts` | `erp/billing.ts` | `src/features/erp/billing/` |
| `variations` | `variations` | `vo_` | `schema-variations.ts` | `erp/variations.ts` | `src/features/erp/variations/` |
| `portal` | `portal` | (ไม่มีตาราง) | — | `erp/portal.ts` | `src/features/erp/portal/` |
| `suppliers` | `procurement` | `sup_` | `schema-procurement.ts` | `erp/suppliers.ts` | `src/features/erp/suppliers/` |
| `procurement` | `procurement` | `pc_` | `schema-procurement.ts` | `erp/procurement.ts` | `src/features/erp/procurement/` |
| `site-diary` | `site-diary` | `sd_` | `schema-site.ts` | `erp/site-diary.ts` | `src/features/erp/site-diary/` |
| `labour` | `labour` | `lb_` | `schema-site.ts` | `erp/labour.ts` | `src/features/erp/labour/` |
| `job-cost` | `job-cost` | `jc_` | `schema-job-cost.ts` | `erp/job-cost.ts` | `src/features/erp/job-cost/` |
| `payables` | `payables` | `ap_` | `schema-payables.ts` | `erp/payables.ts`, `erp/tax-reports.ts` | `src/features/erp/payables/`, `src/features/erp/tax-reports/` |
| `handover` | `handover` | `ho_` | `schema-handover.ts` | `erp/handover.ts` | `src/features/erp/handover/` |

หมายเหตุ
- ไฟล์ schema แต่ละไฟล์ export วัตถุกลุ่มตาราง (`erpCoreTables`, `boqControlTables`, `ledgerTables`, `quotationTables`, `contractsBillingTables`, `variationTables`, `procurementTables`, `siteTables`, `jobCostTables`, `payablesTables`, `handoverTables`)
  แล้ว merge ใน `database.ts` และลงรายการใน `drizzle.config.ts`
- **ไฟล์ schema ห้าม import ไฟล์ schema ของ stream อื่น** (กฎใน `database.ts`) ยกเว้น `schema.ts` (core) และ `schema-helpers.ts`
  ผลคือ FK ข้ามไฟล์ทำได้เฉพาะไปยัง `projects`, `workspaces`, `users` เท่านั้น id ข้ามโมดูลอื่น (เช่น `cost_code_id`, `customer_id`, `supplier_id`)
  **ไม่มี FK** และ use case ต้องตรวจผ่าน port (เช่น `CostCodeLookup`, `CustomerLookup`)
- WP-03 สร้าง `backend/src/shared/infrastructure/database/schema-helpers.ts` ที่ export:
  `createdAt()`, `updatedAt()`, `money(name)` = `numeric(name,{precision:14,scale:2,mode:'number'})`,
  `quantity(name)` = `numeric(16,4)`, `unitPrice(name)` = `numeric(16,4)`, `rate(name)` = `numeric(7,6)` (เศษส่วน 0.05 = 5%),
  `businessDate(name)` = `date(name,{mode:'string'})` และ `projectTenantFk(table, t)` (composite FK `(project_id, workspace_id) → projects(id, workspace_id)` ชื่อ `<table>_project_tenant_fk` on delete cascade)

### 1.3 การเข้าถึง (access) แบบเดียวทุกโมดูล ERP

WP-03 สร้าง `backend/src/shared/application/module-access.ts`:

```ts
@Injectable()
export class ModuleAccess {
    constructor(workspaces: WorkspaceAccess, projects: ProjectStatusLookup, flags: ModuleFlags, members: WorkspaceDirectory) {}
    /** not_found (ไม่ใช่สมาชิก) → module_disabled (โมดูลไม่ active) → forbidden (ไม่มีสิทธิ์) ตามลำดับนี้เสมอ */
    inWorkspace(userId: UserId, workspaceId: WorkspaceId, module: ModuleId, ...permissions: Permission[]): Promise<Result<WorkspaceGrant, DomainError>>;
    /** เหมือนกันแต่เริ่มจาก project; write=true และโครงการ archived → conflict 'project_archived' */
    toProject(userId: UserId, projectId: ProjectId, module: ModuleId, opts: { permissions: Permission[]; write: boolean }): Promise<Result<ProjectGrant, DomainError>>;
}
export interface WorkspaceGrant { workspaceId: WorkspaceId; role: Role; memberCount: number }
export interface ProjectGrant extends WorkspaceGrant { projectId: ProjectId; archived: boolean }
```

- ให้บริการ (provide + export) จาก `PlatformModule`
- `memberCount` ใช้ตัดสิน "ทำงานคนเดียว" ในหน้าจอ (ซ่อนปุ่มส่งอนุมัติ) แต่ **การข้ามอนุมัติจริงตัดสินใน `approvals` เสมอ**
- โมดูลที่ต้องการกฎเพิ่ม (เช่นซ่อนราคา) ห่อ `ModuleAccess` ด้วยคลาส `<Module>Access` ของตัวเองได้

### 1.4 รูปแบบ controller

```ts
@Controller('projects/:projectId/quotations')
@RequiresModule('quotations')                      // ชั้น release; ชั้นอื่นตรวจใน use case ผ่าน ModuleAccess
export class ProjectQuotationsController {
    constructor(private readonly create: CreateQuotationUseCase) {}
    @Post()
    async createOne(@CurrentUser() user: AuthenticatedUser, @Param('projectId') raw: string,
        @Body(new ZodPipe(createQuotationRequestSchema)) body: CreateQuotationRequest): Promise<QuotationDto> {
        const projectId = unwrap(parseId<'ProjectId'>(raw, 'Project'));
        return unwrap(await this.create.execute({ userId: user.userId, projectId, ...body }));
    }
}
```

เส้นทาง URL: ข้อมูลระดับ workspace ใช้ `workspaces/:workspaceId/<resource>`, ข้อมูลระดับโครงการใช้ `projects/:projectId/<resource>`,
การกระทำกับเอกสารใช้ `<resource>/:id/<verb>` (เช่น `POST quotations/:quotationId/issue`) ลิงก์สาธารณะใช้ `public/links/:token`

### 1.5 Error codes

ใช้รหัสเดิมให้มากที่สุด: `validation_failed`, `not_found`, `forbidden`, `conflict` (พร้อม `details.reason`), `unprocessable`, `module_disabled`
ห้ามเพิ่ม `ErrorCode` ใหม่ ถ้าไม่จำเป็นจริง ความหมายเฉพาะให้ใส่ใน `details.reason` แบบ snake_case เช่น:
`baseline_locked`, `already_issued`, `invalid_transition`, `missing_dependencies`, `not_entitled`, `has_dependents`,
`over_budget`, `document_issued_exists`, `period_has_documents`, `project_archived`
frontend แปล `details.reason` เป็นข้อความผ่าน namespace `errors.reasons.<reason>` (ดู `03-i18n.md`)

---

## 2. Contract package

- ไฟล์ contract ของ ERP อยู่ที่ `src/shared/contract/erp/<file>.ts` และ export รวมที่ `src/shared/contract/erp/index.ts`
  ซึ่ง root `src/shared/contract/index.ts` เพิ่มบรรทัด `export * from './erp';` (ทำใน WP-03)
- `src/shared/contract/erp/common.ts` (WP-03) มี schema พื้นฐาน **ชื่อใหม่** เพื่อไม่ชนกับ `subcontracting/common.ts` ที่ export `moneySchema`, `qtySchema`, `fractionSchema`, `dateSchema` อยู่แล้ว:

```ts
export const amountSchema = z.number().finite().min(0).max(1e11);            // เงินบาท 2 ตำแหน่ง (ค่าบวก)
export const signedAmountSchema = z.number().finite().min(-1e11).max(1e11);  // เงินที่ติดลบได้ (VO ลดงาน)
export const quantitySchema = z.number().finite().min(-1e9).max(1e9);        // 4 ตำแหน่ง
export const unitPriceSchema = z.number().finite().min(0).max(1e9);          // 4 ตำแหน่ง
export const rateSchema = z.number().finite().min(0).max(1);                 // เศษส่วน 0.07 = 7%
export const businessDateSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
export const docLanguageSchema = z.enum(['th', 'en']);
export const cursorQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50), before: z.string().optional() });
```

- **ชื่อที่ export ต้องไม่ชนของเดิม** ใช้ชื่อโมดูลนำหน้าทุกชื่อ (`quotationDtoSchema`, `progressClaimDtoSchema`, `variationOrderDtoSchema`, `mainContractDtoSchema`)
  ก่อนเพิ่มชื่อใหม่ให้รัน `grep -rn "export const <name>" src/shared/contract` ก่อนเสมอ (subcontracting มี `claimDtoSchema`, `variationDtoSchema`, `installmentSchema`, `penaltySchema` แล้ว)
- DTO วันที่: timestamp ใช้ `isoDateTimeSchema`, วันที่ทางธุรกิจ (วันที่เอกสาร วันครบกำหนด) ใช้ `businessDateSchema`
- request: `<verb><Thing>RequestSchema` เช่น `createQuotationRequestSchema`; query: `<thing>ListQuerySchema` ใช้ `z.coerce`
- enum: ประกาศเป็น `as const` array + `z.enum` เช่น `QUOTATION_STATUSES` / `quotationStatusSchema` / `type QuotationStatus`

---

## 3. Frontend: feature, route, เมนู

### 3.1 โฟลเดอร์

```
src/features/erp/
  shared/                 UI kit กลางของ ERP (WP-06; picker เฉพาะโมดูลเพิ่มทีหลัง): ErpPage, PageHeader, SectionCard, StatusTag, MoneyText, QtyText, DateText,
                          DocumentNumberTag, EmptyState, ConfirmAction, CustomerPicker, CostCodePicker, FileAttachments,
                          PrintFrame, useActiveModules, useErpWorkspace, apiPaths
  hub/  portal/  company/  customers/  numbering/  approvals/  customer-links/  boq-control/  price-reference/
  quotations/  contracts/  billing/  variations/  suppliers/  procurement/  site-diary/  labour/  job-cost/
  payables/  tax-reports/  handover/  admin/
```

ในแต่ละโฟลเดอร์: `api.ts` (เรียก `apiClient.request(method, path, {schema, body, query})` จาก `src/features/cloud/api/client`),
`hooks.ts` (react-query + key factory `<module>Keys` + `invalidateQueries` ใน `onSuccess`), `logic.ts` (pure), หน้าจอ `XxxPage.tsx`

### 3.2 Route (App Router)

| route | ไฟล์ page | ModuleId ที่ต้อง active |
|---|---|---|
| `/` | `src/app/page.tsx` → `<CloudProviders><HomeRedirect/></CloudProviders>` (client) | — : ลำดับตัดสิน (WP-16): (1) `GET /platform/modules` ไม่มี `project-hub` → `router.replace('/journey')` ทันที (release 1); (2) ไม่ได้ล็อกอิน/guest → `/journey`; (3) `portal` active → `/home`; (4) `project-hub` active → `/hub`; (5) อื่น ๆ → `/journey`. ระหว่างรอแสดง spinner เท่านั้น |
| `/hub` | `src/app/(app)/hub/page.tsx` | `project-hub` |
| `/home` | `src/app/(app)/home/page.tsx` | `portal` |
| `/p/[projectId]` (+ `layout.tsx` = `ProjectShell`) | `src/app/(app)/p/[projectId]/page.tsx` | `project-hub` |
| `/p/[projectId]/versions` | ประวัติ BOQ เทียบฉบับ baseline | `boq-control` |
| `/p/[projectId]/quotations`, `/p/[projectId]/quotations/[quotationId]` | | `quotations` |
| `/p/[projectId]/contract` | | `contracts` |
| `/p/[projectId]/billing`, `/p/[projectId]/billing/claims/[claimId]` | | `billing` |
| `/p/[projectId]/variations`, `/p/[projectId]/variations/[variationId]` | | `variations` |
| `/p/[projectId]/procurement` (แท็บ PR/RFQ/PO/รับของ), `/p/[projectId]/procurement/rfqs/[rfqId]`, `/p/[projectId]/procurement/orders/[orderId]` | | `procurement` |
| `/p/[projectId]/diary`, `/p/[projectId]/diary/[date]` | | `site-diary` |
| `/p/[projectId]/labour` | | `labour` |
| `/p/[projectId]/cost` | | `job-cost` |
| `/p/[projectId]/handover` | ส่งมอบ รับประกัน ปิดโครงการ | `handover` |
| `/customers`, `/customers/[customerId]` | | `project-hub` |
| `/receivables` | ลูกหนี้ข้ามโครงการ + aging | `billing` |
| `/purchasing` (PO ข้ามโครงการ), `/suppliers`, `/suppliers/[supplierId]` | | `procurement` |
| `/payables`, `/payables/runs/[runId]` | | `payables` |
| `/workspace/pay-periods` | งวดค่าแรงทั้งบริษัท | `labour` |
| `/tax-reports` | | `payables` |
| `/finance/cashflow` | กระแสเงินสดข้ามโครงการ | `job-cost` |
| `/approvals` | กล่องงานรออนุมัติ | `project-hub` |
| `/workspace/company`, `/workspace/numbering`, `/workspace/approval-policies` | ตั้งค่าบริษัท | `project-hub` |
| `/admin/entitlements` | platform admin เท่านั้น | — (ตรวจ `GET /platform/admin/status`) |
| `/c/[token]` | `src/app/(public)/c/[token]/page.tsx` (layout เบา ไม่มีเมนู) | — (ตรวจที่ backend) |
| `/print/<doc>/[id]` | `src/app/(print)/print/<doc>/[id]/page.tsx` (`<doc>` = `quotation`, `contract`, `claim`, `invoice`, `receipt`, `variation`, `purchase-order`, `rfq`, `pay-period`, `wht-certificate`, `payment-voucher`, `handover`, `closeout`) | ตาม doc |

- route group ใหม่ `(public)` และ `(print)` มี `layout.tsx` ของตัวเอง: `(print)` = `<CloudProviders>` + กรอบ A4 ไม่มีเมนู (WP-06);
  `(public)` = antd ConfigProvider เบา ๆ + `QueryClientProvider` ของตัวเอง **ไม่ใช้** `CloudProviders`/session (ลูกค้าไม่ต้องล็อกอิน เรียก API ด้วย `auth: false`) (WP-14)
- หน้า ERP ทุกหน้าครอบด้วย `<ModuleGate module="<id>" next="<path>">` (ปรับใน WP-04 ให้เช็ค `active`)
- หน้าในโครงการ **ไม่ต้อง** เปิดโครงการเข้า project store: ใช้ `projectId` จาก URL เรียก API ตรง
  ยกเว้นแท็บ "BOQ" ใน `ProjectShell` ที่เรียก `openCloudProject(queryClient, projectId)` (`src/features/cloud/projects/controller.ts`) แล้วไป `/boq`
- Hub เป็น **cloud เท่านั้น** โหมด guest ใช้ `/journey` แบบเดิม

### 3.3 Nav registry (สร้างใน WP-06, ต่อเข้า `AppLayoutUI` ใน WP-16)

`src/features/erp/hub/nav-registry.ts` คือที่เดียวที่ประกาศเมนู ERP (WP-06 สร้าง type, hook และกลุ่มว่าง; แต่ละ WP ที่มีหน้าจอเพิ่มรายการของตัวเอง):

```ts
export interface ErpNavItem {
    key: string;                       // ใช้เป็น activeKey ของ antd Menu
    labelKey: string;                  // คีย์ใน namespace 'nav' เช่น 'nav.receivables'
    href: string;                      // หรือ (projectId: string) => string สำหรับแท็บโครงการ
    module?: ModuleId;                 // ต้อง active
    anyModule?: readonly ModuleId[];   // active อย่างน้อยหนึ่งตัว
    permission?: Permission;           // can(role, permission)
    match: (pathname: string) => boolean;
}
export const WORKSPACE_NAV: readonly { groupKey: string; items: readonly ErpNavItem[] }[];
export const PROJECT_TABS: readonly (Omit<ErpNavItem, 'href'> & { href: (projectId: string) => string })[];
export function useWorkspaceNav(): AntdMenuItem[];       // กรองด้วย useActiveModules() + can()
export function useProjectTabs(projectId: string): ...;
```

เมนูบนสุดใน `AppLayoutUI.tsx` (WP-16 ต่อ registry เข้าเมนู):
- เมื่อ `project-hub` **ไม่** active: เมนูเดิมทุกประการ (journey, boq, man-day, schedule, cashflow, subcontracting, vendor)
- เมื่อ active: `home` (ไป `/home` ถ้า `portal` active ไม่งั้น `/hub`), `projects` (`/hub`), กลุ่ม `boq` (submenu: journey, boq, man-day, schedule, cashflow ของโครงการที่เปิดอยู่),
  `sales` (customers, receivables), `purchasing` (purchasing, suppliers), `finance` (payables, pay-periods, cashflow บริษัท, tax-reports), `subcontracting`, `vendor`,
  `settings` (approvals inbox, company, numbering, approval-policies, modules; admin/entitlements เฉพาะ platform admin) — กลุ่มที่ไม่มีรายการผ่านการกรองไม่แสดง
  ตามด้วยรายการจาก `WORKSPACE_NAV` ที่ผ่านการกรอง `activeKey` คำนวณจาก `match()` ของ registry ก่อน แล้วค่อย if/else เดิม
- แท็บใน `ProjectShell`: overview, boq, versions, quotations, contract, billing, variations, procurement, diary, labour, cost, handover

### 3.4 การตรวจ flag ฝั่งเว็บ

- `src/features/modules/modules.ts` (WP-04): `useModuleEnabled(module)` อ่าน `active` จาก DTO ใหม่ (§4.4) แทน `enabled`
  และเพิ่ม `useActiveModules(workspaceId?)` คืน `ReadonlySet<ModuleId>`
- ใช้กับทุกจุดเข้า: เมนู, แท็บ, ปุ่มลัด, การ์ด Portal, NotificationBell
- ปิดโมดูล = ซ่อน ไม่มีข้อมูลหาย

---

## 4. Module registry และ flag 4 ชั้น

### 4.1 ModuleId

`src/shared/contract/modules.ts` (WP-03) ขยาย `MODULE_IDS` **โดยเติมต่อท้าย** (ห้ามเรียงใหม่):

```ts
export const MODULE_IDS = [
    'subcontracting', 'materials', 'owner-leads', 'ai-assist', 'workforce',            // เดิม
    'project-hub', 'portal', 'boq-control', 'quotations', 'contracts', 'billing', 'variations',
    'procurement', 'site-diary', 'labour', 'job-cost', 'payables', 'handover',          // ERP
] as const;
```

`MODULE_LABEL` (ไทย) ยังคงไว้เพื่อความเข้ากันได้ (backend และ `ModuleGate` เดิมใช้) แต่หน้าจอใหม่ใช้ข้อความจาก namespace `modules` (`modules.<id>.label`, `modules.<id>.hint`)

### 4.2 Registry

ไฟล์ใหม่ `src/shared/contract/module-registry.ts` (WP-03) ใช้ทั้ง backend และเว็บ:

```ts
export interface ModuleDef {
    id: ModuleId;
    kind: 'legacy' | 'erp';
    /** ต้อง active ก่อนจึงเปิดตัวนี้ได้ (ตรง ๆ ไม่รวม transitive) */
    dependsOn: readonly ModuleId[];
    /** 'none' = ไม่ต้องมี entitlement (โมดูลเดิม) */
    entitlement: 'none' | 'required';
    /** 0 = ทดลองเองไม่ได้ */
    trialDays: number;
}
export const MODULE_REGISTRY: Readonly<Record<ModuleId, ModuleDef>>;
export function dependencyClosure(id: ModuleId): ModuleId[];   // transitive, ไม่รวมตัวเอง, เรียงจากรากก่อน
export function dependentsOf(id: ModuleId): ModuleId[];        // ตัวที่พึ่งพา id (transitive)
```

| id | kind | dependsOn | entitlement | trialDays |
|---|---|---|---|---|
| `subcontracting` | legacy | — | none | 0 |
| `materials` | legacy | — | none | 0 |
| `owner-leads` | legacy | — | none | 0 |
| `ai-assist` | legacy | — | none | 0 |
| `workforce` | legacy | — | none | 0 |
| `project-hub` | erp | — | required | 30 |
| `portal` | erp | `project-hub` | required | 30 |
| `boq-control` | erp | `project-hub` | required | 30 |
| `quotations` | erp | `boq-control` | required | 30 |
| `contracts` | erp | `boq-control` | required | 30 |
| `billing` | erp | `contracts` | required | 30 |
| `variations` | erp | `contracts` | required | 30 |
| `procurement` | erp | `boq-control` | required | 30 |
| `site-diary` | erp | `boq-control` | required | 30 |
| `labour` | erp | `site-diary`, `workforce` | required | 30 |
| `job-cost` | erp | `boq-control` | required | 30 |
| `payables` | erp | `project-hub` | required | 30 |
| `handover` | erp | `contracts` | required | 30 |

`quotations` พึ่ง `boq-control` เพราะสร้างจาก `boq_version_lines` (ซึ่งเกิดเฉพาะเมื่อ `boq-control` active)

foundation (ลูกค้า บริษัท เลขเอกสาร อนุมัติ audit ลิงก์ลูกค้า ราคากลาง) ไม่มี ModuleId ของตัวเอง: endpoint ของ foundation ตรวจ `project-hub`
(ทุกโมดูล ERP พึ่ง `project-hub` แบบ transitive) ยกเว้น endpoint ภายในที่เรียกจากโมดูลอื่นผ่าน port ซึ่งไม่มี HTTP

### 4.3 สี่ชั้น

```
active(ws, m) = release(m)                      // ชั้น 1: env MODULES_ENABLED มี m
             && entitled(ws, m, now)            // ชั้น 2: registry.entitlement = 'none' หรือ ENTITLEMENTS=open หรือมีสิทธิ์ใช้ที่ยังไม่หมดอายุ
             && toggled(ws, m)                  // ชั้น 3: workspace_modules.enabled = true
             && dependsOn(m).every(d => active(ws, d))
allowed(user, ws, m, perm) = active(ws, m) && can(role, perm)   // ชั้น 4
```

- `entitled`: แถว `workspace_entitlements` ที่ `status in ('purchased','trial','beta')` และ (`expires_at` เป็น null หรือ > now)
- env ใหม่ใน `backend/src/shared/infrastructure/config/env.ts`:
  - `ENTITLEMENTS`: `'enforce' | 'open'` ค่าเริ่มต้น `'enforce'` เมื่อ `NODE_ENV=production`, ไม่งั้น `'open'`
  - `PLATFORM_ADMIN_EMAILS`: รายการอีเมลคั่นด้วยจุลภาค (ตัวพิมพ์เล็ก) ค่าเริ่มต้นว่าง
  - `testEnv()` ใส่ ModuleId ทั้งหมดใน `MODULES_ENABLED` และ `ENTITLEMENTS: 'open'`
- `ModuleFlags.isEnabled(ws, m)` (port เดิม) คืน `active` ตามสูตรข้างบน (`RepositoryModuleFlags` ใช้ cache เดิมสำหรับ toggle และ cache entitlement ด้วยอายุเท่ากัน)
  `platformEnabled(m)` คงเดิม (ชั้น 1)
- `ModuleGuard` / `@RequiresModule` คงเดิม (ชั้น 1)

### 4.4 ตารางและ API

ตาราง (ใน `schema-platform.ts`, WP-03):

```
workspace_entitlements
  workspace_id uuid FK workspaces cascade, module text, status text check in ('purchased','trial','beta','revoked'),
  starts_at timestamptz not null, expires_at timestamptz null, trial_used_at timestamptz null,
  granted_by uuid null, note text not null default '', updated_at timestamptz not null default now()
  PK (workspace_id, module)
```

`workspace_modules` เดิมไม่เปลี่ยนโครงสร้าง

DTO ใหม่ (แทน `workspaceModuleDtoSchema` เดิม โดยคงฟิลด์เดิมทุกตัว):

```ts
workspaceModuleDtoSchema = z.object({
    module: moduleIdSchema,
    available: z.boolean(),                  // ชั้น 1 (เดิม)
    enabled: z.boolean(),                    // ชั้น 3 toggle (เดิม)
    enabledAt: isoDateTimeSchema.nullable(), // เดิม
    entitlement: z.object({
        status: z.enum(['not_required', 'none', 'purchased', 'trial', 'beta', 'expired', 'revoked']),
        expiresAt: isoDateTimeSchema.nullable(),
    }),
    active: z.boolean(),                     // ผลรวม 4 ชั้น (ไม่รวมสิทธิ์บทบาท)
    missingDependencies: z.array(moduleIdSchema), // ตัวที่ยังไม่ active ใน dependencyClosure
    trialAvailable: z.boolean(),             // trialDays > 0 และ trial_used_at เป็น null และยังไม่มีสิทธิ์
});
```

| Method / path | สิทธิ์ | พฤติกรรม |
|---|---|---|
| `GET /platform/modules` (public, เดิม) | — | `{modules}` ชั้น 1 |
| `GET /workspaces/:workspaceId/modules` (เดิม) | สมาชิก | DTO ใหม่ เรียงตาม `MODULE_IDS` |
| `PUT /workspaces/:workspaceId/modules/:module` (เดิม) `{enabled, confirm?}` | `modules.manage` | เปิด: ต้อง release (ไม่งั้น `unprocessable`), entitled (ไม่งั้น `unprocessable` + `reason:'not_entitled'`), dependency active ครบ (ไม่งั้น `unprocessable` + `reason:'missing_dependencies', missing:[...]`) · ปิด: ถ้ามีตัวที่พึ่งพาเปิดอยู่หรือมีงานค้าง และไม่ได้ส่ง `confirm:true` → 409 `conflict` details `{reason:'has_dependents', dependents:[...], work:{...}}`; ถ้า `confirm:true` ปิดตัวที่พึ่งพาทั้งหมดด้วย (cascade) |
| `POST /workspaces/:workspaceId/modules/:module/trial` (ใหม่) | `modules.manage` | เริ่มทดลอง `trialDays` วัน ครั้งเดียวต่อโมดูลต่อ workspace (ตั้ง `trial_used_at`) เปิด toggle ให้ด้วย และเริ่มทดลอง dependency ที่ยังไม่มีสิทธิ์ไปพร้อมกัน |
| `GET /platform/admin/status` (ใหม่) | ล็อกอิน | `{admin: boolean}` |
| `GET /platform/admin/workspaces?q=&limit=` (ใหม่) | platform admin | `{id, name, kind, memberCount, createdAt, entitlements[]}` |
| `PUT /platform/admin/workspaces/:workspaceId/entitlements/:module` (ใหม่) `{status, expiresAt?, note?}` | platform admin | ตั้งสิทธิ์ บันทึก `audit_events` |

- platform admin = ผู้ใช้ที่อีเมลอยู่ใน `PLATFORM_ADMIN_EMAILS` ตรวจผ่าน `UserDirectory.findMany([userId])` (identity) ใน `PlatformAdminAccess` (`modules/platform/application/platform-admin-access.ts`) ไม่ใช่ admin → `not_found` — สร้างใน **WP-07** (endpoint `/platform/admin/*` ทั้งหมดอยู่ใน WP-07 ไม่ใช่ WP-03)
- **`ModuleUsage` เปลี่ยนเป็น registry** `ModuleWorkRegistry` ใน `ports.ts` (§11) คืน `Record<string, number>` ต่อโมดูล
  subcontracting ลงทะเบียน `{activeSubcontracts}` ใน `onModuleInit` (แทน provider `ModuleUsage` เดิมใน `contracts.parts.ts`; ลบ `ModuleUsage` ออกจาก `ports.ts` และแก้ `FakeModuleUsage`/`RepositoryModuleUsage` ใน test kit ให้ใช้ registry)
  `moduleOffBlockersSchema` เปลี่ยนเป็น `{ reason: z.string(), dependents: z.array(moduleIdSchema), work: z.record(z.string(), z.number().int().nonnegative()), activeSubcontracts: z.number().int().nonnegative().optional() }`
  (คง `activeSubcontracts` ไว้ให้หน้าเดิมอ่านได้)
- หมดอายุ trial: ไม่ต้องมี job ใดๆ เพราะ `entitled` ดูเวลาปัจจุบันเสมอ แจ้งเตือน `trial.expiring` 3 วันก่อนหมดผ่าน sweep รายวันใน platform (WP-10)

### 4.5 Release 1 ซ่อนทุกอย่างยกเว้น BOQ อย่างไร

- production: `MODULES_ENABLED` ไม่มี ModuleId ของ ERP → `active` เป็น false ทุกตัว
- เว็บ: `HomeRedirect` ส่งไป `/journey`; `AppLayoutUI` แสดงเมนูเดิม; ทุกหน้า ERP แสดง `ModuleGate` (ปิดอยู่); Notification bell ทำงานแบบเดิม
- หน้า `/workspace/modules`: โมดูล `kind:'erp'` ที่ `available=false` **ไม่แสดงเลย** (ไม่โชว์ป้าย "ยังไม่เปิดให้บริการ") ส่วนโมดูล legacy แสดงเหมือนเดิมทุกประการ (WP-04)
- หน้าสมาชิก: บทบาทใหม่ (`pm`, `purchasing`, `accounting`, `foreman`) แสดงในตัวเลือกบทบาทเฉพาะเมื่อ `project-hub` active (backend รับได้เสมอ) (WP-05)
- ปุ่มสลับภาษาไม่แสดง (D-16); `users.locale` และ `PATCH /me/preferences` มีอยู่แต่ไม่มีผลกับหน้าจอเดิม
- backend: controller ทุกตัวของ ERP มี `@RequiresModule(<id>)` → 404 `module_disabled` แม้ยังไม่ล็อกอิน
- hook เข้าโค้ดเดิมทุกจุด (PutDoc ที่เช็ค baseline, CreateRevision ที่เก็บบรรทัด BOQ, DeleteProject/DeleteWorkspace ที่เช็คเอกสาร) ต้อง **ไม่มีผลเมื่อโมดูลไม่ active** (guard การลบเป็นข้อยกเว้นเดียว: เอกสารภาษีที่ออกเลขแล้วกันการลบเสมอแม้โมดูลถูกปิดภายหลัง — ใน release 1 ไม่มีเอกสารเช่นนี้)
  (baseline ล็อกได้เฉพาะตอนโมดูล active ดังนั้นโครงการที่ไม่มี baseline ไม่ถูกกระทบ)

---

## 5. บทบาทและสิทธิ์

### 5.1 บทบาท

`ROLES` ใน `src/shared/contract/common.ts` (WP-05) ขยายเป็น
`['owner', 'admin', 'estimator', 'viewer', 'pm', 'purchasing', 'accounting', 'foreman']` (เติมต่อท้าย)

| id | ชื่อที่แสดง TH / EN | rank | หมายเหตุ |
|---|---|---|---|
| `owner` | เจ้าของ / Owner | 3 | ทุกอย่าง |
| `admin` | ผู้ช่วยเจ้าของ / Assistant | 2 | = "assistant" ในการตัดสินใจของเจ้าของ (ไม่เปลี่ยน id เพื่อไม่กระทบข้อมูลเดิม) ทุกอย่างยกเว้น `workspace.delete` |
| `estimator` | ผู้ประมาณราคา / Estimator | 1 | เดิม |
| `pm` | ผู้จัดการโครงการ / Project manager | 1 | ใหม่ |
| `purchasing` | จัดซื้อ / Purchasing | 1 | ใหม่ |
| `accounting` | บัญชี-การเงิน / Accounting | 1 | ใหม่ |
| `foreman` | โฟร์แมน / Foreman | 1 | ใหม่ (ผู้ใช้หน้างาน) |
| `viewer` | ผู้ดู / Viewer | 0 | อ่านอย่างเดียว ไม่เห็นกำไร/ต้นทุน |

ต้องแก้: check constraint `memberships_role_check` และ `invitations_role_check` (migration), `assignableRoleSchema`, `roleRank` (switch ครบทุกตัว),
`MATRIX` ทั้ง backend และเว็บ, ป้ายชื่อบทบาทใน namespace `roles` และ `ROLE_LABEL` เดิมใน `src/features/cloud/permissions.ts` (ไทย ใช้ในหน้าเดิม),
ทุก `Record<Role, …>` / `switch (role)` ที่ต้องครบ (`grep -rn "Record<Role" src backend/src`), `isReadOnly` ใน `src/store/project-store.ts` (ตอนนี้เช็คแค่ `role === 'viewer'` → เปลี่ยนเป็น `!can(role, 'projects.edit')` เพราะ `purchasing`/`accounting`/`foreman` ไม่มีสิทธิ์แก้ BOQ),
หน้าสมาชิก (เลือกบทบาทได้ทุกตัวยกเว้น owner; บทบาทใหม่แสดงเฉพาะเมื่อ `project-hub` active)
ผู้รับเหมาช่วงไม่ใช่บทบาทเหล่านี้: ใช้ vendor portal เดิม

### 5.2 Permission ใหม่ (ประกาศครบใน WP-05 ทีเดียว แม้โมดูลยังไม่ถูกสร้าง)

```
company.read | company.manage                       (โปรไฟล์บริษัท ชุดเลขเอกสาร นโยบายอนุมัติ)
customers.read | customers.manage
boq.baseline.lock | boq.baseline.unlock
quotations.read | quotations.manage | quotations.issue | quotations.seeMargins
contracts.read | contracts.manage
billing.read | billing.manage | billing.receive     (receive = บันทึกรับเงิน ออกใบกำกับภาษี/ใบเสร็จ)
variations.read | variations.manage
procurement.read | procurement.request | procurement.manage | procurement.receive
suppliers.read | suppliers.manage
site.read | site.report
labour.read | labour.record | labour.pay
cost.read | cost.manage                             (cost.read = เห็นงบ ต้นทุนจริง กำไร)
payables.read | payables.manage | payables.pay
tax.reports
handover.read | handover.manage
audit.read
```

### 5.3 Matrix (✓ = มีสิทธิ์) — owner และ admin มีทุกตัว (admin ไม่มี `workspace.delete` เหมือนเดิม)

| permission | estimator | pm | purchasing | accounting | foreman | viewer |
|---|---|---|---|---|---|---|
| company.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| company.manage | | | | | | |
| customers.read | ✓ | ✓ | ✓ | ✓ | | ✓ |
| customers.manage | ✓ | ✓ | | ✓ | | |
| boq.baseline.lock | | ✓ | | | | |
| boq.baseline.unlock | | | | | | |
| quotations.read | ✓ | ✓ | | ✓ | | ✓ |
| quotations.manage / issue | ✓ | ✓ | | | | |
| quotations.seeMargins | ✓ | ✓ | | ✓ | | |
| contracts.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| contracts.manage | | ✓ | | ✓ | | |
| billing.read | ✓ | ✓ | | ✓ | | ✓ |
| billing.manage | | ✓ | | ✓ | | |
| billing.receive | | | | ✓ | | |
| variations.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| variations.manage | ✓ | ✓ | | | | |
| procurement.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| procurement.request | ✓ | ✓ | ✓ | | ✓ | |
| procurement.manage | | ✓ | ✓ | | | |
| procurement.receive | | ✓ | ✓ | | ✓ | |
| suppliers.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| suppliers.manage | | ✓ | ✓ | ✓ | | |
| site.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| site.report | | ✓ | | | ✓ | |
| labour.read | ✓ | ✓ | | ✓ | ✓ | ✓ |
| labour.record | | ✓ | | | ✓ | |
| labour.pay | | | | ✓ | | |
| cost.read | ✓ | ✓ | ✓ | ✓ | | |
| cost.manage | | ✓ | | | | |
| payables.read | | ✓ | ✓ | ✓ | | |
| payables.manage | | | | ✓ | | |
| payables.pay | | | | ✓ | | |
| tax.reports | | | | ✓ | | |
| handover.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| handover.manage | | ✓ | | | ✓ | |
| audit.read | | ✓ | | ✓ | | |

สิทธิ์เดิมของบทบาทใหม่:
- `pm`: เหมือน estimator + `levels.assign`, `sc.award`, `sc.claims.approve`, `workforce.manage`
- `purchasing`: `workspace.read`, `members.read`, `projects.read`, `sc.read`, `sc.readPrices`, `sc.vendors.manage`, `rateCards.read`, `workforce.read`, `vendor.read`
- `accounting`: `workspace.read`, `members.read`, `projects.read`, `sc.read`, `sc.readPrices`, `sc.payments.record`, `rateCards.read`, `workforce.read`, `workforce.seeWages`, `workforce.seeCrewCost`, `vendor.read`
- `foreman`: `workspace.read`, `members.read`, `projects.read`, `sc.read`, `sc.claims.inspect`, `rateCards.read`, `workforce.read`, `workforce.assign`, `vendor.read`

WP-05 ทำให้ `src/features/cloud/permissions.ts` **ตรงกับ backend ทุกตัว** (รวม `rateCards.*`, `workforce.*` ที่ตกหล่นอยู่)
แนะนำให้ย้าย matrix ไปที่ `src/shared/contract/permissions.ts` ที่เดียว แล้วให้ทั้งสองฝั่ง re-export (ลดการคัดลอก) — WP-05 ตัดสินและบันทึก

---

## 6. Workflow อนุมัติ (generic, ข้ามเองเมื่อทำคนเดียว)

โมดูล `backend/src/modules/approvals/` (WP-08) ตาราง `approval_policies`, `approval_requests`, `approval_steps` (ดู `02-domain-model.md` §1.4)

### 6.1 Subject

`APPROVAL_SUBJECTS` ใน `src/shared/contract/erp/approvals.ts`:

| subject | ใครขอ | ค่าเริ่มต้นนโยบาย | ผู้อนุมัติเริ่มต้น |
|---|---|---|---|
| `quotation.issue` | quotations | ปิด | owner, admin |
| `claim.submit` | billing (ส่งเบิกลูกค้า) | ปิด | owner, admin, pm |
| `variation.submit` | variations (ส่งให้ลูกค้า) | ปิด | owner, admin, pm |
| `purchase_request.approve` | procurement | เปิด | owner, admin, pm, purchasing |
| `purchase_order.issue` | procurement | เปิด, `minAmount` 50,000 | owner, admin, pm |
| `supplier_bill.approve` | payables | ปิด | owner, admin, accounting |
| `payment_run.approve` | payables | เปิด | owner, admin |
| `timesheet.approve` | labour | ปิด | owner, admin, pm |
| `pay_period.approve` | labour | เปิด | owner, admin, accounting |

### 6.2 Port

```ts
// backend/src/shared/application/ports.ts
export type ApprovalSubject = (typeof APPROVAL_SUBJECTS)[number];
export interface ApprovalTicket { requestId: string; status: 'approved' | 'pending'; auto: boolean }
export abstract class Approvals {
    /** ต้องเรียกภายใน uow.run ของผู้ขอ; คืน approved ทันทีเมื่อเข้ากฎข้ามอนุมัติ */
    abstract request(input: {
        workspaceId: WorkspaceId; subject: ApprovalSubject; subjectId: string; projectId: ProjectId | null;
        amount: number | null; title: string; requestedBy: UserId; requesterRole: Role;
    }): Promise<ApprovalTicket>;
    abstract cancel(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string, by: UserId): Promise<void>;
    abstract statusOf(workspaceId: WorkspaceId, subject: ApprovalSubject, subjectId: string): Promise<'pending' | 'approved' | 'rejected' | 'cancelled' | undefined>;
}
/** registry ใน core (แบบ ProjectDependents): โมดูลเจ้าของ subject ลงทะเบียน handler ตอน onModuleInit */
export class ApprovalHandlers {
    register(subject: ApprovalSubject, handler: ApprovalHandler): void;
    handlerOf(subject: ApprovalSubject): ApprovalHandler | undefined;
}
export interface ApprovalHandler {
    /** รันใน transaction เดียวกับการตัดสิน: เปลี่ยนสถานะเอกสาร ออกเลขเอกสาร โพสต์ ledger */
    onDecided(e: { workspaceId: WorkspaceId; subjectId: string; decision: 'approved' | 'rejected'; decidedBy: UserId; note: string }): Promise<Result<void, DomainError>>;
}
```

### 6.3 กฎข้ามอนุมัติ (auto-skip) — ทำใน `Approvals.request` เท่านั้น

1. นโยบายของ subject ปิด หรือ `amount < minAmount` → `approved`, `auto: true`
2. หา `eligible` = สมาชิกของ workspace ที่บทบาทอยู่ใน `approverRoles` ของนโยบาย (อ่านผ่าน method ใหม่ `WorkspaceDirectory.members(workspaceId): Promise<{ userId: UserId; role: Role }[]>` ที่ WP-08 เพิ่มใน `ports.ts`, `workspace-directory.adapter.ts` และ `FakeWorkspaceDirectory`)
3. ถ้าผู้ขออยู่ใน `eligible` และ (`policy.selfApprove` เป็น true หรือ `eligible` มีแค่ผู้ขอคนเดียว) → `approved`, `auto: true`
4. ถ้า `eligible` ว่าง (ไม่ควรเกิดเพราะ owner อยู่เสมอ แต่กันไว้) → `approved`, `auto: true` และบันทึก `reason:'no_approver'`
5. ไม่งั้น `pending`: บันทึก step แรก แจ้งเตือน `approval.requested` ถึง `eligible` ที่ไม่ใช่ผู้ขอ

ผลคือผู้ใช้คนเดียว (owner) **ไม่เคยเห็นขั้นตอนอนุมัติ** ทุกครั้งบันทึกเป็นแถว `approval_requests` สถานะ `approved` + `auto=true` เพื่อ audit

- เมื่อได้ `approved` จาก `request` ผู้ขอต้องทำผลต่อ **เอง** ใน transaction เดียวกัน (เช่น ออกเลข PO) ไม่เรียก handler
- เมื่อ `pending` ผู้ขอเปลี่ยนเอกสารเป็นสถานะ `pending_approval` แล้วรอ `POST /approvals/:requestId/decide` ซึ่งเรียก `handler.onDecided` ใน transaction ของการตัดสิน
- v1 มีขั้นเดียว (ผู้อนุมัติคนใดคนหนึ่งใน `eligible`) ตารางรองรับหลายขั้น (`approval_steps.seq`) ในอนาคต
- API: `GET /workspaces/:workspaceId/approvals?status=pending&mine=true`, `POST /approvals/:requestId/decide {decision, note}`,
  `GET/PUT /workspaces/:workspaceId/approval-policies[/:subject]` (`company.manage`)

---

## 7. การแจ้งเตือน: channel abstraction (ในแอปตอนนี้ พร้อมต่อ LINE)

WP-10 แก้ `backend/src/modules/platform`:

1. **Template เปิดกว้างตามโมดูล:** `NotificationTemplate = ScNotificationTemplate | ErpNotificationTemplate` ใน `ports.ts`
   `ErpNotificationTemplate` เริ่มต้นด้วย: `approval.requested`, `approval.decided`, `quotation.viewed`, `quotation.accepted`, `quotation.change_requested`,
   `variation.accepted`, `variation.rejected`, `invoice.due_soon`, `invoice.overdue`, `retention.release_due`, `guarantee.expiring`,
   `purchase_order.issued`, `goods.short_delivery`, `cost.overrun`, `cash.negative_forecast`, `warranty.claim_opened`, `warranty.expiring`,
   `trial.expiring`, `pay_period.ready`, `supplier_bill.due_soon`
   **WP-10 ประกาศ template ทั้งหมดนี้พร้อมข้อความ th/en ครั้งเดียว** เพื่อให้ WP ภายหลังไม่ต้องแก้ `ports.ts` (ถ้าจำเป็นต้องเพิ่มจริง: เพิ่มใน union + renderer ทั้งสองภาษา + บันทึก Handoff)
   `TEMPLATES` เดิมใน `notification-templates.ts` เป็น `Record<NotificationTemplate, …>` แบบครบทุกค่า: ให้แยก `Record<ScNotificationTemplate, …>` (เดิม) กับ `Record<ErpNotificationTemplate, …>` (ใหม่) แล้ว `renderNotification` เลือกตาม prefix
2. **เรนเดอร์ตามภาษาผู้รับ:** `users.locale` (`'th' | 'en'`, ค่าเริ่มต้น `'th'`, เพิ่มใน WP-01) → `RecipientDirectory.resolve` คืน `locale` ด้วย
   `renderNotification(template, payload, url, locale)`; ข้อความ ERP อยู่ที่ `application/services/notification-templates.erp.ts` (มีทั้ง th และ en),
   ข้อความ `sc.*` เดิมคงไว้ (ไทย) และเพิ่ม en ทีหลังได้ใน track I
   payload ของ template ERP ส่ง **ค่าดิบ** (`amount: number`, `date: 'YYYY-MM-DD'`, `docNumber`, `projectName`) และ renderer จัดรูปแบบตามภาษาด้วย
   `notification-format.ts` (Intl, ปฏิทินเกรกอเรียน) ต่างจาก `sc.*` ที่ส่งค่าที่จัดรูปแบบแล้ว
3. **Channel port:** `application/ports/notification-channel.port.ts`
   ```ts
   export interface NotificationChannel { readonly id: 'sms' | 'line' | 'email'; readonly enabled: boolean;
       send(toAddress: string, text: string): Promise<Result<void, DomainError>> }
   export abstract class NotificationChannels { abstract get(id: NotificationChannel['id']): NotificationChannel | undefined }
   ```
   `DeliveryWorker` ส่งผ่าน `NotificationChannels` (ห่อ `SmsSender` และ `LineSender` เดิม) แทนการเรียกแต่ละ sender ตรง ๆ
4. **ผูกบัญชีช่องทาง:** ตาราง `user_channel_links (user_id, channel, address, verified_at, created_at)` PK `(user_id, channel)`
   `DrizzleRecipientDirectory` อ่าน `line` จากตารางนี้ (ปิด TODO) การผูก LINE จริง (LINE Login) **ทำภายหลัง** ตอนนี้ไม่มีหน้าจอผูก
5. **การตั้งค่าของผู้ใช้:** ทำภายหลัง (ตอนนี้ทุก template ไปในแอปเสมอ ส่วน SMS ใช้ `SMS_WORTHY_TEMPLATES` เดิม ไม่เพิ่ม template ERP เข้าไป)
6. **Bell:** `src/features/notifications/NotificationBell.tsx` แสดงเมื่อ subcontracting เปิด หรือเป็น vendor หรือ `project-hub` active
7. **Sweep รายวัน:** `backend/src/modules/platform/infrastructure/adapters/daily-sweeps.ts` registry ของงานประจำวัน (`DailySweeps.register(name, fn)` ใน core)
   ใช้แพตเทิร์นเดียวกับ `RetentionDueSweep` (`backend/src/modules/subcontracting/contracts/application/retention-due-sweep.ts`): `setTimeout` ครั้งแรกหลัง 60 วินาที แล้ว `setInterval` ทุก 6 ชั่วโมง,
   ไม่เริ่ม timer เมื่อ `NODE_ENV=test` (เทสต์เรียก `runOnce()`), ข้ามโมดูลที่ไม่ release ใช้กับ invoice ครบกำหนด, retention, ค้ำประกันหมดอายุ, trial, warranty, cost overrun
   ต้องกันส่งซ้ำ: บันทึก `(sweep, key, mark_date)` ในตาราง `sweep_marks` (สร้างใน WP-10) โดย `mark_date = bangkokToday(now)` ส่งได้ครั้งเดียวต่อ key ต่อวัน

---

## 8. บริการเลขเอกสาร (shared, concurrency-safe, immutable)

โมดูล `backend/src/modules/numbering/` (WP-11)

### 8.1 ประเภทเอกสาร

`DOC_TYPES` ใน `src/shared/contract/erp/numbering.ts`:

| docType | prefix เริ่มต้น | reset | ใช้โดย |
|---|---|---|---|
| `project` | `PJ` | yearly | hub (รหัสโครงการ — ไม่ใช่เอกสารภาษี: guard การลบ **ไม่นับ** docType นี้) |
| `quotation` | `QT` | yearly | quotations (`subject_id` = `qt_quotations.id`; ฉบับแก้ `-R<n>` ไม่ออกเลขใหม่) |
| `contract` | `CT` | yearly | main-contracts |
| `invoice` | `INV` | yearly | billing (ใบแจ้งหนี้/ใบวางบิล รวมใบแจ้งหนี้เงินล่วงหน้า) |
| `tax_invoice` | `TI` | yearly | billing |
| `receipt` | `RC` | yearly | billing |
| `credit_note` | `CN` | yearly | billing |
| `variation` | `VO` | yearly | variations |
| `purchase_request` | `PR` | yearly | procurement |
| `rfq` | `RFQ` | yearly | procurement |
| `purchase_order` | `PO` | yearly | procurement |
| `goods_receipt` | `GR` | yearly | procurement |
| `supplier_bill` | `AP` | yearly | payables (เลขภายในของบิลผู้ขาย) |
| `payment_voucher` | `PV` | yearly | payables (ใบสำคัญจ่าย) |
| `wht_certificate` | `WHT` | yearly | payables (50 ทวิ) |
| `handover` | `HO` | yearly | handover |
| `warranty_claim` | `WC` | yearly | handover |

### 8.2 รูปแบบเลข

- `pattern` ใช้ token: `{prefix}`, `{yyyy}` (ปีตาม `year_style`), `{yy}`, `{mm}`, `{seq:N}` (เติมศูนย์ N หลัก, N = 3–6)
- ค่าเริ่มต้น `{prefix}{yyyy}-{seq:4}` → `QT2026-0001`; reset รายเดือนใช้ `{prefix}{yyyy}{mm}-{seq:4}`
- `year_style`: `ce` (ค่าเริ่มต้น ตามเจ้าของ: ปี ค.ศ.) หรือ `be` (พ.ศ. = ค.ศ. + 543) สำหรับบริษัทที่ต้องการ
- `period_key`: `'2026'` (yearly), `'2026-10'` (monthly), `'all'` (never) คำนวณจาก `issueDate` (วันที่ทางธุรกิจ) เสมอ ไม่ใช่เวลาเซิร์ฟเวอร์

### 8.3 Port และความปลอดภัยเมื่อออกพร้อมกัน

```ts
export abstract class DocumentNumbering {
    /** ต้องเรียกภายใน uow.run เดียวกับที่เปลี่ยนเอกสารเป็น issued; rollback = เลขไม่ถูกใช้ (ไม่มีเลขข้าม) */
    abstract issue(input: { workspaceId: WorkspaceId; docType: DocType; issueDate: string; subjectType: string; subjectId: string;
        projectId: ProjectId | null; issuedBy: UserId }): Promise<Result<IssuedNumber, DomainError>>;
    abstract void(input: { workspaceId: WorkspaceId; docType: DocType; subjectId: string; reason: string; by: UserId }): Promise<Result<void, DomainError>>;
    abstract preview(workspaceId: WorkspaceId, docType: DocType, issueDate: string): Promise<string>;   // ไม่จองเลข
}
export interface IssuedNumber { number: string; seq: number; periodKey: string; issuedDocumentId: string }
```

- Drizzle: `INSERT INTO doc_number_counters (...) VALUES (..., 1) ON CONFLICT (workspace_id, doc_type, period_key) DO UPDATE SET last_seq = doc_number_counters.last_seq + 1 RETURNING last_seq`
  (แพตเทิร์นเดียวกับ `nextSeq` ใน `drizzle-subcontract.repository.ts`) แถว counter ถูกล็อกจน transaction จบ คำขอพร้อมกันได้เลขถัดไปตามลำดับ
- insert `issued_documents` ใน transaction เดียวกัน (unique `(workspace_id, doc_type, number)` และ `(workspace_id, doc_type, subject_id)`)
- in-memory adapter: Map + mutex ต่อ key (ใช้แนวเดียวกับ `keyed-mutex.ts` ใน workspaces)
- `tax_invoice`, `receipt`, `credit_note`: `issueDate` ห้ามเก่ากว่าวันที่ของเลขล่าสุดในชุดเดียวกัน (`unprocessable`, `reason:'date_before_last_issued'`) เพื่อให้เลขเรียงตามวันที่

### 8.4 เปลี่ยนไม่ได้เมื่อออกแล้ว

- เอกสารได้เลข **เฉพาะตอน issue** ฉบับร่างไม่มีเลข
- หลัง issue: เนื้อหาเอกสาร (บรรทัด ยอดเงิน ลูกค้า วันที่) แก้ไม่ได้ โมดูลเจ้าของต้องตรวจ (`conflict`, `reason:'already_issued'`)
- แก้ไขด้วย "ยกเลิก (void) + ออกใหม่" หรือใบลดหนี้เท่านั้น เลขที่ยกเลิกยังอยู่ (`status='voided'`) และพิมพ์คำว่า "ยกเลิก / VOID"
- เปลี่ยน `prefix` / `pattern` / `reset` ได้เฉพาะเมื่อยังไม่มีเอกสารประเภทนั้นในรอบปัจจุบัน (ไม่งั้น `conflict`, `reason:'period_has_documents'`)
- ลบโครงการหรือ workspace ที่มี `issued_documents` (ยกเว้น `doc_type = 'project'`) ไม่ได้ (`conflict`, `reason:'document_issued_exists'`) ผ่าน `ProjectDeletionGuards` / `WorkspaceDeletionGuards` (§11)
  แถว `issued_documents` ไม่มี FK ไปยังโครงการ จึงคงอยู่หลังลบโครงการ (เลขไม่ถูกใช้ซ้ำ)
- API: `GET /workspaces/:workspaceId/numbering` (ทุก docType พร้อม preview), `PUT /workspaces/:workspaceId/numbering/:docType` (`company.manage`)

ข้อยกเว้น: เลขสัญญาจ้างช่วงเดิม `SC-YYYY-NNNN` (`sc_contract_counters`) **ไม่ย้าย** มาใช้บริการนี้ (Decisions log D-08)

---

## 9. ไฟล์แนบ

- ใช้ `FileService` เดิม เก็บเฉพาะ file id ในตารางของโมดูล (คอลัมน์ `jsonb file_ids string[]` หรือ `uuid file_id`) ห้ามเก็บ storage key
- อัปโหลดของ ERP ต้องส่ง `workspaceId` (มีใน `UploadFileInput` แล้ว) และตรวจด้วย `assertUploadedBy(ids, userId)` ก่อนผูก
- `FILE_PURPOSES` ใหม่ (เพิ่มในแต่ละ WP ที่ใช้ และผูก `FILE_PURPOSE_MODULE`):

| purpose | module | WP |
|---|---|---|
| `company_logo`, `company_stamp`, `company_signature` | `project-hub` | WP-12 |
| `customer_document` | `project-hub` | WP-13 |
| `quotation_attachment` | `quotations` | WP-23 |
| `main_contract_scan`, `guarantee_scan` | `contracts` | WP-26 |
| `payment_slip`, `customer_wht_certificate` | `billing` | WP-30 |
| `variation_evidence` | `variations` | WP-33 |
| `supplier_quote` | `procurement` | WP-38 |
| `delivery_note_photo`, `goods_photo` | `procurement` | WP-39 |
| `site_photo` | `site-diary` | WP-42 |
| `supplier_bill_scan` | `payables` | WP-49 |
| `handover_document`, `as_built`, `warranty_photo` | `handover` | WP-53 |

- รูปหน้างาน: ใช้เวลาถ่ายจาก client (`takenAt` ISO) เก็บคู่กับ file id (`{fileId, takenAt, caption}`) เพราะตาราง `files` ไม่มีเวลาถ่าย

---

## 10. Audit log

โมดูล `backend/src/modules/audit/` (WP-08) ตาราง `audit_events` (§1.5 ของ domain model)

```ts
export abstract class AuditLog {
    /** ภายใน uow.run เดียวกับการเปลี่ยนแปลง */
    abstract record(e: { workspaceId: WorkspaceId; projectId: ProjectId | null; actor: UserId | null; entityType: string; entityId: string;
        action: string; data: Record<string, unknown> }): Promise<void>;
}
```

- บันทึกทุกการกระทำที่มีผลทางเงินหรือสถานะ: issue, void, approve, reject, lock/unlock baseline, entitlement, การรับเงิน การจ่ายเงิน
- `data` เก็บเฉพาะฟิลด์ที่เปลี่ยน (`{field: [before, after]}`) หรือสรุปตัวเลข ไม่เก็บเอกสารทั้งก้อน
- API `GET /workspaces/:workspaceId/audit?entityType=&entityId=&limit=&before=` (`audit.read`)
- `activity_log` (projects) และ `sc_activity` (subcontracting) เดิมคงไว้ ไม่ย้าย

---

## 11. Registry ใน core (แพตเทิร์น `ProjectDependents`)

WP แต่ละตัวเพิ่ม class ต่อไปนี้ใน `backend/src/shared/application/ports.ts` และ provide/export ใน `CoreModule.forRoot`
(`backend/src/shared/infrastructure/core.module.ts`) โมดูลลงทะเบียนใน `onModuleInit`:

| registry | สร้างใน | ใช้ทำอะไร |
|---|---|---|
| `ModuleWorkRegistry` | WP-03 | งานค้างต่อโมดูลก่อนปิด (แทน `ModuleUsage`) |
| `ApprovalHandlers` | WP-08 | ผลการอนุมัติไปยังโมดูลเจ้าของ |
| `DailySweeps` | WP-10 | งานประจำวัน |
| `ProjectDeletionGuards`, `WorkspaceDeletionGuards` | WP-11 | ห้ามลบเมื่อมีเอกสารออกเลขแล้ว (คืนรายการเหตุผล) — `DeleteProjectUseCase` และ `DeleteWorkspaceUseCase` เรียกก่อนลบ |
| `CustomerLinkHandlers` | WP-14 | เรนเดอร์และรับคำตอบจากลิงก์ลูกค้าตาม `subjectType` |
| `HubRollups` | WP-15 | ตัวเลขสรุปต่อโครงการจากแต่ละโมดูล (§12 ของ domain model) |
| `RevisionHooks` | WP-17 | หลังสร้าง revision (ใน transaction เดียวกัน) boq-control เก็บบรรทัด BOQ |
| `BoqEditLocks` | WP-18 | `PutDocUseCase` ถาม: doc นี้ถูกล็อกเพราะ baseline หรือไม่ |
| `BaselineUnlockGuards` | WP-18 | เหตุที่ห้ามปลดล็อก baseline (สัญญา signed, claim, VO accepted, ledger) |
| `PortalSources`, `SearchSources` | WP-35 | งานของฉัน การแจ้งเตือนความเสี่ยง และผลค้นหาข้ามโมดูล |
| `PayPeriodBillChecks` | WP-44 | labour ถาม: งวดค่าแรงนี้มีบิล AP แล้วหรือยัง (payables ลงทะเบียนใน WP-49) |
| `CashPlanSources` | WP-47 | เงินเข้า/ออกที่คาดการณ์ต่อโครงการ (billing, procurement, labour, subcontracting ลงทะเบียนใน WP-47; payables ลงทะเบียนใน WP-49) |

กติกา: handler ที่ลงทะเบียนต้องตรวจเองว่าโมดูลของตน active สำหรับ workspace นั้น ถ้าไม่ active ให้คืนค่าว่าง/ไม่ทำอะไร

Port ข้ามโมดูล (abstract class ใน `ports.ts`, provide โดยโมดูลเจ้าของข้อมูล) ที่แผนนี้กำหนด:
`ModuleAccess` (platform, WP-03), `Approvals`/`AuditLog` (WP-08), `DocumentNumbering` (WP-11), `CompanyProfiles` (WP-12), `CustomerLookup` (WP-13),
`ProjectLifecycle` (hub, WP-15), `RevisionWriter` (projects, WP-17), `CostCodeLookup`/`BaselineControl` (boq-control, WP-18), `CostLedger`/`FinancialEvents` (ledger, WP-20),
`MainContracts` (main-contracts, WP-26: `find`, `forProject`, `applyVariation`, `markMilestone`, `complete`), `ScVendorDirectory`/`SupplierLookup` (WP-37), `PurchaseOrders` (WP-39), `CrewDailyCost` (workforce, WP-42), `PeopleDirectory` (workforce, WP-44),
`BillingTotals` (billing, WP-30), `SubcontractCommitments` (subcontracting, WP-46), `SubcontractCashPlan` (subcontracting, WP-47), `SubcontractPayables` (subcontracting, WP-49),
`SubcontractClaimPayer` (subcontracting, WP-50), `PayPeriodPayments` (labour, สร้างใน WP-49 + `markPaid` ใน WP-50), `QuotationPricingLookup` (quotations, WP-33), `UnitRateHistory` (job-cost, WP-55)
ชื่อเหล่านี้ตายตัว WP ที่สร้างต้องใช้ชื่อนี้

---

## 12. เงินและตัวเลข

### 12.1 ชนิดและการเก็บ

- TypeScript: `number` (บาท) เหมือนเดิม ไม่ใช้ Decimal library (Decisions log D-04) ช่วงสูงสุด 1e11 บาท ยังแม่นยำที่ 2 ตำแหน่งใน float64
- Postgres: เงิน `numeric(14,2)` (`money()` helper), ปริมาณ `numeric(16,4)`, ราคาต่อหน่วย `numeric(16,4)`, อัตรา `numeric(7,6)` เป็นเศษส่วน
- **ทุกค่าที่เก็บลงตารางต้องผ่าน `round2` แล้ว** (เงิน) / `roundQty` (ปริมาณ 4 ตำแหน่ง)

### 12.2 ไลบรารีกลาง `src/domain/money/` (WP-02)

| ไฟล์ | export |
|---|---|
| `money.ts` | `round2(v)` (ย้ายตรรกะจาก `src/domain/subcontracting/snapshot.ts` ไปที่นี่; `snapshot.ts` re-export ชื่อเดิม), `roundQty(v)` (4 ตำแหน่ง), `sumMoney(values)` = round2 ของผลรวมที่ปัดแต่ละตัวแล้ว, `pctOf(amount, rate)` = round2(amount × rate), `allocate(total, weights)` (ปัดทุกส่วน ตัวสุดท้ายรับเศษ แบบ `installmentAmounts`), `MONEY_MAX = 1e11` |
| `tax.ts` | `THAI_VAT_RATE = 0.07`, `vatOf(net, rate)`, `splitVatInclusive(gross, rate)` → `{net, vat}` (net = round2(gross / (1+rate)), vat = gross − net), `whtOf(base, rate)`, `WHT_PRESETS` |
| `amount-in-words.ts` | `amountInWordsEn(amount)` ("One thousand two hundred baht and fifty satang only") — ภาษาไทยใช้ `bahtText` เดิมจาก `src/features/export/baht-text.ts` ผ่าน wrapper ใน `src/i18n/format.ts` |
| `index.ts` | re-export |

`WHT_PRESETS`:

| key | อัตรา | ใช้เมื่อ |
|---|---|---|
| `none` | 0 | ลูกค้าบุคคลธรรมดา, ซื้อสินค้า |
| `government` | 0.01 | หน่วยงานรัฐจ่ายผู้รับจ้าง |
| `transport` | 0.01 | ค่าขนส่ง |
| `advertising` | 0.02 | ค่าโฆษณา |
| `service` | 0.03 | ค่าจ้างทำของ/บริการ (นิติบุคคลจ่าย) |
| `rent` | 0.05 | ค่าเช่า |

### 12.3 กติกาการคำนวณ (ทุกเอกสาร)

1. ยอดบรรทัด = `round2(qty × unitPrice)` (ปริมาณ `roundQty` ก่อน)
2. ยอดรวมหมวด / เอกสาร = `sumMoney(ยอดบรรทัด)` ห้ามคูณใหม่จากยอดรวม
3. ส่วนลดและ markup คิดที่ระดับที่ระบุ (บรรทัด หมวด หรือเอกสาร) แล้ว `round2` ทันที
4. VAT คิด **ครั้งเดียวที่ระดับเอกสาร** บนฐานที่ไม่รวม VAT: `vat = round2(base × rate)` (ไม่คิด VAT ต่อบรรทัดแล้วรวม) ยกเว้นใบเสนอราคาแบบ "VAT ต่อหมวด" ที่คิดต่อหมวดแล้วรวม (ระบุชัดในเอกสาร)
   และใบเสนอราคาราชการ (`vatMode='included_in_factor'`: Factor F รวม VAT แล้ว) ที่แยกกลับด้วย `splitVatInclusive(grandTotal, rate)` เพื่อให้ได้ฐานไม่รวม VAT สำหรับสัญญา
5. WHT คิดบนฐานก่อน VAT: `wht = round2(base × whtRate)`
6. การแบ่งเปอร์เซ็นต์เป็นงวดใช้ `allocate()` ให้ผลรวมเท่าต้นฉบับพอดี
7. BOQ engine เดิม **ไม่ปัด** (ตัวเลข float) เมื่อดึง BOQ เข้าเอกสาร ERP (ใบเสนอราคา baseline) ให้ปัดต่อบรรทัดด้วยกฎข้อ 1 ทันที
   ผลคือยอดรวมใน ERP อาจต่างจากยอดที่หน้า BOQ แสดงไม่เกินไม่กี่สตางค์ ต้องแสดงยอดของ ERP เสมอในเอกสาร ERP (Decisions log D-05)
8. ค่าติดลบ: VO ลดงานและใบลดหนี้ใช้ `signedAmountSchema` ทุกอย่างอื่นเป็นบวก

### 12.4 การเผื่อ GL ในอนาคต

ทุกเหตุการณ์ทางเงิน (ออกใบแจ้งหนี้ ใบกำกับภาษี รับเงิน หักประกัน คืนประกัน เงินล่วงหน้า บิลผู้ขาย จ่ายเงิน 50 ทวิ ค่าแรง) **ต้องโพสต์หนึ่งแถว** ใน `fin_events`
ผ่าน port `FinancialEvents.post(...)` ภายใน transaction เดียวกัน (WP-20) แถวเปลี่ยนไม่ได้ การกลับรายการทำด้วยแถวใหม่ที่ `reverses_id` ชี้แถวเดิมและยอดติดลบ
GL ในอนาคตแค่แปลง `fin_events` เป็น journal ตาม posting rules

---

## 13. วันที่และเวลา

- **timestamp** (เวลาเกิดเหตุ): `timestamptz` + `isoDateTimeSchema` (ISO มี offset) จาก `Clock`
- **วันที่ทางธุรกิจ** (วันที่เอกสาร ครบกำหนด วันรายงาน วันทำงาน): `date` (`businessDate()`) + `businessDateSchema` `YYYY-MM-DD` ตามเวลา **Asia/Bangkok**
- WP-02 สร้าง `src/domain/dates/business-date.ts`: `bangkokToday(now: Date): string`, `addDays(date, n)`, `addMonths(date, n)` (ใช้ตรรกะเดียวกับ `addMonthsToDate` ใน `src/domain/subcontracting/claims.ts`), `daysBetween(a, b)`, `isBusinessDate(s)`, `compareDates(a, b)`, `payPeriodOf(date)` (`'2026-10-A'` = วันที่ 1–15, `'2026-10-B'` = 16–สิ้นเดือน)
- backend หา "วันนี้" ด้วย `bangkokToday(this.clock.now())` เท่านั้น ห้ามใช้ `new Date().toISOString().slice(0,10)` (ได้วันที่ UTC ผิดตอนเช้า)
- การแสดงผล: ปี ค.ศ. เสมอใน UI (`-u-ca-gregory`) ดู `03-i18n.md` §5 เอกสารพิมพ์เลือก พ.ศ. ได้ตาม `company_profiles.documentYearStyle`

---

## 14. Multi-tenancy และความถูกต้องของข้อมูล

1. ทุกตารางของ ERP มี `workspace_id` (FK `workspaces` cascade) ยกเว้นตารางลูกที่ผูกแม่ในโมดูลเดียวกันด้วย FK ที่มี `workspace_id` อยู่แล้ว ก็ยังต้องมี `workspace_id` เพื่อกรองตรง
2. ตารางที่ผูกโครงการใช้ `projectTenantFk` เสมอ
3. ทุก query ของ repository กรอง `workspace_id` เสมอ id จาก URL หาไม่เจอใน workspace ของผู้เรียก → `not_found`
4. id อ้างข้ามโมดูล (ไม่มี FK): use case ตรวจผ่าน lookup port ว่าเป็นของ workspace/โครงการเดียวกัน ไม่งั้น `not_found`
5. ล็อกแถวก่อนเปลี่ยนสถานะ (`lockForUpdate`) ใน `uow.run` เพื่อกันกดซ้ำพร้อมกัน แล้วตรวจสถานะหลังล็อก
6. ใช้ partial unique index กันเอกสารซ้อน (เช่น claim ที่ยังไม่ปิดได้หนึ่งใบต่องวด) และให้ in-memory adapter เลียนแบบ
7. ลูกค้าภายนอก (ลิงก์) เห็นเฉพาะเอกสารที่ลิงก์ชี้ ไม่เห็นต้นทุน กำไร หรือเอกสารอื่น
8. ปิดโมดูลไม่ลบข้อมูล ลบโครงการลบแถวร่างทั้งหมดผ่าน `ProjectDependents` แต่ถูกกันด้วย `ProjectDeletionGuards` เมื่อมีเอกสารออกเลขแล้วหรือมี `fin_events`
9. ไม่มี realtime สำหรับ ERP: เว็บ refetch หลัง mutation (react-query `invalidateQueries`) และ `staleTime` 30 วินาทีเดิม

---

## 15. เอกสารพิมพ์ (ใบเสนอราคา ใบแจ้งหนี้ ใบกำกับภาษี ฯลฯ)

- พิมพ์จากเบราว์เซอร์ (ไม่มี PDF ฝั่ง server) ผ่าน route `(print)` และ component `PrintFrame` (`src/features/erp/shared/PrintFrame.tsx`, WP-06):
  แถบเครื่องมือ (พิมพ์/ปิด), กระดาษ A4 ขอบ 15 มม., ฟอนต์ Sarabun (`--font-sarabun`) ซึ่งรองรับละตินด้วย, `@media print` ซ่อนแถบเครื่องมือ
- ภาษาเอกสาร = `document.language` ของเอกสาร (ไม่ใช่ภาษา UI) ใช้ `createTranslator` ของ next-intl กับ namespace `documents` ของภาษานั้น (ดู `03-i18n.md` §6)
- หัวเอกสาร: โลโก้ ชื่อบริษัทตามภาษา เลขผู้เสียภาษี สาขา ที่อยู่ จาก `company_profiles`; ลูกค้าจาก snapshot ในเอกสาร (ไม่อ่าน `customers` สด เพราะเอกสารที่ออกแล้วต้องไม่เปลี่ยน)
- เอกสารที่ void แล้วพิมพ์ลายน้ำ "ยกเลิก" / "VOID"; ฉบับร่างพิมพ์ลายน้ำ "ฉบับร่าง" / "DRAFT"
- ใบกำกับภาษีเต็มรูปต้องมีครบ: คำว่า "ใบกำกับภาษี", ชื่อ ที่อยู่ เลขผู้เสียภาษีของผู้ขายและผู้ซื้อ (+ สาขา), เลขที่, วันที่, รายการ, มูลค่า, VAT แยก, ยอดรวม

---

## 16. HOW TO ADD AN ERP MODULE (checklist จากโค้ดจริง)

ทำตามลำดับ แต่ละข้อมีไฟล์ที่ต้องแตะ

### A. ตัดสินใจก่อน
- [ ] ModuleId อยู่ใน `MODULE_IDS` และ `MODULE_REGISTRY` แล้วหรือยัง (WP-03 ประกาศ id ERP ทั้งหมดไว้แล้ว) ถ้ายังไม่มี: เพิ่มต่อท้ายใน `src/shared/contract/modules.ts`, `MODULE_LABEL`, `MODULE_REGISTRY` (dependsOn/entitlement/trialDays), `testEnv()` `MODULES_ENABLED` และ doc comment ของ `MODULES_ENABLED` ใน `backend/src/shared/infrastructure/config/env.ts`
- [ ] Permission ที่ต้องใช้อยู่ใน §5.2 แล้ว (WP-05 ประกาศครบ) ถ้าต้องเพิ่ม: `backend/src/shared/domain/permissions.ts` + `src/features/cloud/permissions.ts` (หรือไฟล์กลางถ้า WP-05 ย้ายแล้ว) ทุกบทบาท

### B. Contract
- [ ] `src/shared/contract/erp/<module>.ts` (schemas + types + constants; ชื่อขึ้นต้นด้วยชื่อโมดูล; grep ชื่อก่อน)
- [ ] export ใน `src/shared/contract/erp/index.ts`
- [ ] `FILE_PURPOSES` ใหม่ (ถ้ามี) ใน `src/shared/contract/files.ts` + `FILE_PURPOSE_MODULE` ใน `backend/src/modules/platform/domain/file-purposes.ts`
- [ ] template แจ้งเตือนใหม่ (ถ้ามี) ใน `ErpNotificationTemplate` (`ports.ts`) + `notification-templates.erp.ts` (th + en)

### C. Database
- [ ] ตารางใน `backend/src/shared/infrastructure/database/schema-<file>.ts` ตาม §1.2 ใช้ helper จาก `schema-helpers.ts`; enum ทุกตัวมี `check(...)`; ชื่อ index/constraint `<table>_<cols>_idx|_key|_check|_project_tenant_fk`
- [ ] ถ้าไฟล์ใหม่: export `<x>Tables`, merge ใน `database.ts`, เพิ่มใน `backend/drizzle.config.ts`
- [ ] `cd backend && npm run db:generate -- --name <wp-id>_<change>` (เช่น `wp23_quotations`) commit SQL + snapshot + `_journal.json` ห้ามแก้ migration ที่ออกไปแล้ว; แก้ schema แบบเพิ่มอย่างเดียว (ไม่ rename/drop) เพื่อไม่ให้ drizzle-kit ถามแบบ interactive

### D. Backend module
- [ ] โฟลเดอร์ตาม §1.1, branded ids ใน `domain/<module>-ids.ts`
- [ ] state machine ใน `domain/<module>-state.ts` ตาม `02-domain-model.md` (ตาราง transition + `requireStatus`)
- [ ] repository port (abstract class) + drizzle adapter (กรอง `workspace_id`, `lockForUpdate`) + in-memory adapter
- [ ] use case ทุกตัวใช้ `ModuleAccess` (§1.3) ลำดับ not_found → module_disabled → forbidden; `uow.run` สำหรับเขียน; `Clock`/`IdGenerator`; แจ้งเตือนหลัง commit
- [ ] เอกสารที่มีเลข: เรียก `DocumentNumbering.issue` ใน transaction ตอน issue; ห้ามแก้หลัง issue
- [ ] เหตุการณ์เงิน: `FinancialEvents.post`; ต้นทุน: `CostLedger.post`; สถานะสำคัญ: `AuditLog.record`
- [ ] ต้องอนุมัติ: `Approvals.request` + ลงทะเบียน `ApprovalHandlers` ใน `onModuleInit`
- [ ] controller มี `@RequiresModule('<id>')`, `ZodPipe`, `unwrap(parseId(...))`
- [ ] `<module>.module.ts` (`@Global() @Module`) ใช้ `persistence(...)` ทุก repository; ลงทะเบียน `ProjectDependents` (ลบแถวร่างของโครงการ), `ProjectDeletionGuards` (ถ้ามีเอกสารออกเลข), `HubRollups`, `PortalSources`, `SearchSources` ตามที่เกี่ยวข้อง
- [ ] เพิ่มคลาสโมดูลใน `imports` ของ `AppModule.forRoot` (`backend/src/app.module.ts`)
- [ ] ข้ามโมดูลเฉพาะผ่าน port ใน `backend/src/shared/application/ports.ts` ห้าม import ไฟล์ของโมดูลอื่น

### E. Frontend
- [ ] `src/features/erp/<module>/api.ts`, `hooks.ts`, `logic.ts`, หน้าจอ
- [ ] route `src/app/(app)/...` ตาม §3.2 ครอบ `<ModuleGate module="<id>" next="...">`
- [ ] เมนู/แท็บ: เพิ่มรายการใน `src/features/erp/hub/nav-registry.ts` (ไม่แก้ `AppLayoutUI.tsx` ตรง)
- [ ] ใช้ UI kit จาก `src/features/erp/shared/` (อ่าน `src/features/erp/shared/README.md` ของ WP-06) และฟอร์แมตจาก `src/i18n/format.ts` (`useFormat()`)
- [ ] ปุ่ม/ข้อมูลที่ต้องมีสิทธิ์: `can(role, '<perm>')`
- [ ] เอกสารพิมพ์: หน้า `src/app/(print)/print/<doc>/[id]/page.tsx` + model ใน `src/features/erp/<module>/print-model.ts` + ข้อความใน namespace `documents`

### F. i18n
- [ ] namespace `<module>` ใหม่ทั้ง `src/i18n/messages/th/<module>.json` และ `en/<module>.json` ลงทะเบียนใน `index.ts` ทั้งสองภาษา
- [ ] สถานะ/enum ใน `enums.json`, error reason ใหม่ใน `errors.json` (`reasons.<reason>`), ป้ายเมนูใน `nav.json`
- [ ] ข้อความเอกสารพิมพ์ใน `documents.json` ทั้งสองภาษา
- [ ] `node scripts/i18n/check-parity.mjs` ผ่าน และไม่มีข้อความไทยตรงในโค้ด (ESLint rule ของ WP-01 จับ)

### G. Flag และ seed
- [ ] หน้า `/workspace/modules` แสดงโมดูลพร้อม hint (`modules.<id>.hint`) — มาจาก registry อัตโนมัติหลัง WP-04
- [ ] ข้อมูลตัวอย่าง (ถ้ามี) ใน `backend/src/cli/seed-erp.ts` (WP-56) ข้ามอย่างสุภาพเมื่อโมดูลไม่ release
- [ ] เพิ่ม route ใน `backend/API.md`

### H. ตรวจ
- [ ] `npx tsc --noEmit -p backend/tsconfig.json`
- [ ] `npx tsc --noEmit -p tsconfig.json`
- [ ] `cd backend && npx eslint <ไฟล์ที่แก้>` และ `npx eslint <ไฟล์ที่แก้>` ที่ root
- [ ] jest/vitest เฉพาะไฟล์ที่เกี่ยวข้อง (ห้ามทั้งชุดพร้อมกัน)
- [ ] อัปเดต `PROGRESS.md` (สถานะ + Handoff note)
