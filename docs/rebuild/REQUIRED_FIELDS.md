# Required fields per step (decision, 2026-10-26)

## Rule
A value is **required** only if leaving it empty makes the BOQ silently wrong (an element with a size but no count
costs 0 baht; a wall with a length but no height has no area). Everything else is optional:
- prices, waste %, ratios, standard bar sizes and spacings — they already have Excel standard values;
- descriptive text (address, owner, notes) — it does not change any amount;
- work that many houses do not have — the step is **optional** and can be marked "ไม่มีในโครงการนี้" instead.

Two kinds of requirement:
1. **At least one item** in steps every house has (footings, columns, walls, roof …).
2. **Complete rows**: once a row/card exists, its few key values must be filled (no half-filled rows that cost 0).

How it behaves (UX):
- Required labels carry a small `*`. Nothing turns red before the user tries to finish the step.
- "ยืนยันและไปขั้นตอนถัดไป" stays clickable; if something required is missing, it shows the short list
  ("ยังต้องกรอก 2 รายการ: ฐานราก F2 — จำนวน …") and highlights those fields instead of moving on.
- Optional steps keep "ไม่มีในโครงการนี้" as the honest way out. Steps already marked done stay done.
- The sample house meets every requirement (tested), so it can be completed as before.

## Decisions
| Step | Required | Optional (why) |
|---|---|---|
| ข้อมูลโครงการ | ชื่อโครงการ (heads the BOQ document) | สถานที่, เจ้าของบ้าน, ผู้จัดทำ, วันที่ |
| ตรวจสอบที่ดิน | — | everything (standard lump sum; checklist is a record) |
| รื้อถอน *(optional step)* | each item with a quantity has a rate | — |
| ถมดิน *(optional step)* | กว้าง, ยาว, ความสูงถม | settlement %, material |
| น้ำ-ไฟชั่วคราว | — | distances / points (standard box is counted anyway) |
| แคมป์คนงาน | — | room counts (0 is valid: no camp) |
| วางผัง / ปักหมุด | — | points, stakes (lump sum is counted) |
| เสาเข็ม *(optional step)* | ชนิด, ขนาด, ความยาว, จำนวนต้น | spec text, price (standard) |
| ฐานราก | ≥ 1 ฐานราก; each: กว้าง, ยาว, หนา, จำนวน, ความลึกหลุม | bars (standard sizes), sand / lean |
| เสาตอม่อ | each: ฐานที่วาง, กว้าง, ยาว, สูง, จำนวน | bars |
| คานคอดิน | ≥ 1 คาน; each: กว้าง, ลึก, ความยาวรวม | bars, lean |
| พื้นหล่อในที่ | ≥ 1 แผ่น; each: กว้าง, ยาว, หนา | bars, fill / sand |
| พื้นสำเร็จรูป *(optional)* | each: กว้าง, ยาว | shear key, topping |
| เสาชั้น 1 | ≥ 1 เสา; each: จำนวน, กว้าง, ยาว, สูง | bars |
| คานดาดฟ้า / คานหลังคา | ≥ 1 คาน; each: กว้าง, ลึก, ความยาวรวม | bars |
| พื้นดาดฟ้า *(optional)* | each: กว้าง, ยาว, หนา | bars |
| บันได *(optional)* | each: กว้าง, จำนวนขั้น | riser / tread / bars (derived or standard) |
| เพลทหัวเสา | — | count (0 valid for a concrete roof) |
| วัสดุมุงหลังคา | พื้นที่หลังคา (แปลน), ความชัน | per-material lengths |
| โครงหลังคา | — | (derived from roofing; lengths optional) |
| ประตู-หน้าต่าง | ≥ 1 ช่องเปิด; each: กว้าง, สูง, จำนวน | wall part / brick (deduction only) |
| ก่ออิฐ | ≥ 1 ผนัง; each: ความยาว, ความสูง | brick type (standard) |
| ฉาบปูน | — | (derived from walls) |
| ท่อร้อยสายไฟ | ≥ 1 วงจร; each: ระยะท่อเมน | points, drops |
| สายไฟ | every circuit with conduit has its cable size chosen | — |
| ตู้ควบคุมไฟฟ้า | ≥ 1 รายการ | — |
| อุปกรณ์ไฟฟ้า | ≥ 1 รายการ | — |
| ท่อน้ำทิ้ง | at least one run length | extra runs |
| ท่อน้ำดี | at least one run length | extra runs |
| อุปกรณ์ระบบสุขาภิบาล | — | (septic tanks etc. vary) |
| สุขภัณฑ์ | ≥ 1 รายการ | — |
| ฝ้าเพดาน | ≥ 1 ห้อง; each: ชนิดฝ้า, กว้าง, ยาว | paint group |
| ปูกระเบื้องพื้น | ≥ 1 ห้อง; each: ชนิด, กว้าง, ยาว | — |
| กระเบื้องห้องน้ำ | each bathroom row: its sizes | openings |
| ตกแต่งผนัง *(optional)* | each row: its length / size | — |
| ทาสี | — | (derived; choices have defaults) |
| งานเบ็ดเตล็ด | — | everything |
