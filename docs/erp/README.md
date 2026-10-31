# ConTrack ERP: คลังความรู้สำหรับเอเจนต์ที่ลงมือทำ

สถานะ: **ฉบับที่ 1 (ออกแบบครบ ยังไม่เริ่มเขียนโค้ด)** · 2026-10-31 · branch ที่ใช้ทำงาน: `epic/erp`

> **ใครใช้เอกสารนี้:** เอเจนต์ที่ลงมือทำงานทุกตัว แต่ละตัวเริ่มด้วย context ว่างและได้รับงาน 1 ชิ้น (`WP-xx`)
> เอกสารในโฟลเดอร์นี้คือ **context ทั้งหมดที่คุณมี** อย่าเดาสิ่งที่เอกสารไม่ได้เขียนไว้ ถ้าเอกสารกับโค้ดขัดกัน
> ให้เชื่อโค้ด แล้วบันทึกความขัดแย้งไว้ใน `PROGRESS.md` หัวข้อ "Decisions log"

## 1. ลำดับการอ่าน (บังคับ)

| ลำดับ | ไฟล์ | อ่านเมื่อ | เนื้อหา |
|---|---|---|---|
| 1 | `README.md` (ไฟล์นี้) | ทุกครั้ง | กติกา อภิธานศัพท์ |
| 2 | `PROGRESS.md` | ทุกครั้ง | WP ไหนเสร็จแล้ว, Decisions log, **Handoff notes ของ WP ก่อนหน้า** (อ่านทุกบันทึกของ WP ที่งานคุณ depends on) |
| 3 | `04-implementation-plan.md` → หัวข้อ WP ของคุณ | ทุกครั้ง | ขอบเขต เกณฑ์รับงาน และสิ่งที่ไม่อยู่ในขอบเขต |
| 4 | `01-architecture.md` | §0–§3, §11, §14, §16 ทุกครั้ง; §4–§10, §12–§13, §15 เมื่อ WP แตะเรื่องนั้น | แพตเทิร์นโมดูล ธงโมดูล 4 ชั้น สิทธิ์ การอนุมัติ เลขเอกสาร เงิน วันที่ และ checklist "HOW TO ADD AN ERP MODULE" |
| 5 | `02-domain-model.md` → หัวข้อของโมดูลคุณ + §0 และ §1 (foundation) | เมื่อแตะตาราง/entity | ตาราง คอลัมน์ state machine ความสัมพันธ์ |
| 6 | `03-i18n.md` | เมื่อแตะหน้าจอหรือเอกสารพิมพ์ | กติกาสองภาษา TH/EN |
| 7 | `00-vision.md` | ครั้งแรก หรือเมื่อต้องตัดสินใจเชิงผลิตภัณฑ์ | การตัดสินใจของเจ้าของ ขอบเขตที่ทำ/ไม่ทำ |

เอกสารเดิมที่ยังใช้อ้างอิงได้: `backend/CONVENTIONS.md` (กฎ backend), `docs/rebuild/DESIGN_SYSTEM.md` (โทเค็นดีไซน์),
`docs/marketplace/01-module1-subcontracting-plan.md` (โมดูลจ้างช่วง ซึ่งเป็นต้นแบบของ retention/งวด/claim)
ส่วน `docs/rebuild/AGENT_GUIDE.md` ใช้กับงานเครื่องคำนวณ Excel เท่านั้น งาน ERP ไม่ต้องใช้

## 2. กติกาการทำงานของเอเจนต์ (ทุก WP)

1. **ทำ WP เดียว** ให้จบตามเกณฑ์รับงาน (acceptance criteria) ห้ามทำงานของ WP อื่นล่วงหน้า ถ้าจำเป็นจริงให้บันทึกใน Handoff notes
2. ก่อนเริ่ม ให้แก้สถานะ WP ใน `PROGRESS.md` เป็น `in-progress` เมื่อจบให้เปลี่ยนเป็น `done` ใส่ commit hash แล้ว **เพิ่ม Handoff note** (สร้างอะไร เบี่ยงจากแผนตรงไหน WP ถัดไปต้องรู้อะไร)
3. **ฮาร์ดแวร์จำกัด** (MacBook M1 Pro RAM 16 GB ดิสก์ว่างราว 49 GB):
   - ห้ามรันคำสั่งหนักพร้อมกัน (`next build`, `nest build`, jest หรือ vitest ทั้งชุด)
   - ตรวจด้วย `npx tsc --noEmit -p backend/tsconfig.json` (backend) และ `npx tsc --noEmit -p tsconfig.json` (web) ทีละอัน
   - lint เฉพาะไฟล์ที่แก้: `cd backend && npx eslint <files>` และ `npx eslint <files>` ที่ root
   - ห้าม docker build และห้ามเปิด dev server ค้างไว้
4. **การทดสอบ:** เฟสนี้ยังไม่เขียนเทสต์ละเอียด (เจ้าของจะสั่งรอบทดสอบแยกภายหลัง) แต่โค้ดต้องถูกต้องและไม่มีบั๊ก
   - typecheck และ lint ต้องผ่าน 100%
   - เทสต์เดิมที่อยู่ใกล้โค้ดที่แก้ต้องไม่พัง: backend `cd backend && npx jest <path>` / web `npx vitest run <path>` (ที่ root) เฉพาะไฟล์ที่เกี่ยวข้อง ห้ามรันทั้งชุด
   - ฟังก์ชันคำนวณเงินที่เป็น pure (`src/domain/money`, `billing`, `quotation`) ควรมีเทสต์สั้น ๆ ครอบกรณีหลัก เพราะเขียนเร็วและกันบั๊กเงิน
5. **Migration ต้องทำทีละ WP ตามลำดับ** เพราะ `backend/drizzle/meta/_journal.json` ขัดกันได้ ห้าม WP ที่แก้ schema รันขนานกัน
   ไฟล์ล่าสุดตอนเขียนเอกสารนี้คือ `0005_workforce_catch_up` ดังนั้น WP แรกที่แก้ schema (WP-01) จะได้ `0006_*`
   คำสั่ง: `cd backend && npm run db:generate -- --name <wpNN>_<name>` (drizzle-kit ไม่ต้องต่อฐานข้อมูล)
   **แก้ schema แบบเพิ่มอย่างเดียว** (ตาราง/คอลัมน์/constraint ใหม่) ห้ามเปลี่ยนชื่อหรือลบคอลัมน์ เพราะ drizzle-kit จะถามแบบ interactive (เอเจนต์ตอบไม่ได้) ถ้าคำสั่งค้างรอคำตอบ ให้ยกเลิกและบันทึกใน Handoff
   ห้ามแก้ไฟล์ migration ที่ commit แล้ว
6. **ไฟล์กลางที่แก้ร่วมกัน** (ห้ามแก้ขนานกันหลาย WP): `src/shared/contract/modules.ts`, `src/shared/contract/module-registry.ts`,
   `src/shared/contract/index.ts`, `backend/src/shared/domain/permissions.ts`, `src/features/cloud/permissions.ts`,
   `backend/src/shared/application/ports.ts`, `backend/src/app.module.ts`, `backend/src/shared/infrastructure/database/database.ts`,
   `backend/drizzle.config.ts`, `backend/src/shared/infrastructure/core.module.ts`, `backend/src/shared/testing/platform-fakes.ts`, `src/i18n/messages/*/index.ts`,
   `src/features/erp/hub/nav-registry.ts`, `src/components/AppLayoutUI.tsx`, `src/features/cloud/ui/AccountMenu.tsx`, `src/store/project-store.ts`, `src/features/cloud/sync/engine.ts`, `eslint.config.mjs`, `package.json`, `backend/package.json`
7. commit เมื่อ WP จบและผ่าน typecheck/lint แล้ว หนึ่ง WP ต่อหนึ่ง commit
   ข้อความ commit: `feat(erp): WP-xx <title>` ลงท้ายด้วยบรรทัด attribution ตามที่ระบบกำหนด
8. **ห้ามข้อความไทยแบบ hard-code ในโค้ด ERP ใหม่** ข้อความ UI ทุกคำต้องอยู่ใน message files (`03-i18n.md`)
9. ห้ามแก้ `backend/CONVENTIONS.md` เว้นแต่ WP ระบุไว้
10. เมื่อเอกสารขาดรายละเอียดที่ต้องตัดสินใจ ให้เลือกทางที่เข้ากับโค้ดเดิมที่สุด แล้วบันทึกใน Decisions log
11. **ห้ามเปลี่ยนพฤติกรรมของหน้าจอ/โมดูลเดิม** (BOQ, planning, subcontracting, workforce, vendor) นอกจากที่ WP ระบุ — release 1 ต้องเหมือนเดิมทุกประการเมื่อโมดูล ERP ปิด
    ข้อความไทยเดิมที่ย้ายเข้า message files ต้องตรงตัวอักษร (Robot e2e ใน `tests/robot/` ใช้ข้อความไทยเป็น locator)
12. ลำดับรัน: สายหลักทีละ WP ตามเลข (WP-01 → WP-56) ห้ามข้าม; track I รันคู่ได้อย่างมาก 1 ตัวตามกติกา `04-implementation-plan.md` §0
    ถ้า WP ใหญ่เกินจะจบใน context เดียว ให้หยุดที่จุดที่ typecheck ผ่าน commit เป็น `WP-xx (part 1)` แล้วเขียน Handoff ว่าเหลืออะไร — WP ถัดไปห้ามเริ่มจนกว่า WP นี้ `done`

## 3. แผนที่ไฟล์ในโฟลเดอร์นี้

```
docs/erp/
  README.md                    ดัชนี + กติกา + อภิธานศัพท์
  00-vision.md                 การตัดสินใจของเจ้าของ ขอบเขต กลุ่มลูกค้า นโยบายปล่อยด้วย flag
  01-architecture.md           สถาปัตยกรรม + "HOW TO ADD AN ERP MODULE"
  02-domain-model.md           ตาราง entity state machine
  03-i18n.md                   แผนสองภาษา TH/EN
  04-implementation-plan.md    Work packages WP-01 … WP-56 และ track I-01 … I-14
  PROGRESS.md                  ledger สถานะ + Decisions log + Handoff notes
```

## 4. อภิธานศัพท์ TH / EN / ชื่อในโค้ด

| ไทย | English | ชื่อในโค้ด / หมายเหตุ |
|---|---|---|
| ใบแสดงปริมาณงานและราคา | Bill of Quantities (BOQ) | `BoqResult`, `src/domain/boq/*` |
| รายการ BOQ / แถว | BOQ line item | `BoqItemRow`, คีย์ `R<excelRow>` หรือ slot key `${calcId}:${slot}:${rowKey}` |
| หมวดงาน | BOQ section / category | `BoqSectionResult.no` 0–31 |
| ค่าวัสดุ / ค่าแรง | material / labour | `matTotal` / `labTotal` |
| ประวัติ BOQ / ฉบับ | BOQ version (history) | `project_revisions` + `boq_versions` |
| ฉบับฐาน (ล็อกตอนเซ็นสัญญา) | Baseline | `project_baselines`; หลังล็อกห้ามเขียน BOQ ทับ |
| รหัสต้นทุน | Cost code | `project_cost_codes` 1 แถวต่อ 1 รายการ BOQ ใน baseline หรือรายการที่ VO เพิ่ม |
| งบประมาณ | Budget | baseline + VO ที่อนุมัติแล้ว ต่อ cost code |
| ผูกพันแล้ว | Committed | PO / สัญญาจ้างช่วงที่ยังไม่รับของหรือเบิก (`cost_ledger_entries.kind = 'commit'`) |
| ต้นทุนจริง | Actual cost | รับของ ค่าแรง เบิกจ้างช่วง บิลค่าใช้จ่าย (`kind = 'actual'`) |
| ประมาณการเมื่อแล้วเสร็จ | Forecast at completion (EAC) | `jc_forecasts` |
| ใบเสนอราคา | Quotation | `qt_quotations`, เลข `QT` |
| สัญญาหลัก (กับเจ้าของงาน) | Main contract | `mc_contracts`, เลข `CT` |
| งวดงาน / งวดเงิน | Payment milestone (installment) | `mc_milestones` |
| เงินล่วงหน้า | Advance payment | `ar_advance_entries`; หักคืนตามสัดส่วนทุกงวด (advance recovery) |
| เงินประกันผลงาน | Retention | `ar_retention_entries` (ฝั่งลูกค้า) / `sc_retention_entries` (ฝั่งจ้างช่วง ของเดิม) |
| หลักประกันสัญญา | Contract guarantee (performance bond) | `mc_guarantees` |
| ค่าปรับล่าช้า | Late penalty (liquidated damages) | เงื่อนไขใน `mc_contracts.terms.penalty` หักใน claim |
| ระยะเวลารับประกันผลงาน | Warranty period | `mc_contracts.terms.warrantyMonths` → `ho_warranties` |
| เบิกงวดตามผลงาน | Progress claim | `ar_claims` (+ `ar_claim_lines` ต่อ cost code) |
| ใบแจ้งหนี้ / ใบวางบิล | Invoice / Billing note | `ar_invoices.kind = 'invoice'`, เลข `INV` |
| ใบกำกับภาษี | Tax invoice | `ar_invoices.kind = 'tax_invoice'`, เลข `TI` (ห้ามข้ามเลข ห้ามใช้ซ้ำ) |
| ใบเสร็จรับเงิน | Receipt | `ar_receipts`, เลข `RC` |
| ใบกำกับภาษี/ใบเสร็จรับเงิน | Tax invoice / receipt (combined) | `ar_receipts.taxInvoiceId` พิมพ์รวมได้ |
| ใบลดหนี้ | Credit note | `ar_invoices.kind = 'credit_note'`, เลข `CN` |
| ภาษีมูลค่าเพิ่ม (VAT) 7% | Value added tax | `THAI_VAT_RATE = 0.07` ใน `src/domain/money/tax.ts` |
| ภาษีขาย / ภาษีซื้อ | Output VAT / Input VAT | รายงานใน `tax-reports` |
| ภาษีหัก ณ ที่จ่าย | Withholding tax (WHT) | `whtRate`; รัฐ 1%, นิติบุคคลจ้างทำของ 3%, บุคคลธรรมดา (ลูกค้า) 0% |
| หนังสือรับรองการหักภาษี ณ ที่จ่าย (50 ทวิ) | WHT certificate | `ap_wht_certificates`, เลข `WHT` |
| ภ.ง.ด.3 / ภ.ง.ด.53 | WHT returns (individual / juristic payee) | สรุปรายเดือนใน `tax-reports` |
| ลูกหนี้ / อายุลูกหนี้ | Receivables / AR aging | `/receivables` |
| เจ้าหนี้ | Payables (AP) | `ap_bills` |
| รอบจ่ายเงิน | Payment run | `ap_payment_runs` |
| งานเพิ่ม-ลด | Variation order (VO) | `vo_variations`, เลข `VO` |
| ใบขอซื้อ | Purchase request (PR) | `pc_requests`, เลข `PR` |
| ขอใบเสนอราคาผู้ขาย | Request for quotation (RFQ) | `pc_rfqs`, เลข `RFQ` |
| ใบสั่งซื้อ | Purchase order (PO) | `pc_orders`, เลข `PO` |
| ใบรับของ / ใบส่งของ | Goods receipt (GR) / delivery note | `pc_receipts`, เลข `GR` |
| เทียบ 3 ทาง | 3-way match | PO ↔ GR ↔ supplier bill |
| ผู้ขาย / ร้านวัสดุ | Supplier (vendor master) | `sup_suppliers` |
| ผู้รับเหมาช่วง | Subcontractor | โมดูล `subcontracting` เดิม (`sc_*`) และ vendor portal |
| รายงานประจำวัน | Daily site report | `sd_reports` |
| ค่าแรงรายวัน / งวดจ่าย 15 วัน | Daily wage / 15-day pay period | `lb_pay_periods` |
| เบิกล่วงหน้า (ค่าแรง) | Wage advance | `lb_advances` |
| ส่งมอบงาน | Handover | `ho_handovers` |
| แบบก่อสร้างจริง | As-built drawings | ไฟล์ `purpose = 'as_built'` |
| เคลมประกัน | Warranty claim | `ho_warranty_claims` |
| ปิดโครงการ | Project closeout | `ho_closeouts` |
| ปร.4 / ปร.5 / ปร.6 | Thai government BOQ forms (detail / summary / multi-building summary) | `quotationFormat = 'government'` |
| Factor F | ตัวคูณค่างานงานราชการ (overhead/profit/interest/VAT) | ป้อนเองต่อใบเสนอราคา (ดู Decisions log D-12) |
| ค่า K | Price escalation factor (K) | `mc_contracts.terms.escalation` (ดู D-13) |
| ราคากลางภาครัฐ | Government reference price | `price_reference_items` (WP-21) |
| เลขเอกสารรันต่อเนื่อง | Running document number | `modules/numbering`, ตาราง `doc_number_*` |
| โปรไฟล์ธุรกิจ | Business profile | `company_profiles.businessProfiles` (เลือกได้หลายแบบ) |
| ประเภทโครงการ | Project type | `projects.project_type` |
| สิทธิ์ใช้งานโมดูล (ซื้อ/ทดลอง/เบต้า) | Entitlement | `workspace_entitlements` |
| ศูนย์รวมโครงการ | Project Hub | `/hub`, `modules/hub` |
| หน้าหลักตามบทบาท | Portal | `/home`, `modules/portal` |
| การอนุมัติ (ข้ามเองเมื่อทำคนเดียว) | Approval workflow (auto-skip when solo) | `modules/approvals` |
| เหตุการณ์ทางการเงิน (พร้อมลง GL) | Financial event | `fin_events` |
| บัญชีแยกประเภท | General ledger (GL) | **ยังไม่ทำ** แต่ `fin_events` ออกแบบให้ต่อได้ |
| พื้นที่ทำงาน / บริษัท | Workspace (tenant) | `workspaces` (`personal` / `company`) |
