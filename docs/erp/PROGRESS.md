# ERP — บันทึกความคืบหน้า

อัปเดตล่าสุด: 2026-10-31 · branch: `epic/erp` · สถานะ: **เริ่มลงมือ (WP-01, WP-02 done)**

วิธีอัปเดต (ทุก WP):
1. เริ่มงาน: เปลี่ยน status เป็น `in-progress`
2. จบงาน: status `done`, ใส่ commit hash สั้น, notes สั้น ๆ (เช่นเลข migration ที่ได้จริง)
3. เพิ่ม **Handoff note** ท้ายไฟล์ (รูปแบบด้านล่าง) และบันทึกการตัดสินใจใหม่ใน **Decisions log** (เลข D ถัดไป)
4. ห้ามลบหรือแก้บันทึกของ WP อื่น เพิ่มต่อท้ายเท่านั้น

## Ledger — สายหลัก

| WP | Title | Model | Status | Commit | Notes |
|---|---|---|---|---|---|
| WP-01 | i18n foundation (locale, format, parity, lint) | opus | done | 3adace6 | migration `0006_wp01_user_locale`; `amountInWords` เลื่อนไป WP-02 (D-52) |
| WP-02 | ไลบรารีเงิน ภาษี วันที่ | opus | done | COMMIT_HASH | ไม่มี migration; `round2` ย้ายไป `src/domain/money/money.ts`; `amountInWords(v, locale)` ใน `src/i18n/format.ts` (D-52) |
| WP-03 | Module registry, flag 4 ชั้น, entitlement, ModuleAccess (backend + contract) | opus | todo | | |
| WP-04 | หน้าโมดูลและทดลองใช้ (web) | sonnet | todo | | |
| WP-05 | บทบาทและสิทธิ์ ERP | opus | todo | | |
| WP-06 | ERP web foundation: UI kit, nav registry, กรอบพิมพ์ | opus | todo | | |
| WP-07 | Platform admin: ให้สิทธิ์โมดูล (backend + web) | sonnet | todo | | |
| WP-08 | Workflow อนุมัติ + audit log (backend) | opus | todo | | |
| WP-09 | หน้าอนุมัติ นโยบาย และ audit (web) | sonnet | todo | | |
| WP-10 | การแจ้งเตือน: channel, ภาษาผู้รับ, sweep | opus | todo | | |
| WP-11 | บริการเลขเอกสาร + guard การลบ | opus | todo | | |
| WP-12 | โปรไฟล์บริษัท + business profile + project type | sonnet | todo | | |
| WP-13 | ทะเบียนลูกค้า | sonnet | todo | | |
| WP-14 | ลิงก์ลูกค้า (public) | opus | todo | | |
| WP-15 | Project Hub backend | opus | todo | | |
| WP-16 | Project Hub web + ต่อ nav เข้า AppLayoutUI | opus | todo | | |
| WP-17 | ประวัติ BOQ (versions, เทียบฉบับ) | opus | todo | | |
| WP-18 | Baseline + cost codes (backend) | opus | todo | | |
| WP-19 | Baseline web: BOQ อ่านอย่างเดียวเมื่อล็อก + CostCodePicker | opus | todo | | |
| WP-20 | Cost ledger + financial events | opus | todo | | |
| WP-21 | ราคากลางภาครัฐ | sonnet | todo | | |
| WP-22 | Quotation: domain คำนวณ + overlay อังกฤษของ BOQ | opus | todo | | |
| WP-23 | Quotation backend | opus | todo | | |
| WP-24 | Quotation web: รายการ ตัวแก้ไข เทียบฉบับ | sonnet | todo | | |
| WP-25 | Quotation เอกสารพิมพ์ TH/EN + หน้าลูกค้า | sonnet | todo | | |
| WP-26 | สัญญาหลัก backend | opus | todo | | |
| WP-27 | สัญญาหลัก web + พิมพ์สัญญา | sonnet | todo | | |
| WP-28 | Billing domain คำนวณ | opus | todo | | |
| WP-29 | งวดเบิก + ใบแจ้งหนี้ backend | opus | todo | | |
| WP-30 | รับเงิน ใบกำกับภาษี ลูกหนี้ เตือน PromptPay backend | opus | todo | | |
| WP-31 | Billing web | sonnet | todo | | |
| WP-32 | Billing เอกสารพิมพ์ + QR | sonnet | todo | | |
| WP-33 | VO backend | opus | todo | | |
| WP-34 | VO web + ราคาด้วยเครื่องคำนวณ (sandbox) | opus | todo | | |
| WP-35 | Portal backend + ค้นหา | opus | todo | | |
| WP-36 | Portal web | sonnet | todo | | |
| WP-37 | ทะเบียนผู้ขาย | opus | todo | | |
| WP-38 | PR + RFQ backend | opus | todo | | |
| WP-39 | PO + รับของ + 3-way match backend | opus | todo | | |
| WP-40 | PR/RFQ web | sonnet | todo | | |
| WP-41 | PO/รับของ web + พิมพ์ PO/RFQ | sonnet | todo | | |
| WP-42 | รายงานประจำวัน backend | opus | todo | | |
| WP-43 | รายงานประจำวัน web | sonnet | todo | | |
| WP-44 | ใบลงเวลา งวดค่าแรง 15 วัน เบิกล่วงหน้า backend | opus | todo | | |
| WP-45 | ค่าแรง web | sonnet | todo | | |
| WP-46 | Job cost backend: ต้นทุน กำไร แจ้งเตือน | opus | todo | | |
| WP-47 | กระแสเงินสดจริงข้ามโครงการ (backend) | opus | todo | | |
| WP-48 | Job cost + กระแสเงินสด web | sonnet | todo | | |
| WP-49 | เจ้าหนี้: บิลผู้ขาย / งวดจ้างช่วง / ค่าแรง + 3-way match (backend) | opus | todo | | |
| WP-50 | รอบจ่าย ใบสำคัญจ่าย และ 50 ทวิ (backend) | opus | todo | | |
| WP-51 | เจ้าหนี้ web + พิมพ์ 50 ทวิ / ใบสำคัญจ่าย | sonnet | todo | | |
| WP-52 | รายงานภาษี + Excel ให้นักบัญชี | opus | todo | | |
| WP-53 | ส่งมอบ + รับประกัน backend | opus | todo | | |
| WP-54 | ส่งมอบ + รับประกัน web | sonnet | todo | | |
| WP-55 | ปิดโครงการ + ราคาจริงกลับสู่ BOQ | opus | todo | | |
| WP-56 | ข้อมูลตัวอย่าง ERP + เอกสาร API | sonnet | todo | | |

## Ledger — Track I (ย้ายข้อความไทยเดิม)

| WP | Title | Status | Commit | Notes |
|---|---|---|---|---|
| I-01 | เปลือกแอป บัญชี ล็อกอิน error | todo | | หลัง WP-16 |
| I-02 | components/sheet | todo | | |
| I-03 | components/sheet/journey | todo | | |
| I-04 | boq-home + journey | todo | | |
| I-05 | export (BOQ print/xlsx) | todo | | |
| I-06 | calculators กลุ่ม 1 | todo | | |
| I-07 | calculators กลุ่ม 2 | todo | | |
| I-08 | calculators กลุ่ม 3 + overlay domain | todo | | หลังข้อนี้เปิดปุ่มภาษาทั่วไป |
| I-09 | planning | todo | | |
| I-10 | cloud ที่เหลือ | todo | | |
| I-11 | workforce | todo | | |
| I-12 | subcontracting buyer | todo | | |
| I-13 | subcontracting contracts/shared + sc.* notification en | todo | | |
| I-14 | vendor portal | todo | | |

## Decisions log

| # | วันที่ | การตัดสินใจ | เหตุผล / ความขัดแย้งที่พบ |
|---|---|---|---|
| D-01 | 2026-10-31 | ทำงานบน branch `epic/erp` | คำสั่งระบุ `feat/erp-foundation` แต่ branch ปัจจุบันของ repo คือ `epic/erp` (commit `9319ac2`) |
| D-02 | 2026-10-31 | บทบาท "ผู้ช่วย (assistant)" = role id `admin` เดิม ไม่เปลี่ยนชื่อ id; เพิ่ม `pm`, `purchasing`, `accounting`, `foreman` ใน WP-05 | ไม่กระทบข้อมูล membership เดิมและ check constraint |
| D-03 | 2026-10-31 | ราคากลางภาครัฐ: นำเข้า `goverment_price.json` เข้า `price_reference_*` ใน WP-21 (คาด 4,559 แถวที่มีราคา; ข้าม 1,012 แถวที่ราคาเป็น `-`) | เจ้าของเข้าใจว่า "มีอยู่แล้ว" แต่โค้ดที่ใช้ถูกลบใน commit `a985437`; มีแค่ไฟล์ JSON ดิบที่ root (5,571 แถว, ฟิลด์หน่วยชื่อ `unit_type`) |
| D-04 | 2026-10-31 | เงินใช้ `number` + `round2` ทุกค่าที่เก็บ + `numeric(14,2)` ไม่ใช้ Decimal library | ตรงกับโค้ดจ้างช่วงเดิม; ช่วงสูงสุด 1e11 แม่นยำพอใน float64 |
| D-05 | 2026-10-31 | เอกสาร ERP ปัดเงินต่อบรรทัด BOQ ตอนดึงเข้า ยอดรวมอาจต่างจากหน้า BOQ (ไม่ปัด) ไม่กี่สตางค์ เอกสาร ERP ใช้ยอดของตัวเองเสมอ | BOQ engine ไม่ปัดเงิน (ตรงกับ Excel) และห้ามเปลี่ยนตัวเลข BOQ |
| D-06 | 2026-10-31 | ฐาน VAT ของงวดเบิก = งานงวดนี้ − หักเงินล่วงหน้า + ค่า K; ค่าปรับไม่ลดฐาน VAT; VAT คิดบนทั้งงวดรวมส่วนที่หักประกันผลงาน; ใบแจ้งหนี้คืนเงินประกันไม่มี VAT | แนวปฏิบัติทั่วไป (เงินล่วงหน้าเสีย VAT ตอนรับแล้ว) และทำให้สูตรเดียวทุกกลุ่มลูกค้า ปรับเป็นตัวเลือกได้ภายหลัง |
| D-07 | 2026-10-31 | ใบกำกับภาษี (งานบริการ) ออกตอนรับเงินเป็นค่าเริ่มต้น รับบางส่วนออกตามสัดส่วน ใบสุดท้ายรับเศษ | จุดความรับผิด VAT ของบริการคือเมื่อได้รับชำระ |
| D-08 | 2026-10-31 | เลขสัญญาจ้างช่วง `SC-YYYY-NNNN` (`sc_contract_counters`) ไม่ย้ายเข้าบริการเลขเอกสารกลาง | ไม่แตะโมดูลที่ใช้งานแล้ว และไม่ใช่เอกสารภาษี |
| D-09 | 2026-10-31 | ลูกค้า/ที่อยู่ของ Hub ไม่ซิงก์อัตโนมัติกับ `meta.ownerName`/`meta.siteAddress` ของ BOQ (มีปุ่มคัดลอก) | กันสองที่เขียนทับกันผ่าน sync engine |
| D-10 | 2026-10-31 | ทะเบียนผู้ขาย `sup_suppliers` แยกจาก `sc_vendor_list_entries` แต่ผูกกันได้และนำเข้าได้ | สมุดจ้างช่วงเดิมผูกกับเบอร์โทรและ flow OTP ของ vendor portal |
| D-11 | 2026-10-31 | ผู้ขายวัสดุไม่ล็อกอินใน v1: RFQ พิมพ์/ส่งให้ผู้ขาย แล้วผู้รับเหมากรอกราคาเอง | ลดขอบเขต; supplier portal อยู่ใน marketplace (later) |
| D-12 | 2026-10-31 | Factor F ป้อนเองต่อ part ของใบเสนอราคาราชการ; ยังไม่ฝังตาราง Factor F ทางการ | ต้องได้ตารางทางการจากเจ้าของ ห้ามเดาตัวเลข — **คำถามค้างถึงเจ้าของ** |
| D-13 | 2026-10-31 | ค่า K: สูตรและสัมประสิทธิ์ป้อนเองต่อสัญญา ดัชนีป้อนเองต่องวด ยังไม่มี preset ตามประเภทงาน | ต้องได้สูตรทางการตามประเภทงานจากเจ้าของ — **คำถามค้างถึงเจ้าของ** |
| D-14 | 2026-10-31 | ค่าแรงรายวัน: ไม่หัก ภ.ง.ด.1 / ประกันสังคม ใน v1 | เงินเดือน/HR อยู่ใน later |
| D-15 | 2026-10-31 | ส่งข้อความทุก namespace ของภาษาปัจจุบันไปเบราว์เซอร์ | ง่ายและพอสำหรับตอนนี้; แยกด้วย `pick` ภายหลังถ้าใหญ่ |
| D-16 | 2026-10-31 | ปุ่มสลับภาษาแสดงเมื่อ `NEXT_PUBLIC_LANGUAGE_SWITCH=1` (WP-01) หรือ `project-hub` active (เพิ่มใน WP-16) จนกว่า I-08 เสร็จ | หน้า BOQ เดิมยังเป็นไทยเกือบทั้งหมด สลับแล้วจะครึ่ง ๆ กลาง ๆ; ModuleId `project-hub` เกิดใน WP-03 จึงตรวจใน WP-01 ไม่ได้ |
| D-17 | 2026-10-31 | ประวัติ BOQ v1: ดู เทียบ ล็อก baseline — ยังไม่มี "กู้คืนฉบับเก่า" | การเขียน project docs ทั้งชุดกลับมีผลกับ sync/realtime ต้องออกแบบแยก |
| D-18 | 2026-10-31 | คอลัมน์ Hub อยู่ในตาราง `projects` แต่โมดูล `hub` เป็นเจ้าของ; `ProjectDto` เดิมไม่เปลี่ยน มี `HubProjectDto` แยก | ไม่กระทบ endpoint/sync เดิม |
| D-19 | 2026-10-31 | ไม่มี FK ข้ามไฟล์ schema ยกเว้นไปยังตาราง core (`schema.ts`); id ข้ามโมดูลตรวจผ่าน lookup port | กฎเดิมใน `database.ts` ("no file imports another stream's file") |
| D-20 | 2026-10-31 | Foundation (ลูกค้า บริษัท เลขเอกสาร อนุมัติ audit ลิงก์ ราคากลาง) gate ด้วย `project-hub` | ทุกโมดูล ERP พึ่ง `project-hub`; release 1 ปิดทั้งหมดได้ด้วย flag เดียว |
| D-21 | 2026-10-31 | `ModuleUsage` (ผูกกับจ้างช่วง) เปลี่ยนเป็น registry `ModuleWorkRegistry` | ให้โมดูลใหม่รายงานงานค้างก่อนปิดได้ |
| D-22 | 2026-10-31 | โมดูลเดิม (`subcontracting`, `workforce`, `ai-assist`, `materials`, `owner-leads`) ไม่ต้องมี entitlement | ไม่เปลี่ยนพฤติกรรมของลูกค้าที่ใช้อยู่ |
| D-23 | 2026-10-31 | env `ENTITLEMENTS=enforce|open` ค่าเริ่มต้น enforce เฉพาะ production; `testEnv()` = open | dev/test ลองโมดูลได้ไม่ต้องให้สิทธิ์ |
| D-24 | 2026-10-31 | platform admin = อีเมลใน env `PLATFORM_ADMIN_EMAILS` | ยังไม่มีแนวคิด platform admin ในโค้ด; admin panel แยก repo (docs/admin) ยังไม่ทำ |
| D-25 | 2026-10-31 | UI แสดงปี ค.ศ. เสมอ; เอกสารพิมพ์ภาษาไทยเลือก พ.ศ. ได้ (`document_year_style`); เลขเอกสารค่าเริ่มต้นใช้ปี ค.ศ. | ตามกติกาเดิมในโค้ด (`-u-ca-gregory`) และเปิดทางให้บริษัทที่ใช้ พ.ศ. |
| D-26 | 2026-10-31 | หนึ่งโครงการมีสัญญาหลักที่มีผลได้หนึ่งฉบับ (v1) | ง่ายต่อ baseline/cost code; หลายสัญญาต่อโครงการทำภายหลัง |
| D-27 | 2026-10-31 | เอกสารพิมพ์ทำผ่าน route group `(print)` + `PrintFrame` และพิมพ์จากเบราว์เซอร์ | ไม่มี PDF ฝั่ง server เหมือนโมดูลจ้างช่วง |
| D-28 | 2026-10-31 | ลบโครงการ/workspace ไม่ได้เมื่อมีเอกสารที่ออกเลขแล้วหรือมี `fin_events` | ข้อกำหนดเก็บเอกสารภาษี |
| D-29 | 2026-10-31 | ต้นทุนค่าแรงจริง: มาจากใบลงเวลาเมื่อ `labour` active ไม่งั้นประมาณจากรายงานประจำวัน (crew daily cost) | กันนับซ้ำ |
| D-30 | 2026-10-31 | ERP ไม่เขียน project docs ของ planning; S-curve จริงคำนวณแยกใน job-cost | กันชนกับ sync engine และเครื่องคำนวณเดิม |
| D-31 | 2026-10-31 | ราคาขายใบเสนอราคา: `sellFactor = 1 + markup + overhead + profit` (บวกกันเป็นสัดส่วนต้นทุน) | อธิบายง่ายกับผู้รับเหมา; CashFlow เดิมใช้ factor 1.3 แบบเดียวกัน |
| D-32 | 2026-10-31 | เอกสารออกเป็นภาษาเดียวต่อฉบับ (`th` หรือ `en`) ไม่มีแบบสองภาษาในหน้าเดียว v1; 50 ทวิ เป็นภาษาไทยเสมอ | ลดความซับซ้อน; แบบฟอร์มกรมสรรพากรเป็นภาษาไทย |
| D-33 | 2026-10-31 | ใบแจ้งหนี้เงินล่วงหน้าสร้างด้วยปุ่มใน billing ไม่สร้างอัตโนมัติตอนเซ็นสัญญา | main-contracts (WP-26) ถูกสร้างก่อน billing และห้าม import ข้ามโมดูล |
| D-34 | 2026-10-31 | PromptPay QR ใช้ npm `qrcode@1.5.4` ฝั่งเว็บ | ไม่มีไลบรารี QR ใน repo |
| D-35 | 2026-10-31 | (ทบทวนแล้ว) **ไม่แก้** `fmtDate` ของสัญญาจ้างช่วง (`src/features/subcontracting/contracts/logic.ts`) ที่ใช้ปี พ.ศ. | คอมเมนต์ในโค้ดเขียนผลเป็น `30 ต.ค. 69` (พ.ศ.) และ `contract-template.ts` มีเทสต์ล็อก `26 ตุลาคม 2569` = ตั้งใจใช้ พ.ศ. ในเอกสารสัญญา; เจ้าของไม่ได้สั่งเปลี่ยน และงาน ERP ห้ามเปลี่ยนพฤติกรรมโมดูลเดิม กติกา ค.ศ. ใช้กับหน้าจอ ERP ใหม่เท่านั้น |
| D-36 | 2026-10-31 | เรียงลำดับ WP ใหม่และเลขใหม่ (WP-01…WP-56): i18n (WP-01) และไลบรารีเงิน (WP-02) มาก่อน; แยก UI kit/nav registry/กรอบพิมพ์เป็น WP-06 ก่อนหน้าจอ ERP ตัวแรก; แยก platform admin (WP-07), baseline web (WP-19), กระแสเงินสด (WP-47), รอบจ่าย/50 ทวิ (WP-50) | ทบทวนแผน: เดิมหน้าจอ ERP (อนุมัติ เลขเอกสาร บริษัท ลูกค้า) ถูกสร้างก่อน UI kit และก่อน i18n ส่วน WP-01/14/43/45 เดิมใหญ่เกินหนึ่ง context |
| D-37 | 2026-10-31 | หลังล็อก baseline ห้ามแก้ doc `journey` ด้วย (นอกจาก `calc:*`, `boq:*`) | การข้ามงาน "ไม่มีในโครงการนี้" ใน `journey` ทำให้ปริมาณ BOQ เปลี่ยน (`computeProject` → `skippedWork`) |
| D-38 | 2026-10-31 | "มัดจำ" ในแม่แบบงวด = งวดงาน `trigger:'signing'` (ส่วนหนึ่งของมูลค่าสัญญา) ไม่ใช่เงินล่วงหน้าที่หักคืน (`advancePct`) | แม่แบบบ้าน "มัดจำ 20% + 8×10%" รวม 100% จึงต้องเป็นงวดงาน; เงินล่วงหน้าของงานราชการ/พาณิชย์หักคืนตามสูตร A |
| D-39 | 2026-10-31 | ราคาขายต่อ cost code = `allocate(original_value, sell_amount ของบรรทัดใบเสนอราคา)` สูตรเดียวทุกรูปแบบ; ตอนเซ็นถ้ายังไม่มี baseline ให้ล็อกจาก `boq_version_id` ของใบเสนอราคาที่รับ | ให้ Σ `contract_amount` = มูลค่าสัญญาพอดีแม้มีส่วนลด/ปัดเศษ และบรรทัดใบเสนอราคาตรงกับ baseline |
| D-40 | 2026-10-31 | ใบเสนอราคาราชการ (Factor F รวม VAT): แยกฐานไม่รวม VAT ด้วย `splitVatInclusive(grandTotal)` เพื่อใช้เป็นมูลค่าสัญญา | สัญญาและงวดเบิกคิด VAT แยกเสมอ (`mc_contracts.original_value` ไม่รวม VAT) |
| D-41 | 2026-10-31 | VO `billing='next_claim'` ใช้ได้เฉพาะสัญญาแบบ progress; สัญญาแบบงวดต้องเลือก `spread` หรือ `separate_milestone` | สูตร W ของ milestone mode = ยอดงวด จึงไม่มีที่ใส่ยอด VO โดยไม่มีงวด |
| D-42 | 2026-10-31 | ใบเสร็จหนึ่งใบรับได้หลายใบแจ้งหนี้ของลูกค้าเดียว และออก TI หนึ่งใบต่อใบแจ้งหนี้ (`ar_receipts.tax_invoice_ids`) | `ar_invoices.related_invoice_id` ชี้ใบแจ้งหนี้ต้นทางได้ใบเดียว |
| D-43 | 2026-10-31 | ค่าแรงงวด 15 วันจ่ายในโมดูล labour ได้เมื่อ `payables` ปิด; เมื่อ `payables` เปิด จ่ายผ่านบิล `kind='labour'` ในรอบจ่าย (กันจ่ายซ้ำด้วย `PayPeriodBillChecks`) | ข้อกำหนดโมดูล 8 "labour → payment runs" และ release ทีละโมดูลต้องใช้ได้ทั้งสองแบบ |
| D-44 | 2026-10-31 | รอบจ่าย v1 จ่ายบิลเต็มยอดคงเหลือเท่านั้น (ไม่แบ่งจ่าย) | ลดความซับซ้อนของ WHT/50 ทวิ ต่อการจ่ายบางส่วน |
| D-45 | 2026-10-31 | บทบาทใหม่ (pm/purchasing/accounting/foreman) แสดงในหน้าสมาชิกเฉพาะเมื่อ `project-hub` active; `isReadOnly` ของ BOQ ใช้ `can(role,'projects.edit')` | release 1 ต้องเหมือนเดิม; บทบาทใหม่ส่วนใหญ่ไม่มีสิทธิ์แก้ BOQ |
| D-46 | 2026-10-31 | รหัสโครงการ (docType `project`) ไม่นับใน guard ห้ามลบโครงการ | ไม่ใช่เอกสารภาษี; ไม่งั้นโครงการที่แค่ออกรหัสจะลบไม่ได้ |
| D-47 | 2026-10-31 | ประวัติราคาผู้ขายเป็น endpoint ของ procurement (WP-39) ไม่ใช่ suppliers | `pc_order_lines` เป็นของโมดูล procurement ห้ามโมดูลอื่น query ตรง |
| D-48 | 2026-10-31 | ลิงก์ลูกค้า: ใบเสนอราคา = รับ/ขอแก้/ปฏิเสธ; VO = รับ/ปฏิเสธ; ใบแจ้งหนี้ = ดูอย่างเดียว | ขอแก้ VO = ปฏิเสธพร้อมหมายเหตุแล้วทำ VO ใหม่ |
| D-49 | 2026-10-31 | แผนเงินสดรวบรวมผ่าน registry `CashPlanSources` (แต่ละโมดูลคืนรายการของตัวเอง) | job-cost ห้าม query ตารางโมดูลอื่น และ payables ถูกสร้างหลัง job-cost |
| D-50 | 2026-10-31 | หน้า `/workspace/modules` ไม่แสดงโมดูล ERP ที่เซิร์ฟเวอร์ไม่ได้เปิด (`available=false`) | release 1 ต้องไม่เผยโมดูลที่ยังไม่ขาย |
| D-51 | 2026-10-31 | `quotations` dependsOn `boq-control` (เดิม `project-hub`) | ใบเสนอราคาสร้างจาก `boq_version_lines` ที่มีเฉพาะเมื่อ `boq-control` active |
| D-52 | 2026-10-31 | (WP-01) `amountInWords(v, locale)` ยังไม่อยู่ใน `src/i18n/format.ts`; WP-02 เพิ่มหลังสร้าง `amountInWordsEn` (th = `bahtText` เดิม) | `src/domain/money/amount-in-words.ts` เป็นของ WP-02 ห้ามทำล่วงหน้า (README §2 ข้อ 1) |
| D-53 | 2026-10-31 | (WP-01) `src/i18n/request.ts` import ข้อความ th/en แบบ static แทน dynamic import ตามภาษา (แบบใน 03 §2 ข้อ 2) | type-safe และไม่ต้องพึ่ง dynamic import ฝั่ง server; ขนาด bundle ฝั่ง client ไม่เปลี่ยน (ส่งเฉพาะภาษาปัจจุบันผ่าน `getMessages()`) |
| D-54 | 2026-10-31 | (WP-01) `/me` คืน `locale` ระดับบนสุด (`meResponseSchema.locale` optional); `PATCH /me/preferences {locale}` คืน `UserPreferences` (`{locale}`); `USER_LOCALES`/`userLocaleSchema` อยู่ใน `src/shared/contract/auth.ts` | แผนเขียน "`GET /me` คืน `locale`" และ `CloudRuntime` อ่าน `me.locale`; optional เพื่อให้เว็บอ่านคำตอบของ server รุ่นเก่าได้ |
| D-55 | 2026-10-31 | (WP-01) ผลข้างเคียงที่ยอมรับ: `<html lang>` เป็น `th` เมื่อไม่มี cookie (เดิม hard-code `en`); `VendorShell` ได้ antd locale ไทย (เดิมไม่ได้ตั้ง จึงเป็นอังกฤษของ antd เช่น `OK`/`No data`) | ตามขอบเขต WP-01 ที่ระบุให้ใส่ `useAntdLocale()` ใน vendor shell; ข้อความที่ผู้ใช้เห็นของหน้าจอเดิมไม่เปลี่ยน (ปุ่มยืนยันใน vendor ตั้ง `okText`/`cancelText` เองอยู่แล้ว) |
| D-56 | 2026-10-31 | (WP-01) ปุ่มสลับภาษาใน vendor shell และหน้า login/register (03-i18n §2 ข้อ 8) ยังไม่ทำ — WP-01 ทำเฉพาะ AccountMenu ตามขอบเขต | ขอบเขตของ WP-01 ระบุแค่ AccountMenu; vendor/login เป็นหน้าจอเดิมที่ยังเป็นไทยทั้งหมด ให้ track I (I-01, I-14) เพิ่มพร้อมย้ายข้อความ ด้วย `useAppLocale().setLocale` |
| D-57 | 2026-10-31 | (WP-01 review) `setLocale` ขณะล็อกอิน: บันทึก `PATCH /me/preferences` ก่อน แล้วจึงเขียน cookie + `router.refresh()`; บันทึกไม่สำเร็จ → ไม่เปลี่ยนอะไรเลย (คืน `false`, เมนูแสดง `account.languageSaveFailed`) | 03 §2 ข้อ 4 เรียง cookie → PATCH → refresh แต่โปรไฟล์ชนะ cookie (`CloudRuntime`) จึงทำให้ภาษาที่บันทึกไม่สำเร็จเด้งกลับเองในการโหลดครั้งถัดไป ขณะที่ข้อความเดิมบอกว่า "ใช้ได้เฉพาะเครื่องนี้" |
| D-58 | 2026-10-31 | (WP-02) `allocate(total, weights)` ปัด `total` ด้วย `round2` ก่อนแบ่ง (ผลรวม = `round2(total)` เสมอ); weight ติดลบหรือไม่ใช่ตัวเลขจำกัด → `RangeError`; `splitVatInclusive`/`vatOf` มี `rate` ค่าเริ่มต้น `THAI_VAT_RATE` และ `splitVatInclusive` ปัด gross ก่อน | เงินที่เก็บต้องผ่าน round2 อยู่แล้ว (§12.1) และ weight ติดลบเป็นบั๊กของผู้เรียก ไม่ใช่ข้อมูลผู้ใช้ |
| D-59 | 2026-10-31 | (WP-02) `addMonthsToDate` ใน `src/domain/subcontracting/claims.ts` ไม่ถูกแก้ (ไม่ delegate ไป `addMonths`); `addMonths` ใช้สูตรเดียวกันแต่ตรวจวันที่เข้มกว่า (`2026-02-30` → `RangeError`, เดิม clamp ไป 28 ก.พ.) และ `months` ต้องเป็นจำนวนเต็ม | ห้ามเปลี่ยนพฤติกรรมโมดูลจ้างช่วงเดิม (README §2 ข้อ 11) — เทสต์เทียบผลสองตัวไว้ |
| D-60 | 2026-10-31 | (WP-02) `roundQty` ใช้ `toPrecision(15)` ก่อนปัด (แบบ `bahtText`) แทน nudge `1e-7` ของ `round2`; `round2` คงสูตรเดิมตรงตัว | nudge ขนาดคงที่ไม่พอเมื่อปริมาณ ×10⁴ ใหญ่ (ulp > 1e-7) ส่วน `round2` ต้องไม่เปลี่ยนพฤติกรรม |
| D-61 | 2026-10-31 | (WP-02) `amountInWordsEn`: ไม่มีคำว่า "and" ระหว่างหลักร้อยกับหลักสิบ (ตามเกณฑ์ `… two hundred fifty …`), เลข 21–99 ใช้ขีด (`twenty-one`), ค่าติดลบ `Minus one hundred baht only` (คำถัดจาก Minus เป็นตัวเล็ก), มีแต่สตางค์ → `Twenty-five satang only`, ไม่ใช่ตัวเลขจำกัด → `''` (เหมือน `bahtText`) | เอกสารระบุแค่ตัวอย่างหลัก; เลือกรูปแบบเช็คธนาคารอังกฤษที่พบบ่อย |

### คำถามค้างถึงเจ้าของ
1. ตาราง Factor F ทางการ (กรมบัญชีกลาง) ฉบับที่ต้องการใช้ (D-12)
2. สูตรค่า K ตามประเภทงานที่ใช้บ่อย (D-13)
3. ต้องการเอกสารสองภาษาในหน้าเดียว (ไทย/อังกฤษคู่กัน) หรือไม่ (D-32)

## Handoff notes

รูปแบบ (เพิ่มต่อท้าย ห้ามแก้ของคนอื่น):

```
### WP-xx — <title> (<commit>)
- สร้าง: <ไฟล์/ตาราง/endpoint หลัก>
- migration: <เลขจริง>
- เบี่ยงจากแผน: <อะไร ทำไม> (ถ้ามีการตัดสินใจใหม่ ให้เพิ่ม D-xx ด้วย)
- WP ถัดไปต้องรู้: <สิ่งที่ไม่อยู่ในเอกสาร เช่น ชื่อ helper, ข้อจำกัด, TODO>
- ตรวจแล้ว: <คำสั่งที่รันและผล>
```

### WP-01 — i18n foundation (locale, format, parity, lint) (3adace6)
- สร้าง (web): `src/i18n/request.ts` (cookie `NEXT_LOCALE` → locale), `config.ts` (`resolveLocale`, `isLocale`, `LOCALE_COOKIE`), `locale-cookie.ts` (`readLocaleCookie`/`writeLocaleCookie`), `global.d.ts` (คีย์ข้อความ type-safe), `LocaleProvider.tsx` (`useAppLocale()` → `{locale, setLocale}` โดย `setLocale` คืน `Promise<boolean>` = บันทึกโปรไฟล์สำเร็จไหม; `useAntdLocale()`), `format.ts`, `useFormat.ts`, `document-translator.ts`, `src/features/cloud/api/error-message.ts` (`useErrorMessage()`, `errorMessage(t, e)`, `errorReason(details)`, type `ErrorsTranslator`)
- namespace ใหม่: `errors` (`unknown`, `codes.*` ครบทุก `ERROR_CODES` + `network_error`/`invalid_response` — ไทยตรงกับ `thaiErrorMessage`, `reasons.*` 10 ตัวจาก 01 §1.5), `enums` `{}`, `shell`, `account` (สำเนาข้อความไทยเดิมของเมนูบัญชีแบบตรงตัว เตรียมให้ I-01 ใช้ + `account.language`, `account.languageSaveFailed`), `documents` `{}`; `app` เพิ่ม `metaTitle`/`metaDescription`/`vendorMetaTitle`/`vendorMetaDescription`
- root layout: async, `<html lang={locale}>`, `NextIntlClientProvider` (server) ครอบ `LocaleProvider`, `generateMetadata`; `(vendor)/layout.tsx` ใช้ `generateMetadata`; `next.config.ts` ครอบ `createNextIntlPlugin`
- `AppLayoutUI` และ `VendorShell` ใช้ `locale={useAntdLocale()}`; `dayjs.locale(...)` ถูกเรียกระหว่าง render ใน `useAntdLocale` (ไม่ใช่ระดับโมดูลแล้ว)
- AccountMenu: กลุ่ม "ภาษา / Language" (`account.language`, รายการ `common.thai`/`common.english`) แสดงเมื่อ `NEXT_PUBLIC_LANGUAGE_SWITCH === '1'` เท่านั้น; หลังสลับ invalidate `qk.me` (กัน `CloudRuntime` ตั้ง cookie กลับเป็นค่าเก่า); บันทึกโปรไฟล์ไม่สำเร็จ → `message.warning`
- `CloudRuntime`: เมื่อ `me.locale` ≠ cookie → เขียน cookie + `router.refresh()` (โปรไฟล์ชนะ)
- backend: `users.locale` (`text not null default 'th'` + check `users_locale_check`), `User.locale`/`withLocale`, `UserRepository.setLocale` (drizzle + in-memory), `UpdatePreferencesUseCase` (+ spec), `PATCH /me/preferences` ใน `me.controller.ts`, `toMeResponse` ใส่ `locale`; e2e `test/e2e/auth.e2e-spec.ts` เพิ่ม 2 เคส
- ESLint: block ห้ามอักษรไทย (`no-restricted-syntax` error, `[\u0E00-\u0E7F]` = `[฀-๿]`) ท้าย `eslint.config.mjs` ก่อน `globalIgnores` ตาม glob ในแผน (ลองแล้ว: ไฟล์ทดลองใต้ `src/features/erp/` error 3 จุด, ไฟล์เดิมนอก glob ไม่โดน)
- parity: `node scripts/i18n/check-parity.mjs [dir]` (export `checkParity`, `compareMessages`, `leafKeys`, `loadMessages`); `src/i18n/__tests__/parity.test.ts` ตรวจทั้งไฟล์ JSON, `index.ts` ทั้งสองภาษา และ `errors.codes` ครบทุก `ERROR_CODES`; `src/i18n/__tests__/format.test.ts` ครอบเกณฑ์รับงานของ format
- migration: `0006_wp01_user_locale` (ตรงตามที่คาด) → WP ถัดไปที่แก้ schema ได้ `0007_*`
- เบี่ยงจากแผน: D-52 (`amountInWords` ไป WP-02), D-53, D-54, D-55, D-56
- WP ถัดไปต้องรู้:
  - **namespace ใหม่ต้องเพิ่มทั้ง `messages/th/index.ts` และ `messages/en/index.ts`** (parity test เทียบ index ด้วย); ไฟล์ JSON ว่าง `{}` ผ่าน parity ได้
  - คีย์แบบ dynamic (เช่น `` te(`quotationStatus.${s}`) ``) ต้อง cast เป็นชนิดคีย์ ดูตัวอย่าง `ErrorKey` ใน `error-message.ts`; ใช้ `t.has(key)` ก่อนถ้าค่าอาจไม่มีคีย์
  - เอกสารพิมพ์: `documentTranslator(doc.language)` (ตอนนี้ `documents` ว่าง → WP-06 เติม `documents.common.*`); วันที่บนเอกสาร `formatDocumentDate(date, doc.language, companyYearStyle)`
  - `format.ts` คืน `''` สำหรับค่าที่ไม่ใช่ตัวเลข/วันที่ที่ถูกต้อง (`'2026-02-30'` → `''`); วันที่ `YYYY-MM-DD` ไม่แปลงโซน, ISO/Date แสดงเวลา Bangkok; ใช้ `formatToParts` จึงไม่ขึ้นกับรุ่น ICU (ไม่มี "พ.ศ." แทรก)
  - WP-16 เพิ่มเงื่อนไข `project-hub` active ให้ `LANGUAGE_SWITCH` ใน `AccountMenu.tsx` (D-16)
  - root layout อ่าน cookie จึงเรนเดอร์แบบ dynamic ทุกหน้า (ไม่มี static prerender แล้ว) — ยอมรับตามสถาปัตยกรรม 03 §2
  - สภาพเครื่อง: `node_modules` ที่ root ไม่ตรง lockfile (zod 4.3.6, ไม่มี vitest) และ `backend/node_modules` ไม่มีเลย จึงรัน `npm ci` (root) และ `npm ci --ignore-scripts` (backend) จาก lockfile เดิม ไม่มีไฟล์ที่ track เปลี่ยน; `tsc -p tsconfig.json` ยังรายงาน error ใน `.next/types/validator.ts` / `.next/dev/types/validator.ts` (ไฟล์ generate เก่าที่ชี้หน้าที่ถูกลบไปแล้ว ไม่เกี่ยวกับโค้ด) — กรองด้วย `grep -v '^\.next/'` หรือลบโฟลเดอร์ `.next` ก่อนตรวจ
- ตรวจแล้ว: `npx tsc --noEmit -p backend/tsconfig.json` ผ่าน; `npx tsc --noEmit -p tsconfig.json` ผ่าน (นอกจาก `.next/*` เก่า); eslint ไฟล์ที่แก้ทั้ง backend/web ผ่าน 0 error; `node scripts/i18n/check-parity.mjs` exit 0 (ลบคีย์ en หนึ่งตัวในสำเนา → exit 1); `npx vitest run src/i18n src/features/cloud/api` 16 ผ่าน; `cd backend && npx jest src/modules/identity` 188 ผ่าน; `npx jest --config test/jest-e2e.config.js test/e2e/auth.e2e-spec.ts` 21 ผ่าน; `next dev` ชั่วคราว: ไม่มี cookie → `<html lang="th">` + title/เมนู/footer ไทยเดิม; `NEXT_LOCALE=en` → `<html lang="en">`, title และเมนู `nav` อังกฤษ (ปิด server แล้ว)
- review (fix(erp): WP-01 review fixes): `setLocale` บันทึกโปรไฟล์ก่อน ไม่สำเร็จ = ไม่เปลี่ยน (D-57) + ข้อความ `account.languageSaveFailed` ใหม่; `shell.openMenu` ("เปิดเมนู" ไม่มีในโค้ดเดิม) → `shell.menu` = `เมนู` ตรงกับ `aria-label` เดิมที่ Robot ใช้เป็น locator; `formatDate` en แสดง `Sep` เสมอ (ICU ≥ 72 ของ en-GB ให้ `Sept`) — ตรวจ: tsc ทั้งสองฝั่งผ่าน, eslint ผ่าน, parity ผ่าน, vitest `src/i18n src/features/cloud/api` 16 ผ่าน, `next build` ผ่าน (ทุก route เป็น dynamic ตามคาด; `.next` ถูกสร้างใหม่ error `.next/types` เก่าหายแล้ว), ลอง probe ไฟล์ใต้ `(app)/hub`, `(print)`, `(app)/workspace/numbering` → eslint จับไทยครบ (ลบ probe แล้ว)

### WP-02 — ไลบรารีเงิน ภาษี วันที่ (COMMIT_HASH)
- สร้าง: `src/domain/money/money.ts` (`MONEY_MAX`, `round2`, `roundQty`, `sumMoney`, `pctOf`, `allocate`), `tax.ts` (`THAI_VAT_RATE`, `vatOf`, `splitVatInclusive` → `VatSplit`, `whtOf`, `WHT_PRESETS`, `WhtPresetKey`, `WHT_PRESET_KEYS`), `amount-in-words.ts` (`amountInWordsEn`), `index.ts`; `src/domain/dates/business-date.ts` (`bangkokToday`, `isBusinessDate`, `addDays`, `addMonths`, `daysBetween`, `compareDates`, `payPeriodOf`, type `PayPeriod`); `src/domain/erp/tax-id.ts` (`isThaiTaxId`); `amountInWords(value, locale)` ใน `src/i18n/format.ts` (th = `bahtText`, en = `amountInWordsEn`) ตาม D-52
- `src/domain/subcontracting/snapshot.ts` import + re-export `round2` จาก `../money/money` (สูตรเดิมตรงตัว; เทสต์ยืนยันว่าเป็นฟังก์ชันเดียวกัน)
- เทสต์: `src/domain/money/__tests__/{money,tax,amount-in-words}.test.ts`, `src/domain/dates/__tests__/business-date.test.ts`, `src/domain/erp/__tests__/tax-id.test.ts`, เพิ่มเคส `amountInWords` ใน `src/i18n/__tests__/format.test.ts`
- migration: ไม่มี (WP ถัดไปที่แก้ schema ยังได้ `0007_*`)
- เบี่ยงจากแผน: D-58, D-59, D-60, D-61
- WP ถัดไปต้องรู้:
  - backend import ผ่าน alias `@contrack/domain/money` / `@contrack/domain/dates/business-date` / `@contrack/domain/erp/tax-id` (มีใน `backend/tsconfig.json` และ jest `moduleNameMapper` แล้ว); ไฟล์เหล่านี้ pure ไม่มี dependency
  - ฟังก์ชันวันที่ทุกตัว (ยกเว้น `isBusinessDate`/`bangkokToday`) โยน `RangeError` เมื่อวันที่ไม่ถูกต้อง — ตรวจ input ด้วย `businessDateSchema` ก่อนเรียก; `daysBetween(a, b)` = b − a (บวกเมื่อ b หลัง a); `compareDates` ใช้เป็น comparator ของ `sort` ได้
  - `addDays`/`addMonths` รับจำนวนเต็มเท่านั้น
  - `WHT_PRESETS` เป็น `as const` ใช้ `WHT_PRESET_KEYS` ทำ `z.enum` ได้
  - `amountInWords` ยังไม่อยู่ใน `useFormat()` (เอกสารพิมพ์ใช้ภาษาเอกสาร ไม่ใช่ภาษา UI — เรียก `amountInWords(v, doc.language)` ตรง ๆ)
- ตรวจแล้ว: `npx vitest run src/domain/money src/domain/dates src/domain/erp src/domain/subcontracting src/i18n` 100 ผ่าน; `npx tsc --noEmit -p tsconfig.json` ผ่าน; `npx tsc --noEmit -p backend/tsconfig.json` ผ่าน; eslint ไฟล์ที่แก้ผ่าน; `cd backend && npx jest src/modules/subcontracting/contracts` 106 ผ่าน
