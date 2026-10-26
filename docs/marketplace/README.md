# ConTrack — เครือข่ายจัดหา (Procurement) : สารบัญแผน

| ไฟล์ | เนื้อหา | สถานะ |
|---|---|---|
| [00-business-scope-brainstorm.md](00-business-scope-brainstorm.md) | สโคปธุรกิจรวม 3 โมดูล, วงการจริง, คู่แข่ง, โมเดลรายได้, GTM | brainstorm — เจ้าของระบบเห็นชอบ 26 ต.ค. 2026 |
| [01-module1-subcontracting-plan.md](01-module1-subcontracting-plan.md) | **โมดูล 1 หาผู้รับเหมาช่วง** — ออกแบบสมบูรณ์ทั้งฝั่งผู้รับเหมาหลักและฝั่งซับ + data model + API + แผนส่งมอบ | **แผนพร้อมทำ** (ยังไม่เริ่มโค้ด) |
| [02-module2-materials-plan.md](02-module2-materials-plan.md) | โมดูล 2 หาร้านวัสดุ / ขอราคาวัสดุ | แผนระดับกลาง — ทำหลังโมดูล 1 |
| [03-module3-owner-plan.md](03-module3-owner-plan.md) | โมดูล 3 เจ้าของงานหาผู้รับเหมาหลัก | แผนระดับกลาง — ทำหลังโมดูล 2 |

## ข้อกำหนดร่วมทุกโมดูล

### 1. ทุกโมดูลเปิด-ปิดได้ (module feature flags)
เจ้าของระบบต้องการให้ "วันหนึ่งปิดโมดูล 1 แล้วใช้แค่ BOQ estimation ธรรมดาได้" ดังนั้น:

- โมดูลคือหน่วยที่ **เปิด-ปิดได้ 2 ชั้น**
  1. **ระดับระบบ (platform)** — ตัวแปรสภาพแวดล้อมฝั่ง server `MODULES_ENABLED=subcontracting,materials,owner-leads` (ค่าว่าง = BOQ อย่างเดียว) ปิดแล้ว route ทั้งหมดของโมดูลตอบ 404 `module_disabled`, งาน background ของโมดูลไม่รัน
  2. **ระดับ workspace** — ตาราง `workspace_modules (workspace_id, module, enabled, enabled_by, enabled_at)`; owner/admin เปิด-ปิดได้ในหน้าตั้งค่า workspace; เปิดได้เฉพาะโมดูลที่ระดับระบบเปิดอยู่
- **การปิดไม่ลบข้อมูล** แพ็กเกจ/สัญญา/ประวัติยังอยู่ในฐานข้อมูล เปิดกลับมาแล้วเห็นเหมือนเดิม; ปิดตอนมีสัญญาที่ยังไม่จบ → ระบบเตือนก่อนและซับยังเห็นสัญญาที่ค้างอยู่ได้ (อ่านอย่างเดียว) เพื่อไม่ทำลายหลักฐานของอีกฝ่าย
- **ฝั่งหน้าจอ**: มี `ModuleRegistry` ตัวเดียว (`src/features/modules/registry.ts`) ที่ทุกเมนู, route guard, ปุ่มใน BOQ (เช่น "ส่งขอราคา") และ widget ถามก่อนแสดง → ปิดโมดูลแล้วหน้าจอ BOQ กลับไปเหมือนไม่เคยมีโมดูล ไม่มีปุ่มค้าง ไม่มี import รั่วเข้า bundle หลัก (โหลดโมดูลแบบ lazy)
- **ฝั่ง backend**: โมดูล NestJS ของแต่ละโมดูลธุรกิจลงทะเบียนแบบมีเงื่อนไข; ตารางของโมดูลอยู่ใน migration แยก (prefix `sc_`, `mt_`, `ol_`); โค้ด core (identity/workspaces/projects) **ไม่ import** โมดูลธุรกิจ — ทิศทางพึ่งพาเป็นทางเดียว
- **สัญญาเดียวกับ feature อื่น**: ข้อมูลของโมดูลไม่ไปอยู่ใน `project_docs` (ซึ่งเป็นของ BOQ engine) → ปิดโมดูลแล้ว `computeProject()` และ golden tests ไม่กระทบ
- flag ย่อยภายในโมดูล (เช่น `subcontracting.openBoard`, `subcontracting.lineNotify`) ใช้กลไกเดียวกัน แต่เป็นค่าใน `workspace_modules.settings jsonb`

### 2. หลักออกแบบ UI เดิมใช้ต่อ
ยึด `docs/rebuild/JOURNEY_UX.md` (restraint first) และ `docs/rebuild/DESIGN_SYSTEM.md` ทุกหน้าจอของโมดูลใหม่มี primary action เดียว ไม่ซ้ำข้อมูล สีหมายถึงสถานะเท่านั้น

### 3. ไม่แตะ engine
`computeProject()`, BOQ template, golden/oracle tests ไม่เปลี่ยนเพราะโมดูลจัดหา โมดูลอ่านผลคำนวณและ **snapshot** ไว้เป็นของตัวเอง
