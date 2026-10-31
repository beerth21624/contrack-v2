# 04 — แผนลงมือทำ (Work packages)

สถานะ: แผนครบทุก foundation และโมดูล 1–9 · 2026-10-31 (ทบทวนแล้ว: เรียงลำดับใหม่ แตก WP ที่ใหญ่เกิน) · 56 WP ในสายหลัก + 14 WP ใน track I (ย้ายข้อความไทยเดิม)

## 0. วิธีใช้แผนนี้

- หนึ่ง WP = หนึ่งเอเจนต์ context ใหม่ ทำจบในรอบเดียว แตะไฟล์ไม่เกินราว 25 ไฟล์ จบในสถานะที่ typecheck และ lint ผ่าน และ commit แยกได้
- ก่อนเริ่ม: อ่าน `README.md` → `PROGRESS.md` (รวม Handoff notes ของ WP ที่ depends on) → หัวข้อ WP นี้ → ส่วนที่อ้างถึงใน `01`/`02`/`03`
- "ไฟล์" ในขอบเขตคือรายการขั้นต่ำ เพิ่มไฟล์ช่วยได้ถ้าจำเป็น (บันทึกใน Handoff note)
- **เกณฑ์รับงานร่วมของทุก WP** (ไม่เขียนซ้ำในแต่ละ WP):
  1. `npx tsc --noEmit -p backend/tsconfig.json` และ `npx tsc --noEmit -p tsconfig.json` ผ่าน (รันทีละอัน)
  2. eslint ผ่านบนไฟล์ที่แก้ (backend: `cd backend && npx eslint <files>`; web: `npx eslint <files>`)
  3. ถ้าแก้ schema: มี migration ใหม่จาก `npm run db:generate -- --name <wpxx>_<name>` พร้อม snapshot และ journal — เลข `00xx` ที่เขียนในแต่ละ WP เป็นเลข **ที่คาดไว้** ถ้าไม่ตรงให้ใช้เลขถัดไปจริงที่ drizzle สร้าง
  4. เทสต์เดิมในโฟลเดอร์ที่แก้ยังผ่าน (`cd backend && npx jest <path>` / `npx vitest run <path>` เฉพาะ path)
  5. ข้อความ UI ใหม่อยู่ใน message files ทั้ง th/en; `node scripts/i18n/check-parity.mjs` ผ่าน (หลัง WP-01)
  6. route/เมนูใหม่ถูกซ่อนเมื่อโมดูลไม่ active; API ใหม่ตอบ 404 `module_disabled` เมื่อ release flag ปิด
  7. `PROGRESS.md` อัปเดต (status, commit, Handoff note)
  8. **Release 1 ไม่เปลี่ยน:** เมื่อ `MODULES_ENABLED` ไม่มี id ERP หน้าจอ เมนู และ API เดิมทำงานเหมือนก่อน WP นี้ทุกประการ (hook ที่แทรกในโค้ดเดิมต้องไม่มีผลเมื่อโมดูลไม่ active)
  9. use case ERP ทุกตัวผ่าน `ModuleAccess` (ลำดับ not_found → module_disabled → forbidden) และเงินทุกค่าผ่าน `round2` ก่อนเก็บ (`01-architecture.md` §12)
- โมเดลที่แนะนำ: **opus** = งานออกแบบ ตรรกะเงิน เลขเอกสาร baseline ledger state machine; **sonnet** = CRUD/UI ตามสเปก งานแปล
- ลำดับรัน (ฮาร์ดแวร์ 16 GB): สายหลัก **ทีละ WP** ตามเลข (dependency ถูกเรียงไว้แล้ว — ไม่มี WP ใดพึ่ง WP ที่เลขมากกว่า) อนุญาตให้รัน track I คู่ขนานได้ **อย่างมาก 1 ตัว** กับ WP สายหลักที่ไม่แตะไฟล์เดียวกัน (รวม `src/i18n/messages/*/index.ts`: ผู้ประสานงานให้ track I เพิ่มบรรทัดใน index.ts หลังสายหลัก commit แล้วเท่านั้น)
  ห้ามสอง agent รันคำสั่งหนัก (tsc ทั้งโปรเจกต์, jest/vitest ทั้งชุด, build) พร้อมกัน — ผู้ประสานงานเรียงคิวการตรวจ
- WP ที่แก้ schema ห้ามรันขนานกันเด็ดขาด (journal ของ drizzle ชนกัน)

## 1. ภาพรวม

| WP | ชื่อ | ModuleId | depends on | model |
|---|---|---|---|---|
| WP-01 | i18n foundation (locale, format, parity, lint) | — | — | opus |
| WP-02 | ไลบรารีเงิน ภาษี วันที่ | — | — | opus |
| WP-03 | Module registry, flag 4 ชั้น, entitlement, ModuleAccess (backend + contract) | platform | — (รันหลัง WP-01/02 ตามลำดับ migration) | opus |
| WP-04 | หน้าโมดูลและทดลองใช้ (web) | platform | WP-01, WP-03 | sonnet |
| WP-05 | บทบาทและสิทธิ์ ERP | — | WP-03, WP-04 | opus |
| WP-06 | ERP web foundation: UI kit, nav registry, กรอบพิมพ์ | — (ใช้ร่วมทุกโมดูล) | WP-01, WP-04, WP-05 | opus |
| WP-07 | Platform admin: ให้สิทธิ์โมดูล (backend + web) | platform | WP-03, WP-06 | sonnet |
| WP-08 | Workflow อนุมัติ + audit log (backend) | foundation (gate ด้วย `project-hub`) | WP-03, WP-05, WP-07 | opus |
| WP-09 | หน้าอนุมัติ นโยบาย และ audit (web) | foundation | WP-08, WP-06 | sonnet |
| WP-10 | การแจ้งเตือน: channel, ภาษาผู้รับ, sweep | platform | WP-01, WP-02, WP-03 | opus |
| WP-11 | บริการเลขเอกสาร + guard การลบ | foundation | WP-02, WP-03, WP-06, WP-08 | opus |
| WP-12 | โปรไฟล์บริษัท + business profile + project type | foundation | WP-11, WP-06 | sonnet |
| WP-13 | ทะเบียนลูกค้า | foundation | WP-12 | sonnet |
| WP-14 | ลิงก์ลูกค้า (public) | foundation | WP-13 | opus |
| WP-15 | Project Hub backend | project-hub | WP-11, WP-13 | opus |
| WP-16 | Project Hub web + ต่อ nav เข้า AppLayoutUI | project-hub | WP-15, WP-06, WP-09 | opus |
| WP-17 | ประวัติ BOQ (versions, เทียบฉบับ) | boq-control | WP-16 | opus |
| WP-18 | Baseline + cost codes (backend) | boq-control | WP-17 | opus |
| WP-19 | Baseline web: BOQ อ่านอย่างเดียวเมื่อล็อก + CostCodePicker | boq-control | WP-18 | opus |
| WP-20 | Cost ledger + financial events | foundation | WP-18 | opus |
| WP-21 | ราคากลางภาครัฐ | foundation (ใช้เมื่อ `priceSource='government'`) | WP-16 | sonnet |
| WP-22 | Quotation: domain คำนวณ + overlay อังกฤษของ BOQ | quotations | WP-02, WP-12, WP-17 | opus |
| WP-23 | Quotation backend | quotations | WP-22, WP-08, WP-10, WP-12, WP-14, WP-15 | opus |
| WP-24 | Quotation web: รายการ ตัวแก้ไข เทียบฉบับ | quotations | WP-23 | sonnet |
| WP-25 | Quotation เอกสารพิมพ์ TH/EN + หน้าลูกค้า | quotations | WP-24 | sonnet |
| WP-26 | สัญญาหลัก backend | contracts | WP-18, WP-23 | opus |
| WP-27 | สัญญาหลัก web + พิมพ์สัญญา | contracts | WP-26 | sonnet |
| WP-28 | Billing domain คำนวณ | billing | WP-02 | opus |
| WP-29 | งวดเบิก + ใบแจ้งหนี้ backend | billing | WP-26, WP-28, WP-20 | opus |
| WP-30 | รับเงิน ใบกำกับภาษี ลูกหนี้ เตือน PromptPay backend | billing | WP-29, WP-10 | opus |
| WP-31 | Billing web | billing | WP-30 | sonnet |
| WP-32 | Billing เอกสารพิมพ์ + QR | billing | WP-31 | sonnet |
| WP-33 | VO backend | variations | WP-29, WP-14 | opus |
| WP-34 | VO web + ราคาด้วยเครื่องคำนวณ (sandbox) | variations | WP-33 | opus |
| WP-35 | Portal backend + ค้นหา | portal | WP-30, WP-33 | opus |
| WP-36 | Portal web | portal | WP-35 | sonnet |
| WP-37 | ทะเบียนผู้ขาย | procurement | WP-06, WP-16, WP-35 | opus |
| WP-38 | PR + RFQ backend | procurement | WP-37, WP-20, WP-08 | opus |
| WP-39 | PO + รับของ + 3-way match backend | procurement | WP-38 | opus |
| WP-40 | PR/RFQ web | procurement | WP-39 | sonnet |
| WP-41 | PO/รับของ web + พิมพ์ PO/RFQ | procurement | WP-40 | sonnet |
| WP-42 | รายงานประจำวัน backend | site-diary | WP-20 | opus |
| WP-43 | รายงานประจำวัน web | site-diary | WP-42 | sonnet |
| WP-44 | ใบลงเวลา งวดค่าแรง 15 วัน เบิกล่วงหน้า backend | labour | WP-42 | opus |
| WP-45 | ค่าแรง web | labour | WP-44 | sonnet |
| WP-46 | Job cost backend: ต้นทุน กำไร แจ้งเตือน | job-cost | WP-39, WP-44, WP-30 | opus |
| WP-47 | กระแสเงินสดจริงข้ามโครงการ (backend) | job-cost | WP-46 | opus |
| WP-48 | Job cost + กระแสเงินสด web | job-cost | WP-47 | sonnet |
| WP-49 | เจ้าหนี้: บิลผู้ขาย / งวดจ้างช่วง / ค่าแรง + 3-way match (backend) | payables | WP-39, WP-44, WP-20 | opus |
| WP-50 | รอบจ่าย ใบสำคัญจ่าย และ 50 ทวิ (backend) | payables | WP-49 | opus |
| WP-51 | เจ้าหนี้ web + พิมพ์ 50 ทวิ / ใบสำคัญจ่าย | payables | WP-50 | sonnet |
| WP-52 | รายงานภาษี + Excel ให้นักบัญชี | payables | WP-51, WP-30 | opus |
| WP-53 | ส่งมอบ + รับประกัน backend | handover | WP-30 | opus |
| WP-54 | ส่งมอบ + รับประกัน web | handover | WP-53 | sonnet |
| WP-55 | ปิดโครงการ + ราคาจริงกลับสู่ BOQ | handover | WP-54, WP-46 | opus |
| WP-56 | ข้อมูลตัวอย่าง ERP + เอกสาร API | — | WP-55 | sonnet |

Track I (ย้ายข้อความไทยเดิม) อยู่ใน §13

---

## 2. Foundations

### WP-01 — i18n foundation (locale, format, parity, lint)
- **Module:** — · **Depends on:** — · **Model:** opus
- **Goal:** สลับ th/en ได้จริงทั้ง SSR และ client; มีเครื่องมือจัดรูปแบบกลาง กติกา lint และ parity — ก่อนหน้าจอ ERP ใด ๆ ถูกสร้าง
- **Scope** (ตาม `03-i18n.md` §2–§5)
  - `next.config.ts` (ครอบ `createNextIntlPlugin('./src/i18n/request.ts')`), ใหม่ `src/i18n/request.ts`, `src/i18n/config.ts` (`resolveLocale`), ใหม่ `src/i18n/global.d.ts`, `src/i18n/LocaleProvider.tsx` (`useAppLocale` คืน `{locale,setLocale}`, `useAntdLocale`), `src/app/layout.tsx` (async, `<html lang>`, `generateMetadata`), `src/app/(vendor)/layout.tsx` (`generateMetadata`)
  - `src/components/AppLayoutUI.tsx`: ลบ `thTH`/`dayjs.locale('th')` ระดับโมดูล ใช้ `useAntdLocale()`; `src/features/vendor/ui/VendorShell.tsx` (มี `ConfigProvider`) ใส่ `locale={useAntdLocale()}` เช่นกัน
  - ใหม่ `src/i18n/format.ts`, `src/i18n/useFormat.ts`, `src/i18n/document-translator.ts` (ตอนนี้ `documents.json` ยังว่าง `{}` ทั้งสองภาษา — WP-06 เติมโครง)
  - ใหม่ namespace `errors` (ครบทุก `ErrorCode` ใน `codes.*` + reasons ที่ `01-architecture.md` §1.5 ระบุ), `enums` (โครงว่าง), `shell`, `account`, `documents` (ว่าง); ใหม่ `src/features/cloud/api/error-message.ts` (`useErrorMessage`, `errorMessage(t, e)`) — `thaiErrorMessage` เดิมไม่แตะ
  - ใหม่ `scripts/i18n/check-parity.mjs` + `src/i18n/__tests__/parity.test.ts`
  - `eslint.config.mjs`: block ใหม่ท้ายไฟล์ (ก่อน `globalIgnores`) `files: ['src/features/erp/**/*.{ts,tsx}', 'src/app/(public)/**/*.{ts,tsx}', 'src/app/(print)/**/*.{ts,tsx}', 'src/app/(app)/{hub,home,p,customers,receivables,purchasing,suppliers,payables,tax-reports,finance,approvals,admin}/**/*.{ts,tsx}', 'src/app/(app)/workspace/{company,numbering,approval-policies,pay-periods}/**/*.{ts,tsx}']` rule `no-restricted-syntax` (error) จับ `Literal[value=/[฀-๿]/]`, `TemplateElement[value.raw=/[฀-๿]/]`, `JSXText[value=/[฀-๿]/]` (glob ของโฟลเดอร์ที่ยังไม่มีไม่เป็นไร)
  - ปุ่มสลับภาษาใน `src/features/cloud/ui/AccountMenu.tsx` (กลุ่ม Language; ใช้คีย์ `common.language/thai/english` ที่มีแล้ว) แสดงเฉพาะเมื่อ `process.env.NEXT_PUBLIC_LANGUAGE_SWITCH === '1'` (เงื่อนไข `project-hub` active เพิ่มใน WP-16; D-16)
  - Backend: `users.locale` (schema.ts + migration `0006_wp01_user_locale`), `GET /me` คืน `locale`, ใหม่ `PATCH /me/preferences {locale}` (use case ใน identity + `me.controller.ts`), contract `src/shared/contract/auth.ts` (`userPreferencesSchema`, `updatePreferencesRequestSchema`; ฟิลด์ใหม่ใน DTO ของ `/me` เป็น optional ฝั่งเว็บเพื่อความเข้ากันได้)
  - `src/features/cloud/CloudRuntime.tsx`: หลังล็อกอิน ถ้า `me.locale` ≠ cookie ตั้ง cookie ตาม `me.locale` แล้ว `router.refresh()`
- **Acceptance**
  - [ ] ตั้ง cookie `NEXT_LOCALE=en` แล้วโหลดหน้า: `<html lang="en">`, เมนูที่ใช้ `nav` อยู่แล้วเป็นอังกฤษ, antd DatePicker เป็นอังกฤษ
  - [ ] สลับภาษาจากเมนูบัญชีขณะล็อกอิน (env เปิดปุ่ม) → `users.locale` เปลี่ยน และล็อกอินเครื่องอื่นได้ภาษาเดียวกัน
  - [ ] `formatDate('2026-10-31','th')` = `31 ต.ค. 2026`; `formatDocumentDate('2026-10-31','th','be')` = `31 ตุลาคม 2569`; `formatBaht(1234.5,'en')` = `THB 1,234.50`; `formatMoney(-5,'th')` = `-5.00`
  - [ ] พิมพ์ข้อความไทยในไฟล์ใต้ `src/features/erp/` แล้ว eslint error; ไฟล์เดิมนอก glob ไม่โดน
  - [ ] parity script exit 1 เมื่อคีย์ขาด, exit 0 บนสถานะ commit
  - [ ] ไม่มี cookie / ไม่มี env ปุ่ม: ทุกหน้าเดิมแสดงภาษาไทยเหมือนเดิมทุกตัวอักษร และไม่มีปุ่มสลับภาษา (Robot e2e ใช้ข้อความไทย)
- **Out of scope:** ย้ายข้อความเดิม (track I), แจ้งเตือนสองภาษา (WP-10), แก้รูปแบบวันที่ของหน้าจอเดิม (รวม `fmtDate` ของสัญญาจ้างช่วงที่ใช้ พ.ศ. โดยตั้งใจ — D-35)

### WP-02 — ไลบรารีเงิน ภาษี วันที่
- **Module:** — · **Depends on:** — · **Model:** opus
- **Goal:** ฟังก์ชันกลางที่ทุกโมดูลใช้คำนวณเงินอย่างสม่ำเสมอ
- **Scope**
  - ใหม่ `src/domain/money/{money.ts,tax.ts,amount-in-words.ts,index.ts}` ตาม `01-architecture.md` §12.2
    - `allocate(total, weights)`: total บวกหรือลบได้, weights ≥ 0; ส่วนที่ i (ยกเว้นตัวสุดท้าย) = `round2(total × wᵢ / Σw)`, ตัวสุดท้าย = `round2(total − Σ ส่วนก่อนหน้า)`; Σw = 0 → ถือว่า weights เท่ากันทุกตัว; weights ว่าง → `[]`
    - `amountInWordsEn`: `0` → `Zero baht only`; ไม่มีสตางค์ → `... baht only`; ใช้ round2 ก่อนแปลง; ค่าติดลบ → นำหน้า `Minus `
  - `src/domain/subcontracting/snapshot.ts`: `round2` re-export จาก `money.ts` (พฤติกรรมเดิมทุกประการ: half away from zero + 1e-7)
  - ใหม่ `src/domain/dates/business-date.ts` (§13)
  - ใหม่ `src/domain/erp/tax-id.ts` (`isThaiTaxId(id)` checksum 13 หลัก: Σ digit[i] × (13 − i) สำหรับ i=0..11, check = (11 − sum mod 11) mod 10)
  - เทสต์สั้น: `src/domain/money/__tests__/money.test.ts`, `tax.test.ts`, `amount-in-words.test.ts`, `src/domain/dates/__tests__/business-date.test.ts`, `src/domain/erp/__tests__/tax-id.test.ts`
- **Acceptance**
  - [ ] `allocate(100, [1,1,1])` = `[33.33, 33.33, 33.34]`; `allocate(10, [0,0])` = `[5, 5]`; `allocate(-100, [1,3])` = `[-25, -75]`; ผลรวมเท่าต้นฉบับเสมอ
  - [ ] `splitVatInclusive(107, 0.07)` = `{net: 100, vat: 7}`
  - [ ] `amountInWordsEn(1250.5)` = `One thousand two hundred fifty baht and fifty satang only`
  - [ ] `bangkokToday(new Date('2026-10-30T18:00:00Z'))` = `2026-10-31`
  - [ ] `payPeriodOf('2026-10-16')` = `2026-10-B`; `addMonths('2026-01-31', 1)` ได้ค่าเดียวกับ `addMonthsToDate` เดิม
  - [ ] `isThaiTaxId('0105536000313') === true`, `isThaiTaxId('0105536000315') === false`, ความยาวไม่ใช่ 13 หลักหรือมีอักษร → false
  - [ ] vitest ของ `src/domain/subcontracting` ผ่าน (round2 ไม่เปลี่ยนพฤติกรรม)
- **Out of scope:** UI formatter (WP-01)

### WP-03 — Module registry, flag 4 ชั้น, entitlement, ModuleAccess (backend + contract)
- **Module:** platform · **Depends on:** — (รันหลัง WP-01/02 ตามลำดับ migration) · **Model:** opus
- **Goal:** ทุกโมดูล ERP มี id, dependency, entitlement และ `active` ตาม 4 ชั้น โดยโมดูลเดิมทำงานเหมือนเดิม; มี `ModuleAccess` ให้ทุก use case ERP
- **Scope**
  - Contract
    - `src/shared/contract/modules.ts`: เติม ModuleId ERP ต่อท้าย `MODULE_IDS` (ตาม `01-architecture.md` §4.1), `MODULE_LABEL` ไทยของ id ใหม่, `workspaceModuleDtoSchema` ใหม่ (§4.4), `moduleOffBlockersSchema` ใหม่, `entitlementStatusSchema`, `startTrialResponseSchema`; อัปเดตคอมเมนต์หัวไฟล์ (4 ชั้น)
    - ใหม่ `src/shared/contract/module-registry.ts` (`MODULE_REGISTRY`, `dependencyClosure`, `dependentsOf`)
    - ใหม่ `src/shared/contract/erp/common.ts`, `src/shared/contract/erp/index.ts`; root `index.ts` เพิ่ม `export * from './erp'` และ `export * from './module-registry'`
  - Backend
    - `backend/src/shared/infrastructure/config/env.ts`: `ENTITLEMENTS`, `PLATFORM_ADMIN_EMAILS` (parse เท่านั้น ใช้ใน WP-07), doc comment ของ `MODULES_ENABLED`, `testEnv()` เปิดทุก id + `ENTITLEMENTS:'open'`; getter ใน `AppConfig`
    - ใหม่ `backend/src/shared/infrastructure/database/schema-helpers.ts` (§1.2); `schema-platform.ts` เพิ่ม `workspace_entitlements`
    - platform: `application/ports/workspace-entitlement.repository.ts`, `infrastructure/adapters/{drizzle,in-memory}-workspace-entitlement.repository.ts`, `infrastructure/adapters/module-flags.adapter.ts` (สูตร active + cache), `application/services/module-flag-cache.ts` (cache entitlement + `invalidate(ws)`), `use-cases/set-workspace-module.use-case.ts` (dependency/cascade/entitled; ใช้ `ModuleWorkRegistry`), ใหม่ `use-cases/start-trial.use-case.ts`, `use-cases/list-workspace-modules.use-case.ts` + `workspace-module.view.ts` (DTO ใหม่), `presentation/modules.controller.ts` (route trial), `platform.module.ts`
    - ใหม่ `backend/src/shared/application/module-access.ts` (`ModuleAccess` §1.3; `memberCount` = `WorkspaceDirectory.memberIds(ws).length`) provide + export จาก `PlatformModule`
    - `backend/src/shared/application/ports.ts`: `ModuleWorkRegistry` (แทนและลบ `ModuleUsage`); `core.module.ts` provide/export registry
    - subcontracting: ลบ provider `ModuleUsage` ใน `backend/src/modules/subcontracting/contracts/contracts.parts.ts` แล้ว `register('subcontracting', ws => ({activeSubcontracts}))` ใน `onModuleInit` (ใช้ `RepositoryModuleUsage` เดิมเป็นตัวนับได้); แก้ test kit `backend/src/modules/platform/testing/platform-test-kit.ts` (`FakeModuleUsage`) และ `backend/src/modules/subcontracting/contracts/testing/contracts-test-kit.ts` ให้ใช้ registry
    - Endpoint ใหม่: `POST /workspaces/:workspaceId/modules/:module/trial` (`modules.manage`)
  - Web (เฉพาะให้คอมไพล์ผ่าน ไม่เปลี่ยนหน้าตา): `src/features/subcontracting/buyer/ModulesPage.tsx` อ่าน `activeSubcontracts` แบบ optional
  - Migration `0007_wp03_entitlements`
- **Acceptance**
  - [ ] `MODULE_REGISTRY` ครบทุก id ตามตาราง §4.2 (`Record<ModuleId, ModuleDef>` บังคับครบ); `dependencyClosure('labour')` = `['project-hub','boq-control','site-diary','workforce']` (ลำดับรากก่อน; tie-break ตามลำดับใน `MODULE_IDS`)
  - [ ] `ENTITLEMENTS=enforce`: โมดูล ERP ที่ไม่มีแถวสิทธิ์ `active=false`; legacy (`subcontracting`, `workforce`, `ai-assist`) ได้ผลเหมือนก่อน WP นี้
  - [ ] PUT เปิดโมดูลที่ dependency ไม่ active → 422 `unprocessable` + `details.reason='missing_dependencies'`, `details.missing`
  - [ ] PUT ปิดโมดูลที่มีตัวพึ่งพาเปิดอยู่ ไม่มี confirm → 409 `details.reason='has_dependents'`; มี confirm → ตัวพึ่งพาปิดด้วย; ปิด `subcontracting` ที่มีสัญญาค้างยังได้ 409 ที่มี `activeSubcontracts` เหมือนเดิม
  - [ ] trial: ครั้งแรกได้ `status='trial'`, `expires_at = now + 30 วัน`, toggle เปิด, dependency ที่ไม่มีสิทธิ์ได้ trial ด้วย; ครั้งที่สอง → 409 `reason:'trial_used'`; โมดูลที่ไม่ release → 422
  - [ ] `ModuleAccess.inWorkspace/toProject` คืน not_found → module_disabled → forbidden ตามลำดับ (เทสต์สั้นด้วย in-memory)
  - [ ] jest เดิมใน `backend/src/modules/platform` และ `backend/src/modules/subcontracting` ผ่าน
- **Out of scope:** หน้าเว็บ (WP-04), platform admin (WP-07), audit ของการให้สิทธิ์ (WP-08 เพิ่ม), การเก็บเงิน/แพ็กเกจ

### WP-04 — หน้าโมดูลและทดลองใช้ (web)
- **Module:** platform · **Depends on:** WP-01, WP-03 · **Model:** sonnet
- **Goal:** owner เปิด/ปิด/ทดลองโมดูลได้พร้อมเห็น dependency; ทุกจุด gate ใช้ `active`
- **Scope**
  - `src/features/modules/modules.ts`: `useModuleEnabled` อ่าน `active`; ใหม่ `useActiveModules(workspaceId?)` (คืน `ReadonlySet<ModuleId>`; ว่างระหว่างโหลด), `useStartTrial(ws)`
  - `src/features/modules/ModuleGate.tsx`: ใช้ `active`; ข้อความจาก namespace `modules` (ข้อความไทยเดิม "… ปิดใช้งานอยู่" ฯลฯ คัดลอกตรงตัว); ถ้า `trialAvailable` แสดงปุ่ม "ทดลองใช้ 30 วัน" (`modules.manage`)
  - `src/features/subcontracting/buyer/ModulesPage.tsx`: แยกกลุ่ม "โมดูลเดิม" / "ERP"; โมดูล ERP ที่ `available=false` ไม่แสดงเลย และถ้าไม่มี ERP ที่ available เลย ไม่แสดงหัวกลุ่ม ERP (release 1 เหมือนเดิม); แสดง entitlement (ป้าย trial + วันหมดอายุ, beta, purchased), `missingDependencies`, ปุ่มทดลอง, dialog ยืนยันการปิดแบบ cascade (แสดง `dependents`, `work`)
    ย้ายข้อความ `MODULE_HINT` ไป `modules.<id>.hint` และข้อความทั้งไฟล์ไป namespace `modules` (ไทยตรงตัวอักษรเดิม)
  - i18n: namespace `modules` (th + en) ลงทะเบียนใน `src/i18n/messages/{th,en}/index.ts`
- **Acceptance**
  - [ ] env เปิดโมดูล ERP: หน้า `/workspace/modules` แสดงทุก id ที่ available จาก registry, กด trial แล้วสถานะเปลี่ยนโดยไม่ reload
  - [ ] ปิด `contracts` ขณะ `billing` เปิด → dialog แสดง billing แล้วยืนยันปิดทั้งคู่
  - [ ] env แบบ release 1 (`MODULES_ENABLED` ไม่มี id ERP): หน้า modules เหมือนก่อน WP นี้ทุกประการ
- **Out of scope:** หน้า Portal tiles (WP-36), platform admin (WP-07)

### WP-05 — บทบาทและสิทธิ์ ERP
- **Module:** — · **Depends on:** WP-03, WP-04 · **Model:** opus
- **Goal:** บทบาทใหม่ 4 ตัวและ permission ERP ทั้งหมดพร้อมใช้ ฝั่งเว็บตรงกับ backend
- **Scope**
  - `src/shared/contract/common.ts`: `ROLES` + `assignableRoleSchema` (ตาม §5.1)
  - `backend/src/shared/domain/permissions.ts`: permission ใหม่ทั้งหมด §5.2 + matrix §5.3 + `roleRank`
  - ตัดสินและทำ: ย้าย matrix ไป `src/shared/contract/permissions.ts` แล้วให้ backend `permissions.ts` และ `src/features/cloud/permissions.ts` re-export (ทางที่แนะนำ; คงลายเซ็นเว็บ `can(role: Role | undefined, …)` และ `ROLE_LABEL`) หรือคัดลอกให้ตรงกันทุกตัว (รวม `rateCards.*`, `workforce.*` ที่เว็บขาด) — บันทึกใน Decisions log
  - schema.ts check constraint `memberships_role_check`, `invitations_role_check` (และ `enum` ของคอลัมน์) + migration `0008_wp05_roles`
  - backend workspaces: `role-change.policy.ts`, `invitation.policy.ts` รองรับบทบาทใหม่ (rank 1); `testing/workspaces-test-kit.ts` `ROLES_UNDER_TEST` เพิ่มบทบาทใหม่ถ้าเทสต์ยังผ่าน
  - ทุก `Record<Role, …>` / `switch (role)` ใน `src` และ `backend/src` ครบ (`grep -rn "Record<Role" src backend/src`); `ROLE_LABEL` ไทยของบทบาทใหม่
  - `src/store/project-store.ts`: `isReadOnly` = `binding.kind === 'cloud' && !can(binding.role, 'projects.edit')`
  - web: หน้าสมาชิก/เชิญ (`src/features/cloud/workspaces/MembersPage.tsx` และส่วนเลือกบทบาท) แสดงบทบาทใหม่ด้วย namespace `roles` (th/en) **เฉพาะเมื่อ `useModuleEnabled('project-hub')`**; ป้ายบทบาทของสมาชิกที่มีบทบาทใหม่แสดงเสมอ
- **Acceptance**
  - [ ] เชิญสมาชิกเป็น `accounting` ได้ และ `can('accounting','payables.pay') === true`, `can('viewer','cost.read') === false`
  - [ ] `can()` ฝั่งเว็บและ backend ให้ผลเท่ากันทุกคู่ (role × permission) — เทสต์ 1 ไฟล์
  - [ ] ผู้ใช้บทบาท `purchasing` เปิด BOQ ของโครงการ → โหมดอ่านอย่างเดียว (ไม่ยิง PUT แล้วโดน 403)
  - [ ] release 1: ตัวเลือกบทบาทในหน้าสมาชิกเหมือนเดิม (admin/estimator/viewer)
  - [ ] เทสต์ workspaces/permissions เดิมผ่าน (`cd backend && npx jest src/modules/workspaces src/shared/domain`)
- **Out of scope:** สิทธิ์ระดับโครงการ (ACL รายคน)

### WP-06 — ERP web foundation: UI kit, nav registry, กรอบพิมพ์
- **Module:** — (ใช้ร่วมทุกโมดูล) · **Depends on:** WP-01, WP-04, WP-05 · **Model:** opus
- **Goal:** ทุกหน้าจอ ERP ที่ตามมาใช้ชิ้นส่วนกลางชุดเดียว (หน้า, ตัวเลข, วันที่, เอกสารพิมพ์, เมนู) — สร้าง **ก่อน** หน้าจอ ERP ตัวแรก
- **Scope**
  - UI kit `src/features/erp/shared/`: `ErpPage.tsx` (container กว้างสุด 1200px + `PageHeader` title/extra/breadcrumb, gutter 16px บนมือถือ), `SectionCard.tsx`, `StatusTag.tsx` (map สถานะ → สี + ข้อความจาก `enums`), `MoneyText.tsx`, `QtyText.tsx`, `DateText.tsx`, `DocumentNumberTag.tsx` (แสดงเลข หรือป้าย "ฉบับร่าง" เมื่อ null), `EmptyState.tsx`, `ConfirmAction.tsx` (ปุ่ม + modal.confirm ข้อความจาก t), `MoneyInput.tsx`, `QtyInput.tsx` (antd `InputNumber` + `precision` + formatter จาก `format.ts`), `FileAttachments.tsx` (อัปโหลดผ่าน API files เดิมพร้อม `workspaceId` + แสดงรายการ), `PrintFrame.tsx` (§15), `apiPaths.ts` (helper `seg()` + ฟังก์ชันสร้าง path), `useErpWorkspace.ts` (workspace ปัจจุบัน: `{workspaceId, role, memberCount, isSolo}` จาก hooks cloud เดิม)
  - ใหม่ `src/features/erp/hub/nav-registry.ts` ตาม `01-architecture.md` §3.3: type `ErpNavItem`, `WORKSPACE_NAV` (กลุ่ม `sales`, `purchasing`, `finance`, `settings` ยังว่าง), `PROJECT_TABS` (ว่าง), `useWorkspaceNav()`, `useProjectTabs(projectId)` กรองด้วย `useActiveModules()` + `can()` — **ยังไม่ต่อเข้า `AppLayoutUI`** (WP-16)
  - ใหม่ `src/app/(print)/layout.tsx` (`CloudProviders` + พื้นหลังเทา ไม่มีเมนู); CSS พิมพ์ A4 ใน `PrintFrame` (`@page { size: A4; margin: 15mm }`)
  - i18n: namespace ใหม่ `erp` (ข้อความของ UI kit: ฉบับร่าง, พิมพ์, ปิด, อัปโหลด, ว่าง ฯลฯ), `documents` โครง `documents.common.*` (taxId, branch, headOffice, page, draft, void, total, vat, grandTotal, amountInWords, signature, date, number)
  - `src/features/erp/shared/README.md` สั้น ๆ: รายการ component + ตัวอย่างใช้ 1 บรรทัดต่อชิ้น (ให้ WP ถัดไปไม่ต้องเปิดอ่านทุกไฟล์)
- **Acceptance**
  - [ ] ทุก component ไม่มีข้อความไทยตายตัว (lint ผ่าน) และใช้ `useFormat()`
  - [ ] `MoneyText` แสดง `1,234.50` ทั้งสองภาษา; `DateText` ปี ค.ศ.
  - [ ] `PrintFrame` พิมพ์ A4 ได้ (ทดสอบด้วยหน้าตัวอย่างชั่วคราวใน `(print)` แล้วลบก่อน commit — ระบุผลใน Handoff)
  - [ ] ไม่มีหน้าจอเดิมเปลี่ยน (ยังไม่ต่อ nav)
- **Out of scope:** picker เฉพาะโมดูล (`CustomerPicker` WP-13, `CostCodePicker` WP-19, `SupplierPicker` WP-37), Hub (WP-16)

### WP-07 — Platform admin: ให้สิทธิ์โมดูล (backend + web)
- **Module:** platform · **Depends on:** WP-03, WP-06 · **Model:** sonnet
- **Goal:** platform admin (อีเมลใน `PLATFORM_ADMIN_EMAILS`) ค้นหา workspace และตั้งสิทธิ์ purchased / trial / beta / revoked ต่อโมดูลได้ (ชั้นที่ 2)
- **Scope**
  - Contract `src/shared/contract/modules.ts`: `putEntitlementRequestSchema` (`{status, expiresAt?: iso | null, note?}`; `trial` ต้องมี `expiresAt`), `adminWorkspaceDtoSchema`, `adminWorkspaceListQuerySchema`, `platformAdminStatusDtoSchema`
  - Backend platform: ใหม่ `application/platform-admin-access.ts` (`PlatformAdminAccess.check(userId)` → `UserDirectory.findMany([userId])` แล้วเทียบอีเมลตัวพิมพ์เล็ก; ไม่ใช่ → `not_found`), `use-cases/get-platform-admin-status.use-case.ts`, `use-cases/list-admin-workspaces.use-case.ts`, `use-cases/set-entitlement.use-case.ts` (เขียน `workspace_entitlements`, `granted_by`, invalidate cache), ใหม่ `presentation/platform-admin.controller.ts`, `platform.module.ts`
  - `ports.ts`: `WorkspaceDirectory.search(q, limit): Promise<{id, name, kind, memberCount, createdAt}[]>`; implement ใน `backend/src/modules/workspaces/infrastructure/adapters/workspace-directory.adapter.ts` (+ repository method ถ้าต้องใช้) และ `FakeWorkspaceDirectory` ใน `backend/src/shared/testing/platform-fakes.ts`
  - Endpoints: `GET /platform/admin/status`, `GET /platform/admin/workspaces?q=&limit=`, `PUT /platform/admin/workspaces/:workspaceId/entitlements/:module`
  - Web: ใหม่ `src/features/erp/admin/{api.ts,hooks.ts,EntitlementsPage.tsx}` + route `src/app/(app)/admin/entitlements/page.tsx` (ตาราง workspace ค้นหา, แก้สิทธิ์ต่อโมดูล ERP: status, วันหมดอายุ, หมายเหตุ); ลิงก์ในกลุ่ม `settings` ของ nav registry + ลิงก์ใน `AccountMenu.tsx` เฉพาะเมื่อ `status.admin = true`
  - i18n: namespace `admin`
- **Acceptance**
  - [ ] admin endpoints ตอบ 404 `not_found` สำหรับผู้ที่อีเมลไม่อยู่ใน `PLATFORM_ADMIN_EMAILS` (และเมื่อ env ว่าง)
  - [ ] ตั้ง `purchased` แล้ว `GET /workspaces/:id/modules` ของ workspace นั้นได้ `entitlement.status='purchased'` ทันที (cache ถูก invalidate)
  - [ ] ผู้ใช้ทั่วไปเข้า `/admin/entitlements` เห็นหน้า "ไม่พบ" (ไม่เห็นข้อมูล)
  - [ ] เทสต์สั้นของ `PlatformAdminAccess` (อีเมลตัวพิมพ์ต่างกันยังตรง)
- **Out of scope:** audit (WP-08 เพิ่มใน `set-entitlement.use-case.ts`), การเก็บเงิน, admin panel แยก

### WP-08 — Workflow อนุมัติ + audit log (backend)
- **Module:** foundation (gate ด้วย `project-hub`) · **Depends on:** WP-03, WP-05, WP-07 · **Model:** opus
- **Goal:** port `Approvals` + `ApprovalHandlers` + `AuditLog` ใช้ได้ทุกโมดูล กฎข้ามอนุมัติเมื่อทำคนเดียวถูกต้อง
- **Scope**
  - ใหม่ `backend/src/shared/infrastructure/database/schema-erp-core.ts` (`approval_policies`, `approval_requests`, `approval_steps`, `audit_events`; export `erpCoreTables`) + `database.ts` + `drizzle.config.ts` + migration `0009_wp08_approvals_audit`
  - contract ใหม่ `src/shared/contract/erp/approvals.ts` (`APPROVAL_SUBJECTS`, `APPROVAL_SUBJECT_DEFAULTS` ตาม `01-architecture.md` §6.1, DTO/requests), `erp/audit.ts`
  - `ports.ts`: `Approvals`, `ApprovalHandlers`, `AuditLog`, types; `WorkspaceDirectory.members(workspaceId)` (`{userId, role}[]`) + implement ใน `workspace-directory.adapter.ts` และ `FakeWorkspaceDirectory`; `core.module.ts` provide/export `ApprovalHandlers`
  - ใหม่ `backend/src/modules/approvals/` (domain request/policy + pure `auto-skip.policy.ts` ตาม §6.3, repos, use cases: request (ภายในผ่าน port), decide (ล็อกแถว request → ตรวจสิทธิ์: ผู้ตัดสินต้องอยู่ใน eligible และ **ไม่ใช่ผู้ขอ** เว้นแต่ `selfApprove` → เรียก handler ใน transaction เดียว → audit), cancel, list inbox, get/put policies; controller `@RequiresModule('project-hub')`) และ `backend/src/modules/audit/` (repo + `AuditLog` adapter + list use case + controller)
  - เพิ่ม `AuditLog.record` ใน `backend/src/modules/platform/application/use-cases/set-entitlement.use-case.ts` (สร้างใน WP-07; `workspaceId` = workspace ที่ถูกตั้งสิทธิ์, `entityType:'entitlement'`)
  - `app.module.ts` import สองโมดูล
  - Endpoints: `GET /workspaces/:workspaceId/approvals?status=&mine=`, `POST /approvals/:requestId/decide`, `GET /workspaces/:workspaceId/approval-policies`, `PUT /workspaces/:workspaceId/approval-policies/:subject` (`company.manage`), `GET /workspaces/:workspaceId/audit` (`audit.read`)
  - เทสต์สั้นของ auto-skip policy (pure) ครบ 5 ข้อของ §6.3
- **Acceptance**
  - [ ] workspace ที่มี owner คนเดียว: `request` ทุก subject คืน `approved`, `auto=true`, แถวถูกบันทึกพร้อม `auto_reason`
  - [ ] มี owner + estimator: estimator ขอ `purchase_order.issue` 60,000 → `pending`; owner decide approved → handler ถูกเรียกใน transaction เดียว; ถ้า handler คืน err → การตัดสิน rollback
  - [ ] ขอซ้ำขณะ pending → `conflict` (partial unique)
  - [ ] non-approver decide → `forbidden`; คนนอก workspace → `not_found`; decide request ที่ตัดสินแล้ว → 409 `invalid_transition`
- **Out of scope:** หลายขั้นอนุมัติ, UI (WP-09)

### WP-09 — หน้าอนุมัติ นโยบาย และ audit (web)
- **Module:** foundation · **Depends on:** WP-08, WP-06 · **Model:** sonnet
- **Scope**
  - ใหม่ `src/features/erp/approvals/{api.ts,hooks.ts,ApprovalsInboxPage.tsx,ApprovalPoliciesPage.tsx,ApprovalBadge.tsx}` (ใช้ UI kit ของ WP-06 และ `useErpWorkspace`)
  - ใหม่ `src/features/erp/shared/AuditTimeline.tsx` (component ใช้ซ้ำแสดงประวัติของ entity จาก `GET /workspaces/:id/audit?entityType=&entityId=`; ซ่อนเมื่อไม่มี `audit.read`)
  - routes `src/app/(app)/approvals/page.tsx`, `src/app/(app)/workspace/approval-policies/page.tsx` (ครอบ `ModuleGate module="project-hub"`)
  - nav registry กลุ่ม `settings`: approvals inbox, approval-policies (`company.manage`); ลิงก์เดียวกันใน `AccountMenu.tsx` (เฉพาะเมื่อ `project-hub` active)
  - i18n `approvals`, `audit`, `enums.approvalStatus`, `enums.approvalSubject`
- **Acceptance**
  - [ ] กล่องอนุมัติแสดงรายการรอฉัน อนุมัติ/ปฏิเสธพร้อมหมายเหตุได้ รายการหายหลังตัดสิน
  - [ ] หน้านโยบายแก้ enabled / minAmount / approverRoles / selfApprove ได้ทุก subject
  - [ ] workspace คนเดียว (`useErpWorkspace().isSolo`): หน้า inbox แสดงข้อความ "คุณทำงานคนเดียว ระบบอนุมัติให้อัตโนมัติ" (จาก message file)
- **Out of scope:** badge บนเมนู (WP-16 ใส่ตอนต่อ nav)

### WP-10 — การแจ้งเตือน: channel, ภาษาผู้รับ, sweep
- **Module:** platform · **Depends on:** WP-01, WP-02, WP-03 · **Model:** opus
- **Scope** (ตาม `01-architecture.md` §7)
  - `ports.ts`: `ScNotificationTemplate` (ชื่อใหม่ของ union เดิม), `ErpNotificationTemplate` (**ครบทุกตัวใน §7 ข้อ 1**), `NotificationTemplate` union, `DailySweeps` registry (+ core.module provide/export)
  - platform: `application/ports/notification-channel.port.ts`, adapter ห่อ sms/line, `infrastructure/adapters/delivery-worker.ts` ใช้ channels, `application/ports/recipient-directory.port.ts` + adapters (drizzle + in-memory) คืน `locale` และอ่าน `user_channel_links`,
    `send-notification.use-case.ts` เรนเดอร์ต่อ locale ของผู้รับ, `application/services/notification-templates.ts` (ลายเซ็น `renderNotification(template, payload, url, locale)`; แยก `TEMPLATES` เดิมเป็น `Record<ScNotificationTemplate, …>`; `sc.*` ภาษาอังกฤษ fallback = ไทย), ใหม่ `notification-templates.erp.ts` (ข้อความ th + en ของทุก template ERP), ใหม่ `notification-format.ts`
  - ใหม่ `backend/src/modules/platform/infrastructure/adapters/daily-sweeps.runner.ts` (แพตเทิร์น `RetentionDueSweep`: timer แรก 60 วินาที แล้วทุก 6 ชั่วโมง, ไม่เริ่มเมื่อ `NODE_ENV=test`, `runOnce()` สาธารณะ) + `sweep_marks` repo (`markOnce(sweep, key, date): Promise<boolean>`); sweep แรก `platform.trial-expiring` (`trial.expiring` ถึงสมาชิกที่มี `modules.manage`)
  - schema-platform.ts: `user_channel_links`, `sweep_marks` + migration `0010_wp10_notifications`
  - web: `src/features/notifications/NotificationBell.tsx` แสดงเมื่อ `project-hub` active ด้วย (เงื่อนไขเดิมคงไว้)
  - spec เดิม `notification-templates.spec.ts`, `send-notification.use-case.spec.ts` ปรับตามลายเซ็นใหม่ (ไม่ลดสิ่งที่ตรวจ)
- **Acceptance**
  - [ ] ผู้ใช้ locale `en` ได้ title/body ของ template ERP เป็นอังกฤษ ผู้ใช้ `th` ได้ไทย ใน notify ครั้งเดียวกัน; payload เงิน/วันที่ถูกจัดรูปแบบตามภาษา
  - [ ] template `sc.*` เดิมได้ข้อความไทยเหมือนเดิมทุกตัวอักษร (ทั้งสองภาษาในเฟสนี้)
  - [ ] trial ที่หมดใน 3 วันได้แจ้ง `trial.expiring` ครั้งเดียวต่อวัน (เรียก `runOnce()` สองครั้ง ได้ 1 แถว)
  - [ ] เทสต์ platform เดิมผ่าน
- **Out of scope:** หน้าผูก LINE, การตั้งค่าแจ้งเตือนรายผู้ใช้, ส่ง LINE จริง

### WP-11 — บริการเลขเอกสาร + guard การลบ
- **Module:** foundation · **Depends on:** WP-02, WP-03, WP-06, WP-08 · **Model:** opus
- **Scope** (ตาม `01-architecture.md` §8, `02-domain-model.md` §1.6)
  - schema-erp-core.ts: `doc_number_series`, `doc_number_counters`, `issued_documents` + migration `0011_wp11_numbering`
  - contract `erp/numbering.ts` (`DOC_TYPES` + ค่าเริ่มต้น, pattern tokens, DTO, request)
  - pure `src/domain/erp/numbering.ts`: `formatDocNumber(pattern, {prefix, issueDate, yearStyle, seq})`, `periodKeyOf(reset, issueDate)`, `validatePattern(pattern)` (ต้องมี `{seq:N}` หนึ่งครั้ง N 3–6, token ที่ไม่รู้จัก → ผิด; reset `monthly` ต้องมี `{mm}`) + เทสต์สั้น
  - ใหม่ `backend/src/modules/numbering/` (port `DocumentNumbering` ใน `ports.ts`, drizzle adapter ด้วย upsert counter, in-memory ด้วย `KeyedMutex` (ย้าย `backend/src/modules/workspaces/infrastructure/adapters/keyed-mutex.ts` ไป `backend/src/shared/infrastructure/keyed-mutex.ts` แล้วให้ไฟล์เดิม re-export), use cases list/put series (`company.manage`), void (ผ่าน port), controller; `AuditLog.record` ตอน issue/void)
  - `ports.ts` + core: `ProjectDeletionGuards`, `WorkspaceDeletionGuards`; `DeleteProjectUseCase` (`backend/src/modules/projects/application/use-cases/delete-project.use-case.ts`) และ `DeleteWorkspaceUseCase` (`backend/src/modules/workspaces/application/use-cases/delete-workspace.use-case.ts`) เรียก guard ภายใน transaction ก่อนลบ → `conflict` `reason:'document_issued_exists'`; numbering ลงทะเบียน guard ที่นับ `issued_documents` ยกเว้น `doc_type='project'`
  - ใหม่ `src/features/erp/numbering/{api.ts,hooks.ts,NumberingSettingsPage.tsx}` + route `src/app/(app)/workspace/numbering/page.tsx` + nav registry กลุ่ม `settings` + i18n `numbering`, `enums.docType`
- **Acceptance**
  - [ ] ออกเลขพร้อมกัน 20 ครั้ง (Promise.all ใน memory adapter) ได้ seq 1–20 ไม่ซ้ำไม่ข้าม
  - [ ] transaction ที่ throw หลัง `issue` → ครั้งถัดไปได้เลขเดิม (postgres; ระบุใน Handoff ถ้าทดสอบได้แค่ memory)
  - [ ] `tax_invoice` วันที่ก่อนใบล่าสุดของชุด → 422 `date_before_last_issued`
  - [ ] เปลี่ยน prefix ขณะมีเอกสารในรอบปัจจุบัน → 409 `period_has_documents`
  - [ ] ลบโครงการที่มี issued document (ไม่ใช่ `project`) → 409; โครงการที่มีแค่รหัสโครงการลบได้
  - [ ] หน้า settings แสดง preview เลขถัดไปทุก docType (preview ไม่จองเลข)
- **Out of scope:** ย้ายเลขสัญญาจ้างช่วงเดิม (D-08)

### WP-12 — โปรไฟล์บริษัท + business profile + project type
- **Module:** foundation · **Depends on:** WP-11, WP-06 · **Model:** sonnet
- **Scope**
  - schema-erp-core.ts: `company_profiles` + migration `0012_wp12_company`
  - pure `src/domain/erp/profiles.ts` (`BUSINESS_PROFILES`, `PROJECT_TYPES`, `ProjectCommercialSettings`, `PROJECT_TYPE_DEFAULTS` ตาม `00-vision.md` §4 ครบทุกช่องรวม `milestoneTemplate` และ `billingMode`, `resolveSettings`, `defaultProjectTypeFor(businessProfiles)`) + เทสต์สั้น (`Σ pct` ของทุกแม่แบบ = 1)
  - contract `erp/company.ts`
  - FILE_PURPOSES `company_logo`, `company_stamp`, `company_signature` → `project-hub` (`src/shared/contract/files.ts` + `FILE_PURPOSE_MODULE`)
  - ใหม่ `backend/src/modules/company/` (port `CompanyProfiles` ใน `ports.ts`: `get(ws)` คืนโปรไฟล์หรือค่าเริ่มต้น (ชื่อ = `workspaces.name` ผ่าน `WorkspaceDirectory.names`), `snapshot(ws, locale)` สำหรับเอกสาร), endpoints `GET /workspaces/:workspaceId/company` (`company.read`), `PUT /workspaces/:workspaceId/company` (`company.manage`)
  - web `src/features/erp/company/{api.ts,hooks.ts,CompanyProfilePage.tsx,BusinessProfileStep.tsx}` + route `src/app/(app)/workspace/company/page.tsx` (ข้อมูลบริษัท, ภาษี, บัญชีธนาคาร, PromptPay, โลโก้ (`FileAttachments`), business profile หลายค่า, project type เริ่มต้น, ตารางค่าเริ่มต้นต่อ project type แก้ทับได้) + nav registry กลุ่ม `settings`
  - i18n `company`, `enums.projectType`, `enums.businessProfile`, `enums.billingMode`, `enums.milestoneTrigger`
- **Acceptance**
  - [ ] `resolveSettings('government', {}, {})` คืน `retentionPct 0.05`, `customerWhtRate 0.01`, `quotationFormat 'government'`, `billingMode 'milestone'`; ค่าทับของบริษัทชนะค่าเริ่มต้น และค่าของโครงการชนะบริษัท
  - [ ] tax id ผิด checksum → 400 `validation_failed`; `vat_registered=false` แล้ว `vat_rate` ถูกบังคับ 0 ใน `snapshot`
  - [ ] อัปโหลดโลโก้แล้วแสดงในหน้า และใน `snapshot`
- **Out of scope:** หน้า onboarding wizard เต็ม (มีแค่ `BusinessProfileStep` ใช้ในหน้า company)

### WP-13 — ทะเบียนลูกค้า
- **Module:** foundation · **Depends on:** WP-12 · **Model:** sonnet
- **Scope**
  - schema-erp-core.ts `customers` + migration `0013_wp13_customers`; contract `erp/customers.ts`; FILE_PURPOSE `customer_document`
  - ใหม่ `backend/src/modules/customers/` (CRUD + archive, port `CustomerLookup` ใน `ports.ts`: `find(ws, id)`, `findMany(ws, ids)`, `snapshot(ws, id, locale)`; ลงทะเบียน `SearchSources` ทำใน WP-35)
  - Endpoints: `GET/POST /workspaces/:workspaceId/customers?q=&kind=&archived=`, `GET/PATCH /customers/:customerId`, `POST /customers/:customerId/archive|restore`
  - web `src/features/erp/customers/{api.ts,hooks.ts,CustomersPage.tsx,CustomerDetailPage.tsx,CustomerForm.tsx}` + `src/features/erp/shared/CustomerPicker.tsx` + routes `src/app/(app)/customers/page.tsx`, `src/app/(app)/customers/[customerId]/page.tsx` + nav registry กลุ่ม `sales`
  - i18n `customers`, `enums.customerKind`
- **Acceptance**
  - [ ] สร้าง/แก้/เก็บเข้าคลังลูกค้าได้; tax id + สาขาซ้ำ (active) → 409; ไม่มีทั้ง `name_th` และ `name_en` → 400
  - [ ] `CustomerPicker` ค้นหาและสร้างลูกค้าใหม่ในตัวได้
  - [ ] สิทธิ์ `customers.read` / `customers.manage` ตาม matrix
- **Out of scope:** ประวัติการขาย (แสดงใน WP-36)

### WP-14 — ลิงก์ลูกค้า (public)
- **Module:** foundation · **Depends on:** WP-13 · **Model:** opus
- **Scope**
  - schema-erp-core.ts `customer_links` + migration `0014_wp14_customer_links`; contract `erp/customer-links.ts` (`CustomerLinkViewDto` แบบ discriminated union ตาม `subjectType` — ตอนนี้ payload ของแต่ละ subject เป็น `z.unknown()` ที่โมดูลเจ้าของกำหนด schema ภายหลัง, `respondRequestSchema` `{action, name, note}`)
  - `ports.ts` + core: `CustomerLinkHandlers` (`register(subjectType, {permission, view, respond?})`; respond ทำงานใน transaction ของ customer-links)
  - ใหม่ `backend/src/modules/customer-links/`: create/revoke/list (ผู้ใช้ภายใน, สิทธิ์ตาม `handler.permission`), public controller `@Controller('public/links') @Public()` `GET :token`, `POST :token/respond` (**ไม่มี** `@RequiresModule` ที่ controller สาธารณะ — ตรวจ release `project-hub` ใน use case แล้วตอบ 404 เหมือน token ผิด), ตัวจำกัดอัตรา in-memory (30 ครั้ง/10 นาที ต่อ token+IP) แบบ `InMemoryRateLimiter` ของ identity, บันทึก ip/user-agent, `view_count`/`last_viewed_at`; action ที่รับได้ตาม `02-domain-model.md` §1.8
  - Endpoints ภายใน (`@RequiresModule('project-hub')`): `POST /workspaces/:workspaceId/customer-links {subjectType, subjectId, expiresInDays?}` → `{url, token}` ครั้งเดียว (`url` = `AppLinks.url('/c/' + token)`), `GET /workspaces/:workspaceId/customer-links?subjectType=&subjectId=`, `POST /customer-links/:linkId/revoke`
  - web: route group `src/app/(public)/layout.tsx` (ConfigProvider + `QueryClientProvider` ของตัวเอง ไม่ใช้ `CloudProviders`), `src/app/(public)/c/[token]/page.tsx` + `src/features/erp/customer-links/{api.ts,PublicLinkPage.tsx,RespondForm.tsx,renderers.ts}` (`renderers.ts` = registry `subjectType → component`; WP-25 (quotation), WP-32 (invoice), WP-34 (variation) ลงทะเบียน), ปุ่มคัดลอก/แชร์ลิงก์ `src/features/erp/shared/ShareLinkButton.tsx`
  - i18n `customerLinks` (ภาษาของหน้า = `language` ของเอกสารใน view DTO: ใช้ `createTranslator` แบบเดียวกับ `documentTranslator` กับ namespace `customerLinks`)
- **Acceptance**
  - [ ] token ผิด/หมดอายุ/ถูก revoke/ปิดโมดูล → 404 เหมือนกันทุกกรณี
  - [ ] ตอบครั้งที่สอง → 409 `already_responded`; action ที่ subject ไม่รองรับ → 422
  - [ ] ไม่มี subject handler → 404
  - [ ] หน้า public ไม่เรียก `/api/auth/refresh` (ไม่ใช้ session)
- **Out of scope:** ลายเซ็นอิเล็กทรอนิกส์ (เก็บชื่อ + เวลา + IP เท่านั้น), renderer ของแต่ละเอกสาร

### WP-15 — Project Hub backend
- **Module:** project-hub · **Depends on:** WP-11, WP-13 · **Model:** opus
- **Scope**
  - schema.ts คอลัมน์ใหม่ของ `projects` (`02-domain-model.md` §1.9; ทุกคอลัมน์ nullable หรือมี default เพื่อให้แถวเดิมผ่าน) + migration `0015_wp15_project_hub`
  - contract `erp/hub.ts` (`PROJECT_STATUSES`, `hubProjectFieldsSchema`, `HubProjectDto`, `HubProjectDetailDto`, `ProjectRollup`, `updateHubProjectRequestSchema`, `hubProjectListQuerySchema`, `HubSummaryDto` = จำนวนต่อสถานะ + Σ มูลค่าสัญญา/ค้างรับ (null เมื่อโมดูลไม่ active))
  - `ports.ts` + core: `HubRollups` registry (`register(module, (ws, projectIds) => Promise<Map<ProjectId, Partial<ProjectRollup>>>)`), port `ProjectLifecycle`
  - ใหม่ `backend/src/modules/hub/` (repo อ่าน/เขียนเฉพาะคอลัมน์ hub — repository `projects` เดิมไม่แตะ; transition table สถานะโครงการ; use cases list (batch + rollups), detail, update (`projects.edit`; `customerId` ตรวจผ่าน `CustomerLookup`; `settings` merge แบบ partial), assign code (`DocumentNumbering` docType `project`; ถ้ามีรหัสแล้ว → 409), summary; `ProjectLifecycle` adapter)
  - Endpoints: `GET /workspaces/:workspaceId/hub/projects`, `GET /workspaces/:workspaceId/hub/summary`, `GET /projects/:projectId/hub`, `PATCH /projects/:projectId/hub`, `POST /projects/:projectId/hub/code`
- **Acceptance**
  - [ ] list 50 โครงการใช้จำนวน query คงที่ (ไม่ N+1) — อธิบายใน Handoff
  - [ ] เปลี่ยนสถานะตามตาราง transition; ไม่ถูกต้อง → 409 `invalid_transition`; `closed → warranty` เฉพาะ owner
  - [ ] `ProjectLifecycle.advance(..., 'won')` จาก `quoted` ได้ `won`; จาก `in_progress` ไม่เปลี่ยน; จาก `lost` ไม่เปลี่ยน
  - [ ] `customerId` ของ workspace อื่น → 404
  - [ ] endpoint เดิมของ projects (`GET /projects/:id`, list, sync) ไม่เปลี่ยน DTO และเทสต์ projects เดิมผ่าน
- **Out of scope:** web (WP-16)

### WP-16 — Project Hub web + ต่อ nav เข้า AppLayoutUI
- **Module:** project-hub · **Depends on:** WP-15, WP-06, WP-09 · **Model:** opus
- **Scope**
  - nav: `src/components/AppLayoutUI.tsx` ใช้ `useWorkspaceNav()` จาก nav registry (WP-06) เมื่อ `project-hub` active ตาม `01-architecture.md` §3.3 (เมนูเดิมเหมือนเดิมทุกประการเมื่อไม่ active — แยกเป็น branch ชัดเจน), badge จำนวนรออนุมัติ (`ApprovalBadge` จาก WP-09); เพิ่มรายการ `home`/`projects` และแท็บโครงการ `overview`, `boq` ใน registry
  - ใหม่ `src/features/erp/hub/{api.ts,hooks.ts,HubPage.tsx,HubFilters.tsx,ProjectCard.tsx,ProjectShell.tsx,ProjectOverviewPage.tsx,HubFieldsDrawer.tsx,HomeRedirect.tsx}`
  - routes: `src/app/page.tsx` → `<CloudProviders><HomeRedirect/></CloudProviders>` (ลำดับตัดสินตาม §3.2; release 1 ต้องไป `/journey` โดยไม่ต้องล็อกอิน), `src/app/(app)/hub/page.tsx`, `src/app/(app)/p/[projectId]/layout.tsx`, `src/app/(app)/p/[projectId]/page.tsx`
  - การสร้างโครงการจาก Hub: ใช้ modal สร้างเดิมของ `src/features/cloud/projects/ProjectsPage.tsx` (export ออกมาถ้ายังไม่ export โดยไม่เปลี่ยนพฤติกรรมหน้าเดิม) แล้ว PATCH hub fields + assign code
  - แท็บ BOQ ใน `ProjectShell` เรียก `openCloudProject(queryClient, projectId)` แล้วไป `/boq`; ปุ่ม "คัดลอกลูกค้า/ที่อยู่ไปหัว BOQ" (เขียน `meta` ผ่าน store เดิมหลังเปิดโครงการ)
  - ปุ่มสลับภาษาใน `AccountMenu.tsx`: เพิ่มเงื่อนไข "หรือ `project-hub` active" (D-16)
  - i18n `hub`, `nav` (คีย์ใหม่)
- **Acceptance**
  - [ ] `project-hub` ไม่ active: `/` → `/journey`, เมนูเหมือนก่อน WP นี้ทุกประการ
  - [ ] active: `/` → `/hub`; Hub แสดงโครงการทั้งหมดของ workspace พร้อมกรองสถานะ/ลูกค้า/ประเภท ค้นหา และสรุปบนสุด
  - [ ] `/p/[id]` แสดง overview + แท็บเฉพาะโมดูลที่ active และมีสิทธิ์
  - [ ] มือถือ 375px ไม่มี scroll แนวนอน (การ์ดซ้อนแนวตั้ง แท็บเลื่อนได้)
- **Out of scope:** Portal (WP-36), การ์ด rollup ของโมดูลที่ยังไม่มี (แสดงเมื่อค่าไม่ null)

### WP-17 — ประวัติ BOQ (versions, เทียบฉบับ)
- **Module:** boq-control · **Depends on:** WP-16 · **Model:** opus
- **Scope**
  - ใหม่ `schema-boq-control.ts` (`boq_versions`, `boq_version_sections`, `boq_version_lines`; export `boqControlTables`) + `database.ts` + `drizzle.config.ts` + migration `0016_wp17_boq_versions`
  - ย้าย `ENGINE_VERSION` (`'excel-v5'`) จาก `backend/src/modules/projects/domain/entities/project.entity.ts` ไป `src/domain/project.ts` (export) แล้วให้ entity re-export ชื่อเดิม (ไม่เปลี่ยนค่า)
  - pure `src/domain/boq-control/{version-lines.ts,diff.ts}` + เทสต์สั้น
  - contract `erp/boq-control.ts` (version DTO, lines, compare DTO)
  - `ports.ts` + core: `RevisionHooks`; `backend/src/modules/projects/application/use-cases/create-revision.use-case.ts` เรียก hooks ใน transaction หลัง insert revision (ไม่มีผลเมื่อไม่มี hook)
  - port `RevisionWriter` (provide โดย projects: `create(ws, projectId, {label, note, by})` ใช้ตรรกะเดียวกับ `CreateRevisionUseCase` โดยไม่ตรวจสิทธิ์ซ้ำ เรียกได้ภายใน `uow.run` ของผู้เรียก) สำหรับโมดูลที่ต้องสร้าง revision อัตโนมัติ (baseline, ใบเสนอราคา)
  - ใหม่ `backend/src/modules/boq-control/` (hook ที่ทำงานเฉพาะเมื่อ `boq-control` active, lazy backfill, use cases list/get/compare รวม `to=live` ผ่าน `ProjectReader`; สิทธิ์ `projects.read`)
  - Endpoints: `GET /projects/:projectId/boq-versions`, `GET /boq-versions/:versionId` (sections + lines), `GET /projects/:projectId/boq-versions/compare?from=&to=` (`to` = versionId หรือ `live`)
  - web: `src/features/erp/boq-control/{api.ts,hooks.ts,VersionsPage.tsx,VersionCompareTable.tsx}` + route `src/app/(app)/p/[projectId]/versions/page.tsx` + แท็บ `versions` ใน registry; ลิงก์ "ดูประวัติและเทียบ" ใน `src/features/cloud/revisions/RevisionButtons.tsx` เมื่อ `boq-control` active
  - i18n `boqControl`
- **Acceptance**
  - [ ] สร้าง revision ขณะ active → มี `boq_versions` + บรรทัด; ขณะไม่ active → พฤติกรรมเดิม (ไม่มีแถว)
  - [ ] revision เก่าเปิดดูแล้วถูก backfill
  - [ ] เทียบสองฉบับแสดงบรรทัดเพิ่ม/ลด/เปลี่ยน และผลต่างรายหมวด; เทียบกับ live ได้
  - [ ] ผลรวมบรรทัดของ version ต่างจาก `totals.constructionTotal` ไม่เกิน 0.01 × จำนวนบรรทัด (บันทึกค่าจริงใน Handoff)
- **Out of scope:** กู้คืนฉบับเก่าเป็น BOQ ปัจจุบัน (Decisions log D-17), baseline (WP-18)

### WP-18 — Baseline + cost codes (backend)
- **Module:** boq-control · **Depends on:** WP-17 · **Model:** opus
- **Scope**
  - schema-boq-control.ts: `project_baselines`, `project_cost_codes` + migration `0017_wp18_baseline`
  - contract เพิ่มใน `erp/boq-control.ts` (baseline DTO, cost code DTO, lock/unlock requests, `baselineStatusDtoSchema`)
  - `ports.ts` + core: `BoqEditLocks` (`isLocked(ws, projectId, docKey): Promise<boolean>`), `BaselineUnlockGuards`, port `CostCodeLookup`, port `BaselineControl` (`lock(ws, projectId, {versionId?, reason, contractId, by})` ภายใน transaction ของผู้เรียก, `status(projectId)`, `baselineProject(projectId)` คืน `Project` snapshot ของ baseline)
  - `PutDocUseCase` (`backend/src/modules/projects/application/use-cases/put-doc.use-case.ts`) ถาม `BoqEditLocks` สำหรับ `calc:*`, `boq:*`, `journey` ภายใน transaction หลังล็อกโครงการ → 409 `baseline_locked` (ไม่มี lock ลงทะเบียน = เดิม)
  - boq-control: use cases lock/unlock/get baseline, list cost codes (`projects.read`; ซ่อนต้นทุนเมื่อไม่มี `cost.read`), `CostCodeLookup` adapter (รวม `applyVariation`, `setReportedProgress`, `setCertifiedProgress`, `allocateContractAmounts` ตาม `02-domain-model.md` §1.10)
  - Endpoints: `GET /projects/:projectId/baseline`, `POST /projects/:projectId/baseline` (`boq.baseline.lock`), `POST /projects/:projectId/baseline/unlock` (`boq.baseline.unlock`), `GET /projects/:projectId/cost-codes`
- **Acceptance**
  - [ ] lock → cost code เท่าจำนวนบรรทัด baseline; PUT doc `boq:R58` และ `journey` → 409; `meta` ยังเขียนได้
  - [ ] unlock แล้ว lock ใหม่ด้วย BOQ ที่ตัดบรรทัดหนึ่ง → id ของบรรทัดอื่นคงเดิม บรรทัดที่หายเป็น `omitted`
  - [ ] unlock เมื่อ guard มีเหตุ → 409 พร้อมรายการเหตุผล
  - [ ] `allocateContractAmounts` (เทสต์สั้น): Σ `contract_amount` = มูลค่าที่ส่งเข้าพอดี ทั้งแบบมีและไม่มีใบเสนอราคา
  - [ ] โมดูลปิด: PUT doc ทุก key ทำงานเหมือนเดิม
- **Out of scope:** หน้าจอ (WP-19), การเรียกจัดสรรราคาขายจากสัญญา (WP-26)

### WP-19 — Baseline web: BOQ อ่านอย่างเดียวเมื่อล็อก + CostCodePicker
- **Module:** boq-control · **Depends on:** WP-18 · **Model:** opus
- **Goal:** หลังล็อก baseline ผู้ใช้เห็นชัดว่าแก้ BOQ ไม่ได้ (ต้องทำ VO) โดย sync engine ไม่วน retry และโครงการที่ไม่ล็อกไม่เปลี่ยนเลย
- **Scope**
  - `VersionsPage.tsx`: ปุ่ม "ล็อกเป็น baseline" (เลือกฉบับ; `boq.baseline.lock`), ป้าย baseline, ปุ่มปลดล็อกพร้อมเหตุผล (`boq.baseline.unlock`) และแสดงเหตุที่ปลดไม่ได้
  - `src/store/project-store.ts`: เพิ่ม `locked: boolean` ใน `CloudBinding` (ค่าเริ่มต้น false); `isReadOnly(binding)` คืน true เมื่อ `locked`; ข้อความแจ้งเตือนเมื่อพยายามแก้ใช้คีย์ i18n ใหม่ `boqControl.lockedNotice` (ไม่แตะ `READ_ONLY_TEXT` เดิม)
  - `src/features/cloud/projects/controller.ts` (`openCloudProject`): เมื่อ `boq-control` active ดึง `GET /projects/:id/baseline` แล้วตั้ง `locked`
  - `src/features/cloud/sync/engine.ts`: เมื่อ PUT ได้ 409 `details.reason='baseline_locked'` → ทิ้ง pending ของ doc นั้น (ไม่ retry), ตั้ง `locked=true`, แจ้งผู้ใช้ครั้งเดียว
  - แถบเตือน "ล็อก baseline แล้ว — แก้ผ่าน VO" บนหน้า BOQ/เครื่องคำนวณ (component ใหม่ `src/features/erp/boq-control/BaselineLockedBanner.tsx` วางใน `AppLayoutUI` เหนือเนื้อหาเมื่อ `binding.locked`)
  - `src/features/erp/shared/CostCodePicker.tsx` (ค้นหาตามรหัส/ชื่อ/หมวด แสดงงบคงเหลือเมื่อมีสิทธิ์ `cost.read`)
  - i18n `boqControl` (เพิ่ม)
- **Acceptance**
  - [ ] หน้า BOQ ของโครงการที่ล็อกแก้ไม่ได้และแสดงแถบ; ส่วนโครงการที่ไม่ล็อก/โมดูลปิดไม่เปลี่ยนเลย (ตรวจ network: ไม่มี request baseline เมื่อโมดูลปิด)
  - [ ] แก้จากอีกแท็บที่ยังไม่รู้ว่าล็อก → ได้ 409 ครั้งเดียว แล้วกลายเป็นอ่านอย่างเดียว ไม่วน retry
  - [ ] `CostCodePicker` ใช้ได้บนมือถือ 375px
- **Out of scope:** VO sandbox (WP-34)

### WP-20 — Cost ledger + financial events
- **Module:** foundation · **Depends on:** WP-18 · **Model:** opus
- **Scope**
  - ใหม่ `schema-ledger.ts` (`cost_ledger_entries`, `fin_events`; export `ledgerTables`) + wiring + migration `0018_wp20_ledger`
  - contract `erp/ledger.ts` (`FIN_EVENT_TYPES`, `COST_CATEGORIES`, `COST_ENTRY_KINDS`, DTO)
  - `ports.ts`: `CostLedger`, `FinancialEvents` (ตาม `02-domain-model.md` §1.11; ทั้งคู่ต้องเรียกใน `uow.run` ของผู้เรียก)
  - ใหม่ `backend/src/modules/ledger/` (repos, adapters, ตรวจ invariants: `commit_release` ไม่ทำให้ `committed_open` ติดลบต่อ `commitment_ref`; reversal), ลงทะเบียน `ProjectDeletionGuards` (มี `fin_events` → ห้ามลบ) และ `BaselineUnlockGuards` (มี ledger)
  - Endpoint อ่าน: `GET /projects/:projectId/cost-ledger?costCodeId=` (`cost.read`), `GET /workspaces/:workspaceId/fin-events?from=&to=&type=` (`tax.reports` หรือ `billing.read`) — gate `project-hub`
- **Acceptance**
  - [ ] post commit 1,000 → release −400 → actual 400: totals ถูกต้อง (committed_open 600, actual 400)
  - [ ] release เกิน commitment → `unprocessable`
  - [ ] reverse event สร้างแถวยอดติดลบที่ `reverses_id` ชี้ต้นฉบับ; reverse ซ้ำ → 409
- **Out of scope:** หน้าจอ (WP-48)

### WP-21 — ราคากลางภาครัฐ
- **Module:** foundation (ใช้เมื่อ `priceSource='government'`) · **Depends on:** WP-16 · **Model:** sonnet
- **Scope**
  - schema-erp-core.ts `price_reference_books`, `price_reference_items` (ตาม `02-domain-model.md` §1.12) + migration `0019_wp21_price_reference`
  - ใหม่ `backend/src/cli/import-price-reference.ts` + script `"db:import-prices": "tsx src/cli/import-price-reference.ts"` ใน `backend/package.json` (อ่าน `../goverment_price.json` จาก cwd `backend/`; รับ `--file`)
  - ใหม่ `backend/src/modules/price-reference/` endpoint `GET /workspaces/:workspaceId/price-reference/items?q=&category=&limit=` (`projects.read`, gate `project-hub`)
  - web: `src/features/erp/price-reference/{api.ts,PriceReferencePicker.tsx}`; ปุ่ม "ราคากลาง" ในแถวแก้ราคาวัสดุของ `src/features/boq-home/BoqHomePage.tsx` เฉพาะเมื่อ `project-hub` active (เติม `mat` override ผ่าน action เดิม `setBoqOverride`; โมดูลปิด = หน้าเดิมทุกประการ)
  - i18n `priceReference`
- **Acceptance**
  - [ ] import ได้ 4,559 รายการ และพิมพ์ว่าข้าม 1,012 แถว (ราคา `-`); รันซ้ำไม่ซ้ำ (แทนที่ book เดิมของ source+year ใน transaction เดียว)
  - [ ] ค้นหา "ปูน" ได้ผลภายใน 300 ms บน postgres ขนาดนี้
  - [ ] เลือกราคาแล้วราคาวัสดุแถว BOQ เปลี่ยน
- **Out of scope:** ผูก `mid` ถาวรกับ line key, ราคาระดับภูมิภาค

---

## 3. โมดูล 1 — ใบเสนอราคา

### WP-22 — Quotation: domain คำนวณ + overlay อังกฤษของ BOQ
- **Module:** quotations · **Depends on:** WP-02, WP-12, WP-17 · **Model:** opus
- **Scope**
  - pure `src/domain/quotation/{types.ts,build.ts,pricing.ts,compare.ts,government.ts,index.ts}` ตาม `02-domain-model.md` §2 (กติกา 1–7)
  - ใหม่ `src/domain/boq/template.v5.en.ts` (คำแปลอังกฤษของ **ทุก** item line 212 แถว + 32 หัวหมวด; แปลจริงจาก `desc` ใน `template.v5.ts`), `src/domain/boq/units.ts` (`UNIT_EN` ครบทุกหน่วยที่ใช้ใน template; ใช้ script หาหน่วยทั้งหมด), `slotLineEn`
  - เทสต์สั้น `src/domain/quotation/__tests__/pricing.test.ts`: full / per_category / lump_sum / government (2 parts) / VAT 4 โหมด / ส่วนลด / ปัดเศษ / บริษัทไม่จด VAT
  - `buildQuotationDraft` ใช้ค่าเริ่มต้นจาก `resolveSettings` (`src/domain/erp/profiles.ts`, WP-12) และ `QuotationPricing.defaults`
- **Acceptance**
  - [ ] ผลรวมบรรทัดขายของทุกหมวด = `section.sell_total` พอดีทุกโหมด
  - [ ] government: `grandTotal = Σ round2(costPart × F)`; `vatBase + vat = grandTotal` (`splitVatInclusive`) เมื่อจด VAT; ไม่จด VAT → `vatBase = grandTotal`, `vat = 0`
  - [ ] `per_category` + discount หรือ rounding → validation error; `marginPct` = 0 เมื่อ `vatBase = 0`
  - [ ] `compareQuotationVersions` คืน delta ที่บวกกลับได้ยอดใหม่
  - [ ] overlay มีคีย์ครบทุก item line ของ template (เทสต์นับ)
- **Out of scope:** ตาราง Factor F ทางการ (D-12)

### WP-23 — Quotation backend
- **Module:** quotations · **Depends on:** WP-22, WP-08, WP-10, WP-12, WP-14, WP-15 · **Model:** opus
- **Scope**
  - ใหม่ `schema-quotations.ts` (`qt_quotations`, `qt_quotation_versions`, `qt_quotation_sections`, `qt_quotation_lines`) + wiring + migration `0020_wp23_quotations`
  - contract `erp/quotations.ts`; FILE_PURPOSE `quotation_attachment`
  - ใหม่ `backend/src/modules/quotations/`: state `quotation-state.ts`; use cases: create-from-boq (ต้องมี `boqVersionId` หรือสร้าง revision อัตโนมัติ `QT-<n>`), get, list by project, update draft (header/pricing/sections/lines), new-version (copy), issue (approval `quotation.issue` → numbering docType `quotation` ด้วย `subject_id = quotation.id` เฉพาะฉบับแรก; ฉบับถัดไปใช้ `${base}-R${n}` → snapshots จาก `CompanyProfiles.snapshot` / `CustomerLookup.snapshot` → `ProjectLifecycle.advance('quoted')`), record-response (ภายใน; บันทึกเองต้องมี `acceptedByName`), cancel, compare
    สิทธิ์: อ่าน `quotations.read`, แก้ `quotations.manage`, issue `quotations.issue`; DTO ตัดฟิลด์ cost/margin เมื่อไม่มี `quotations.seeMargins`
    ลงทะเบียน `ApprovalHandlers('quotation.issue')`, `CustomerLinkHandlers('quotation')` (permission `quotations.issue`; view = เอกสารที่เรนเดอร์ได้โดยไม่มีต้นทุน/margin + `language`; respond = accept/request_change/reject → แจ้งเตือน `quotation.accepted` / `quotation.change_requested`; เปิดดูครั้งแรก → `quotation.viewed`), `DailySweeps` (`quotations.expire`: issued ที่เลย `valid_until` → `expired`), `ProjectDependents`, `ProjectDeletionGuards` ไม่ต้อง (numbering ดูแล)
  - Endpoints: `GET/POST /projects/:projectId/quotations`, `GET /quotations/:quotationId`, `GET /quotation-versions/:versionId`, `PATCH /quotation-versions/:versionId`, `POST /quotations/:quotationId/versions`, `POST /quotation-versions/:versionId/issue|cancel|record-response`, `GET /quotations/:quotationId/compare?from=&to=`
  - แจ้งเตือน: `quotation.accepted`, `quotation.change_requested`
- **Acceptance**
  - [ ] สร้างจาก BOQ → หมวด/บรรทัดตรง `boq_version_lines` และยอดตาม `pricing.ts`
  - [ ] แก้ฉบับที่ issued แล้ว → 409 `already_issued`
  - [ ] issue ฉบับที่ 2 → เลข `${base}-R1`, ฉบับแรก `superseded`
  - [ ] ลูกค้า accept ผ่านลิงก์ → สถานะ accepted, โครงการ `won`, แจ้งเตือนถึงสมาชิก
  - [ ] DTO ฝั่งลิงก์ไม่มี `cost*` หรือ `margin*`
  - [ ] ผู้ไม่มี `quotations.seeMargins` ได้ DTO ที่ตัด cost/margin
- **Out of scope:** UI (WP-24), เอกสารพิมพ์ (WP-25)

### WP-24 — Quotation web: รายการ ตัวแก้ไข เทียบฉบับ
- **Module:** quotations · **Depends on:** WP-23 · **Model:** sonnet
- **Scope**
  - ใหม่ `src/features/erp/quotations/{api.ts,hooks.ts,logic.ts,QuotationsPage.tsx,QuotationEditorPage.tsx,SectionPricingTable.tsx,LinesTable.tsx,PricingPanel.tsx,TotalsPanel.tsx,IssueDialog.tsx,CompareDrawer.tsx,CreateFromBoqDialog.tsx}`
  - routes `src/app/(app)/p/[projectId]/quotations/page.tsx`, `src/app/(app)/p/[projectId]/quotations/[quotationId]/page.tsx`; แท็บ `quotations` ใน nav registry
  - ปุ่ม "สร้างใบเสนอราคาจาก BOQ" (1 คลิก ใช้ค่าเริ่มต้นจาก `resolveSettings`) บน `ProjectOverviewPage` และบนหน้า BOQ (`src/features/boq-home/BoqHomePage.tsx`) เฉพาะเมื่อ `quotations` active และโครงการเป็น cloud
  - แก้ markup/overhead/profit/VAT ต่อหมวด, เลือก format/detail level, ภาษาเอกสาร, ส่วนลด, ปัดเศษ, parts + Factor F (government), เงื่อนไขการชำระ (milestone template)
  - คำนวณสดฝั่งเว็บด้วย `src/domain/quotation` แล้วบันทึกด้วย PATCH (debounce 800 ms)
  - i18n `quotations`, `enums.quotationVersionStatus`, `enums.quotationFormat`, `enums.detailLevel`
- **Acceptance**
  - [ ] สร้าง → แก้ % กำไรหมวดหนึ่ง → ยอดรวมเปลี่ยนทันทีและหลัง reload ตรงกัน
  - [ ] issue (คนเดียว) ได้เลขทันที; หลาย user ที่นโยบายเปิด → ขึ้น "รออนุมัติ"
  - [ ] เทียบสองฉบับแสดงหมวด/ยอดที่เปลี่ยน
  - [ ] viewer เห็นแต่ไม่เห็นต้นทุน/กำไร และไม่มีปุ่มแก้
- **Out of scope:** พิมพ์ (WP-25)

### WP-25 — Quotation เอกสารพิมพ์ TH/EN + หน้าลูกค้า
- **Module:** quotations · **Depends on:** WP-24 · **Model:** sonnet
- **Scope**
  - `src/features/erp/quotations/{print-model.ts,QuotationPrintDocument.tsx,GovernmentForms.tsx}` (lump-sum ต่อหมวด, detailed แยกวัสดุ/ค่าแรง, ปร.4 / ปร.5 / ปร.6), หัวจาก company snapshot (โลโก้ สี), จำนวนเงินเป็นคำ, ลายน้ำ DRAFT/VOID
  - route `src/app/(print)/print/quotation/[versionId]/page.tsx`
  - renderer `quotation` ใน `src/features/erp/customer-links/renderers.ts`: แสดงเอกสาร + ปุ่มรับ / ขอแก้ / ปฏิเสธ
  - ปุ่ม "แชร์ลิงก์ให้ลูกค้า" ในตัวแก้ไข (ฉบับ issued)
  - i18n `documents.quotation.*`, `documents.government.*`
- **Acceptance**
  - [ ] พิมพ์ได้ทั้งไทยและอังกฤษ ตัวเลข/วันที่ตามภาษาเอกสาร ไม่ใช่ภาษา UI
  - [ ] ปร.5 แสดง Factor F และยอดรวมตรงกับตัวแก้ไข
  - [ ] ลูกค้าเปิดลิงก์บนมือถือ 375px อ่านได้ ตอบรับแล้วตัวแก้ไขเปลี่ยนสถานะเป็น accepted
- **Out of scope:** PDF ฝั่ง server

---

## 4. โมดูล 2 — สัญญาหลัก งวดงาน และวางบิล

### WP-26 — สัญญาหลัก backend
- **Module:** contracts · **Depends on:** WP-18, WP-23 · **Model:** opus
- **Goal:** สัญญาหลักกับเจ้าของงาน + งวดงาน/งวดเงิน + หลักประกัน; การเซ็นสัญญาล็อก baseline และตั้งราคาขายต่อ cost code
- **Scope**
  - ใหม่ `schema-contracts-billing.ts` (`mc_contracts`, `mc_milestones`, `mc_guarantees`) + wiring + migration `0021_wp26_main_contracts`
  - contract `erp/main-contracts.ts`; FILE_PURPOSES `main_contract_scan`, `guarantee_scan`
  - ใหม่ `src/domain/erp/html-sanitize.ts` (ย้าย sanitizer ออกจาก `src/domain/subcontracting/contract-template.ts`; ไฟล์เดิม re-export) + แม่แบบสัญญาหลัก th/en `src/domain/erp/main-contract-template.ts`
  - ใหม่ `backend/src/modules/main-contracts/`: create from accepted quotation (`original_value = totals.vatBase`, `quoted_margin_pct = totals.marginPct`, terms จาก `resolveSettings` + payment terms ของใบเสนอราคา, งวดจาก `milestoneTemplate`) หรือว่าง (ต้องระบุ `customerId` + `originalValue`), update draft, milestones PUT ทั้งชุด (draft เท่านั้น), sign (ใน `uow.run` เดียว: numbering `contract` → `BaselineControl.lock` ถ้ายังไม่ล็อก (versionId = `boq_version_id` ของฉบับที่รับ) → `CostCodeLookup.allocateContractAmounts` → คำนวณ `amount` ของงวด → `ProjectLifecycle.advance('in_progress')` → audit), terminate, cancel, close, guarantees CRUD + return
    port สำหรับโมดูลอื่น `MainContracts`: `find(ws, id)`, `forProject(ws, projectId)` (สัญญาที่มีผล + terms + milestones + `quotedMarginPct`), `applyVariation(ws, contractId, {sellDelta, extensionDays, billing, variationId})`, `markMilestone(ws, milestoneId, status)`, `complete(ws, contractId, date)`
    ลงทะเบียน `HubRollups` (contractValue, nextMilestone), `BaselineUnlockGuards` (สัญญา signed), `ProjectDependents`, `DailySweeps` (`contracts.guarantee-expiring`: `guarantee.expiring` 30 วันก่อน `expiry_date`)
    สิทธิ์: อ่าน `contracts.read`, แก้/เซ็น `contracts.manage`
  - Endpoints: `GET/POST /projects/:projectId/main-contract`, `PATCH /main-contracts/:contractId`, `PUT /main-contracts/:contractId/milestones`, `POST /main-contracts/:contractId/sign|terminate|cancel|close`, `GET/POST /main-contracts/:contractId/guarantees`, `PATCH /guarantees/:guaranteeId`, `POST /main-contracts/:contractId/signed-scan`
- **Acceptance**
  - [ ] สร้างจากใบเสนอราคา: มูลค่า = vatBase ของฉบับที่รับ, งวดตาม payment terms, terms ตาม project type; ใบเสนอราคาที่ยังไม่ accepted → 409
  - [ ] sign: ได้เลข CT, baseline active, Σ `contract_amount` ของ cost codes = `original_value` พอดี
  - [ ] งวดรวม pct ≠ 1 → 400; โครงการมีสัญญาที่มีผลอยู่แล้ว → 409
  - [ ] สัญญาที่ signed แก้เนื้อหาไม่ได้ (409 `already_issued`); เซ็นแล้ว project status = `in_progress`
  - [ ] baseline ล็อกแล้วก่อนเซ็น → ใช้ baseline เดิม ไม่ล็อกซ้ำ
- **Out of scope:** วางบิล (WP-29)

### WP-27 — สัญญาหลัก web + พิมพ์สัญญา
- **Module:** contracts · **Depends on:** WP-26 · **Model:** sonnet
- **Scope**
  - `src/features/erp/contracts/{api.ts,hooks.ts,ContractPage.tsx,ContractWizard.tsx,TermsForm.tsx,MilestonesEditor.tsx,GuaranteesCard.tsx,SignDialog.tsx,print-model.ts,ContractPrintDocument.tsx}`
  - routes `src/app/(app)/p/[projectId]/contract/page.tsx`, `src/app/(print)/print/contract/[contractId]/page.tsx`; แท็บ `contract` ใน nav registry
  - SignDialog แสดงคำเตือนเมื่อมี cost code baseline ที่ไม่ได้รับราคาขาย (จาก response preview ของ allocate)
  - i18n `contracts`, `enums.contractStatus`, `enums.milestoneTrigger`, `enums.guaranteeKind`, `documents.contract.*`
- **Acceptance**
  - [ ] wizard: เลือกใบเสนอราคา → ตรวจเงื่อนไข → งวด → ตัวอย่างสัญญา → เซ็น
  - [ ] milestone editor แสดงยอดเงินต่องวดจาก `allocate` และเตือนเมื่อรวมไม่ครบ 100%
  - [ ] พิมพ์สัญญา + ภาคผนวกงวดงานทั้งสองภาษา
- **Out of scope:** —

### WP-28 — Billing domain คำนวณ
- **Module:** billing · **Depends on:** WP-02 · **Model:** opus
- **Scope**
  - pure `src/domain/billing/{claim.ts,escalation.ts,penalty.ts,tax-invoice.ts,retention.ts,advance.ts,aging.ts,index.ts}` ตามสูตร `02-domain-model.md` §4.1–4.5
  - pure `src/domain/payments/promptpay.ts` (payload + CRC16)
  - เทสต์สั้น: claim progress/milestone, cap ของ retention, advance งวดสุดท้าย, penalty cap สะสม, K สามกรณี, TI รับบางส่วนสองครั้งรวมแล้วตรง, aging buckets, PromptPay (โครงสร้าง TLV ถูก + CRC16 ของ payload ตรวจซ้ำได้ด้วยฟังก์ชัน crc เดียวกันกับสตริงทดสอบมาตรฐาน `"123456789"` → `0x29B1`)
- **Acceptance**
  - [ ] ทุกฟังก์ชันคืนเงินที่ผ่าน `round2` และ invariant รวมเท่าต้นฉบับ
  - [ ] `payable = base + VAT − R − WHT − P − other` ทุกกรณีเทสต์
- **Out of scope:** IO ทั้งหมด

### WP-29 — งวดเบิก + ใบแจ้งหนี้ backend
- **Module:** billing · **Depends on:** WP-26, WP-28, WP-20 · **Model:** opus
- **Scope**
  - schema-contracts-billing.ts: `ar_claims`, `ar_claim_lines`, `ar_invoices`, `ar_retention_entries`, `ar_advance_entries` + migration `0022_wp29_billing`
  - contract `erp/billing.ts` (claim, invoice, ledger DTO)
  - ใหม่ `backend/src/modules/billing/` (สิทธิ์: อ่าน `billing.read`, แก้ `billing.manage`): claims (create draft จาก progress รายงานหรือ milestone ที่ claimable; progress mode รวมบรรทัด VO ที่ accepted แล้ว, update lines/deductions, submit (approval `claim.submit`), certify, invoice (numbering `invoice` + retention withheld + advance recovered + `CostCodeLookup.setCertifiedProgress` + `fin_events` `ar.invoiced`, `ar.retention_withheld`, `ar.advance_recovered`, `ar.penalty`), cancel), advance invoice (ผู้ใช้กดสร้างจากหน้า billing เมื่อสัญญา signed และ `advancePct > 0` และยังไม่มีใบเงินล่วงหน้า — ไม่สร้างอัตโนมัติ D-33; issue → `ar.advance_invoiced`, รับเงินแล้ว → `ar_advance_entries` received ซึ่งบันทึกใน WP-30 ตอนรับเงิน), invoice issue/void (void ได้เมื่อยังไม่มีรับเงิน), retention release invoice
    ลงทะเบียน `ApprovalHandlers('claim.submit')`, `HubRollups` (billedToDate), `BaselineUnlockGuards` (มี claim), `ProjectDeletionGuards`, `ProjectDependents`
  - Endpoints: `GET/POST /main-contracts/:contractId/claims`, `GET/PATCH /claims/:claimId`, `POST /claims/:claimId/submit|certify|invoice|cancel`, `GET /projects/:projectId/invoices`, `POST /main-contracts/:contractId/advance-invoice`, `POST /main-contracts/:contractId/retention-release-invoice {amount}`, `GET /invoices/:invoiceId`, `POST /invoices/:invoiceId/issue|void`, `GET /main-contracts/:contractId/retention`, `GET /main-contracts/:contractId/advance`
- **Acceptance**
  - [ ] ทำ 3 งวดแบบ progress: Σ this_amount = cum_amount ของงวดสุดท้าย; retention สะสมไม่เกิน cap
  - [ ] claim ใหม่ขณะมี draft/pending_approval/submitted → 409
  - [ ] milestone mode: W = ยอดงวด; งวดเปลี่ยนเป็น `claimed` แล้ว `invoiced` (ผ่าน `MainContracts.markMilestone`)
  - [ ] ค่าปรับเกินเพดานสะสม → 422 `reason:'penalty_cap_exceeded'`
  - [ ] invoice ทำให้ `fin_events` 1+ แถวตามสเปกและ ledger retention/advance ถูก
  - [ ] void invoice ที่มีรับเงินแล้ว → 409
- **Out of scope:** รับเงิน/ใบกำกับภาษี (WP-30)

### WP-30 — รับเงิน ใบกำกับภาษี ลูกหนี้ เตือน PromptPay backend
- **Module:** billing · **Depends on:** WP-29, WP-10 · **Model:** opus
- **Scope**
  - schema: `ar_receipts`, `ar_receipt_allocations` + migration `0023_wp30_receipts`
  - FILE_PURPOSES `payment_slip`, `customer_wht_certificate`
  - billing: record receipt (allocations หลายใบ, numbering `receipt`, ใบ `advance_invoice` ที่ได้รับเงิน → `ar_advance_entries` kind `received` ตามยอด net ที่ settle, ออก tax invoice ตาม `tax-invoice.ts` ถ้าบริษัทจด VAT และเลือก, `fin_events` `ar.receipt`, `ar.tax_invoiced`, `ar.wht_withheld_by_customer`), void receipt (ภายในวันเดียวกัน และ reverse events), credit note (ลด tax invoice: `ar.credit_noted`), AR aging (workspace), customer statement, sweep `billing.invoice-due` + `retention.release_due`, PromptPay payload endpoint
    `CustomerLinkHandlers('invoice')` (permission `billing.read`; view อย่างเดียว: ใบแจ้งหนี้ + payload PromptPay + บัญชีธนาคาร); `HubRollups` (receivedToDate, overdueReceivable); port ใหม่ `BillingTotals` (`totalsByProject(ws, projectId)` → billed/received/retentionHeld/advanceOutstanding; ใช้ใน closeout WP-55)
    สิทธิ์: บันทึกรับเงิน/ออก TI/CN `billing.receive`; ใบเสร็จหลายใบแจ้งหนี้ต้องเป็นลูกค้าเดียวกัน (ไม่งั้น 422)
  - Endpoints: `POST /workspaces/:workspaceId/receipts`, `GET /receipts/:receiptId`, `POST /receipts/:receiptId/void`, `POST /invoices/:invoiceId/credit-note`, `GET /workspaces/:workspaceId/receivables/aging`, `GET /customers/:customerId/statement`, `GET /invoices/:invoiceId/promptpay`
- **Acceptance**
  - [ ] รับเงินบางส่วน 2 ครั้งปิดหนี้: TI สองใบ net+vat รวม = ของใบแจ้งหนี้พอดี; รับเกิน → 422 `overpayment`
  - [ ] บริษัทไม่จด VAT → ไม่มี TI และ endpoint ออก TI ตอบ 422
  - [ ] ลูกค้า juristic ไม่มี tax id → ออก TI ไม่ได้ 422 `customer_tax_id_required`
  - [ ] aging แบ่ง bucket ถูกตามวันที่ใน `FixedClock`
  - [ ] sweep ส่ง `invoice.overdue` วันที่ 1/7/30 ครั้งเดียวต่อวัน
- **Out of scope:** ยืนยันการโอนอัตโนมัติ

### WP-31 — Billing web
- **Module:** billing · **Depends on:** WP-30 · **Model:** sonnet
- **Scope**
  - `src/features/erp/billing/{api.ts,hooks.ts,BillingPage.tsx,ClaimEditorPage.tsx,ClaimLinesTable.tsx,DeductionsPanel.tsx,InvoicesTable.tsx,ReceiveDialog.tsx,RetentionCard.tsx,AdvanceCard.tsx,ReceivablesPage.tsx,AgingTable.tsx,CustomerStatement.tsx}`
  - routes `src/app/(app)/p/[projectId]/billing/page.tsx`, `src/app/(app)/p/[projectId]/billing/claims/[claimId]/page.tsx`, `src/app/(app)/receivables/page.tsx`; แท็บ `billing` + เมนู `sales.receivables` ใน nav registry
  - ClaimLinesTable: % สะสมเริ่มจาก reported progress, แสดง prev/this/cum, กรองหมวด, มือถือแสดงแบบรายการ
  - i18n `billing`, `enums.claimStatus`, `enums.invoiceKind`, `enums.invoiceStatus`, `enums.paymentMethod`
- **Acceptance**
  - [ ] ทำงวดเบิก → certify → ออกใบแจ้งหนี้ → รับเงิน (มี WHT) ครบในหน้าเว็บ
  - [ ] หน้า receivables แสดง aging ข้ามโครงการ และกดไปหาใบได้
- **Out of scope:** พิมพ์ (WP-32)

### WP-32 — Billing เอกสารพิมพ์ + QR
- **Module:** billing · **Depends on:** WP-31 · **Model:** sonnet
- **Scope**
  - เพิ่ม dependency `qrcode@1.5.4` + `@types/qrcode` (root `package.json`) — ถ้าติดตั้งไม่ได้ ให้หยุดและบันทึกใน Handoff
  - `src/features/erp/billing/{print-model.ts,InvoicePrintDocument.tsx,TaxInvoicePrintDocument.tsx,ReceiptPrintDocument.tsx,ClaimCertificateDocument.tsx,PromptPayQr.tsx}`
  - routes `src/app/(print)/print/invoice/[invoiceId]/page.tsx`, `src/app/(print)/print/receipt/[receiptId]/page.tsx`, `src/app/(print)/print/claim/[claimId]/page.tsx`
  - renderer `invoice` ใน customer-links (ดูใบแจ้งหนี้ + QR + บัญชีธนาคาร)
  - i18n `documents.invoice.*`, `documents.taxInvoice.*`, `documents.receipt.*`, `documents.claim.*`
- **Acceptance**
  - [ ] ใบกำกับภาษีเต็มรูปมีข้อมูลครบตาม `01-architecture.md` §15
  - [ ] "ใบเสร็จรับเงิน/ใบกำกับภาษี" พิมพ์รวมเมื่อ receipt มี TI ใบเดียว; หลายใบ → ใบเสร็จแสดงเลข TI ทั้งหมด
  - [ ] QR สแกนด้วยแอปธนาคารแล้วยอดตรง (ทดสอบมือ บันทึกใน Handoff)
- **Out of scope:** —

---

## 5. โมดูล 3 — VO

### WP-33 — VO backend
- **Module:** variations · **Depends on:** WP-29, WP-14 · **Model:** opus
- **Scope**
  - ใหม่ `schema-variations.ts` (`vo_variations`, `vo_lines`, `vo_evidence`) + wiring + migration `0024_wp33_variations`
  - contract `erp/variations.ts`; FILE_PURPOSE `variation_evidence`
  - pure `src/domain/variations/{pricing.ts,sandbox.ts}` (+เทสต์สั้น: เพิ่มบรรทัด, ลดปริมาณ, รายการใหม่)
  - ใหม่ `backend/src/modules/variations/` (สิทธิ์: อ่าน `variations.read`, แก้/ส่ง `variations.manage`; ต้องมีสัญญา `signed`): CRUD draft + lines + evidence (`assertUploadedBy` ก่อนผูกไฟล์), compute-from-sandbox (อ่าน baseline snapshot ผ่าน port `BaselineControl.baselineProject(projectId)`), submit (approval `variation.submit` + numbering `variation`), record response (ภายใน + link), withdraw, cancel; ผลเมื่อ accepted ตาม §5 (เรียก `CostCodeLookup.applyVariation`, `MainContracts.applyVariation`, hub planned_finish)
    `CustomerLinkHandlers('variation')` (permission `variations.manage`; respond = `accept` | `reject` เท่านั้น), `ApprovalHandlers('variation.submit')`, `HubRollups` (openVariations), `BaselineUnlockGuards` (มี VO accepted), `ProjectDependents`
    ราคาขายของบรรทัด: `sellFactor` จาก `qt_quotation_sections` ของฉบับที่รับ อ่านผ่าน port ใหม่ `QuotationPricingLookup.sellFactors(ws, quotationVersionId)` (quotations provide ในไฟล์ module ของ quotations — เพิ่มใน WP นี้) ไม่มีใบเสนอราคา → `QuotationPricing.defaults` ของ company
  - Endpoints: `GET/POST /projects/:projectId/variations`, `GET/PATCH /variations/:variationId`, `PUT /variations/:variationId/lines`, `POST /variations/:variationId/compute`, `POST /variations/:variationId/evidence`, `DELETE /variation-evidence/:evidenceId`, `POST /variations/:variationId/submit|record-response|withdraw|cancel`
- **Acceptance**
  - [ ] VO เพิ่ม 50,000 accepted → contract current_value +50,000 (ขาย), budget cost code ที่เกี่ยวข้องเพิ่มตามต้นทุน, finish_date เลื่อนตามวัน
  - [ ] VO รายการใหม่ได้ cost code `VO{seq}-{n}` ใช้ใน claim ถัดไปได้
  - [ ] สัญญา milestone + `billing='next_claim'` → 422 `invalid_billing_option`; `separate_milestone` เพิ่มงวด `source='variation'`; VO ลดงาน (ยอดติดลบ) ทำให้ `current_value` ลดและงวดที่ยังไม่ claim ถูกจัดสรรใหม่
  - [ ] ทุก VO ที่ accepted มีหลักฐานอย่างน้อย: ผู้ขอ วันที่ และ (ลิงก์ตอบรับ หรือ evidence ≥ 1) — ไม่ครบ → 422 `evidence_required`
- **Out of scope:** UI (WP-34)

### WP-34 — VO web + ราคาด้วยเครื่องคำนวณ (sandbox)
- **Module:** variations · **Depends on:** WP-33 · **Model:** opus
- **Scope**
  - `src/features/erp/variations/{api.ts,hooks.ts,VariationsPage.tsx,VariationEditorPage.tsx,VoLinesTable.tsx,EvidencePanel.tsx,SandboxLauncher.tsx,print-model.ts,VariationPrintDocument.tsx}`
  - sandbox: เพิ่ม binding `{kind:'sandbox', variationId, projectId}` ใน `src/store/project-store.ts` (ไม่ persist ไม่ sync; ตรวจ `CloudRuntime.tsx` และ `src/features/cloud/sync/*` ให้ข้าม sandbox) — เปิดเครื่องคำนวณเดิม (`/calc/[id]`) บน snapshot baseline + sandbox ของ VO, แถบบนสุด "กำลังคิดราคา VO-xxx: บันทึก / ยกเลิก", บันทึก → `PATCH sandbox` + `POST compute` แล้วกลับหน้า VO; ออกจาก sandbox คืนโครงการเดิมให้ store
  - routes `src/app/(app)/p/[projectId]/variations/page.tsx`, `src/app/(app)/p/[projectId]/variations/[variationId]/page.tsx`, `src/app/(print)/print/variation/[variationId]/page.tsx`; แท็บ `variations` ใน nav registry; renderer `variation` ใน customer-links (ปุ่มรับ / ปฏิเสธ)
  - i18n `variations`, `enums.variationStatus`, `enums.variationReason`, `documents.variation.*`
- **Acceptance**
  - [ ] เปิด sandbox แก้เครื่องคำนวณ → กลับมาเห็นบรรทัด VO ที่คำนวณ; โครงการจริงไม่ถูกเขียน (ตรวจ network ไม่มี PUT docs)
  - [ ] refresh หน้าในระหว่าง sandbox ไม่ทำให้ข้อมูล sandbox ทับ guest/cloud project
  - [ ] ส่งลิงก์ลูกค้า รับ/ปฏิเสธได้ แสดงหลักฐานรูป/บันทึก
- **Out of scope:** หลาย sandbox พร้อมกัน

---

## 6. โมดูล 4 — Portal

### WP-35 — Portal backend + ค้นหา
- **Module:** portal · **Depends on:** WP-30, WP-33 · **Model:** opus
- **Scope**
  - contract `erp/portal.ts`
  - `ports.ts` + core: `PortalSources`, `SearchSources`
  - ใหม่ `backend/src/modules/portal/` (รวมแหล่ง, กรองตามสิทธิ์ผู้ใช้, จำกัด 50 tasks เรียงตาม dueDate; source ของโมดูลที่ไม่ active ไม่ถูกเรียก; `tiles` จาก `ModuleFlags`/registry; `quickActions` ตามบทบาท+โมดูล), ลงทะเบียน sources ในโมดูลที่มีแล้ว: approvals (รอฉัน), billing (เลยกำหนด, งวดเบิกได้), quotations (หมดอายุใน 7 วัน), variations (รอลูกค้า), hub search (โครงการ ชื่อ/รหัส), customers search, numbering search (`issued_documents.number` → href ของเอกสารตาม `subject_type`)
    `riskyProjects` จาก `HubRollups` (`overdueReceivable > 0`, `alerts`) — เหตุ `cost_overrun`/`negative_cash` จะมีเมื่อ job-cost (WP-46/47) ลงทะเบียน; `cashOutlook` = null จนกว่า WP-47 ลงทะเบียน
    สิทธิ์: สมาชิกทุกคน (`workspace.read`); gate `portal`
  - Endpoints: `GET /workspaces/:workspaceId/portal`, `GET /workspaces/:workspaceId/search?q=`
- **Acceptance**
  - [ ] ผู้ใช้ estimator ไม่เห็น task ที่ต้องใช้ `billing.receive`
  - [ ] ค้นเลข `INV2026-0003` เจอใบนั้น
  - [ ] ฟิลด์ของโมดูลที่ไม่ active ไม่ถูกคำนวณ
- **Out of scope:** sources ของโมดูล 5–9 (แต่ละ WP ของโมดูลนั้นเพิ่ม source ของตัวเอง)

### WP-36 — Portal web
- **Module:** portal · **Depends on:** WP-35 · **Model:** sonnet
- **Scope**
  - `src/features/erp/portal/{api.ts,hooks.ts,PortalPage.tsx,TasksList.tsx,RiskyProjects.tsx,CashOutlookChart.tsx,ModuleTiles.tsx,QuickActions.tsx,GlobalSearch.tsx}`
  - route `src/app/(app)/home/page.tsx`; `GlobalSearch` เปิดด้วย Ctrl/⌘+K และไอคอนบน header (เพิ่ม slot `headerExtras` ใน nav registry แล้วให้ `AppLayoutUI` เรนเดอร์เมื่อ `portal` active); `HomeRedirect` (WP-16) ส่งไป `/home` อยู่แล้ว
  - กราฟ cash outlook แบบ SVG เขียนเอง (แนว `src/features/planning/shared/charts.tsx`) แสดงเมื่อ `cashOutlook` ไม่ null (หลัง WP-47) — ตอนนี้ทดสอบด้วยข้อมูลจำลองใน dev แล้วไม่ commit ข้อมูลจำลอง
  - ModuleTiles: การ์ดทุกโมดูล ERP สถานะ active/trial (เหลือ n วัน)/ทดลองได้/ล็อก
  - i18n `portal`
- **Acceptance**
  - [ ] หน้าแรกต่างกันตามบทบาท (owner เห็นเงิน, foreman เห็นงานหน้างาน)
  - [ ] ผู้ใช้คนเดียวที่เพิ่งเปิด trial เห็น tile และ quick action "สร้างใบเสนอราคา"
- **Out of scope:** ปรับแต่ง layout เอง

---

## 7. โมดูล 5 — จัดซื้อ

### WP-37 — ทะเบียนผู้ขาย
- **Module:** procurement · **Depends on:** WP-06, WP-16, WP-35 · **Model:** opus
- **Scope**
  - ใหม่ `schema-procurement.ts` (`sup_suppliers`, `sup_ratings`) + wiring + migration `0025_wp37_suppliers`
  - contract `erp/suppliers.ts`
  - port `ScVendorDirectory` (provide โดย subcontracting: `listEntries(ws)` คืน displayName/phone/trades/vendorWorkspaceId) ; port `SupplierLookup` (provide โดย suppliers)
  - ใหม่ `backend/src/modules/suppliers/` (สิทธิ์ `suppliers.read` / `suppliers.manage`): CRUD, archive, import from sc vendor list (idempotent ด้วย `sc_vendor_list_entry_id`), rating (คำนวณ `rating`/`rating_count` ใหม่ทุกครั้ง), ลงทะเบียน `SearchSources` (ผู้ขาย); ประวัติราคา **ไม่อยู่ในโมดูลนี้** (procurement เป็นเจ้าของ `pc_order_lines` — WP-39)
  - Endpoints: `GET/POST /workspaces/:workspaceId/suppliers`, `GET/PATCH /suppliers/:supplierId`, `POST /suppliers/:supplierId/archive|restore|ratings`, `POST /workspaces/:workspaceId/suppliers/import-sc`
  - web `src/features/erp/suppliers/{api.ts,hooks.ts,SuppliersPage.tsx,SupplierDetailPage.tsx,SupplierForm.tsx}` + `src/features/erp/shared/SupplierPicker.tsx` + routes `src/app/(app)/suppliers/page.tsx`, `src/app/(app)/suppliers/[supplierId]/page.tsx` + เมนู `purchasing.suppliers` ใน nav registry (แท็บประวัติราคาแสดงเมื่อ WP-39 เสร็จ — ตอนนี้ซ่อน)
  - i18n `suppliers`, `enums.supplierKind`, `enums.whtPreset`
- **Acceptance**
  - [ ] import จากรายชื่อผู้รับเหมาช่วงสร้าง supplier ที่ผูก `sc_vendor_list_entry_id` และรันซ้ำไม่สร้างซ้ำ
  - [ ] เมื่อ subcontracting ไม่ active ปุ่ม import ไม่แสดงและ endpoint คืน 0 รายการ
- **Out of scope:** supplier portal

### WP-38 — PR + RFQ backend
- **Module:** procurement · **Depends on:** WP-37, WP-20, WP-08 · **Model:** opus
- **Scope**
  - schema-procurement.ts: `pc_requests`, `pc_request_lines`, `pc_rfqs`, `pc_rfq_lines`, `pc_rfq_suppliers`, `pc_rfq_quotes` + migration `0026_wp38_pr_rfq`
  - contract `erp/procurement.ts` (ส่วน PR/RFQ); FILE_PURPOSE `supplier_quote`
  - pure `src/domain/procurement/{budget-check.ts,compare.ts}` + เทสต์สั้น
  - ใหม่ `backend/src/modules/procurement/` (ส่วน PR/RFQ; สิทธิ์ PR `procurement.request`, RFQ `procurement.manage`): PR create (จาก site หรือจาก BOQ: เลือก cost codes แล้วเติมปริมาณคงเหลือ = `baseline_qty + vo_qty − ordered`), update, submit (budget check → numbering `purchase_request` → approval `purchase_request.approve`: approved → `approved`, pending → `pending_approval`), cancel; RFQ create from PR lines, invite suppliers, send (numbering `rfq`), enter quote, compare, award (→ สร้าง PO draft ผ่าน use case ของ WP-39: ใน WP นี้สร้างแค่ข้อมูล award และ endpoint คืน `{awardedSupplierId}`)
    `ApprovalHandlers('purchase_request.approve')`, `PortalSources` (PR ที่ approved รอสั่งซื้อ), `ProjectDependents`; RFQ ใช้ `SupplierLookup` ตรวจผู้ขายของ workspace
  - Endpoints: `GET/POST /projects/:projectId/purchase-requests`, `GET/PATCH /purchase-requests/:requestId`, `POST /purchase-requests/:requestId/submit|cancel`, `GET/POST /projects/:projectId/rfqs`, `GET/PATCH /rfqs/:rfqId`, `PUT /rfqs/:rfqId/suppliers`, `POST /rfqs/:rfqId/send|cancel`, `PUT /rfqs/:rfqId/quotes/:supplierId`, `GET /rfqs/:rfqId/compare`
- **Acceptance**
  - [ ] PR จาก BOQ ปริมาณเกิน budget 5% → warning `over_quantity` และต้องมี `override_reason`
  - [ ] compare แสดงราคาต่ำสุดต่อบรรทัด และยอดรวมแบบ normalized (บรรทัดที่ไม่เสนอคิดราคา budget)
- **Out of scope:** PO (WP-39)

### WP-39 — PO + รับของ + 3-way match backend
- **Module:** procurement · **Depends on:** WP-38 · **Model:** opus
- **Scope**
  - schema: `pc_orders`, `pc_order_lines`, `pc_receipts`, `pc_receipt_lines` + migration `0027_wp39_po_gr`
  - contract (ส่วน PO/GR); FILE_PURPOSES `delivery_note_photo`, `goods_photo`; pure `src/domain/procurement/three-way-match.ts` + เทสต์สั้น
  - procurement: PO create (จาก RFQ award / PR / ว่าง; supplier ตรวจผ่าน `SupplierLookup`, snapshot ผู้ขายตอน issue), update draft, issue (budget check → ถ้ามีคำเตือนต้องมี `override_reason` → approval `purchase_order.issue` (มีคำเตือน = ส่ง `amount: null` และบังคับขออนุมัติแม้ต่ำกว่า `minAmount` ยกเว้นข้ามอัตโนมัติเพราะทำคนเดียว) → numbering `purchase_order` → `CostLedger` commit ต่อบรรทัด → แจ้ง `purchase_order.issued`), cancel (ยังไม่รับของ), close (release คงเหลือ); GR create/confirm (numbering `goods_receipt` + actual + commit_release + อัปเดต `received_qty` + แจ้ง `goods.short_delivery` เมื่อขาด/เสียหาย; รูปเก็บ `{fileId, takenAt, caption}`)
    port `PurchaseOrders` สำหรับ payables (`find`, `linesWithReceived(ws, orderId)`, `markBilled(ws, lines[])`)
    ประวัติราคา: `GET /suppliers/:supplierId/price-history?q=` อยู่ใน controller ของ procurement (query `pc_order_lines` ของ PO ที่ issued ของผู้ขายนั้น)
    `ApprovalHandlers('purchase_order.issue')`, `HubRollups` (openPurchaseOrders), `PortalSources` (PO รอรับของ), `ProjectDependents`
    สิทธิ์: อ่าน `procurement.read`, สร้าง/issue `procurement.manage`, รับของ `procurement.receive`
  - Endpoints: `GET/POST /projects/:projectId/purchase-orders`, `GET /workspaces/:workspaceId/purchase-orders?status=`, `GET/PATCH /purchase-orders/:orderId`, `POST /purchase-orders/:orderId/issue|cancel|close`, `POST /rfqs/:rfqId/award {supplierId}` (สร้าง PO draft และ RFQ → `awarded`), `GET/POST /purchase-orders/:orderId/receipts`, `POST /goods-receipts/:receiptId/confirm|cancel`, `GET /suppliers/:supplierId/price-history`
- **Acceptance**
  - [ ] issue PO 10,000 → ledger commit 10,000 ต่อ cost code; รับของ 6,000 → actual 6,000, commit คงเหลือ 4,000; close → คงเหลือ 0
  - [ ] รับเกินที่สั่ง → 422 `reason:'over_received'`
  - [ ] PO over budget บังคับขออนุมัติ (ทีม) / ข้ามอัตโนมัติ (คนเดียว) และบันทึก override reason; ไม่มี reason → 422 `reason:'override_reason_required'`
- **Out of scope:** บิลผู้ขาย (WP-49)

### WP-40 — PR/RFQ web
- **Module:** procurement · **Depends on:** WP-39 · **Model:** sonnet
- **Scope**
  - `src/features/erp/procurement/{api.ts,hooks.ts,ProcurementPage.tsx (แท็บ PR/RFQ/PO/รับของ),PurchaseRequestEditor.tsx,FromBoqPicker.tsx,BudgetWarnings.tsx,RfqEditorPage.tsx,QuoteEntryDialog.tsx,RfqCompareTable.tsx}`
  - routes `src/app/(app)/p/[projectId]/procurement/page.tsx`, `src/app/(app)/p/[projectId]/procurement/rfqs/[rfqId]/page.tsx`; แท็บ `procurement` ใน nav registry
  - i18n `procurement`, `enums.purchaseRequestStatus`, `enums.rfqStatus`
- **Acceptance**
  - [ ] foreman สร้าง PR จากหน้างานบนมือถือได้ (ฟอร์มสั้น: รายการ ปริมาณ วันที่ต้องการ)
  - [ ] เทียบราคา 3 ผู้ขาย แล้วกด award ไปสู่ PO draft
- **Out of scope:** —

### WP-41 — PO/รับของ web + พิมพ์ PO/RFQ
- **Module:** procurement · **Depends on:** WP-40 · **Model:** sonnet
- **Scope**
  - `src/features/erp/procurement/{PurchaseOrderPage.tsx,OrderLinesTable.tsx,GoodsReceiptDialog.tsx,PurchasingPage.tsx,print-model.ts,PurchaseOrderPrintDocument.tsx,RfqPrintDocument.tsx}`
  - routes `src/app/(app)/p/[projectId]/procurement/orders/[orderId]/page.tsx`, `src/app/(app)/purchasing/page.tsx` (PO ข้ามโครงการ), `src/app/(print)/print/purchase-order/[orderId]/page.tsx`, `src/app/(print)/print/rfq/[rfqId]/page.tsx`; เมนู `purchasing.purchasing` ใน nav registry; แท็บประวัติราคาในหน้า supplier เปิดใช้
  - GR: ถ่ายรูปใบส่งของ (input `capture="environment"`), ระบุขาด/เสียหาย
  - i18n `enums.purchaseOrderStatus`, `enums.receiptCondition`, `documents.purchaseOrder.*`, `documents.rfq.*`
- **Acceptance**
  - [ ] รับของบางส่วนสองครั้งจนครบ สถานะ PO เปลี่ยนตาม
  - [ ] พิมพ์ PO ทั้งสองภาษา
- **Out of scope:** —

---

## 8. โมดูล 6 — รายงานประจำวันและค่าแรง

### WP-42 — รายงานประจำวัน backend
- **Module:** site-diary · **Depends on:** WP-20 · **Model:** opus
- **Scope**
  - ใหม่ `schema-site.ts` (`sd_reports`, `sd_manpower`, `sd_work_items`, `sd_photos`, `sd_issues`; export `siteTables`) + wiring + migration `0028_wp42_site_diary`
  - contract `erp/site-diary.ts`; FILE_PURPOSE `site_photo`
  - port `CrewDailyCost` (provide โดย workforce: `dailyCostOf(ws, crewIds)` ใช้ `backend/src/modules/workforce/application/crew-pricing.ts`)
  - ใหม่ `backend/src/modules/site-diary/` (สิทธิ์ `site.read` / `site.report`): get-or-create report ของวัน, update (draft เท่านั้น), manpower/work items/photos/issues, submit (ตั้ง reported progress ตาม `02-domain-model.md` §8.1 + โพสต์ค่าแรงประมาณถ้า `labour` ไม่ active), reopen (reverse ledger ของรายงานนั้น), progress series (`{actual, planned}` ตาม §8.1), issues list ข้ามวัน
    `HubRollups` (progressPct), `PortalSources` (ยังไม่ส่งรายงานวันนี้ สำหรับโครงการ `in_progress`), `ProjectDependents`
  - Endpoints: `GET /projects/:projectId/site-diary?from=&to=`, `GET/PUT /projects/:projectId/site-diary/:date`, `POST /projects/:projectId/site-diary/:date/submit|reopen`, `GET /projects/:projectId/site-diary/progress`, `GET /projects/:projectId/site-issues?status=`, `PATCH /site-issues/:issueId`
- **Acceptance**
  - [ ] submit รายงานที่มีงาน R58 = 40% → cost code R58 `reported_progress` = 0.4
  - [ ] reopen + แก้เป็น 50% + submit → 0.5 และ ledger ค่าแรงไม่ซ้ำ
  - [ ] วันที่อนาคต (เทียบ `bangkokToday`) → 422
  - [ ] progress series `actual` ถ่วงด้วย budget ถูกต้องในเทสต์สั้น 2 cost code
- **Out of scope:** หน้าจอ (WP-43)

### WP-43 — รายงานประจำวัน web
- **Module:** site-diary · **Depends on:** WP-42 · **Model:** sonnet
- **Scope**
  - `src/features/erp/site-diary/{api.ts,hooks.ts,DiaryCalendarPage.tsx,DailyReportPage.tsx,WeatherPicker.tsx,ManpowerTable.tsx,WorkItemsTable.tsx,PhotoGrid.tsx,IssuesPanel.tsx,ProgressChart.tsx}`
  - routes `src/app/(app)/p/[projectId]/diary/page.tsx`, `src/app/(app)/p/[projectId]/diary/[date]/page.tsx`; แท็บ `diary` ใน nav registry
  - ใช้ได้บนมือถือ (กรอกจากหน้างาน), รูปเก็บ `takenAt` จาก `File.lastModified`
  - i18n `siteDiary`, `enums.weather`, `enums.issueKind`, `enums.severity`
- **Acceptance**
  - [ ] กรอกรายงานหนึ่งวันครบ (อากาศ คน งาน % รูป ปัญหา) และส่งได้ทั้ง desktop และ 375px
  - [ ] กราฟ S-curve: % สะสมจริงตามวันเทียบเส้นแผน (`planned`) เมื่อมี
- **Out of scope:** —

### WP-44 — ใบลงเวลา งวดค่าแรง 15 วัน เบิกล่วงหน้า backend
- **Module:** labour · **Depends on:** WP-42 · **Model:** opus
- **Scope**
  - schema-site.ts: `lb_timesheet_entries`, `lb_pay_periods`, `lb_pay_lines`, `lb_advances`, `lb_advance_recoveries` + migration `0029_wp44_labour`
  - contract `erp/labour.ts`
  - port `PeopleDirectory` (provide โดย workforce: people + daily wage; caller ส่งว่าเห็นค่าแรงได้หรือไม่ตาม `workforce.seeWages`)
  - ใหม่ `backend/src/modules/labour/` (สิทธิ์ `labour.read` / `labour.record` / `labour.pay`; ค่าแรงรายคนต้องมี `workforce.seeWages` ด้วย): timesheet bulk upsert ต่อวัน/โครงการ (prefill จาก manpower ของรายงานประจำวันที่มี crew; กติกา `daily_wage`/Σ days ตาม `02-domain-model.md` §8.2), approve (approval `timesheet.approve` + ledger actual labour), pay period build (รวมใบลงเวลา approved ในช่วง + หักเบิกล่วงหน้าตามลำดับเก่าสุดก่อน), approve period (`pay_period.approve`), mark paid (`fin_events` `lb.wages_paid` ต่อโครงการตามสัดส่วนใบลงเวลา, `lb.advance_recovered`; ตอบ 409 `paid_via_payables` เมื่อมีบิล AP ของงวดแล้ว — ตรวจผ่าน registry `PayPeriodBillChecks` ใน core ที่ payables ลงทะเบียนใน WP-49; ไม่มีผู้ลงทะเบียน = ไม่มีบิล), advances CRUD + paid (`lb.advance_paid`)
    `ApprovalHandlers('timesheet.approve')`, `ApprovalHandlers('pay_period.approve')`, `PortalSources` (งวดพร้อมจ่าย), `DailySweeps` (`labour.pay-period-ready`: แจ้ง `pay_period.ready` วันที่ 15 และวันสุดท้ายของเดือน), `ProjectDependents`
  - Endpoints: `GET/PUT /projects/:projectId/timesheets/:date`, `POST /projects/:projectId/timesheets/approve {from,to}`, `GET /workspaces/:workspaceId/pay-periods`, `POST /workspaces/:workspaceId/pay-periods/:periodKey/build|approve|pay`, `GET /pay-periods/:periodId`, `GET/POST /workspaces/:workspaceId/wage-advances`, `PATCH /wage-advances/:advanceId`
- **Acceptance**
  - [ ] งวด `2026-10-A` รวมเฉพาะวันที่ 1–15; คนที่มีเบิกล่วงหน้า 1,000 ค่าแรง 600 → หัก 600 เหลือยอดเบิก 400 ยกไปงวดหน้า
  - [ ] แก้ใบลงเวลาในงวดที่ pending_approval/approved/paid → 409 `period_locked`
  - [ ] คนเดียวลง 1 วันในสองโครงการรวม 1.5 วัน → 422 `over_one_day`
  - [ ] estimator ไม่เห็นค่าแรงรายคน (ตาม `workforce.seeWages`)
- **Out of scope:** ภ.ง.ด.1, ประกันสังคม (D-14), จ่ายผ่านรอบจ่าย AP (WP-49/50)

### WP-45 — ค่าแรง web
- **Module:** labour · **Depends on:** WP-44 · **Model:** sonnet
- **Scope**
  - `src/features/erp/labour/{api.ts,hooks.ts,LabourPage.tsx,TimesheetGrid.tsx (คน × วัน),PayPeriodsPage.tsx,PayPeriodDetail.tsx,AdvancesTable.tsx,PaySlipPrint.tsx}`
  - routes `src/app/(app)/p/[projectId]/labour/page.tsx`, `src/app/(app)/workspace/pay-periods/page.tsx` (เมนู `finance.payPeriods` ใน nav registry), `src/app/(print)/print/pay-period/[periodId]/page.tsx` (ใบสรุปจ่ายค่าแรง); แท็บ `labour` ใน nav registry
  - ปุ่ม "จ่าย" ของงวดซ่อนเมื่อ `payables` active (ให้ไปจ่ายผ่านรอบจ่าย) และแสดงลิงก์ "สร้างบิลเพื่อจ่าย"
  - i18n `labour`, `enums.payPeriodStatus`, `enums.advanceStatus`
- **Acceptance**
  - [ ] กรอกใบลงเวลา 1 สัปดาห์ด้วย grid (คลิกเต็มวัน/ครึ่งวัน) → สร้างงวด → อนุมัติ → จ่าย → พิมพ์ใบสรุป
- **Out of scope:** —

---

## 9. โมดูล 7 — ควบคุมต้นทุนและกระแสเงินสด

### WP-46 — Job cost backend: ต้นทุน กำไร แจ้งเตือน
- **Module:** job-cost · **Depends on:** WP-39, WP-44, WP-30 · **Model:** opus
- **Goal:** งบ vs ผูกพัน vs จริง vs EAC ต่อรายการ BOQ (cost code) + กำไรคาดการณ์ต่อโครงการ + แจ้งเตือนเกินงบ
- **Scope**
  - ใหม่ `schema-job-cost.ts` (`jc_forecasts`, `jc_alerts`, `jc_cash_settings`, `jc_unit_rates` — สร้างทั้ง 4 ตารางใน WP นี้; export `jobCostTables`) + wiring + migration `0030_wp46_job_cost`
  - contract `erp/job-cost.ts` (ส่วนต้นทุน)
  - pure `src/domain/job-cost/{cost-status.ts,forecast.ts,profit.ts}` ตาม `02-domain-model.md` §9 + เทสต์สั้น
  - port จาก subcontracting: `SubcontractCommitments` (บรรทัดสัญญาจ้างช่วงที่ active + claims approved ต่อโครงการ; provide ใน `backend/src/modules/subcontracting/contracts/contracts.parts.ts`)
  - ใหม่ `backend/src/modules/job-cost/` (สิทธิ์ `cost.read` / `cost.manage`): cost report ต่อโครงการ (ต่อ cost code และต่อหมวด + แถว "ไม่ระบุ"), forecast PUT (manual), projected profit (`MainContracts.forProject`), sync จ้างช่วง → ledger (idempotent ด้วย `entriesBySource`; เรียกตอนเปิด cost report และใน sweep), sweep `job-cost.alerts` + แจ้ง `cost.overrun`
    `HubRollups` (committedOpen, actualCost, forecastAtCompletion, projectedProfit, alerts), `PortalSources` (riskyProjects: `cost_overrun`)
  - Endpoints: `GET /projects/:projectId/job-cost`, `GET /projects/:projectId/job-cost/ledger?costCodeId=`, `PUT /projects/:projectId/job-cost/forecasts/:costCodeId`, `GET /workspaces/:workspaceId/job-cost/alerts`
- **Acceptance**
  - [ ] cost code budget 100,000, actual 70,000, progress 50%, ไม่มีผูกพัน → auto EAC 120,000 (= 70,000 + max(50,000, 0)) และ level `critical` (120% > 110%); budget 100,000 EAC 105,000 → `warning`
  - [ ] sync จ้างช่วงสองครั้งไม่ซ้ำ entry
  - [ ] alert เดิมที่หายไปถูกตั้ง `resolved_at` และแจ้งเตือนไม่ส่งซ้ำ
- **Out of scope:** กระแสเงินสด (WP-47), UI (WP-48)

### WP-47 — กระแสเงินสดจริงข้ามโครงการ (backend)
- **Module:** job-cost · **Depends on:** WP-46 · **Model:** opus
- **Goal:** แผน vs จริงของเงินเข้า/ออก ต่อโครงการและทั้งบริษัท 13 สัปดาห์ และเตือนล่วงหน้าเมื่อเงินสดจะติดลบ (ต่อยอด CashFlow เดิมของ planning)
- **Scope**
  - `ports.ts` + core: registry `CashPlanSources` (`register(module, (ws, projectIds | 'all', from, to) => Promise<CashPlanItem[]>)`)
  - pure `src/domain/job-cost/cash-projection.ts` ตาม `02-domain-model.md` §9 + เทสต์สั้น
  - ลงทะเบียน source ในโมดูลที่มีแล้ว (ไฟล์ module ของแต่ละโมดูล + use case/query เล็ก ๆ): billing (ใบแจ้งหนี้ค้างรับ + งวดที่ยังไม่วางบิลที่มี `due_date`), procurement (PO issued ที่ยังไม่มีบิล), labour (ค่าแรงคาดการณ์), subcontracting (port `SubcontractCashPlan` provide ใน `contracts.parts.ts` แล้ว job-cost เป็นผู้ลงทะเบียน source นี้) — แต่ละ source คืนค่าว่างเมื่อโมดูลของตนไม่ active
  - job-cost: cash flow โครงการ (+ เส้น "แผนตอนประมาณราคา" จาก `computeProject(read.project).planning.cashflow` ผ่าน `ProjectReader`) และทั้งบริษัท, cash settings GET/PUT (`cost.manage`), sweep `job-cost.cash` (`cash.negative_forecast` วันละครั้งต่อ workspace ผ่าน `sweep_marks`), `PortalSources` (`cashOutlook` 13 สัปดาห์ เฉพาะผู้มี `cost.read`; riskyProjects `negative_cash`)
  - contract `erp/job-cost.ts` (ส่วนกระแสเงินสด)
  - Endpoints: `GET /projects/:projectId/cash-flow`, `GET /workspaces/:workspaceId/cash-flow?weeks=13`, `GET/PUT /workspaces/:workspaceId/cash-settings`
- **Acceptance**
  - [ ] cash projection แสดงสัปดาห์แรกที่ `balance < min_balance` และส่ง `cash.negative_forecast` ครั้งเดียวต่อวัน
  - [ ] ยอดจริงรายสัปดาห์ = Σ `fin_events.cash` ของสัปดาห์นั้น (เทสต์สั้น)
  - [ ] ปิดโมดูล billing → source ของ billing ไม่ถูกนับ (ไม่ error)
- **Out of scope:** UI (WP-48), บิลค้างจ่าย (payables ลงทะเบียนเองใน WP-49)

### WP-48 — Job cost + กระแสเงินสด web
- **Module:** job-cost · **Depends on:** WP-47 · **Model:** sonnet
- **Scope**
  - `src/features/erp/job-cost/{api.ts,hooks.ts,JobCostPage.tsx,CostTable.tsx (หมวด → cost code),ForecastEditor.tsx,ProfitCard.tsx,AlertsList.tsx,CashFlowChart.tsx,CompanyCashFlowPage.tsx,CashSettingsDialog.tsx,ExportCostXlsx.ts}`
  - routes `src/app/(app)/p/[projectId]/cost/page.tsx`, `src/app/(app)/finance/cashflow/page.tsx`; แท็บ `cost` + เมนู `finance.cashflow` ใน nav registry
  - กราฟ SVG เขียนเอง (budget vs committed vs actual vs EAC; plan vs actual cash) แนว `src/features/planning/shared/charts.tsx`
  - Excel ด้วย exceljs แบบ lazy (แนว `src/features/export/xlsx.ts`)
  - i18n `jobCost`, `enums.alertKind`, `enums.alertLevel`
- **Acceptance**
  - [ ] ตารางต้นทุนกรองหมวด ดูรายการ ledger ของ cost code ได้ export Excel ได้
  - [ ] หน้า cash flow บริษัทรวมทุกโครงการที่ active; viewer (ไม่มี `cost.read`) ไม่เห็นหน้าเหล่านี้
- **Out of scope:** —

---

## 10. โมดูล 8 — เจ้าหนี้และภาษี

### WP-49 — เจ้าหนี้: บิลผู้ขาย / งวดจ้างช่วง / ค่าแรง + 3-way match (backend)
- **Module:** payables · **Depends on:** WP-39, WP-44, WP-20 · **Model:** opus
- **Scope**
  - ใหม่ `schema-payables.ts` (`ap_bills`, `ap_bill_lines`; export `payablesTables`) + wiring + migration `0031_wp49_payables_bills`
  - contract `erp/payables.ts` (ส่วนบิล); FILE_PURPOSE `supplier_bill_scan`
  - port จาก subcontracting: `SubcontractPayables` (`listApprovedUnpaid(ws)`; provide ใน `contracts.parts.ts`); port จาก labour: `PayPeriodPayments` (สร้างใน WP นี้: `approvedUnbilled(ws)`, `find(ws, periodId)`; provide ใน `backend/src/modules/labour/labour.module.ts`; WP-50 เพิ่ม `markPaid`)
  - core registry `PayPeriodBillChecks` (สร้างใน WP-44) — payables ลงทะเบียน "งวดนี้มีบิลที่ไม่ voided หรือไม่"
  - ใหม่ `backend/src/modules/payables/` (สิทธิ์ `payables.read` / `payables.manage`): bill create (จาก PO+GR พร้อม 3-way match ผ่าน `PurchaseOrders.linesWithReceived`, จาก sc claim, จากงวดค่าแรง, ว่าง/ค่าใช้จ่าย), update draft, approve/post (approval `supplier_bill.approve` + numbering `supplier_bill` + `fin_events` `ap.bill_posted` (`data.inputVatClaimable`, `data.taxInvoiceDate`) + ledger ส่วนต่างราคา/บิลไม่มี PO (`category` ตามบรรทัด) + `PurchaseOrders.markBilled`), void (reverse), due list
    `ApprovalHandlers('supplier_bill.approve')`, `CashPlanSources` (บิลค้างจ่าย `due_date`), `PortalSources` (บิลครบกำหนดใน 7 วัน; แจ้ง `supplier_bill.due_soon` ผ่าน sweep `payables.due` 3 วันก่อนครบกำหนด), `ProjectDeletionGuards` ไม่ต้อง (numbering + fin_events ดูแล)
  - Endpoints: `GET/POST /workspaces/:workspaceId/supplier-bills`, `GET/PATCH /supplier-bills/:billId`, `POST /supplier-bills/:billId/approve|void`, `POST /purchase-orders/:orderId/bill`, `POST /workspaces/:workspaceId/supplier-bills/from-sc-claim {claimId}`, `POST /workspaces/:workspaceId/supplier-bills/from-pay-period {periodId}`, `GET /workspaces/:workspaceId/payables/due`
- **Acceptance**
  - [ ] บิลราคา 105 เทียบ PO 100 (รับครบ) → match `price_differs`, ledger actual +5 เมื่อ post
  - [ ] บิลที่ qty เกินที่รับ → `qty_exceeds_received` และ `match_status='exceptions'` (post ได้เมื่อมีหมายเหตุ)
  - [ ] supplier_invoice_no ซ้ำของผู้ขายเดียวกัน → 409
  - [ ] สร้างบิลจากงวดค่าแรงซ้ำ → 409; labour `pay` ของงวดที่มีบิลแล้ว → 409 `paid_via_payables`
- **Out of scope:** รอบจ่ายและ 50 ทวิ (WP-50), UI (WP-51)

### WP-50 — รอบจ่าย ใบสำคัญจ่าย และ 50 ทวิ (backend)
- **Module:** payables · **Depends on:** WP-49 · **Model:** opus
- **Scope**
  - schema-payables.ts: `ap_payment_runs`, `ap_payments`, `ap_payment_allocations`, `ap_wht_certificates` + migration `0032_wp50_payment_runs`
  - contract `erp/payables.ts` (ส่วนรอบจ่าย/50 ทวิ)
  - port จาก subcontracting: `SubcontractClaimPayer.markPaid` (ใช้ตรรกะ `PayClaim` เดิม; provide ใน `contracts.parts.ts`); labour: `PayPeriodPayments.markPaid(ws, periodId, {paidAt, method, by})` (โพสต์ `lb.wages_paid` / `lb.advance_recovered` เหมือน pay ของ labour)
  - payables: payment run create/add-remove bills (`approved` → `scheduled`)/approve (`payment_run.approve`)/pay (ใน `uow.run` เดียว: ต่อผู้ขาย สร้าง `ap_payments` + numbering `payment_voucher`; WHT > 0 → `ap_wht_certificates` + numbering `wht_certificate` (`form` = `pnd53` เมื่อ `sup_suppliers.is_juristic` ไม่งั้น `pnd3`; `income_type` จาก `wht_preset`); `fin_events` `ap.payment` + `ap.wht_withheld` (`data.form`); บิล → `paid`; บิล subcontract → `SubcontractClaimPayer.markPaid`; บิล labour → `PayPeriodPayments.markPaid` แทน `ap.payment`), cancel (`scheduled` → `approved`)
    สิทธิ์: สร้างรอบ `payables.manage`, จ่าย `payables.pay`
    `ApprovalHandlers('payment_run.approve')`
  - Endpoints: `GET/POST /workspaces/:workspaceId/payment-runs`, `GET/PATCH /payment-runs/:runId`, `POST /payment-runs/:runId/approve|pay|cancel`, `GET /payments/:paymentId`, `GET /wht-certificates/:certificateId`
- **Acceptance**
  - [ ] จ่ายผู้ขายนิติบุคคลค่าบริการ 10,000 VAT 700 WHT 3% → เงินสด 10,400 (= 10,000 + 700 − 300), 50 ทวิ form `pnd53`, ฐาน 10,000
  - [ ] รอบจ่าย 3 บิล 2 ผู้ขาย → PV 2 ใบ; ผู้ขายที่ไม่มี WHT ไม่มี 50 ทวิ
  - [ ] บิลจากงวดจ้างช่วง จ่ายแล้ว claim ในโมดูลจ้างช่วงเป็น paid; บิลค่าแรงจ่ายแล้วงวดค่าแรงเป็น `paid` และไม่มี `ap.payment` ซ้ำ
  - [ ] pay ซ้ำ → 409 `invalid_transition`
- **Out of scope:** UI (WP-51), รายงานภาษี (WP-52)

### WP-51 — เจ้าหนี้ web + พิมพ์ 50 ทวิ / ใบสำคัญจ่าย
- **Module:** payables · **Depends on:** WP-50 · **Model:** sonnet
- **Scope**
  - `src/features/erp/payables/{api.ts,hooks.ts,PayablesPage.tsx,BillEditor.tsx,MatchTable.tsx,PaymentRunPage.tsx,DueList.tsx,print-model.ts,WhtCertificatePrint.tsx (แบบฟอร์ม 50 ทวิ ภาษาไทย),PaymentVoucherPrint.tsx}`
  - routes `src/app/(app)/payables/page.tsx`, `src/app/(app)/payables/runs/[runId]/page.tsx`, `src/app/(print)/print/wht-certificate/[certificateId]/page.tsx`, `src/app/(print)/print/payment-voucher/[paymentId]/page.tsx`; เมนู `finance.payables` ใน nav registry
  - สร้างบิลได้ 4 แบบ: จาก PO, จากงวดจ้างช่วง (เมื่อ subcontracting active), จากงวดค่าแรง (เมื่อ labour active), ค่าใช้จ่ายทั่วไป
  - i18n `payables`, `enums.billKind`, `enums.billStatus`, `enums.paymentRunStatus`, `documents.whtCertificate.*`, `documents.paymentVoucher.*`
- **Acceptance**
  - [ ] สร้างบิลจาก PO แสดงผล match ต่อบรรทัด; สร้างรอบจ่าย 3 ใบ 2 ผู้ขาย → จ่าย → ได้ PV 2 ใบ + 50 ทวิ
  - [ ] พิมพ์ 50 ทวิ มีช่องครบ (ผู้จ่าย ผู้ถูกหัก เลขภาษี ประเภทเงินได้ วันที่ จำนวน ภาษี เงื่อนไข ลายมือชื่อ)
- **Out of scope:** —

### WP-52 — รายงานภาษี + Excel ให้นักบัญชี
- **Module:** payables · **Depends on:** WP-51, WP-30 · **Model:** opus
- **Scope**
  - contract `erp/tax-reports.ts`
  - backend `backend/src/modules/payables/` (หรือโฟลเดอร์ `tax-reports` ภายใน payables): endpoints `GET /workspaces/:workspaceId/tax-reports/output-vat?month=YYYY-MM`, `.../input-vat`, `.../pnd3`, `.../pnd53`, `.../wht-received`, `.../summary` อ่าน `fin_events` เท่านั้น (`tax.reports`)
  - web `src/features/erp/tax-reports/{api.ts,hooks.ts,TaxReportsPage.tsx,ReportTable.tsx,xlsx.ts}` (exceljs lazy แบบ `src/features/export/xlsx.ts`; หนึ่งไฟล์หลายชีต: ภาษีขาย ภาษีซื้อ ภ.ง.ด.3 ภ.ง.ด.53 ภาษีถูกหัก สรุป) + route `src/app/(app)/tax-reports/page.tsx` + เมนู `finance.taxReports` ใน nav registry
  - backend อ่านเดือนตาม `event_date` (ภาษีขาย, ภ.ง.ด.) และตาม `data.taxInvoiceDate` (ภาษีซื้อ) ในโซนเวลา Asia/Bangkok; รายการที่ถูก reverse แสดงคู่กับแถวกลับรายการ
  - i18n `taxReports`
- **Acceptance**
  - [ ] ภาษีขายเดือนหนึ่งรวม VAT ตรงกับผลรวม TI − CN ของเดือน
  - [ ] ภาษีซื้อแสดงเฉพาะบิลที่มีใบกำกับภาษีเต็มรูป
  - [ ] ไฟล์ Excel เปิดใน Excel/Numbers ได้ หัวคอลัมน์ตามภาษา UI
- **Out of scope:** ยื่นภาษีออนไลน์, รูปแบบไฟล์อัปโหลดกรมสรรพากร

---

## 11. โมดูล 9 — ส่งมอบ รับประกัน ปิดโครงการ

### WP-53 — ส่งมอบ + รับประกัน backend
- **Module:** handover · **Depends on:** WP-30 · **Model:** opus
- **Scope**
  - ใหม่ `schema-handover.ts` (`ho_handovers`, `ho_handover_documents`, `ho_warranties`, `ho_warranty_claims`, `ho_closeouts`; export `handoverTables`) + wiring + migration `0033_wp53_handover`
  - contract `erp/handover.ts`; FILE_PURPOSES `handover_document`, `as_built`, `warranty_photo`
  - ใหม่ `backend/src/modules/handover/` (สิทธิ์ `handover.read` / `handover.manage`; ต้องมีสัญญา `signed`): handover CRUD + schedule (`ProjectLifecycle.advance('handover')`)/inspect/accept (ใน `uow.run` เดียว: numbering `handover`, `ProjectLifecycle.advance('warranty')`, `MainContracts.complete`, สร้าง `ho_warranties` (`warrantyMonths` จาก terms ของสัญญา), แจ้ง `retention.release_due` เมื่อ `retentionRelease` มีส่วน at completion), warranty get, warranty claims CRUD + state (numbering `warranty_claim` ตอนเปิด, assign user/supplier, close + ledger cost ถ้า `cost_amount > 0`, แจ้ง `warranty.claim_opened`), sweep `handover.warranty` (`warranty.expiring` 30 วันก่อน, เลย `end_date` → `expired`)
    `HubRollups`, `PortalSources` (เคลมเปิด), `ProjectDependents`
  - Endpoints: `GET/POST /projects/:projectId/handover`, `PATCH /handovers/:handoverId`, `POST /handovers/:handoverId/schedule|inspect|accept|reject`, `POST /handovers/:handoverId/documents`, `GET /projects/:projectId/warranty`, `GET/POST /projects/:projectId/warranty-claims`, `PATCH /warranty-claims/:claimId`, `POST /warranty-claims/:claimId/assign|start|resolve|close|reject`
- **Acceptance**
  - [ ] accept → โครงการ warranty, สัญญา completed, งวด trigger `handover` เป็น claimable, warranty end = `addMonths(handover_date, warrantyMonths)`
  - [ ] เคลมปิดพร้อมค่าใช้จ่าย 2,000 → ledger actual 2,000 (`category='other'`)
  - [ ] sweep แจ้ง warranty.expiring 30 วันก่อน ครั้งเดียว
- **Out of scope:** closeout (WP-55), punch list เต็มรูป

### WP-54 — ส่งมอบ + รับประกัน web
- **Module:** handover · **Depends on:** WP-53 · **Model:** sonnet
- **Scope**
  - `src/features/erp/handover/{api.ts,hooks.ts,HandoverPage.tsx (แท็บ ส่งมอบ/รับประกัน/ปิดโครงการ),HandoverChecklist.tsx,HandoverDocuments.tsx,WarrantyCountdown.tsx,WarrantyClaimsTable.tsx,WarrantyClaimDrawer.tsx,print-model.ts,HandoverPrintDocument.tsx}`
  - routes `src/app/(app)/p/[projectId]/handover/page.tsx`, `src/app/(print)/print/handover/[handoverId]/page.tsx`; แท็บ `handover` ใน nav registry
  - ปุ่ม "คืนเงินประกันผลงาน" ลิงก์ไป billing (retention release invoice) และ "คืนหลักประกัน" ไป guarantees
  - i18n `handover`, `enums.handoverStatus`, `enums.warrantyClaimStatus`, `documents.handover.*`
- **Acceptance**
  - [ ] ทำส่งมอบ: นัด → ตรวจ (checklist) → ลูกค้ารับ → พิมพ์ใบส่งมอบสองภาษา
  - [ ] นับถอยหลังประกันแสดงวันคงเหลือ; เปิดเคลม มอบหมาย ปิดได้
- **Out of scope:** —

### WP-55 — ปิดโครงการ + ราคาจริงกลับสู่ BOQ
- **Module:** handover · **Depends on:** WP-54, WP-46 · **Model:** opus
- **Scope**
  - pure `src/domain/handover/closeout.ts` ตาม `02-domain-model.md` §11 + เทสต์สั้น
  - handover backend: closeout draft (คำนวณสรุปจาก `CostLedger.totalsByCostCode`, `CostCodeLookup.listByProject`, `MainContracts.forProject`, `BillingTotals.totalsByProject`), finalize (`ProjectLifecycle.advance('closed')`, เขียน `jc_unit_rates` ผ่าน port `UnitRateHistory.record(ws, projectId, rows[])` ที่ job-cost provide; ต้องมี `handover.manage` + `cost.read`)
  - job-cost: provide `UnitRateHistory`; endpoint `GET /workspaces/:workspaceId/unit-rates?lineKeys=` (เฉลี่ยของ 3 โครงการล่าสุดต่อ line key ตาม `observed_date`; `cost.read`)
  - web: แท็บปิดโครงการใน `HandoverPage` (`CloseoutPanel.tsx`: ตารางประมาณการ vs จริงต่อหมวด กราฟ กำไร บันทึกบทเรียน ปุ่ม finalize), พิมพ์สรุป `src/app/(print)/print/closeout/[projectId]/page.tsx`
  - หน้า BOQ (`src/features/boq-home/BoqHomePage.tsx`): เมื่อ `handover` active และมีสิทธิ์ `cost.read` แสดง hint "ราคาจริงล่าสุด" ต่อแถวที่มีข้อมูล และปุ่ม "ใช้ราคานี้" (เขียน override ผ่าน `setBoqOverride`; ไม่ทำงานเมื่อ baseline ล็อก); component ใหม่ `src/features/erp/job-cost/UnitRateHint.tsx`
  - i18n `handover.closeout.*`, `documents.closeout.*`
- **Acceptance**
  - [ ] สรุปปิดโครงการ: Σ actual ต่อหมวด (รวมแถว "ไม่ระบุหมวด") = Σ ledger actual ของโครงการ
  - [ ] finalize แล้วเปิดโครงการใหม่ หน้า BOQ แสดงราคาจริงของรายการที่ตรง line key
  - [ ] finalize ซ้ำ → 409
- **Out of scope:** ML ประมาณราคา

---

## 12. Z — ข้อมูลตัวอย่างและเอกสาร

### WP-56 — ข้อมูลตัวอย่าง ERP + เอกสาร API
- **Module:** — · **Depends on:** WP-55 · **Model:** sonnet
- **Scope**
  - ใหม่ `backend/src/cli/seed-erp.ts` เรียกจาก `seed-showcase.ts` (ข้ามเมื่อ `project-hub` ไม่ release, พิมพ์ "erp: skipped"): สิทธิ์โมดูลใช้ `POST /workspaces/:id/modules/:module/trial` (ได้ทุกโมดูลพร้อม dependency) — ไม่ต้องเป็น platform admin, โปรไฟล์บริษัท, ลูกค้า 3 ราย (บุคคล/นิติ/รัฐ), โครงการบ้านตัวอย่าง: baseline → ใบเสนอราคา accepted → สัญญา → 2 งวดเบิก (หนึ่งรับเงินแล้ว) → VO 1 → PR/PO/GR → รายงานประจำวัน 5 วัน → ใบลงเวลา + งวดจ่าย → บิลผู้ขาย + รอบจ่าย; ผ่าน HTTP API จริงแบบ seed เดิม (ใช้ `createApp` ของ `../bootstrap` เหมือน `seed-showcase.ts`)
  - `backend/SEED.md`, `backend/API.md` (ทุก route ERP), `docs/erp/PROGRESS.md`
- **Acceptance**
  - [ ] `npm run db:seed:showcase` บนฐานว่างสำเร็จ (ถ้า DB ใช้ได้; ถ้าไม่ได้ ทดสอบด้วย `PERSISTENCE=memory` ผ่าน in-process app แล้วบันทึก) — **ห้ามรันพร้อมคำสั่งหนักอื่น** (`db:seed:showcase` รัน `npm run build` ก่อน)
  - [ ] API.md มีทุก endpoint ที่ WP-01…WP-55 เพิ่ม
  - [ ] env ที่ไม่มี id ERP ใน `MODULES_ENABLED`: seed เดิมได้ผลเหมือนก่อนทุกประการ
- **Out of scope:** เทสต์ e2e (รอบทดสอบแยก)

---

## 13. Track I — ย้ายข้อความไทยเดิมเข้า message files

กติกาใน `03-i18n.md` §9 (คัดลอกไทยตรงตัว, แปลอังกฤษพร้อมกัน, เพิ่ม glob เข้า ESLint rule หลังเสร็จ) ทุก WP: **model sonnet**, depends on WP-01; I-01 และ I-10 depends on WP-19 (แตะ `AppLayoutUI.tsx`, `AccountMenu.tsx`, `src/store/project-store.ts`, `src/features/cloud/sync/*` ที่ WP-16/WP-19 แก้); I-04 depends on WP-24 (ปุ่มใบเสนอราคาบน `BoqHomePage.tsx`) และ I-04 ต้องไม่รันพร้อม WP-21/WP-55 (แตะ `BoqHomePage.tsx`)
ไฟล์ที่ถูกย้ายข้อความแล้ว (และเพิ่ม glob ESLint) ถ้า WP สายหลักภายหลังต้องแก้ ต้องใช้ message files ต่อ ห้ามเติมไทยตายตัวกลับ

| WP | กลุ่มไฟล์ | namespace | หมายเหตุ |
|---|---|---|---|
| I-01 | `src/components/AppLayoutUI.tsx` (ส่วนที่เหลือ), `src/features/cloud/ui/*`, `src/features/cloud/auth/*`, `src/features/modules/*`, `src/features/notifications/*`, `src/store/project-store.ts` (`READ_ONLY_TEXT`, `CLOUD_NEW_PROJECT_TEXT` → คีย์), `src/features/cloud/api/errors.ts` (`thaiErrorMessage` → ใช้ `errors`), route login/register/invite | `shell`, `account`, `auth`, `errors` | |
| I-02 | `src/components/sheet/*.tsx` (ยกเว้น `journey/`) | `sheet` | |
| I-03 | `src/components/sheet/journey/*` | `journeyUi` | |
| I-04 | `src/features/boq-home/*`, `src/features/journey/*` | `boqHome`, `journeyUi` | |
| I-05 | `src/features/export/*` (BOQ print/xlsx/schedule print) — ภาษาเอกสาร BOQ = ภาษา UI ตอนกดพิมพ์ | `export`, `documents.boq.*` | ใช้ `amountInWords` |
| I-06 | `src/features/calculators/*` ไฟล์ลำดับตัวอักษร 1–22 + `CalculatorShell.tsx` | `calculators` | |
| I-07 | `src/features/calculators/*` ไฟล์ 23–45 | `calculators` | |
| I-08 | `src/features/calculators/*` ไฟล์ 46–ท้าย + overlay domain: `src/domain/journey/levels.en.ts`, `requirements.en.ts`, `src/domain/calculators/sections.en.ts` (sections/options), ใช้ `titleEn`; หน้า BOQ ใช้ `template.v5.en.ts` เมื่อ locale = en | `calculators`, `domainContent` | หลัง I-08 เปิดปุ่มภาษาได้ทั่วไป (ยกเลิกเงื่อนไข D-16) |
| I-09 | `src/features/planning/**` + `src/domain/planning` labels overlay | `planning` | |
| I-10 | `src/features/cloud/**` ที่เหลือ (projects, revisions, workspaces, presence, sync notices) | `cloud` | |
| I-11 | `src/features/workforce/**` + `src/domain/workforce` labels overlay | `workforce` | |
| I-12 | `src/features/subcontracting/buyer/**` | `subcontracting` | |
| I-13 | `src/features/subcontracting/contracts/**`, `src/features/subcontracting/shared/**`, notification templates `sc.*` ภาษาอังกฤษใน backend | `subcontracting` | |
| I-14 | `src/features/vendor/**`, `src/app/(vendor)/**` | `vendor` | |

เกณฑ์รับงานของ track I: ไม่มีอักษรไทยในไฟล์ที่ย้ายแล้ว (ยกเว้นคอมเมนต์), parity ผ่าน, หน้าเดิมภาษาไทยแสดงเหมือนเดิมทุกตัวอักษร, สลับเป็นอังกฤษแล้วหน้าไม่มีข้อความไทยหลงเหลือ, ESLint glob ขยาย
