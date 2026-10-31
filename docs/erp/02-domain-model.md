# 02 — Domain model: ตาราง entity ความสัมพันธ์ และ state machine

สถานะ: ข้อกำหนด · 2026-10-31 · อ่านคู่กับ `01-architecture.md` (§1.2 prefix/ไฟล์ schema, §12 เงิน, §13 วันที่, §14 tenancy)

## 0. กติการ่วมของทุกตาราง

- `id uuid primary key` (สร้างจาก `IdGenerator`) ยกเว้นตารางที่ระบุ PK อื่น
- `workspace_id uuid not null` FK `workspaces(id)` on delete cascade ทุกตาราง
- ตารางที่ผูกโครงการ: `project_id uuid not null` + `projectTenantFk` (composite FK กับ `projects(id, workspace_id)`)
- `created_at timestamptz not null default now()` (`createdAt()`), `created_by uuid not null` (ไม่ FK: ผู้ใช้อาจถูกลบ), `updated_at` ถ้าแถวแก้ได้
- เงิน `money()` = `numeric(14,2)`; ปริมาณ `quantity()` = `numeric(16,4)`; ราคาต่อหน่วย `unitPrice()` = `numeric(16,4)`; อัตรา `rate()` = `numeric(7,6)` เศษส่วน
- วันที่ธุรกิจ `businessDate()` = `date` (string `YYYY-MM-DD`)
- enum = `text(...)` + `check('<table>_<col>_check', sql\`... in (...)\`)` และประกาศค่าใน contract เป็น `as const`
- snapshot (ลูกค้า บริษัท) ในเอกสารที่ออกแล้วเก็บเป็น `jsonb` เพื่อให้เอกสารไม่เปลี่ยนตามทะเบียน
- ทุก state machine เขียนเป็นตาราง transition ใน `domain/<module>-state.ts`:
  ```ts
  export const QUOTATION_VERSION_TRANSITIONS: Readonly<Record<QuotationVersionStatus, readonly QuotationVersionStatus[]>> = {...};
  export function canTransition(from, to): boolean; // + requireStatus(current, allowed[]) คืน conflict reason 'invalid_transition'
  ```
- ทุกการเปลี่ยนสถานะ: ล็อกแถว (`lockForUpdate`) → ตรวจ transition → เขียน → `AuditLog.record`

แผนภาพความสัมพันธ์หลัก (ลูกศร = อ้างถึง):

```
workspaces ─┬─ company_profiles (1:1)
            ├─ customers ◄──────────────── projects.customer_id
            ├─ sup_suppliers
            └─ projects ─┬─ boq_versions ─ boq_version_lines         (ประวัติ BOQ)
                         ├─ project_baselines → boq_versions          (ฉบับฐาน)
                         ├─ project_cost_codes ◄─── (ทุกบรรทัดของ PR/PO/GR/บิล/ใบลงเวลา/รายงาน/claim/VO/ledger)
                         ├─ qt_quotations ─ qt_quotation_versions ─ qt_quotation_sections / qt_quotation_lines
                         ├─ mc_contracts ─ mc_milestones / mc_guarantees
                         │     ├─ ar_claims ─ ar_claim_lines → ar_invoices ◄─ ar_receipt_allocations ─ ar_receipts
                         │     ├─ ar_retention_entries / ar_advance_entries
                         │     ├─ vo_variations ─ vo_lines / vo_evidence
                         │     └─ ho_handovers → ho_warranties ─ ho_warranty_claims
                         ├─ pc_requests ─ pc_request_lines → pc_rfqs ─ pc_rfq_quotes → pc_orders ─ pc_order_lines ─ pc_receipts
                         ├─ sd_reports ─ sd_manpower / sd_work_items / sd_photos / sd_issues
                         ├─ lb_timesheet_entries → lb_pay_periods ─ lb_pay_lines
                         ├─ ap_bills ─ ap_bill_lines ◄─ ap_payment_allocations ─ ap_payments → ap_wht_certificates
                         ├─ cost_ledger_entries (commit/actual ต่อ cost code)
                         ├─ jc_forecasts / jc_alerts
                         └─ ho_closeouts
fin_events  ← ทุกเหตุการณ์เงิน (พร้อมลง GL)
issued_documents ← ทุกเอกสารที่ออกเลข
```

---

## 1. Foundations

### 1.1 Module entitlement (WP-03) — `schema-platform.ts`

`workspace_entitlements` ดู `01-architecture.md` §4.4 (PK `(workspace_id, module)`, `status in ('purchased','trial','beta','revoked')`, `starts_at`, `expires_at`, `trial_used_at`, `granted_by`, `note`, `updated_at`)
`workspace_modules` เดิมใช้ต่อไม่เปลี่ยน

### 1.2 ผู้ใช้: ภาษา ช่องทาง งานประจำวัน (WP-01, WP-10)

| ตาราง/คอลัมน์ | ไฟล์ | รายละเอียด |
|---|---|---|
| `users.locale text not null default 'th'` + check `in ('th','en')` | `schema.ts` | ภาษา UI และภาษาการแจ้งเตือนของผู้ใช้ (WP-01) |
| `user_channel_links` | `schema-platform.ts` | `user_id` FK users cascade, `channel text check in ('line','email')`, `address text`, `verified_at timestamptz null`, `created_at`; PK `(user_id, channel)` (WP-10) |
| `sweep_marks` | `schema-platform.ts` | `sweep text`, `key text`, `mark_date date`; PK `(sweep, key, mark_date)` กันแจ้งเตือนซ้ำ (WP-10) |

### 1.3 โปรไฟล์บริษัท `company_profiles` (WP-12) — `schema-erp-core.ts`

PK `workspace_id`

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `legal_name_th`, `legal_name_en` | text not null default '' | ว่าง = ใช้ `workspaces.name` |
| `tax_id` | text not null default '' | ว่าง หรือเลข 13 หลัก (ตรวจ checksum ด้วย `isThaiTaxId` ใน `src/domain/erp/tax-id.ts`) |
| `branch_code` | text not null default '00000' | `00000` = สำนักงานใหญ่ |
| `branch_name_th`, `branch_name_en` | text default '' | |
| `address_th`, `address_en` | text default '' | หลายบรรทัด |
| `phone`, `email`, `website` | text default '' | |
| `logo_file_id`, `stamp_file_id`, `signature_file_id` | uuid null | purpose `company_logo` ฯลฯ |
| `vat_registered` | boolean default false | false → ทุกเอกสาร VAT = 0 และห้ามออก `tax_invoice` |
| `vat_rate` | rate default 0.07 | |
| `business_profiles` | jsonb `BusinessProfile[]` default `[]` | `'residential' | 'government' | 'commercial'` เลือกหลายค่า |
| `default_project_type` | text null | `ProjectType` |
| `default_doc_language` | text default 'th' | |
| `document_year_style` | text default 'ce' check `in ('ce','be')` | ปีบนเอกสารพิมพ์ |
| `bank_accounts` | jsonb `{bankCode, bankName, accountName, accountNo, branch}[]` | แสดงในใบแจ้งหนี้ |
| `promptpay_id` | text default '' | เบอร์มือถือ 10 หลักหรือเลขผู้เสียภาษี 13 หลัก |
| `defaults` | jsonb `Partial<Record<ProjectType, Partial<ProjectCommercialSettings>>>` default `{}` | ทับค่า `PROJECT_TYPE_DEFAULTS` |
| `brand_color` | text default '#F97316' | |
| `document_footer_th`, `document_footer_en` | text default '' | |
| `updated_by`, `updated_at` | | |

`src/domain/erp/profiles.ts` (WP-12):

```ts
export const BUSINESS_PROFILES = ['residential', 'government', 'commercial'] as const;
export const PROJECT_TYPES = ['residential_new', 'residential_renovation', 'government', 'commercial'] as const;
export interface MilestoneTemplateItem { labelTh: string; labelEn: string; pct: number; trigger: 'signing' | 'progress' | 'handover' | 'manual' }
export interface ProjectCommercialSettings {
    priceSource: 'market' | 'government';
    quotationFormat: 'lump_sum_by_category' | 'detailed' | 'government';
    detailLevel: 'full' | 'per_category' | 'lump_sum';
    billingMode: 'milestone' | 'progress';
    milestoneTemplate: MilestoneTemplateItem[];
    advancePct: number; retentionPct: number; customerWhtRate: number;
    escalation: boolean; penaltyRatePerDay: number; guaranteePct: number; warrantyMonths: number;
    paymentTermDays: number; documentLanguage: 'th' | 'en';
}
export const PROJECT_TYPE_DEFAULTS: Readonly<Record<ProjectType, ProjectCommercialSettings>>; // ค่าตาม 00-vision.md §4
export function resolveSettings(type: ProjectType, company: CompanyDefaults, project: Partial<ProjectCommercialSettings>): ProjectCommercialSettings;
// ลำดับ: project.settings > company_profiles.defaults[type] > PROJECT_TYPE_DEFAULTS[type]
```

`billingMode` เริ่มต้น: `residential_*` = `milestone`, `government` = `milestone`, `commercial` = `progress`

### 1.4 การอนุมัติ (WP-08) — `schema-erp-core.ts`

**`approval_policies`** PK `(workspace_id, subject)`: `enabled boolean`, `min_amount money null`, `approver_roles jsonb Role[]`, `self_approve boolean default true`, `updated_by`, `updated_at`
ไม่มีแถว = ค่าเริ่มต้นจาก `APPROVAL_SUBJECT_DEFAULTS` (`01-architecture.md` §6.1)

**`approval_requests`**
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id uuid null` (+ tenant FK; null ผ่าน MATCH SIMPLE) | |
| `subject text`, `subject_id uuid`, `title text`, `amount money null` | |
| `status` check `in ('pending','approved','rejected','cancelled')` | |
| `auto boolean`, `auto_reason text null` check `in ('policy_off','below_threshold','self_approve','solo','no_approver')` | |
| `requested_by`, `requested_at`, `decided_by null`, `decided_at null`, `decision_note text default ''` | |
| partial unique `approval_requests_pending_key` `(workspace_id, subject, subject_id) where status = 'pending'` | |
| index `(workspace_id, status, requested_at)` | |

**`approval_steps`**: `id`, `request_id` FK cascade, `workspace_id`, `seq int`, `approver_roles jsonb`, `status check in ('pending','approved','rejected','skipped')`, `decided_by`, `decided_at`, `note`; unique `(request_id, seq)`

State: `pending → approved | rejected | cancelled` (ปลายทางทั้งหมดเป็นสถานะสุดท้าย)

### 1.5 Audit (WP-08) — `audit_events`

`id bigserial PK`, `workspace_id`, `project_id uuid null` (ไม่มี FK: ต้องอยู่ต่อแม้โครงการถูกลบ), `actor_user_id uuid null`, `entity_type text`, `entity_id text`, `action text`, `data jsonb default '{}'`, `at timestamptz default now()`
index `(workspace_id, entity_type, entity_id, id)`, `(workspace_id, at)` ไม่มี update/delete (append-only)

### 1.6 เลขเอกสาร (WP-11)

| ตาราง | คอลัมน์ |
|---|---|
| `doc_number_series` PK `(workspace_id, doc_type)` | `prefix text`, `pattern text`, `reset text check in ('yearly','monthly','never')`, `year_style text check in ('ce','be')`, `updated_by`, `updated_at` (ไม่มีแถว = ค่าเริ่มต้นจาก `DOC_TYPES`) |
| `doc_number_counters` PK `(workspace_id, doc_type, period_key)` | `last_seq integer not null`, `updated_at` |
| `issued_documents` | `id`, `workspace_id`, `doc_type`, `number`, `period_key`, `seq`, `issue_date date`, `subject_type text`, `subject_id uuid`, `project_id uuid null` (ไม่มี FK), `issued_by`, `issued_at`, `status check in ('issued','voided')`, `voided_by`, `voided_at`, `void_reason text default ''`; unique `(workspace_id, doc_type, number)`, unique `(workspace_id, doc_type, subject_id)`, index `(workspace_id, project_id)` |

### 1.7 ลูกค้า `customers` (WP-13)

| คอลัมน์ | หมายเหตุ |
|---|---|
| `kind` check `in ('individual','juristic','government')` | |
| `name_th text not null`, `name_en text default ''` | อย่างน้อยหนึ่งชื่อไม่ว่าง |
| `tax_id text default ''`, `branch_code text default ''` | ต้องมีก่อนออก `tax_invoice` ให้ `juristic`/`government` (`unprocessable`, `reason:'customer_tax_id_required'`) |
| `address_th`, `address_en`, `contact_name`, `phone`, `email`, `line_id` | default '' |
| `default_wht_rate rate null` | null = ตาม kind: individual 0, juristic 0.03, government 0.01 |
| `default_doc_language text default 'th'` | |
| `payment_term_days int default 30` | |
| `note text default ''`, `archived_at null`, `created_by`, `created_at`, `updated_at` | |
| index `(workspace_id, archived_at)`; partial unique `(workspace_id, tax_id, branch_code) where tax_id <> '' and archived_at is null` | |

### 1.8 ลิงก์ลูกค้า `customer_links` (WP-14)

`id`, `workspace_id`, `project_id` (+tenant FK), `token_hash text unique` (sha256 จาก `newOpaqueToken()` ใน `backend/src/shared/infrastructure/crypto.ts`), `subject_type check in ('quotation','variation','invoice')`, `subject_id uuid`,
`created_by`, `created_at`, `expires_at timestamptz` (ค่าเริ่มต้น +30 วัน), `revoked_at null`, `last_viewed_at null`, `view_count int default 0`, `responded_at null`,
`response jsonb null` (`{action:'accept'|'request_change'|'reject', name, note, ip, userAgent, at}`); index `(workspace_id, subject_type, subject_id)`
token ดิบคืนให้ผู้สร้างครั้งเดียว (แบบ invitation) ตอบได้ครั้งเดียว (`responded_at` ไม่ null → `conflict`, `reason:'already_responded'`)
action ที่รับได้ตาม subject: `quotation` = `accept` | `request_change` | `reject`; `variation` = `accept` | `reject`; `invoice` = ดูอย่างเดียว (respond → `unprocessable`, `reason:'respond_not_supported'`)
ลิงก์ใช้ได้เฉพาะเอกสารสถานะที่ตอบได้ (quotation version `issued`, VO `submitted`, invoice `issued`/`partially_paid`) ไม่งั้น view แสดงสถานะล่าสุดและ respond → `conflict`, `reason:'invalid_transition'`

### 1.9 Project Hub: คอลัมน์ใหม่ใน `projects` (WP-15) — `schema.ts`

| คอลัมน์ | หมายเหตุ |
|---|---|
| `code text null` | partial unique `(workspace_id, code) where code is not null`; ได้จาก `DocumentNumbering` docType `project` เมื่อสร้างโครงการขณะ hub active หรือกด "ออกรหัส"; แก้เองได้ (ไม่ใช่เอกสารภาษี) |
| `status text not null default 'estimating'` + check | `PROJECT_STATUSES` ด้านล่าง |
| `project_type text null` + check | null = ใช้ `company_profiles.default_project_type` หรือ `residential_new` |
| `customer_id uuid null` | ไม่มี FK (ตาราง customers อยู่อีกไฟล์) ตรวจผ่าน `CustomerLookup` |
| `site_address text not null default ''` | |
| `planned_start`, `planned_finish`, `actual_start`, `actual_finish` | `date null` |
| `manager_user_id uuid null` | |
| `settings jsonb not null default '{}'` | `Partial<ProjectCommercialSettings>` |
| `description text not null default ''` | |

`PROJECT_STATUSES = ['lead','estimating','quoted','won','in_progress','handover','warranty','closed','lost','cancelled']`

| จาก | ไปได้ (ผู้ใช้เปลี่ยนเอง `projects.edit`) | เปลี่ยนอัตโนมัติจากเหตุการณ์ |
|---|---|---|
| `lead` | estimating, lost, cancelled | |
| `estimating` | quoted, lost, cancelled | ออกใบเสนอราคา → `quoted` |
| `quoted` | won, estimating, lost, cancelled | ลูกค้ารับใบเสนอราคา → `won` |
| `won` | in_progress, cancelled | เซ็นสัญญา → `in_progress` |
| `in_progress` | handover, cancelled | เริ่มส่งมอบ → `handover` |
| `handover` | warranty, in_progress | ลูกค้ารับมอบ → `warranty` |
| `warranty` | closed | ปิดโครงการ (closeout final) → `closed` |
| `closed` | warranty (owner เท่านั้น: เปิดใหม่) | |
| `lost`, `cancelled` | estimating | |

เปลี่ยนอัตโนมัติผ่าน port `ProjectLifecycle.advance(workspaceId, projectId, to, by)` (provide โดย `hub`) ซึ่ง **เดินหน้าเท่านั้น** ตามลำดับ
`lead < estimating < quoted < won < in_progress < handover < warranty < closed` ถ้าสถานะปัจจุบันอยู่ที่หรือเลยเป้าหมายแล้ว หรือเป็น `lost`/`cancelled` ไม่ทำอะไร

ความเป็นเจ้าของ: คอลัมน์เหล่านี้อยู่ในตาราง `projects` แต่ **โมดูล `hub` เป็นผู้อ่าน/เขียนแต่ผู้เดียว** (repository ของ hub `update` เฉพาะคอลัมน์ hub) โมดูล `projects` เดิมไม่แตะ
`projectDtoSchema` เดิม **ไม่เปลี่ยน**; ฟิลด์ hub อยู่ใน `hubProjectFieldsSchema` (`code`, `status`, `projectType`, `customerId`, `siteAddress`, `plannedStart`, `plannedFinish`, `actualStart`, `actualFinish`, `managerUserId`, `settings`, `description`)
และ `HubProjectDto = { project: ProjectDto; hub: HubProjectFields; customerName: string | null; rollup: ProjectRollup }` ใน `src/shared/contract/erp/hub.ts`
`meta.ownerName` / `meta.siteAddress` ในเอกสาร BOQ **ไม่ซิงก์อัตโนมัติ** กับลูกค้า/ที่อยู่ของ Hub (มีปุ่ม "คัดลอกไปหัว BOQ" ใน overview) — Decisions log D-09

### 1.10 ประวัติ BOQ, baseline, cost codes (WP-17, WP-18) — `schema-boq-control.ts`

**`boq_versions`** (หนึ่งแถวต่อ `project_revisions` หนึ่งแถว)
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id` (+tenant FK) | |
| `revision_id uuid not null unique` FK `project_revisions(id)` on delete cascade | `project_revisions` อยู่ใน `schema.ts` (core) จึง FK ได้ |
| `version_no int` unique `(project_id, version_no)` | 1, 2, 3 … ตามลำดับสร้าง |
| `kind` check `in ('snapshot','baseline')` | `baseline` = ฉบับที่ถูกล็อกเป็นฐาน |
| `engine_version text` | `ENGINE_VERSION` ตอนคำนวณบรรทัด |
| `construction_total`, `pre_construction_total`, `mat_total`, `lab_total` | money (ผลรวมบรรทัดที่ปัดแล้ว) |
| `line_count int`, `created_by`, `created_at` | |

**`boq_version_sections`** PK `(version_id, section_no)`: `workspace_id`, `title_th`, `in_construction_total boolean`, `mat_total`, `lab_total`, `total`

**`boq_version_lines`** PK `(version_id, line_key)`
`workspace_id`, `section_no int`, `sort int`, `item_no text default ''`, `desc_th text`, `unit text`, `qty quantity`, `gross_qty quantity null`, `waste rate`,
`mat_unit unitPrice`, `lab_unit unitPrice`, `mat_total money`, `lab_total money`, `total money`, `material_basis text`, `labour_basis text`
เก็บเฉพาะแถว `item` ที่ `qty ≠ 0` หรือ `total ≠ 0`; `mat_total = round2(row.matTotal)`, `lab_total = round2(row.labTotal)`, `total = mat_total + lab_total`
คำนวณด้วย pure function `boqVersionLines(boq: BoqResult)` ใน `src/domain/boq-control/version-lines.ts` จาก `computeProject(snapshot).boq`

การสร้าง: `RevisionHooks` (§11 ของ architecture) ใน transaction ของ `CreateRevisionUseCase` เดิม — boq-control ลงทะเบียน hook ที่ทำงานเฉพาะเมื่อ `boq-control` active
revision เก่าที่ยังไม่มี `boq_versions` สร้างแบบ lazy ตอนเปิดดูครั้งแรก (คำนวณจาก snapshot ด้วย engine ปัจจุบัน; `engine_version` = ปัจจุบัน)

Compare: `diffBoqVersions(a, b)` ใน `src/domain/boq-control/diff.ts` → `{ sections: {no, before, after, delta}[], lines: {lineKey, change:'added'|'removed'|'changed'|'same', before?, after?, deltaQty, deltaTotal}[], totals }`
`to = 'live'` = คำนวณจาก project docs ปัจจุบัน (ไม่บันทึก)

**`project_baselines`**
`id`, `workspace_id`, `project_id`, `version_id uuid` FK `boq_versions` (ไฟล์เดียวกัน), `status check in ('active','unlocked')`, `reason check in ('contract_signed','manual')`, `contract_id uuid null`,
`locked_by`, `locked_at`, `unlocked_by null`, `unlocked_at null`, `unlock_reason text default ''`; partial unique `(project_id) where status = 'active'`

**`project_cost_codes`** — หัวใจของ ERP
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id uuid` | **id ถาวร** ทุกโมดูลอ้าง id นี้ |
| `workspace_id`, `project_id` (+tenant FK) | |
| `code text` unique `(project_id, code)` | baseline: `line_key` (เช่น `R58`, `rebar-footing:rebar:DB12`); VO: `VO{voSeq}-{n}`; manual: `X-{n}` |
| `source` check `in ('baseline','variation','manual')`, `source_ref uuid null` | variation id |
| `section_no int`, `line_key text null`, `desc_th text`, `desc_en text default ''`, `unit text`, `sort int` | |
| `baseline_qty quantity`, `baseline_mat_unit unitPrice`, `baseline_lab_unit unitPrice`, `baseline_mat money`, `baseline_lab money`, `baseline_total money` | ต้นทุนตาม baseline |
| `vo_qty quantity default 0`, `vo_cost money default 0` (signed) | สะสมจาก VO ที่อนุมัติ |
| `budget_total money` | = `baseline_total + vo_cost` (อัปเดตพร้อมกันทุกครั้ง) |
| `contract_amount money default 0` | มูลค่าขาย (ไม่รวม VAT) ที่จัดสรรจากสัญญา (ใช้วางบิลตามผลงาน) |
| `vo_contract_amount money default 0` (signed) | มูลค่าขายจาก VO |
| `reported_progress rate default 0` | % สะสมล่าสุดจากรายงานประจำวัน |
| `certified_progress rate default 0` | % สะสมล่าสุดใน claim ที่ certified แล้ว |
| `status` check `in ('active','omitted')` | omitted = หายไปเมื่อ re-baseline หรือ VO ตัดทั้งรายการ |
| `created_at`, `updated_at` | |

กฎ:
- ล็อก baseline (WP-18): `POST /projects/:projectId/baseline {versionId?, reason}` (`boq.baseline.lock`) สร้าง revision ใหม่อัตโนมัติชื่อ `BASELINE-<n>` ถ้าไม่ระบุ version
  เปลี่ยน `boq_versions.kind = 'baseline'` สร้าง/อัปเดต cost code จาก `boq_version_lines` (upsert ตาม `code`; รายการที่ไม่มีแล้ว → `omitted`)
- หลังล็อก `PutDocUseCase` ปฏิเสธ doc key `calc:*`, `boq:*` และ `journey` (`conflict`, `reason:'baseline_locked'`) ผ่าน `BoqEditLocks` เพราะทั้งสามเปลี่ยนปริมาณ BOQ (`journey` เก็บการข้ามงาน "ไม่มีในโครงการนี้") ส่วน `meta` และ `planning:*` ยังแก้ได้
  `DELETE`/reset doc (ถ้ามี endpoint) ใช้กฎเดียวกัน; `CreateRevisionUseCase` ยังสร้าง revision ได้ตามปกติ
- ปลดล็อก: `POST /projects/:projectId/baseline/unlock {reason}` (`boq.baseline.unlock`) ได้เฉพาะเมื่อ: สัญญายังเป็น `draft` หรือไม่มี, ไม่มี `ar_claims`, ไม่มี VO ที่ accepted, ไม่มี `cost_ledger_entries`
  (ตรวจผ่าน registry `BaselineUnlockGuards` ที่แต่ละโมดูลลงทะเบียน) cost code **ไม่ถูกลบ** ล็อกใหม่จะ upsert ตาม `code` จึงไม่มี id ห้อย
- ราคาขายต่อ cost code: ตอนเซ็นสัญญา (WP-26) ผ่าน `CostCodeLookup.allocateContractAmounts` จัดสรร `original_value` (ไม่รวม VAT) ลง `contract_amount` สูตรเดียวทุกรูปแบบ:
  `contract_amount[] = allocate(original_value, weights = sell_amount ของแต่ละบรรทัด kind 'boq'|'custom' ในหมวดที่ included ของฉบับที่ลูกค้ารับ)` (Σ = `original_value` พอดี รวมผลของส่วนลด/ปัดเศษแล้ว)
  จับคู่บรรทัด → cost code ด้วย `line_key = project_cost_codes.line_key`; บรรทัดที่ไม่มี `line_key` หรือไม่มีใน baseline → สร้าง cost code `source='manual'` (`X-{n}`, baseline_* = 0, desc จากบรรทัด)
  cost code baseline ที่ไม่มีบรรทัดใบเสนอราคาคู่ → `contract_amount = 0` (SignDialog แสดงคำเตือนจำนวนบรรทัดนี้)
  ไม่มีใบเสนอราคา → `allocate(original_value, weights = baseline_total)`; ถ้า Σ baseline_total = 0 → แบ่งเท่ากัน (กติกาของ `allocate` เมื่อ weights รวม 0)
  ถ้ายังไม่มี baseline ตอนเซ็น: ล็อกจาก `qt_quotation_versions.boq_version_id` ของฉบับที่รับ (ถ้ามี) ไม่งั้นสร้าง revision ใหม่ `BASELINE-<n>` — บรรทัดใบเสนอราคาจึงตรง baseline เป็นค่าเริ่มต้น
- port `CostCodeLookup` (provide โดย boq-control): `findMany(workspaceId, projectId, ids)`, `listByProject(...)`, `applyVariation(...)`, `setReportedProgress(...)`, `setCertifiedProgress(...)`

### 1.11 Ledger (WP-20) — `schema-ledger.ts`

**`cost_ledger_entries`** (append-only)
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id` (+tenant FK) | |
| `cost_code_id uuid null` | null = ค่าใช้จ่ายโครงการที่ไม่ลงรายการ (overhead) |
| `entry_date date` | |
| `kind` check `in ('commit','commit_release','actual')` | |
| `category` check `in ('material','labour','subcontract','equipment','other')` | |
| `amount money` (signed, ไม่รวม VAT) | |
| `qty quantity null` | |
| `source_type text`, `source_id uuid`, `source_line_id uuid null` | `purchase_order`, `goods_receipt`, `supplier_bill`, `subcontract`, `sc_claim`, `timesheet`, `site_diary`, `warranty_claim`, `manual` |
| `commitment_ref uuid null` | บรรทัดของ PO/สัญญาที่ถูกปลดผูกพัน |
| `reverses_id uuid null`, `note text default ''`, `created_by`, `created_at` | |
| index `(workspace_id, project_id, cost_code_id)`, `(workspace_id, source_type, source_id)` | |

ยอดต่อ cost code: `committed_open = Σ commit + Σ commit_release`, `actual = Σ actual`
port `CostLedger`: `post(entries[])` (ใน transaction), `totalsByCostCode(ws, projectId)`, `totalsByProject(ws, projectIds)`, `entriesBySource(ws, sourceType, sourceId)`

**`fin_events`** (append-only, พร้อมแปลงเป็น GL)
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id uuid null` (ไม่มี FK) | |
| `event_date date`, `event_type text` check ใน `FIN_EVENT_TYPES` | |
| `direction` check `in ('in','out','none')` | ทิศทางเงินสด |
| `counterparty_type` check `in ('customer','supplier','subcontractor','worker','government','other')`, `counterparty_id uuid null`, `counterparty_name text`, `counterparty_tax_id text default ''`, `counterparty_branch text default ''` | ให้รายงานภาษีอ่านจากที่นี่ได้ |
| `doc_type text null`, `doc_number text null`, `doc_date date null` | |
| `source_type text`, `source_id uuid` | |
| `net`, `vat`, `wht`, `retention`, `cash` | money signed: `net` ไม่รวม VAT, `cash` = เงินที่เคลื่อนจริง (0 ถ้าไม่ใช่เงินสด) |
| `reverses_id uuid null`, `data jsonb default '{}'`, `created_by`, `created_at` | |
| index `(workspace_id, event_date)`, `(workspace_id, project_id, event_date)`, `(workspace_id, event_type, event_date)` | |

`FIN_EVENT_TYPES`:
`ar.advance_invoiced`, `ar.invoiced`, `ar.tax_invoiced`, `ar.credit_noted`, `ar.receipt`, `ar.wht_withheld_by_customer`, `ar.retention_withheld`, `ar.retention_released`, `ar.advance_recovered`, `ar.penalty`,
`ap.bill_posted`, `ap.payment`, `ap.wht_withheld`, `ap.retention_withheld`, `ap.retention_released`,
`lb.wages_paid`, `lb.advance_paid`, `lb.advance_recovered`, `sc.claim_paid`
port `FinancialEvents`: `post(event)`, `reverse(eventId, by, date)`, `list(ws, {from, to, types, projectId})`

### 1.12 ราคากลางภาครัฐ (WP-21) — `schema-erp-core.ts`

**`price_reference_books`**: `id`, `workspace_id uuid null` (null = ทั้งแพลตฟอร์ม; ตารางนี้ **ยกเว้น** กฎ workspace_id not null), `source text` (`'government_green_2568'`), `year text`, `title_th`, `title_en`, `item_count int`, `imported_at`
**`price_reference_items`**: `id`, `book_id` FK cascade, `mid text` (JSON เป็นตัวเลข → `String(mid)`), `category text`, `material text`, `spec text`, `brand text`, `model text` (= `model` + ' ' + `sub_spec_model` ถ้าไม่ว่าง), `unit text` (จากฟิลด์ `unit_type`), `green_label boolean` (`envirolment_proof` ไม่ว่าง), `price money`, `search text` (lowercase รวม material/spec/brand/model/category); index `(book_id, category)`, index `search` แบบ `text_pattern_ops` (ไม่ใช้ extension)
นำเข้าด้วย `backend/src/cli/import-price-reference.ts` จาก `goverment_price.json` ที่ root (`result.items[]`, 5,571 แถว; `price_baht` string `"2,731.10"` → 2731.10):
  แถวที่ `price_baht` ไม่ใช่ตัวเลข (`"-"` มี 1,012 แถว) ข้ามและพิมพ์จำนวน → **คาดว่านำเข้า 4,559 แถว**; book: `source='government_green_2568'`, `year='2568'` (ทุกแถวที่มีราคามี year 2568)

---

## 2. ใบเสนอราคา (WP-22 … WP-25) — `schema-quotations.ts`, prefix `qt_`

**`qt_quotations`** (หัวเรื่อง หนึ่งโครงการมีได้หลายใบ เช่นทางเลือก A/B)
`id`, `workspace_id`, `project_id`, `customer_id uuid null`, `title text`, `number text null` (เลขฐาน ได้ตอน issue ครั้งแรก), `current_version_id uuid null`, `accepted_version_id uuid null`, `created_by`, `created_at`, `updated_at`

**`qt_quotation_versions`**
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `quotation_id` FK cascade, `workspace_id`, `project_id` | |
| `version_no int` unique `(quotation_id, version_no)` | |
| `status` check | `QUOTATION_VERSION_STATUSES` ด้านล่าง; partial unique `(quotation_id) where status in ('draft','pending_approval')` (ร่างได้ทีละฉบับ) |
| `boq_version_id uuid null` | ฉบับ BOQ ที่ใช้สร้าง (snapshot ณ ตอนกด "สร้างจาก BOQ") |
| `format` check `in ('lump_sum_by_category','detailed','government')`, `detail_level` check `in ('full','per_category','lump_sum')` | |
| `language` check `in ('th','en')` | |
| `issue_date date null`, `valid_until date null` | |
| `number text null` | ฉบับแรก = เลขฐาน (`QT2026-0001`), ฉบับถัดไป = `${base}-R${version_no - 1}` |
| `customer_snapshot jsonb`, `company_snapshot jsonb` | ตั้งตอน issue |
| `pricing jsonb QuotationPricing` | ด้านล่าง |
| `totals jsonb QuotationTotals` | `{cost, sell, discount, vatBase, vat, grandTotal, marginAmount, marginPct}` |
| `payment_terms jsonb MilestoneTemplateItem[]` | ข้อเสนองวดเงิน (ใช้ตั้งต้นสัญญา) |
| `terms_th`, `terms_en`, `note` | text |
| `accepted_at`, `accepted_by_name`, `response_note` | จากลิงก์ลูกค้าหรือบันทึกเอง |
| `issued_by`, `issued_at`, `created_by`, `created_at`, `updated_at` | |

```ts
export interface QuotationPricing {
    vatMode: 'document' | 'per_category' | 'none' | 'included_in_factor';   // none เมื่อบริษัทไม่จด VAT; included_in_factor สำหรับ government
    vatRate: number;
    defaults: { markupRate: number; overheadRate: number; profitRate: number };  // ค่าเริ่มต้นของหมวดใหม่
    discount: { kind: 'amount' | 'pct'; value: number } | null;                // ห้ามใช้คู่กับ vatMode 'per_category'
    rounding: 'none' | 'to_100' | 'to_1000';                                    // ปัด subtotal (เป็นบรรทัดปรับเศษ)
    parts: { key: string; titleTh: string; titleEn: string; sectionNos: number[]; factorF: number }[]; // government: ปร.5 ต่อ part, ปร.6 เมื่อ > 1 part
}
```

**`qt_quotation_sections`** PK `(version_id, section_no)`: `workspace_id`, `title_th`, `title_en`, `included boolean`, `sort`,
`cost_mat`, `cost_lab`, `cost_total`, `markup_rate`, `overhead_rate`, `profit_rate`, `vat_rate rate null`, `sell_total`
หมวดที่ผู้ใช้เพิ่มเองใช้ `section_no >= 100`

**`qt_quotation_lines`**: `id`, `version_id` FK cascade, `workspace_id`, `section_no`, `sort`, `kind check in ('boq','custom','note')`, `line_key text null`,
`desc_th`, `desc_en`, `unit`, `qty`, `cost_mat_unit`, `cost_lab_unit`, `cost_amount`, `sell_mat_unit`, `sell_lab_unit`, `sell_unit`, `sell_amount`

กติกาการคำนวณ (pure, `src/domain/quotation/pricing.ts`, WP-22):
1. `sellFactor(section) = 1 + markup_rate + overhead_rate + profit_rate` (บวกกันเป็นสัดส่วนของต้นทุน)
2. `detail_level = 'full'`: `sell_mat_unit = round2(cost_mat_unit × f)`, `sell_lab_unit = round2(cost_lab_unit × f)`, `sell_unit = sell_mat_unit + sell_lab_unit`, `sell_amount = round2(qty × sell_unit)`, `section.sell_total = sumMoney(lines)`
3. `per_category` / `lump_sum`: `section.sell_total = round2(section.cost_total × f)` แล้ว `line.sell_amount = allocate(section.sell_total, line.cost_amount[])` (บรรทัดยังเก็บไว้เพื่อจัดสรรสัญญา แม้ไม่พิมพ์)
   เอกสารพิมพ์: `per_category` แสดงหนึ่งบรรทัดต่อหมวด; `lump_sum` แสดงรายการหมวดเป็นขอบเขตงาน (ไม่มีราคา) และยอดรวมก้อนเดียว
4. `government`: ปร.4 แสดงต้นทุนต่อหน่วยวัสดุ/ค่าแรง (ไม่มี markup, markup/overhead/profit ของหมวด = 0); ต่อ part: `partSell = round2(Σ cost_total ของหมวดใน part × factorF)`;
   `section.sell_total = allocate(partSell, cost_total ของหมวดใน part)`, `line.sell_amount = allocate(section.sell_total, line.cost_amount[])`; หมวดที่ included ต้องอยู่ใน part เดียวพอดี (ตรวจ `superRefine`)
   `vatMode = 'included_in_factor'` (Factor F รวม VAT แล้ว); `grandTotal = Σ partSell`; ฐานไม่รวม VAT: `{net: vatBase, vat} = splitVatInclusive(grandTotal, vatRate)` เมื่อบริษัทจด VAT ไม่งั้น `vatBase = grandTotal`, `vat = 0`; ห้ามใช้ discount/rounding
5. ระดับเอกสาร (ไม่ใช่ government): `subtotal = Σ sell_total ของหมวดที่ included`; ส่วนลด (`pct` → `round2(subtotal × value)`); ปัดเศษ (`roundingAdj` = ค่าที่ทำให้ `subtotal − discount` เป็นทวีคูณของ 100/1000 ปัดลง ติดลบหรือ 0); `vatBase = subtotal − discount + roundingAdj`;
   `vat`: `document` → `round2(vatBase × vatRate)`; `per_category` → `Σ round2(section.sell_total × (section.vat_rate ?? vatRate))` (ห้ามใช้คู่กับ discount หรือ rounding — ตรวจ `superRefine`); `none` → 0
   `grandTotal = vatBase + vat`; `cost = Σ cost_total ของหมวดที่ included`; `marginAmount = vatBase − cost`; `marginPct = vatBase > 0 ? marginAmount / vatBase : 0`
   บริษัทไม่จด VAT (`company_profiles.vat_registered = false`) → บังคับ `vatMode = 'none'` (government: `vatBase = grandTotal`)
6. ข้อมูล BOQ เข้า: `buildQuotationDraft(boqVersionLines, sections, settings)` → sections + lines (desc_en จาก overlay `src/domain/boq/template.v5.en.ts` ถ้ามี) — WP-22
7. เทียบฉบับ: `compareQuotationVersions(a, b)` → delta ต่อหมวด/บรรทัดและยอดรวม — WP-22

`QUOTATION_VERSION_STATUSES` และ transition:

| จาก | ไป | ทำโดย |
|---|---|---|
| `draft` | `pending_approval` (นโยบาย `quotation.issue` pending), `issued` (อนุมัติอัตโนมัติ; ออกเลข), `cancelled` | ผู้ใช้ `quotations.issue` |
| `pending_approval` | `issued`, `draft` (ถูกปฏิเสธ) | handler ของการอนุมัติ |
| `issued` | `accepted`, `change_requested`, `rejected` (ลิงก์ลูกค้าหรือบันทึกเอง), `expired` (sweep เมื่อเลย `valid_until`), `superseded` (มีฉบับใหม่ issued) | |
| `change_requested` | `superseded` (เมื่อฉบับใหม่ issued) | |
| `accepted` | — (สุดท้าย) | |
| `rejected`, `expired`, `superseded`, `cancelled` | — | |

เมื่อ accepted: `qt_quotations.accepted_version_id`, `ProjectLifecycle.advance(..., 'won')`, แจ้งเตือน `quotation.accepted`, ฉบับ issued อื่นของใบเดียวกัน → `superseded`
ฉบับใหม่ = คัดลอกฉบับล่าสุด (`POST /quotations/:id/versions {fromVersionId}`) หรือสร้างจาก BOQ ฉบับใหม่

---

## 3. สัญญาหลัก (WP-26, WP-27) — `schema-contracts-billing.ts`, prefix `mc_`

**`mc_contracts`**
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id` | partial unique `(project_id) where status not in ('cancelled','terminated')` (หนึ่งสัญญาที่มีผลต่อโครงการ) |
| `customer_id uuid not null`, `quotation_id null`, `quotation_version_id null` | |
| `quoted_margin_pct rate null` | snapshot `totals.marginPct` ของฉบับที่รับ (job-cost ใช้เตือน `margin_drop`) |
| `number text null` | `CT` ตอน sign; unique `(workspace_id, number)` |
| `status` check | `draft → signed → completed → closed`; `draft → cancelled`; `signed → terminated` |
| `title`, `language` | |
| `sign_date`, `start_date`, `finish_date` (date), `duration_days int` | `finish_date` ขยายตาม VO ที่อนุมัติ (`extension_days`) |
| `billing_mode` check `in ('milestone','progress')` | |
| `original_value money`, `current_value money` | ไม่รวม VAT; current = original + Σ VO accepted |
| `vat_rate rate` | 0 เมื่อบริษัทไม่จด VAT |
| `extension_days int default 0` | |
| `terms jsonb MainContractTerms` | ด้านล่าง |
| `body_th`, `body_en` | HTML ที่ผ่าน sanitizer (ใช้ซ้ำจาก `src/domain/subcontracting/contract-template.ts`: WP-26 แยกฟังก์ชัน sanitize ไปที่ `src/domain/erp/html-sanitize.ts` แล้วให้ไฟล์เดิม re-export) |
| `customer_snapshot`, `company_snapshot` | |
| `signed_scan_file_ids jsonb uuid[]` | |
| `completed_at`, `closed_at`, `terminated_at`, `termination_reason` | |
| `created_by`, `created_at`, `updated_at` | |

```ts
export interface MainContractTerms {
    advancePct: number;                     // 0–0.3
    retentionPct: number;                   // 0–0.1
    retentionCapPct: number | null;         // เพดานเงินประกันสะสม (สัดส่วนของมูลค่าสัญญา) null = ไม่มี
    retentionRelease: 'half_at_completion_half_after_warranty' | 'all_after_warranty' | 'all_at_completion';
    customerWhtRate: number;
    penaltyRatePerDay: number;              // สัดส่วนต่อวัน
    penaltyBase: 'contract_value' | 'remaining_work';
    penaltyCapPct: number;                  // 0.1 ค่าเริ่มต้น
    warrantyMonths: number;
    guaranteePct: number;
    paymentTermDays: number;
    escalation: { enabled: boolean; fixed: number; terms: { index: string; weight: number; baseValue: number }[]; threshold: number } | null;
}
```

**`mc_milestones`**: `id`, `contract_id` FK cascade, `workspace_id`, `project_id`, `no int` unique `(contract_id, no)`, `label_th`, `label_en`,
`kind check in ('advance','work','final')`, `pct rate`, `amount money` (`allocate(current_value, pct[])` ของงวดที่ยังไม่ claim),
`trigger check in ('signing','progress','date','handover','manual')`, `trigger_progress rate null`, `due_date date null`,
`cost_code_ids jsonb uuid[]` (งานที่ต้องเสร็จสำหรับงวดนี้; ว่างได้), `status check in ('planned','claimable','claimed','invoiced','paid')`, `source check in ('contract','variation')`
- งวด `advance` มีได้งวดเดียว เกิดจาก `terms.advancePct > 0` และวางบิลเป็นใบแจ้งหนี้เงินล่วงหน้า (ผู้ใช้กดสร้างใน billing หลังเซ็น — D-33); `amount = round2(original_value × advancePct)`
- ผลรวม `pct` ของงวด `work`+`final` = 1 (ตรวจด้วย `superRefine`, ยอมคลาดเคลื่อน 1e-9); งวด `advance` ไม่นับรวม (เป็นเงินที่หักคืน)
- **มัดจำ (deposit) ≠ เงินล่วงหน้า:** "มัดจำ 20%" ของแม่แบบบ้านคืองวด `kind='work'`, `trigger='signing'` (เป็นส่วนหนึ่งของมูลค่าสัญญา ไม่หักคืน) ส่วน `advancePct` คือเงินล่วงหน้าที่หักคืนทุกงวด
- `trigger='progress'` ใช้ `trigger_progress` (สัดส่วนงานสะสมถ่วงด้วย `contract_amount`); `status` `planned → claimable` คำนวณตอนอ่าน (ไม่มี job): signing → claimable ทันทีหลังเซ็น, progress → เมื่อถึง %, date → เมื่อถึง `due_date`, handover → เมื่อ handover accepted, manual → ผู้ใช้กด

**`mc_guarantees`**: `id`, `contract_id`, `workspace_id`, `project_id`, `kind check in ('performance','advance_payment','warranty')`, `form check in ('bank_guarantee','cash','cheque','bond')`,
`issuer`, `ref_no`, `amount money`, `issue_date`, `expiry_date`, `status check in ('active','returned','claimed','expired')`, `returned_at date null`, `file_ids jsonb`, `note`

transition สัญญา:

| จาก | ไป | ผลข้างเคียง |
|---|---|---|
| `draft` | `signed` | ออกเลข `CT`; ล็อก baseline ถ้ายังไม่ล็อก (`reason:'contract_signed'`, จาก `boq_version_id` ของใบเสนอราคาที่รับ — §1.10); จัดสรร `contract_amount` ลง cost code; สร้างงวด; `ProjectLifecycle.advance('in_progress')`; ถ้ามีเงินล่วงหน้า หน้า billing แสดงปุ่มสร้างใบแจ้งหนี้เงินล่วงหน้า (ไม่สร้างอัตโนมัติ D-33) |
| `draft` | `cancelled` | |
| `signed` | `completed` | เรียกโดย handover เมื่อลูกค้ารับมอบ |
| `completed` | `closed` | เมื่อพ้นประกันและคืนเงินประกันครบ (ผู้ใช้กด) |
| `signed` | `terminated` | เหตุผลบังคับ |

---

## 4. วางบิลและลูกหนี้ (WP-28 … WP-32) — `schema-contracts-billing.ts`, prefix `ar_`

### 4.1 งวดเบิก `ar_claims`
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id`, `contract_id`, `milestone_id uuid null` | milestone mode ต้องมี |
| `claim_no int` unique `(contract_id, claim_no)` | |
| `period_from`, `period_to` | date |
| `status` check | ด้านล่าง; partial unique `(contract_id) where status in ('draft','pending_approval','submitted')` (เปิดได้ทีละงวด) |
| `work_value` | W ของงวดนี้ |
| `cumulative_value`, `previous_value` | สะสม |
| `advance_recovery`, `retention`, `penalty`, `penalty_days int`, `escalation` (signed), `other_deduction`, `other_deduction_note` | |
| `vat_base`, `vat`, `wht`, `payable` | |
| `certified_by_name`, `certified_at`, `certified_note` | ผู้ตรวจ/ลูกค้ายืนยัน |
| `invoice_id uuid null` | |
| `created_by`, `created_at`, `updated_at` | |

**`ar_claim_lines`** PK `(claim_id, cost_code_id)`: `workspace_id`, `contract_amount` (ณ ตอนทำ claim = `contract_amount + vo_contract_amount`), `prev_progress rate`, `cum_progress rate`, `prev_amount`, `cum_amount = round2(contract_amount × cum_progress)`, `this_amount = cum_amount − prev_amount`
ค่าเริ่มต้น `cum_progress` = `project_cost_codes.reported_progress` (จากรายงานประจำวัน; 0 ถ้ายังไม่มี) ผู้ใช้แก้ได้ (0–1) ห้ามต่ำกว่า `prev_progress` เว้นแต่ใส่ `note` (เหตุผล) ในบรรทัด
progress mode: claim มีบรรทัดทุก cost code `active` ที่ `contract_amount + vo_contract_amount ≠ 0`; milestone mode: บรรทัดบันทึกได้ (เพื่ออัปเดต `certified_progress`) แต่ไม่มีผลต่อ W

สูตร (pure `src/domain/billing/claim.ts`, WP-28):
```
W  = progress mode: Σ this_amount   |  milestone mode: milestone.amount (งวด kind 'work'/'final' ที่ status claimable; งวด advance ไม่ทำ claim)
A  = min(round2(W × advancePct), advanceReceived − advanceRecovered)          (งวดสุดท้าย: คืนส่วนที่เหลือทั้งหมด)
R  = round2(W × retentionPct) แต่ไม่เกิน cap − retentionWithheldSoFar
P  = penalty: ป้อน `penalty_days` → round2(penaltyDays × penaltyRatePerDay × penaltyBaseValue) (contract_value = current_value; remaining_work = current_value − cumulative_value ก่อนงวดนี้)
     ไม่เกิน round2(penaltyCapPct × current_value) − Σ penalty ของงวดก่อนหน้า (cap สะสมทั้งสัญญา); ผู้ใช้แก้ยอดเองได้ภายในเพดาน
E  = escalation (ถ้า enabled: escalationAmount(W − A, K, threshold))
base = W − A + E
VAT = round2(base × vatRate)
WHT = round2(base × customerWhtRate)
payable = base + VAT − R − WHT − P − otherDeduction
```
- ค่าปรับไม่ลดฐาน VAT (หักจากยอดจ่าย) และ VAT คิดบนทั้งงวดรวมส่วนที่ถูกหักประกัน (Decisions log D-06)
- `vatRate` = `mc_contracts.vat_rate`; `customerWhtRate` = `terms.customerWhtRate`; `advanceReceived` = Σ `ar_advance_entries` received; งวดสุดท้าย = claim ที่ทำให้ cumulative_value = current_value (progress) หรือของงวด `final` (milestone)
- ค่า K: `K = fixed + Σ weight × (current/baseValue)`; `|K − 1| ≤ threshold` → 0; `K > 1 + threshold` → `round2(base × (K − 1 − threshold))`; `K < 1 − threshold` → `−round2(base × (1 − threshold − K))` (สัมประสิทธิ์ป้อนเองต่อสัญญา D-13)

State:
| จาก | ไป | หมายเหตุ |
|---|---|---|
| `draft` | `pending_approval` / `submitted` | ผ่าน `claim.submit` (ปกติข้ามอัตโนมัติ) |
| `pending_approval` | `submitted` / `draft` | |
| `submitted` | `certified` (บันทึกผู้ตรวจรับ แก้ % ได้ก่อน certify), `draft` (ถอนกลับ), `cancelled` | |
| `certified` | `invoiced` | ออกใบแจ้งหนี้ (ออกเลข `INV`); อัปเดต `certified_progress`; เขียน `ar_retention_entries` (withheld) และ `ar_advance_entries` (recovered); `fin_events` |
| `draft` | `cancelled` | |

### 4.2 ใบแจ้งหนี้ ใบกำกับภาษี ใบลดหนี้ `ar_invoices`
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id null`, `contract_id null`, `claim_id null`, `customer_id` | |
| `kind` check `in ('advance_invoice','invoice','tax_invoice','credit_note')` | |
| `number text null`, `status` check `in ('draft','issued','partially_paid','paid','voided')` | doc type: advance_invoice/invoice → `invoice`; tax_invoice → `tax_invoice`; credit_note → `credit_note` |
| `issue_date`, `due_date`, `language` | |
| `customer_snapshot`, `company_snapshot` | |
| `lines jsonb {descTh, descEn, amount}[]` | สรุปบรรทัดบนเอกสาร |
| `net`, `vat`, `total` (= net + vat), `retention`, `advance_recovery`, `penalty`, `wht_expected`, `payable` | |
| `paid_amount money default 0` | รวมเงินสด + WHT ที่ลูกค้าหัก ที่ settle แล้ว |
| `related_invoice_id uuid null` | tax_invoice → invoice ต้นทาง; credit_note → tax_invoice ที่ลด |
| `void_reason`, `issued_by`, `issued_at`, `created_by`, `created_at` | |

- ใบกำกับภาษี (บริการ จุดความรับผิดเมื่อรับเงิน) ออกตอนบันทึกรับเงิน (ค่าเริ่มต้น) หรือออกเองล่วงหน้าได้ (ทั้งก้อน)
  รับบางส่วน: `ratio = settled / (invoice.payable + invoice.wht_expected)` โดย `settled` = cash + WHT ที่จัดสรรให้ใบนี้; TI `net = round2(invoice.net × ratio)`, `vat = round2(net × vatRate)`;
  ครั้งที่ทำให้ใบแจ้งหนี้ `paid`: TI รับส่วนที่เหลือทั้งหมด (`net = invoice.net − Σ TI.net ก่อนหน้า`, `vat = invoice.vat − Σ TI.vat ก่อนหน้า`) กันเศษ
  สถานะ: `paid_amount ≥ payable + wht_expected` → `paid`; มากกว่า 0 → `partially_paid`; รับเกินยอด → `unprocessable`, `reason:'overpayment'`
- ใบแจ้งหนี้คืนเงินประกันผลงาน: `kind='invoice'`, VAT 0 (VAT คิดไปแล้วตอนงวด), WHT 0
- ห้ามออก `tax_invoice` เมื่อ `company_profiles.vat_registered = false` (`unprocessable`, `reason:'not_vat_registered'`)

### 4.3 รับเงิน `ar_receipts` + `ar_receipt_allocations`
`ar_receipts`: `id`, `workspace_id`, `customer_id`, `project_id null`, `number` (`RC`), `receipt_date`, `method check in ('transfer','cash','cheque','promptpay','other')`, `bank_ref`,
`cash_amount money`, `wht_amount money` (ลูกค้าหัก), `wht_certificate_no text`, `wht_certificate_file_id uuid null`, `tax_invoice_ids jsonb uuid[] default []` (TI หนึ่งใบต่อใบแจ้งหนี้ที่จัดสรร), `status check in ('issued','voided')`, `file_ids jsonb`, `language`, `created_by`, `created_at`
`ar_receipt_allocations`: PK `(receipt_id, invoice_id)`, `workspace_id`, `settled money` (cash + wht ส่วนของใบนี้)
ใบเสร็จออกเลขทันทีที่บันทึก (เอกสารรับเงินออกเมื่อรับเงินแล้วเท่านั้น); ทุกใบแจ้งหนี้ในใบเสร็จเดียวต้องเป็นลูกค้าเดียวกัน; พิมพ์รวมเป็น "ใบเสร็จรับเงิน/ใบกำกับภาษี" เมื่อ `tax_invoice_ids` มีหนึ่งใบ ถ้ามากกว่าหนึ่ง ใบเสร็จแสดงเลข TI ทั้งหมดและ TI พิมพ์แยก

### 4.4 Ledger ฝั่งลูกค้า
`ar_retention_entries`: `id`, `workspace_id`, `contract_id`, `project_id`, `kind check in ('withheld','released','forfeited')`, `amount`, `claim_id null`, `invoice_id null`, `entry_date`, `note`, `created_by`, `created_at`; partial unique `(claim_id) where kind = 'withheld'`
`ar_advance_entries`: `id`, `workspace_id`, `contract_id`, `project_id`, `kind check in ('received','recovered')`, `amount`, `invoice_id null`, `claim_id null`, `entry_date`, `created_by`, `created_at`
ยอดคงเหลือคำนวณจาก ledger เสมอ (แบบ `retentionTotals` ใน `src/domain/subcontracting/claims.ts`)

### 4.5 AR aging และเตือน
- aging (pure `src/domain/billing/aging.ts`): ใบที่ `issued`/`partially_paid` ช่วง `current`, `1_30`, `31_60`, `61_90`, `over_90` ตามวันเลย `due_date` จาก `bangkokToday`
- sweep `billing.invoice-due` (WP-30): `invoice.due_soon` 3 วันก่อน, `invoice.overdue` วันที่ 1, 7, 30 หลังครบกำหนด; `retention.release_due`
  ผู้รับคือสมาชิกที่มี `billing.read` (ลูกค้าไม่ใช่ผู้ใช้ระบบ: ข้อความมีลิงก์ไปหน้าใบแจ้งหนี้ที่มีปุ่ม "แชร์ลิงก์ให้ลูกค้า" เพื่อส่งต่อเอง)
  `guarantee.expiring` 30 วันก่อน `mc_guarantees.expiry_date` เป็น sweep ของ main-contracts (WP-26)
- PromptPay (payload: WP-28; endpoint: WP-30; QR บนเว็บ: WP-32): `src/domain/payments/promptpay.ts` `promptPayPayload({id, amount})` ตาม EMVCo (tag 00 `01`, 01 `12` เมื่อมียอด, 29 AID `A000000677010111` + sub-tag 01 เบอร์ `0066…`/02 เลขภาษี, 53 `764`, 54 ยอด 2 ตำแหน่ง, 58 `TH`, 63 CRC16-CCITT poly `0x1021` init `0xFFFF`) เรนเดอร์ QR ด้วย npm `qrcode@1.5.4` ฝั่งเว็บ

---

## 5. งานเพิ่ม-ลด VO (WP-33, WP-34) — `schema-variations.ts`, prefix `vo_`

**`vo_variations`**
| คอลัมน์ | หมายเหตุ |
|---|---|
| `id`, `workspace_id`, `project_id`, `contract_id` | ต้องมีสัญญา `signed` |
| `seq_no int` unique `(contract_id, seq_no)`, `number text null` (`VO` ตอน submit) | |
| `title`, `reason check in ('owner_request','design_change','site_condition','omission','other')`, `requested_by_name`, `requested_date` | หลักฐาน: ใคร/เมื่อไร |
| `status` check | ด้านล่าง |
| `sandbox jsonb VariationSandbox` | `{ calculators: Record<calcId, unknown>; boqOverrides: Record<lineKey, BoqLineOverride> }` เทียบกับ snapshot ของ baseline |
| `cost_total` (signed), `sell_total` (signed), `vat`, `schedule_impact_days int default 0` | |
| `billing check in ('next_claim','spread','separate_milestone')` | `next_claim` ใช้ได้เฉพาะสัญญา `billing_mode='progress'` (บรรทัด VO ถูกเบิกตาม % ของ cost code ในงวดถัดไป); สัญญา milestone ต้องเลือก `spread` หรือ `separate_milestone` (ไม่งั้น 422 `reason:'invalid_billing_option'`) |
| `language`, `customer_snapshot` | |
| `accepted_at`, `accepted_by_name`, `response_note`, `submitted_at` | |
| `created_by`, `created_at`, `updated_at` | |

**`vo_lines`**: `id`, `variation_id` FK cascade, `workspace_id`, `cost_code_id uuid null` (null = รายการใหม่), `section_no`, `line_key null`, `desc_th`, `desc_en`, `unit`,
`qty_delta quantity` (signed), `cost_mat_unit`, `cost_lab_unit`, `cost_amount` (signed), `sell_unit`, `sell_amount` (signed), `source check in ('manual','calculator')`, `sort`
**`vo_evidence`**: `id`, `variation_id`, `workspace_id`, `kind check in ('photo','note','document')`, `file_id null`, `note`, `taken_at timestamptz null`, `author_user_id`, `created_at`

- ราคาขาย: `sell_unit = round2(costUnit × sellFactor ของหมวด)` โดย sellFactor มาจาก `qt_quotation_sections` ของใบเสนอราคาที่รับ (ถ้าไม่มี ใช้ `QuotationPricing.defaults` ของ company) — `src/domain/variations/pricing.ts`
- ราคาด้วยเครื่องคำนวณ: `variationLinesFromSandbox(baselineProject, sandbox)` ใน `src/domain/variations/sandbox.ts` = `computeProject(apply(baselineSnapshot, sandbox))` → `boqVersionLines` → diff กับบรรทัด baseline → `vo_lines` (`source='calculator'`)

State:
| จาก | ไป | ผล |
|---|---|---|
| `draft` | `pending_approval` / `submitted` | นโยบาย `variation.submit`; ตอน `submitted` ออกเลข `VO` และสร้างลิงก์ลูกค้าได้ |
| `pending_approval` | `submitted` / `draft` | |
| `submitted` | `accepted` (ลิงก์หรือบันทึกเองพร้อมหลักฐาน), `rejected`, `withdrawn` | |
| `draft` | `cancelled` | |
| `accepted` | — | **ผลเมื่อ accepted (transaction เดียว):** cost code เดิม `vo_qty += qty_delta`, `vo_cost += cost_amount`, `budget_total` ใหม่, `vo_contract_amount += sell_amount`; รายการใหม่ → cost code `source='variation'`; `mc_contracts.current_value += sell_total`, `extension_days += schedule_impact_days`, `finish_date` เลื่อน; งวดตาม `billing` (`separate_milestone` เพิ่มงวด `source='variation'`, `spread` จัดสรรงวดที่ยังไม่ claim ใหม่, `next_claim` ไม่แตะงวด); `projects.planned_finish` เลื่อน; audit; แจ้งเตือน `variation.accepted` |

---

## 6. Portal (WP-35, WP-36) — ไม่มีตาราง

`GET /workspaces/:workspaceId/portal` → `PortalDto`:
`{ tasks: PortalTask[], riskyProjects: RiskyProject[], cashOutlook: {weekStart, inflow, outflow, balance}[] | null, tiles: ModuleTile[], quickActions: QuickAction[] }`
- `PortalTask {kind, title params, href, dueDate?, amount?, projectId?}` มาจาก `PortalSources` ที่โมดูลลงทะเบียน: approvals รอฉัน, งวดที่เบิกได้, ใบแจ้งหนี้เลยกำหนด, PO รอรับของ, รายงานประจำวันที่ยังไม่ส่งวันนี้, เคลมประกันที่เปิดอยู่, งวดค่าแรงพร้อมจ่าย
- `RiskyProject {projectId, reasons: ('cost_overrun'|'behind_schedule'|'overdue_receivable'|'negative_cash')[]}` จาก `HubRollups` + `jc_alerts`
- `tiles`: ทุกโมดูล ERP พร้อม `active`, `entitlement.status`, `trialAvailable` (การ์ด "ทดลองใช้ 30 วัน")
- `quickActions` ตามบทบาทและโมดูลที่ active
- ค้นหา: `GET /workspaces/:workspaceId/search?q=` → `{type:'project'|'customer'|'supplier'|'document', id, title, subtitle, href}[]` จาก `SearchSources` (projects ชื่อ/รหัส, customers, suppliers, `issued_documents.number`)

---

## 7. ผู้ขายและจัดซื้อ (WP-37 … WP-41) — `schema-procurement.ts`

### 7.1 `sup_suppliers` (vendor master)
`id`, `workspace_id`, `kind check in ('material','subcontractor','service','equipment_rental','other')`, `name_th`, `name_en`, `tax_id`, `branch_code`, `is_juristic boolean`, `vat_registered boolean`,
`address_th`, `address_en`, `contact_name`, `phone`, `email`, `line_id`, `credit_term_days int default 30`, `default_wht_preset text default 'none'`, `bank_accounts jsonb`,
`trades jsonb TradeId[]`, `sc_vendor_list_entry_id uuid null`, `vendor_workspace_id uuid null`, `rating numeric(3,2) null`, `rating_count int default 0`, `note`, `archived_at`, `created_by`, `created_at`, `updated_at`
partial unique `(workspace_id, tax_id, branch_code) where tax_id <> '' and archived_at is null`; partial unique `(workspace_id, sc_vendor_list_entry_id) where not null`
`sup_ratings`: `id`, `supplier_id` FK cascade, `workspace_id`, `project_id null`, `source_type`, `source_id null`, `score int check 1..5`, `note`, `created_by`, `created_at`
ประวัติราคา: ไม่มีตาราง — endpoint `GET /suppliers/:supplierId/price-history?q=` เป็นของโมดูล **procurement** (WP-39) ซึ่ง query `pc_order_lines` ของ PO ที่ issued ของผู้ขายนั้น (โมดูล suppliers ห้าม query ตาราง `pc_*`)
ความสัมพันธ์กับของเดิม: `sc_vendor_list_entries` (สมุดผู้รับเหมาช่วงของโมดูลจ้างช่วง เข้ารหัสด้วยเบอร์โทร) **ไม่ถูกแทนที่** — supplier ผูกได้ด้วย `sc_vendor_list_entry_id` / `vendor_workspace_id`; มีปุ่ม "นำเข้าจากรายชื่อผู้รับเหมาช่วง" (อ่านผ่าน port `ScVendorDirectory` ที่ subcontracting provide) — Decisions log D-10

### 7.2 PR / RFQ / PO / GR
| ตาราง | คอลัมน์สำคัญ |
|---|---|
| `pc_requests` | `project_id`, `number null` (`PR` ตอน submit), `status`, `source check in ('site','boq')`, `required_date`, `requested_by`, `note`, `budget_warnings jsonb`, `override_reason` |
| `pc_request_lines` | `request_id` FK cascade, `cost_code_id null`, `desc_th`, `desc_en`, `unit`, `qty`, `est_unit_price` (= `baseline_mat_unit` ของ cost code), `est_amount`, `ordered_qty default 0`, `note`, `sort` |
| `pc_rfqs` | `project_id`, `number null` (`RFQ` ตอนส่ง), `status check in ('draft','sent','awarded','closed','cancelled')`, `title`, `due_date`, `delivery_address`, `language`, `request_ids jsonb uuid[]` |
| `pc_rfq_lines` | `rfq_id`, `request_line_id null`, `cost_code_id null`, `desc_th`, `desc_en`, `unit`, `qty`, `sort` |
| `pc_rfq_suppliers` PK `(rfq_id, supplier_id)` | `status check in ('invited','quoted','declined')`, `invited_at`, `quoted_at` |
| `pc_rfq_quotes` | `rfq_id`, `supplier_id`, unique `(rfq_id, supplier_id)`, `quote_ref`, `quote_date`, `valid_until`, `prices_include_vat boolean`, `delivery_days`, `payment_term_days`, `lines jsonb {rfqLineId, unitPrice, amount, available, note}[]`, `subtotal`, `vat`, `total`, `file_ids`, `note` |
| `pc_orders` | `project_id`, `supplier_id`, `rfq_id null`, `number null` (`PO` ตอน issue), `status`, `order_date`, `delivery_date`, `delivery_address`, `language`, `supplier_snapshot`, `vat_rate`, `subtotal`, `discount`, `vat`, `total`, `wht_preset`, `payment_term_days`, `terms`, `budget_warnings jsonb`, `override_reason`, `issued_by`, `issued_at` |
| `pc_order_lines` | `order_id` FK cascade, `cost_code_id null`, `request_line_id null`, `desc_th`, `desc_en`, `unit`, `qty`, `unit_price`, `amount`, `received_qty default 0`, `billed_qty default 0`, `sort` |
| `pc_receipts` | `project_id`, `order_id`, `number null` (`GR` ตอน confirm), `status check in ('draft','confirmed','cancelled')`, `received_date`, `received_by`, `delivery_note_no`, `photos jsonb {fileId, takenAt, caption}[]`, `note` |
| `pc_receipt_lines` | `receipt_id` FK cascade, `order_line_id`, `qty_received`, `qty_rejected`, `condition check in ('ok','damaged','short')`, `note` |

ผู้ขายไม่ได้ล็อกอิน (v1): RFQ พิมพ์/ส่งไฟล์หรือข้อความให้ผู้ขาย แล้วผู้รับเหมากรอกราคาที่ได้รับเอง (Decisions log D-11)

State:
- PR: `draft → pending_approval → approved | rejected`; `draft → approved` (ข้ามอนุมัติ); `approved → partially_ordered → ordered → closed`; `draft|approved → cancelled`
- RFQ: `draft → sent → awarded (สร้าง PO จากใบที่เลือก) → closed`; `draft|sent → cancelled`
- PO: `draft → pending_approval → issued | draft`; `draft → issued`; `issued → partially_received → received → closed`; `draft|issued(ยังไม่รับของ) → cancelled`
- GR: `draft → confirmed`; `draft → cancelled`; ยืนยันแล้วกลับไม่ได้ (แก้ด้วย GR ติดลบ — ไม่ทำ v1)

คำเตือนงบ (pure `src/domain/procurement/budget-check.ts`): ต่อ cost code
`over_quantity`: `qty_ใหม่ + qty_ที่สั่งแล้ว > (baseline_qty + vo_qty) × 1.05`;
`over_price`: `unit_price > baseline_mat_unit × 1.05`;
`over_budget`: `committed_open + actual + amount_ใหม่ > budget_total` (ฝั่งวัสดุ: เทียบ `baseline_mat` + ส่วนวัสดุของ VO)
คำเตือนไม่บล็อก แต่บังคับ `override_reason` และบังคับเข้า `purchase_order.issue` ทุกครั้ง (ยกเว้นข้ามอัตโนมัติเพราะทำคนเดียว)

Ledger:
- PO issued → `commit` +amount ต่อบรรทัด (`category='material'`) ; PO cancelled/closed → `commit_release` −ยอดที่ยังไม่รับ
- GR confirmed → `actual` +(qty_received × unit_price) และ `commit_release` −เท่ากัน (`commitment_ref` = order line)
- 3-way match (pure `src/domain/procurement/three-way-match.ts`): ต่อบรรทัดบิล `matched | qty_exceeds_received | price_differs | no_po` (ราคาต่างเกิน 1% หรือ 1 บาท)

---

## 8. รายงานประจำวันและค่าแรง (WP-42 … WP-45) — `schema-site.ts`

### 8.1 Site diary
| ตาราง | คอลัมน์สำคัญ |
|---|---|
| `sd_reports` | `project_id`, `report_date` unique `(project_id, report_date)`, `status check in ('draft','submitted')`, `weather_morning`, `weather_afternoon` check `in ('sunny','cloudy','rain','storm')`, `rain_hours numeric(4,1) default 0`, `summary text`, `created_by`, `submitted_by`, `submitted_at` |
| `sd_manpower` | `report_id` FK cascade, `crew_id uuid null` (workforce), `supplier_id uuid null`, `crew_name`, `trade`, `skilled_count int`, `labourer_count int`, `hours numeric(4,1) default 8`, `cost_code_id null`, `note` |
| `sd_work_items` | `report_id` FK cascade, `cost_code_id`, `qty_done quantity null`, `progress_after rate` (สะสม), `note` ; unique `(report_id, cost_code_id)` |
| `sd_photos` | `report_id` FK cascade, `file_id`, `taken_at timestamptz`, `caption`, `cost_code_id null` |
| `sd_issues` | `report_id` FK cascade, `project_id`, `kind check in ('delay','safety','quality','material','weather','customer','other')`, `severity check in ('low','medium','high')`, `description`, `status check in ('open','resolved')`, `resolved_at`, `resolved_by` |

ผลเมื่อ submit: `CostCodeLookup.setReportedProgress` (ค่า `progress_after` ของรายงาน submitted ที่ `report_date` ล่าสุดของ cost code นั้น — submit รายงานย้อนหลังไม่ทับค่าของวันที่ใหม่กว่า)
S-curve: `GET /projects/:projectId/site-diary/progress` คืน `{ actual: {date, pct}[], planned: {weekStart, pct}[] | null }`
  `actual` = % งานสะสมรายวัน ถ่วงด้วย `budget_total` ของ cost code (ใช้ค่า `progress_after` ล่าสุด ณ วันนั้น); `planned` = `computeProject(ProjectReader.read(projectId).project).planning.schedule.planCumulative` จับคู่กับ `buckets` (null ถ้าคำนวณไม่ได้)
ค่าแรงจากรายงาน: ถ้า `labour` **ไม่** active และ `sd_manpower.crew_id` + `cost_code_id` มี และ workforce ให้ daily cost ได้ → `cost_ledger` `actual` (`category='labour'`, `source_type='site_diary'`) = round2(dailyCost × hours/8); ถ้า `labour` active ไม่โพสต์ (กันซ้ำ)
แก้รายงานที่ submit แล้ว: เปิดกลับเป็น draft ได้ (`site.report`) ผู้โพสต์ ledger ต้อง reverse ก่อนโพสต์ใหม่

### 8.2 Labour (ขยาย workforce)
| ตาราง | คอลัมน์สำคัญ |
|---|---|
| `lb_timesheet_entries` | `project_id`, `person_id` composite FK `(person_id, workspace_id) → people(id, workspace_id)` ไม่มี on delete (people ถูก archive เท่านั้น — แบบ `crews_leader_tenant_fk`; `people` อยู่ใน `schema.ts` ซึ่งเป็น core จึง FK ได้), `work_date`, `crew_id null`, `cost_code_id null`, `days numeric(3,2)` (0.5/1), `ot_hours numeric(4,1) default 0`, `daily_wage money` (snapshot จาก `people.daily_wage`), `ot_rate money`, `amount money`, `status check in ('draft','approved','paid')`, `pay_period_id uuid null`, `source check in ('manual','site_diary')`, `note`, `recorded_by`; unique `(person_id, work_date, project_id)` |
| `lb_pay_periods` | `period_key text` unique `(workspace_id, period_key)` (`2026-10-A` = 1–15, `2026-10-B` = 16–สิ้นเดือน), `start_date`, `end_date`, `status check in ('open','pending_approval','approved','paid')`, `gross`, `advance_deduction`, `net`, `approved_by`, `paid_at`, `payment_method` |
| `lb_pay_lines` | `period_id` FK cascade, `person_id`, unique `(period_id, person_id)`, `days`, `ot_hours`, `gross`, `advance_deduction`, `other_deduction`, `net`, `paid boolean`, `note` |
| `lb_advances` | `person_id`, `advance_date`, `amount`, `reason`, `status check in ('open','partially_recovered','recovered','written_off')`, `recovered_amount` |
| `lb_advance_recoveries` PK `(advance_id, pay_line_id)` | `amount` |

- `amount = round2(days × daily_wage + ot_hours × ot_rate)`; `ot_rate` เริ่มต้น `round2(daily_wage / 8 × 1.5)`
- `daily_wage` = `people.daily_wage` (integer บาท, nullable) ตอนบันทึก; ถ้า null ต้องส่ง `dailyWage` ใน request ไม่งั้น 422 `reason:'daily_wage_required'`
- Σ `days` ของคนหนึ่งในวันหนึ่ง (ทุกโครงการ) ≤ 1 (ไม่งั้น 422 `reason:'over_one_day'`); `days in (0.5, 1)`
- ใบลงเวลา approved → `cost_ledger` `actual` labour ต่อ cost code (`source_type='timesheet'`) ; งวดจ่าย paid → `fin_events` `lb.wages_paid` (cash out) ; เบิกล่วงหน้า → `lb.advance_paid`; หักคืน → `lb.advance_recovered`
- ไม่หัก ภ.ง.ด.1 / ประกันสังคม ใน v1 (เงินเดือน/HR ทำภายหลัง D-14)
- งวดจ่าย: `open → pending_approval (pay_period.approve) → approved → paid`; `open → approved` เมื่อข้ามอัตโนมัติ; ตั้งแต่ `pending_approval` แก้ใบลงเวลาในงวดไม่ได้ (409 `reason:'period_locked'`)
- จ่ายงวด: ถ้า `payables` **ไม่** active → `POST .../pay` ในโมดูล labour (fin_events `lb.wages_paid`); ถ้า `payables` active → งวดที่ approved ถูกดึงเป็นบิล `ap_bills.kind='labour'` แล้วจ่ายผ่านรอบจ่าย ซึ่งเรียก port `PayPeriodPayments.markPaid` (labour provide, WP-50) ใน transaction เดียวกัน; endpoint pay ของ labour ตอบ 409 `reason:'paid_via_payables'` เมื่อมีบิลของงวดนั้นแล้ว (กันจ่ายซ้ำ)

---

## 9. ควบคุมต้นทุนและกระแสเงินสด (WP-46 … WP-48) — `schema-job-cost.ts`, prefix `jc_`

| ตาราง | คอลัมน์ |
|---|---|
| `jc_forecasts` PK `(project_id, cost_code_id)` | `workspace_id`, `method check in ('auto','manual')`, `eac money`, `note`, `updated_by`, `updated_at` |
| `jc_alerts` | `project_id`, `cost_code_id null`, `kind check in ('cost_overrun','commitment_over_budget','negative_cash','margin_drop')`, `level check in ('warning','critical')`, `value`, `threshold`, `first_seen_at`, `last_seen_at`, `resolved_at null`, `notified_at null`; `scope_key text not null` (= `cost_code_id` หรือ `'project'`); partial unique `(project_id, scope_key, kind) where resolved_at is null` |
| `jc_cash_settings` PK `workspace_id` | `opening_balance money`, `as_of date`, `min_balance money default 0` |
| `jc_unit_rates` | `project_id`, `line_key`, `desc_th`, `unit`, `qty`, `actual_mat_unit`, `actual_lab_unit`, `observed_date`; index `(workspace_id, line_key, observed_date)` (เขียนโดย closeout WP-55) |

pure `src/domain/job-cost/` (WP-46):
- `costStatus(costCode, ledgerTotals, forecast?)` → `{budget, committedOpen, actual, progress, earned = round2(budget × progress), etc, eac, variance = budget − eac, level}`
  `progress` = `reported_progress` เมื่อ `site-diary` active ไม่งั้น `certified_progress`
  auto: `etc = max(round2(budget × (1 − progress)), committedOpen)`, `eac = actual + etc`; manual (`jc_forecasts.method='manual'`): `eac = max(forecast.eac, actual + committedOpen)`
  `level`: `eac ≤ budget` → `ok`; `budget < eac ≤ budget × 1.1` → `warning`; `eac > budget × 1.1` → `critical` (budget = 0 และ eac > 0 → `critical`)
- `projectProfit(contractCurrentValue, Σeac, overheadActual)` → `{revenue, cost, profit, marginPct}`
- `cashProjection(opening, planned: CashPlanItem[], actual[], weeks=13)` (WP-47) → รายสัปดาห์ (สัปดาห์เริ่มวันจันทร์ ตาม `bangkokToday`) `{weekStart, plannedIn, plannedOut, actualIn, actualOut, balance}` + สัปดาห์แรกที่ `balance < min_balance`
  `CashPlanItem = {projectId, date, direction:'in'|'out', amount, source, ref}`; รายการที่ `date` เลยมาแล้วแต่ยังค้าง ลงสัปดาห์แรก
  แหล่งข้อมูลแผน (registry `CashPlanSources`, แต่ละโมดูลคืนเฉพาะรายการที่ยังไม่เกิดเงินจริง): billing = ใบแจ้งหนี้ค้างรับ (`due_date`, ยอด `payable − paid`) + งวดที่ยังไม่วางบิล (`due_date` ถ้ามี ไม่งั้นข้าม); procurement = PO ที่ issued ยังไม่วางบิล (`delivery_date + payment_term_days`);
  payables (WP-49) = บิลค้างจ่าย (`due_date`) — เมื่อ payables active procurement ไม่นับ PO ที่มีบิลแล้ว; labour = ค่าแรงที่คาด (ค่าแรงเฉลี่ยต่อวันของ 14 วันล่าสุด × วันทำงานจนสิ้นงวด จ่ายวันที่ 16 และวันที่ 1); subcontracting = port `SubcontractCashPlan` (งวดจ้างช่วงที่ยังไม่จ่าย)
  เงินจริง = `fin_events.cash` (บวก = เข้า, ลบ = ออก) ตาม `event_date`; `opening` = `jc_cash_settings.opening_balance` + Σ cash ตั้งแต่ `as_of` ถึงก่อนสัปดาห์แรก
- แผนจากการประมาณราคาเดิม: `computeProject(read.project).planning.cashflow` (CashFlow sheet เดิม) อ่านผ่าน `ProjectReader` แสดงเป็นเส้น "แผนตอนประมาณราคา" เทียบ (ต่อโครงการเท่านั้น ไม่รวมในยอดบริษัท)
- Sweep `job-cost.alerts` รายวัน (WP-46): `cost_overrun` ตาม `level`, `commitment_over_budget` (committedOpen + actual > budget), `margin_drop` (marginPct คาดการณ์ = (current_value − Σeac) / current_value ต่ำกว่า `mc_contracts.quoted_margin_pct` เกิน 0.05) → `jc_alerts` (upsert ตาม partial unique; หายแล้วตั้ง `resolved_at`) + แจ้ง `cost.overrun` ครั้งแรกที่ alert เกิด (`notified_at`)
  `negative_cash` ทำใน sweep `job-cost.cash` (WP-47) → แจ้ง `cash.negative_forecast` ไม่เกินวันละครั้งต่อ workspace (`sweep_marks`)

---

## 10. เจ้าหนี้และภาษี (WP-49 … WP-52) — `schema-payables.ts`, prefix `ap_`

| ตาราง | คอลัมน์สำคัญ |
|---|---|
| `ap_bills` | `project_id null`, `supplier_id uuid null` (null ได้เฉพาะ `kind='labour'`), `pay_period_id uuid null` (labour; partial unique `(pay_period_id) where status <> 'voided'`), `kind check in ('material','subcontract','service','labour','expense')`, `number null` (`AP` ตอน post), `supplier_invoice_no`, `supplier_invoice_date`, `tax_invoice_no`, `tax_invoice_date`, `input_vat_claimable boolean`, `status`, `due_date`, `order_id null`, `sc_claim_id null`, `subtotal`, `discount`, `vat`, `total`, `wht_preset`, `wht_rate`, `wht_amount`, `retention_amount`, `payable`, `paid_amount default 0`, `match_status check in ('not_applicable','matched','exceptions')`, `file_ids`, `note`, `created_by`, `created_at`, `updated_at` ; partial unique `(workspace_id, supplier_id, supplier_invoice_no) where supplier_invoice_no <> '' and status <> 'voided'` |
| `ap_bill_lines` | `bill_id` FK cascade, `order_line_id null`, `cost_code_id null`, `category`, `desc`, `unit`, `qty`, `unit_price`, `amount`, `match check in ('matched','qty_exceeds_received','price_differs','no_po')` |
| `ap_payment_runs` | `workspace_id` (ระดับบริษัท ไม่ผูกโครงการ), `number null` (ไม่ออกเลข), `status check in ('draft','pending_approval','approved','paid','cancelled')`, `bill_ids jsonb uuid[]`, `pay_date`, `method`, `note`, `total_cash`, `total_wht`, `approved_by`, `paid_at` |
| `ap_payments` | `run_id null`, `supplier_id uuid null` (null = จ่ายค่าแรงงวด), `number` (`PV` ตอนจ่าย), `pay_date`, `method`, `bank_ref`, `cash_amount`, `wht_amount`, `wht_certificate_id null`, `status check in ('issued','voided')`, `file_ids` |
| `ap_payment_allocations` PK `(payment_id, bill_id)` | `settled`, `wht`, `cash` |
| `ap_wht_certificates` | `number` (`WHT`), `book_no text default ''`, `payment_id`, `payee_snapshot` (ชื่อ เลขภาษี ที่อยู่), `payer_snapshot`, `form check in ('pnd3','pnd53')` (บุคคล → pnd3, นิติบุคคล → pnd53), `income_type check in ('service','transport','advertising','rent','other')`, `income_desc`, `pay_date`, `base_amount`, `wht_rate`, `wht_amount`, `condition check in ('withheld','paid_always','paid_once')`, `status check in ('issued','voided')`, `issued_at` |

State บิล: `draft → pending_approval (supplier_bill.approve) | approved`; `pending_approval → approved | draft`; `approved → scheduled` (ถูกใส่ในรอบจ่าย) `→ paid` (รอบจ่าย paid) หรือ `scheduled → approved` (เอาออกจากรอบ/รอบถูกยกเลิก); `draft|approved → voided` (บิลที่ approved แล้ว void ได้เมื่อยังไม่จ่าย และ reverse `ap.bill_posted` + ledger); `ap_bills.status` check `in ('draft','pending_approval','approved','scheduled','paid','voided')`
State payment run (WP-50): `draft → pending_approval → approved → paid`; `draft → approved` (ข้ามอัตโนมัติ); `draft|approved → cancelled`; ตอน `paid`: สร้าง `ap_payments` ต่อผู้ขาย (บิลค่าแรงหนึ่ง payment ต่อบิล) (ออกเลข `PV`), 50 ทวิ ต่อ payment ที่มี WHT > 0 (ออกเลข `WHT`), `fin_events` `ap.payment` + `ap.wht_withheld`, อัปเดตบิล; บิล labour → `PayPeriodPayments.markPaid` (ซึ่งโพสต์ `lb.wages_paid` / `lb.advance_recovered` แทน `ap.payment` เพื่อไม่นับซ้ำ); บิล subcontract → `SubcontractClaimPayer.markPaid`
ยอดบิล: `base = subtotal − discount`, `wht_amount = round2(base × wht_rate)` (ฐานก่อน VAT), `payable = base + vat − wht_amount − retention_amount`
v1 รอบจ่ายจ่ายบิลที่เลือก **เต็มยอดคงเหลือ** เท่านั้น (ไม่แบ่งจ่ายในรอบเดียว; `partially_paid` เกิดเมื่อบิลถูกบันทึกจ่ายนอกรอบบางส่วนเท่านั้น — ไม่ทำใน v1 จึงไม่ใช้) → payment ต่อผู้ขาย: `cash = Σ payable`, `wht = Σ wht_amount`
ผลตอน post บิล (approved): `fin_events` `ap.bill_posted` (`vat` = ภาษีซื้อ); ราคาต่างจากที่รับของ → `cost_ledger` `actual` ส่วนต่าง; บิลไม่มี PO → `actual` เต็มจำนวนตาม `cost_code_id` ของบรรทัด

จ้างช่วง (เชื่อมของเดิม): port `SubcontractPayables` (provide โดย subcontracting) `listApprovedUnpaid(ws)` → claim ที่ `approved` พร้อม `gross/retention/wht/vat/net`; "สร้างบิลจากงวดจ้างช่วง" → `ap_bills.kind='subcontract'`, `sc_claim_id`;
จ่ายบิลนี้ (WP-50) เรียก `SubcontractClaimPayer.markPaid(claimId, {paidAt, amount, channel, ref, by})` (provide โดย subcontracting, ใช้ตรรกะ `PayClaim` เดิม) ใน transaction เดียวกัน; ถ้า subcontracting ไม่ active ไม่แสดง
ค่าแรง (WP-49): "สร้างบิลจากงวดค่าแรง" → `ap_bills.kind='labour'`, `pay_period_id`, `supplier_id = null`, VAT 0, WHT 0, `payable` = `lb_pay_periods.net` (อ่านผ่าน port `PayPeriodPayments.approvedUnbilled(ws)`)

รายงานภาษี (WP-52, ไม่มีตาราง อ่าน `fin_events` เท่านั้น):
- ภาษีขาย: `ar.tax_invoiced`, `ar.credit_noted` ในเดือน (วันที่ เลขที่ ชื่อ เลขภาษี สาขา มูลค่า VAT)
- ภาษีซื้อ: `ap.bill_posted` ที่ `data.inputVatClaimable = true` ในเดือนของ `tax_invoice_date`
- ภ.ง.ด.3 / ภ.ง.ด.53: `ap.wht_withheld` แยกตาม `data.form`
- ภาษีถูกหัก ณ ที่จ่าย (ลูกค้าหักเรา): `ar.wht_withheld_by_customer`
- export Excel ฝั่งเว็บด้วย exceljs (lazy) แบบ `src/features/export/xlsx.ts`

---

## 11. ส่งมอบ รับประกัน ปิดโครงการ (WP-53 … WP-55) — `schema-handover.ts`, prefix `ho_`

| ตาราง | คอลัมน์สำคัญ |
|---|---|
| `ho_handovers` | `project_id`, `contract_id`, `number null` (`HO` ตอน accepted), `status check in ('draft','scheduled','inspected','accepted','rejected')`, `scheduled_date`, `inspection_date`, `handover_date`, `attendees jsonb {name, role}[]`, `checklist jsonb {itemTh, itemEn, status:'ok'|'fix'|'na', note}[]`, `defects_note`, `accepted_by_name`, `language`, `created_by`, `created_at`, `updated_at` |
| `ho_handover_documents` | `handover_id` FK cascade, `kind check in ('as_built','manual','warranty_card','test_report','other')`, `file_id`, `title` |
| `ho_warranties` | `project_id` unique, `contract_id`, `start_date`, `end_date` (= start + `warrantyMonths` ด้วย `addMonths`), `status check in ('active','expired','closed')` |
| `ho_warranty_claims` | `project_id`, `warranty_id`, `number null` (`WC` ตอนเปิด), `reported_date`, `reported_by_name`, `channel check in ('phone','line','site','link','other')`, `description`, `location`, `photos jsonb`, `severity check in ('low','medium','high')`, `status`, `assignee_user_id null`, `assignee_supplier_id null`, `due_date`, `resolution_note`, `resolved_at`, `closed_at`, `cost_amount money default 0` |
| `ho_closeouts` | `project_id` unique, `status check in ('draft','final')`, `as_of date`, `summary jsonb CloseoutSummary`, `lessons text`, `finalized_by`, `finalized_at` |

- ลูกค้ารับมอบ (`accepted`): `ProjectLifecycle.advance('warranty')`, สัญญา → `completed` (`MainContracts.complete` จาก main-contracts), สร้าง `ho_warranties`, ถ้า `retentionRelease` มีส่วน "at completion" → แจ้ง `retention.release_due` (การคืนจริงทำใน billing)
- เคลมประกัน: `open → assigned → in_progress → resolved → closed`; `open|assigned → rejected` (นอกเงื่อนไขประกัน); ปิดพร้อม `cost_amount > 0` → `cost_ledger` `actual` `category='other'`, `source_type='warranty_claim'`, `cost_code_id` null
- sweep `handover.warranty`: `warranty.expiring` 30 วันก่อน `end_date`; เลยแล้ว → `expired` + แจ้ง `retention.release_due` ส่วนที่เหลือ และ `guarantee.expiring`
- Closeout (pure `src/domain/handover/closeout.ts`): ต่อหมวด (section) `estimate` (baseline), `budget` (+VO), `actual` (ledger, แยก material/labour/subcontract/other), `variance`, รายได้ (`current_value`), วางบิล/รับเงิน/เงินประกันค้าง (port `BillingTotals` จาก billing), กำไรตามใบเสนอราคา (`quoted_margin_pct`) vs จริง; ledger ที่ `cost_code_id` null อยู่ในแถว "ไม่ระบุหมวด"
  final → `ProjectLifecycle.advance('closed')` + เขียน `jc_unit_rates` ต่อ cost code ที่มี `line_key` และ `qty_done > 0`: `actual_mat_unit = round2(actual_material / qty)`, `actual_lab_unit = round2(actual_labour / qty)`
- ป้อนกลับการประมาณราคา: `GET /workspaces/:workspaceId/unit-rates?lineKeys=` → ค่าเฉลี่ย 3 โครงการล่าสุด; หน้า BOQ แสดง "ราคาจริงล่าสุด" ข้างราคาวัสดุ/ค่าแรงเมื่อ `handover` active และให้กด "ใช้ราคานี้" (เขียน `boqOverrides` ผ่านกลไกเดิม)

---

## 12. Hub roll-up (ตัวเลขข้ามโมดูล)

`HubRollups` (registry ใน core, WP-15) แต่ละโมดูลคืน `Partial<ProjectRollup>` ต่อโครงการ:

```ts
export interface ProjectRollup {
    budgetTotal: number | null;          // boq-control
    contractValue: number | null;        // contracts (current_value)
    billedToDate: number | null;         // billing (Σ net ของ invoice/claim ที่ออกแล้ว)
    receivedToDate: number | null;       // billing
    overdueReceivable: number | null;    // billing
    committedOpen: number | null;        // ledger/job-cost
    actualCost: number | null;           // ledger
    forecastAtCompletion: number | null; // job-cost
    projectedProfit: number | null;      // job-cost
    progressPct: number | null;          // site-diary (ถ่วงด้วย budget) หรือ certified
    openVariations: number | null;       // variations
    openPurchaseOrders: number | null;   // procurement
    nextMilestone: { label: string; dueDate: string | null; amount: number } | null; // contracts
    alerts: string[];                    // job-cost / billing
}
```

`GET /workspaces/:workspaceId/hub/projects?status=&q=&customerId=&type=&archived=` คืน `HubProjectDto[]` (`{project, hub, customerName, rollup}`; ฟิลด์ rollup ของโมดูลที่ไม่ active เป็น `null`) — คำนวณแบบ batch ต่อ workspace ห้าม N+1 query
`GET /projects/:projectId/hub` คืน overview ของโครงการเดียว (`HubProjectDetailDto` = HubProjectDto + การ์ดของแต่ละโมดูล)

---

## 13. ตารางเดิมที่ใช้ซ้ำ

| ตารางเดิม | ใช้อย่างไรใน ERP |
|---|---|
| `workspaces`, `memberships`, `invitations`, `users` | tenant, บทบาท (ขยาย), `users.locale` ใหม่ |
| `projects` | Hub (คอลัมน์ใหม่ §1.9) |
| `project_docs` | BOQ ที่กำลังแก้; ถูกล็อก `calc:*`/`boq:*` หลัง baseline |
| `project_revisions` | ประวัติ BOQ (ทุก `boq_versions` ชี้ revision หนึ่ง) |
| `activity_log` | คงเดิมสำหรับ BOQ docs |
| `workspace_modules` | ชั้น toggle |
| `files` | ไฟล์แนบทุกโมดูล |
| `notifications`, `notification_deliveries` | การแจ้งเตือน (template ใหม่) |
| `people`, `crews`, `crew_members`, `crew_assignments`, `rate_cards` | labour/site-diary ใช้ person/crew และอัตราค่าแรง |
| `sc_subcontracts`, `sc_claims`, `sc_retention_entries`, `sc_vendor_list_entries` | AP (งวดจ้างช่วง), committed (มูลค่าสัญญาจ้างช่วงต่อ `lineKey` → cost code), supplier link |

การผูกจ้างช่วงเข้ากับ cost code (WP-46): ต่อสัญญาจ้างช่วงที่ active ในโครงการที่มี baseline, บรรทัด `ScSubcontractLineJson.lineKey` → หา cost code ที่ `code = lineKey`
มูลค่าบรรทัด → `commit` (`category='subcontract'`, `source_type='subcontract'`); claim ที่ approved → `actual` + `commit_release`
ทำผ่าน port `SubcontractCommitments` (provide โดย subcontracting) และ sync แบบ idempotent (ตรวจ `entriesBySource` ก่อนโพสต์) ตอน sweep รายวันและตอนเปิดหน้าต้นทุน
