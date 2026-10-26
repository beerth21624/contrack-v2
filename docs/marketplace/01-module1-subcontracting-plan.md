# โมดูล 1 — หาผู้รับเหมาช่วง ("จ้างช่วง") : แผนออกแบบฉบับเต็ม

สถานะ: **แผน รอเจ้าของระบบอนุมัติก่อนเริ่มโค้ด** (ร่าง 26 ต.ค. 2026)
ต่อจาก: [00-business-scope-brainstorm.md](00-business-scope-brainstorm.md) §3 · ข้อกำหนดร่วม (feature flag, UI, ไม่แตะ engine) ใน [README.md](README.md)

---

## 0. สรุปสำหรับผู้อนุมัติ

**สิ่งที่โมดูลนี้ทำ:** ผู้รับเหมาหลักเลือกงานจาก BOQ ที่คำนวณแล้ว → ส่งเป็น "แพ็กเกจงาน" ให้ทีมช่าง/ซับเสนอราคาทางลิงก์ (LINE/SMS) → เทียบราคากับค่าแรงใน BOQ แถวต่อแถว → ตกลงจ้าง → สัญญา งวดจ่าย เงินประกันผลงาน → เบิกงวด-ตรวจรับ-บันทึกจ่าย → ปิดงานให้คะแนน
ซับมีหน้าจอของตัวเอง: รับคำเชิญ ดูงาน เสนอราคา ติดตามสัญญาและยอดค้าง มีโปรไฟล์ทีมช่าง

**สิ่งที่ตั้งใจไม่ทำในโมดูลนี้ (รอโมดูล 2–3 หรือเฟสหลัง):** ขอราคาวัสดุ, กระดานงานเปิดสาธารณะ, ตรวจเอกสาร L2 โดยทีมงาน, ถือเงิน/escrow, e-signature, reverse auction, งานนอกบ้านพักอาศัย

**หลักที่ยึด:** ใช้ได้ตั้งแต่ผู้ใช้คนแรก (ทีมช่างของตัวเอง ไม่ต้องรอเครือข่าย) · ฝั่งซับง่ายกว่าตอบ LINE · ไม่เก็บ % จากค่าจ้าง · ปิดโมดูลได้ทั้งก้อน · ไม่แตะ BOQ engine

**ส่งมอบ 6 milestone (M0–M5) ประมาณ 14–16 สัปดาห์ สำหรับ 1 นักพัฒนาเต็มเวลา** (รายละเอียด §12) ผู้ใช้เริ่มใช้งานจริงได้ตั้งแต่จบ M2

---

## 1. ขอบเขตและสมมติฐาน

| หัวข้อ | ตัดสินใจ |
|---|---|
| ประเภทโครงการ | บ้านพักอาศัยตาม BOQ 32 หมวด (0–31) ที่ระบบมี; แพ็กเกจ "กรอกเอง" รองรับงานนอก BOQ ได้ (ไม่ลิงก์ปริมาณ) |
| ประเภทงานซับ (taxonomy) | ใช้หมวด BOQ เป็นฐาน จัดกลุ่มเป็น **ประเภทงานช่าง 12 ประเภท** (§3.2) |
| รูปแบบจ้าง | ค่าแรงอย่างเดียว / รวมวัสดุทั้งหมด / รวมวัสดุบางรายการ (เลือกต่อแถว) |
| วิธีจัดหา | จ้างตรง (direct) และ ขอราคาเทียบ (RFQ แบบปิด) — ประกาศเปิดรับ (open board) เลื่อนไปโมดูล 1.5/เฟส 2 แต่ออกแบบ data model รองรับไว้ |
| การเงิน | ระบบ **บันทึก** งวด/การจ่าย/retention ไม่ถือเงิน ไม่ออกใบกำกับภาษี; แสดงตัวเลขหัก ณ ที่จ่าย 3% และ VAT 7% เป็นข้อมูลช่วยคำนวณ (เปิด-ปิดได้ต่อสัญญา) |
| สัญญา | สร้าง PDF จากเทมเพลตภาษาไทยที่แก้ข้อความได้; ลงนามนอกระบบ; ซับกด "ยอมรับเงื่อนไข" ในระบบเป็นหลักฐานประกอบ (ไม่ใช่ e-signature ตามกฎหมาย) |
| ตัวตนของซับ | ซับ = ผู้ใช้ ConTrack ที่มี **โปรไฟล์ทีมช่าง (vendor profile)** ผูกกับ workspace ของตัวเอง → ผู้รับเหมารายหนึ่งเป็นซับให้อีกรายได้ (พบบ่อยจริง) |
| คำเชิญถึงคนที่ยังไม่มีบัญชี | ลิงก์ลงนาม (signed token) เปิดดูแพ็กเกจได้โดยไม่ล็อกอิน; **สมัครด้วยเบอร์โทร + OTP ตอนจะส่งราคา** |
| ภาษา | ไทยอย่างเดียวในเฟสนี้ (โครง next-intl มีอยู่แล้ว เผื่อภายหลัง) |
| อุปกรณ์ | ฝั่งซับ: มือถือเป็นหลัก (≥ 360 px) · ฝั่งผู้รับเหมา: เดสก์ท็อปเป็นหลัก ใช้มือถือได้สำหรับตรวจรับ/อนุมัติ |

---

## 2. ผู้ใช้และบทบาท

### 2.1 ฝั่งผู้รับเหมาหลัก (workspace เดิม)
ใช้บทบาทเดิม เพิ่ม permission ของโมดูล (ดู §10):

| บทบาท | ในโมดูลนี้ทำอะไรได้ |
|---|---|
| owner / admin | ทุกอย่าง + เปิด-ปิดโมดูล, ตั้งค่าเริ่มต้น (retention %, เทมเพลตสัญญา), ลบทีมช่างจากทะเบียน |
| estimator | สร้าง/ส่งแพ็กเกจ, ดูราคา, ต่อรอง, **เสนอ** ผู้ชนะ; ตกลงจ้าง (award) ได้เมื่อ workspace ตั้งค่า "estimator ตกลงจ้างได้" (ค่าเริ่มต้น: ต้องให้ admin/owner ยืนยัน) |
| viewer | ดูแพ็กเกจ สัญญา สถานะงวด (ไม่เห็นราคาของซับรายอื่นถ้าตั้งค่าปิด) |
| **site** (บทบาทใหม่, optional) | โฟร์แมนหน้างาน: ตรวจรับงวด ถ่ายรูป อนุมัติใบเบิกขั้นแรก ไม่เห็นราคาเทียบ — เพิ่มถ้าผู้ใช้นำร่องต้องการ (ตัดสินใจตอน M3) |

### 2.2 ฝั่งซับคอนแทรค
- **ทีมช่าง (vendor)** = workspace ที่มี `vendor profile` (ชื่อทีม, ประเภทงาน, พื้นที่, ติดต่อ) สมาชิกของ workspace นั้นทุกคนทำแทนทีมได้ตามบทบาทเดิม (owner/admin ส่งราคาและยอมรับสัญญา, estimator ร่างราคาได้แต่ส่งไม่ได้ถ้าตั้งค่าไว้, viewer ดู)
- **ผู้ติดต่อ (contact)** ที่ผู้รับเหมาจดไว้ในทะเบียน แต่ยังไม่มีบัญชี — ตอบราคาผ่านลิงก์แล้วค่อยกลายเป็น vendor เมื่อสมัคร

### 2.3 ความสัมพันธ์ข้ามผู้เช่า (cross-tenant) — หัวใจของความปลอดภัย
ระบบเดิมแยก tenant ด้วย `workspace_id` ทุกตาราง โมดูลนี้เป็นที่แรกที่ **สองผู้เช่าเห็นข้อมูลเดียวกัน** (แพ็กเกจ, ราคา, สัญญา) กติกา:
- ข้อมูลทุกแถวของโมดูลมี **เจ้าของ** = `buyer_workspace_id` (ผู้รับเหมาหลัก) และเมื่อเกี่ยวกับซับรายหนึ่งมี `vendor_workspace_id` (nullable ตอนยังเป็น guest)
- ซับเห็นเฉพาะ: แพ็กเกจที่ตนถูกเชิญ, ราคาของตนเอง, สัญญา/งวดของตนเอง, คำถาม-คำตอบสาธารณะของแพ็กเกจ **ไม่เห็น** ราคาประเมินใน BOQ ของผู้ซื้อ, ซับรายอื่น, ราคารายอื่น, ชื่อเจ้าของบ้าน (ถ้าผู้ซื้อตั้งค่าซ่อน)
- ทุก use case ตรวจสิทธิ์จาก **ทั้งสองทาง**: `WorkspaceAccess.roleOf(buyer)` หรือ `vendorAccess(invitation)` — ไม่เป็นสมาชิกฝั่งใดเลย → `notFound` (ไม่เปิดเผยว่ามีอยู่)

---

## 3. แนวคิดหลักและคำศัพท์

### 3.1 วัตถุหลัก

| คำ (ไทยในหน้าจอ) | ความหมาย |
|---|---|
| **ทะเบียนทีมช่าง** (Vendor list) | รายชื่อทีมช่าง/ซับที่ workspace ผู้รับเหมารู้จัก เป็นของ workspace นั้น (ส่วนตัว) แต่ละรายการชี้ไปยัง vendor จริงเมื่อเขามีบัญชี |
| **โปรไฟล์ทีมช่าง** (Vendor profile) | ข้อมูลสาธารณะที่ทีมช่างเป็นเจ้าของ: ชื่อ, ประเภทงาน, พื้นที่, ขนาดทีม, ผลงาน, ระดับการยืนยัน |
| **แพ็กเกจงาน** (Work package) | งานหนึ่งก้อนที่จะจ้างช่วง: รายการ+ปริมาณ (snapshot จาก BOQ), รูปแบบจ้าง, เงื่อนไข, กำหนดเวลา, งวดจ่ายที่เสนอ, ไฟล์แนบ |
| **คำเชิญ** (Invitation) | การส่งแพ็กเกจให้ทีมช่างหนึ่งราย มีลิงก์เฉพาะราย สถานะ ส่งแล้ว/เปิดดู/ปฏิเสธ/ส่งราคา |
| **ใบเสนอราคา** (Bid) | ราคาจากซับหนึ่งราย ต่อแพ็กเกจ มีหลายเวอร์ชัน แต่ละเวอร์ชันแก้ไม่ได้หลังส่ง |
| **ตารางเทียบ** (Bid leveling) | มุมมองเทียบทุกใบเสนอราคากับราคาประเมินใน BOQ |
| **การตกลงจ้าง** (Award) | ผลการเลือก: ทั้งแพ็กเกจให้รายเดียว หรือแยกแถวให้หลายราย (partial award) |
| **สัญญาจ้างช่วง** (Subcontract) | ผลจาก award + เงื่อนไขสุดท้าย: มูลค่า, งวดจ่าย, retention %, ระยะประกัน, ค่าปรับ, ข้อความสัญญา, PDF |
| **ใบเบิกงวด** (Progress claim) | ซับขอเบิกงวดตามสัญญา → ตรวจรับ → อนุมัติ → บันทึกจ่าย |
| **สมุดเงินประกันผลงาน** (Retention ledger) | ยอด retention ที่หักไว้ต่อสัญญา, กำหนดคืน, สถานะคืน |
| **การประเมิน** (Rating) | คะแนนสองทางหลังปิดสัญญา |

### 3.2 ประเภทงานช่าง (trade) — จัดกลุ่มจากหมวด BOQ

| trade id | ชื่อ | หมวด BOQ | plan task |
|---|---|---|---|
| `site-prep` | เตรียมพื้นที่ / รื้อถอน / ถมดิน / วางผัง | 1, 3, 4 | 1.2, 1.3 |
| `temp-utilities` | น้ำ-ไฟชั่วคราว | 2 | 1.1 |
| `piling` | เสาเข็ม | 5 | 1.4 |
| `structure` | โครงสร้าง ค.ส.ล. (ฐานราก ตอม่อ คาน พื้น เสา บันได) | 6–13 | 1.5–2.5 |
| `roof-structure` | โครงหลังคา + เพลทหัวเสา | 14, 15 | 3.1, 3.2 |
| `roofing` | มุงหลังคา | 16 | 3.3 |
| `masonry` | ก่ออิฐ-ฉาบปูน | 17, 18 (ยกเว้นแถวท่อ/สายไฟ) | 4.1, 5.1 |
| `electrical` | ไฟฟ้า (ท่อร้อยสาย สายไฟ ตู้ อุปกรณ์) | 17 (184–186), 18 (192–196), 26 | 4.2, 5.2, 8.1 |
| `plumbing` | ประปา-สุขาภิบาล-สุขภัณฑ์ | 27, 29 (+ ท่อน้ำดี/น้ำทิ้งในหมวด 9, 21) | 8.2, 8.4 |
| `ceiling` | ฝ้าเพดาน | 19 | 6.1 |
| `tiling` | ปูกระเบื้องพื้น/ห้องน้ำ/ตกแต่งผนัง | 20, 21, 22 | 6.2–6.4 |
| `painting` | ทาสี 3 รอบ | 23, 25, 31 | 6.5, 7.2, 8.6 |
| `doors-windows` | ประตู-หน้าต่าง อลูมิเนียม/ไม้ | 24, 30 | 7.1, 8.5 |
| `misc` | เบ็ดเตล็ด / อื่น ๆ | 28 | 8.3 |

ตาราง trade ↔ หมวด ↔ แถว อยู่ใน `src/domain/procurement/trades.ts` (ข้อมูลล้วน) ใช้ทั้งสองฝั่ง; แถวใน BOQ บางแถวสังกัด trade ต่างจากหมวด (ท่อร้อยสายในหมวด 17 → `electrical`) จึงต้องระบุ **ระดับแถว** ไม่ใช่แค่หมวด

### 3.3 เทมเพลตแพ็กเกจ (quick start)
ชุดแถวที่พบบ่อย กดเลือกแล้วแก้ได้: "โครงสร้างทั้งหมด (5–14)", "ก่ออิฐ+ฉาบ", "ระบบไฟฟ้าทั้งหลัง", "ระบบประปา-สุขาภิบาล", "หลังคา (โครง+มุง)", "งานสถาปัตย์ภายใน (ฝ้า กระเบื้อง ผนัง สี)", "ประตู-หน้าต่าง"

---

## 4. ฝั่งผู้รับเหมาหลัก — flow และหน้าจอ

### 4.0 เส้นทางหลัก (happy path)
```
BOQ หน้ารวม ─(ปุ่ม "จ้างช่วง" บนหมวด)─► สร้างแพ็กเกจ (3 ขั้น) ─► ส่งคำเชิญ ─► รอราคา (ซับตอบผ่านลิงก์)
   ─► ตารางเทียบ ─► ต่อรอง/ตกลงจ้าง ─► สัญญา (PDF, ซับกดยอมรับ) ─► ใบเบิกงวด → ตรวจรับ → อนุมัติ → บันทึกจ่าย
   ─► ปิดสัญญา → คืน retention → ให้คะแนน
```
เมนูใหม่ในโครงการ: **จ้างช่วง** (ระหว่าง "BOQ" กับ "แผนงาน") แสดงเฉพาะเมื่อโมดูลเปิด

### 4.1 หน้า "จ้างช่วง" ของโครงการ (ภาพรวม)
- **จุดประสงค์**: เห็นในหน้าเดียวว่างานไหนจัดหาแล้ว งานไหนยัง และต้นทุนจริงเทียบประมาณการ
- **เนื้อหา**: รายการหมวด/trade ของ BOQ พร้อมสถานะ: *ยังไม่จัดหา* (เทา) · *รอราคา n/m ราย* · *ได้ราคาแล้ว* · *ตกลงจ้างแล้ว* (เขียว) · *มีปัญหา* (แดง: เลยกำหนด/ซับปฏิเสธหมด/ใบเบิกค้างอนุมัติ); คอลัมน์: ค่าแรงประเมิน (BOQ L หรือ M ถ้ารวมวัสดุ), ราคาที่ตกลง, ต่าง %, ซับ
- **แถบสรุปบน**: มูลค่า BOQ ที่ครอบคลุมด้วยสัญญาแล้ว (% และบาท), รายการต้องทำ (ใบเบิกรออนุมัติ, ราคาครบกำหนดวันนี้)
- **primary action**: "สร้างแพ็กเกจ"
- **empty state**: หนึ่งย่อหน้า + ปุ่ม "สร้างแพ็กเกจแรกจาก BOQ" + ลิงก์ "เพิ่มทีมช่างที่รู้จักก่อน"
- **ทางลัดจาก BOQ**: ปุ่มเล็ก "จ้างช่วง" ท้ายแถวหัวหมวดในหน้า BOQ (แสดงเมื่อโมดูลเปิด) → เปิดตัวสร้างแพ็กเกจโดยเลือกหมวดนั้นไว้แล้ว

### 4.2 ทะเบียนทีมช่าง (ระดับ workspace)
- **เมนู**: ตั้งค่า workspace → ทีมช่าง (หรือเข้าจากตัวเลือกผู้รับในขั้นส่งคำเชิญ)
- **รายการ**: ชื่อทีม, ประเภทงาน (chips), จังหวัด, ผู้ติดต่อ+เบอร์, สถานะบัญชี (ยังไม่มีบัญชี / มีบัญชีแล้ว ✓ / ยืนยัน L1), งานกับเราล่าสุด, คะแนนเฉลี่ยจากเรา
- **เพิ่มทีมช่าง**: ฟอร์มสั้น: ชื่อทีม*, ประเภทงาน* (เลือกได้หลาย), เบอร์โทร*, LINE ID, จังหวัด, หมายเหตุส่วนตัว (ซับไม่เห็น); หรือ **นำเข้าจาก Excel/CSV** (ชื่อ, เบอร์, ประเภท) สำหรับผู้รับเหมาที่มีรายชื่อยาว
- **เมื่อซับสมัครบัญชีจากลิงก์**: ระบบจับคู่ด้วยเบอร์โทร → รายการในทะเบียนผูกกับ vendor จริง (แสดง ✓) ข้อมูลโปรไฟล์ที่ซับกรอกเองมาแทนข้อมูลที่ผู้รับเหมาจดไว้ ยกเว้นหมายเหตุส่วนตัว
- **กฎ**: เบอร์โทรซ้ำใน workspace เดียวกัน → เตือนว่าเป็นรายเดิม; ลบรายการได้เฉพาะเมื่อไม่มีสัญญาค้าง (ซ่อนแทน)

### 4.3 สร้างแพ็กเกจ (3 ขั้น ใน drawer/หน้าเต็ม)

**ขั้น 1 — เลือกงาน**
- เลือก trade หรือเทมเพลต → แสดงแถว BOQ ที่เกี่ยวข้องเป็น checklist จัดกลุ่มตามหมวด (ติ๊กทั้งหมวดได้); แถวที่อยู่ในแพ็กเกจอื่นแล้วแสดง "อยู่ในแพ็กเกจ X" ติ๊กไม่ได้ (ยกเว้นแพ็กเกจนั้นถูกยกเลิก)
- แต่ละแถวแสดง: รายการ, หน่วย, **ปริมาณสุทธิ (E)**, ปริมาณรวมเผื่อ (H) เป็นตัวรอง, ค่าแรงประเมิน (K×basis) ทางขวา (เฉพาะผู้ซื้อเห็น)
- แถวที่ปริมาณ = 0 ซ่อนเป็นค่าเริ่มต้น (toggle "แสดงแถวปริมาณ 0")
- **เพิ่มแถวกรอกเอง** (งานที่ไม่อยู่ใน BOQ: รายการ, หน่วย, ปริมาณ) — ไม่ลิงก์ BOQ
- ปุ่มถัดไป เปิดเมื่อเลือก ≥ 1 แถว

**ขั้น 2 — รูปแบบและเงื่อนไข**
- **รูปแบบจ้าง** (choice buttons): ค่าแรงอย่างเดียว · รวมวัสดุทั้งหมด · กำหนดต่อแถว (เปิดคอลัมน์ "วัสดุโดย: เรา/ซับ" ต่อแถว)
- **ซับเสนอราคาแบบ**: ต่อหน่วยรายแถว (แนะนำ เทียบได้) · เหมารวมทั้งแพ็กเกจ · ให้ซับเลือกเอง
- **เงื่อนไขมาตรฐาน** (ค่าเริ่มต้นจากตั้งค่า workspace, แก้ได้): เงินประกันผลงาน % (5/10/กำหนดเอง), ระยะประกันผลงาน (เดือน), ค่าปรับล่าช้า (บาท/วัน หรือ % ของมูลค่า/วัน), น้ำ-ไฟ-ที่พัก-นั่งร้าน ใครจัดหา (chips), ความปลอดภัย/ประกันอุบัติเหตุ, ราคาต้องยืนถึงวันที่
- **คำถามเฉพาะงาน** (จาก trade, แก้ได้): เช่น structure: "มีวิศวกรคุมงานหน้างานไหม", electrical: "ช่างมีหนังสือรับรองความรู้ความสามารถช่างไฟฟ้าภายในอาคารกี่คน", masonry: "เคยทำงานฉาบเรียบขัดมันไหม"
- **ไฟล์แนบ**: แบบก่อสร้าง (PDF/รูป), รายการสเปก; ระบบแนบ "ใบรายการงาน" ที่ generate จากแถวที่เลือกอัตโนมัติ
- **การมองเห็น**: ซ่อนชื่อเจ้าของบ้าน/ที่อยู่ละเอียด (แสดงแค่ตำบล/อำเภอ) จนกว่าจะตกลงจ้าง — เปิดเป็นค่าเริ่มต้น

**ขั้น 3 — เวลา งวด และผู้รับ**
- **กำหนดเวลา**: ระบบเสนอวันเริ่ม-จบจาก S-Curve (task ของ trade นั้น; ถ้ายังไม่วางแผนแสดง "ยังไม่กำหนด" ให้กรอกเอง) + จำนวนวันโดยประมาณ (Man-Day T) ผู้ใช้แก้ได้
- **งวดจ่ายที่เสนอ**: ค่าเริ่มต้นตามแพ็กเกจ: 2 งวด (50/50) สำหรับงานสั้น ≤ 2 สัปดาห์, 3 งวด (30/40/30) สำหรับงานยาว; แต่ละงวดผูกกับ "เงื่อนไขส่งมอบ" ข้อความสั้น (เช่น "เทฐานรากครบ", "ฉาบเสร็จทั้งหลัง") — แก้ได้ ซับเห็นและเสนอต่างได้
- **วันปิดรับราคา** (ค่าเริ่มต้น +5 วัน) และ **ราคายืนถึง** (+30 วัน)
- **วิธีจัดหา**: *จ้างตรง* (เลือก 1 ราย → ข้ามการเทียบ ไปยืนยันราคาแล้วสัญญาเลย) · *ขอราคาเทียบ* (เลือก 2–8 ราย)
- **เลือกผู้รับ**: จากทะเบียนทีมช่าง กรองตาม trade ของแพ็กเกจและจังหวัดโครงการอัตโนมัติ; แถวละ: ชื่อ, ✓บัญชี, งานล่าสุด, คะแนน; "เพิ่มรายใหม่" inline (ชื่อ+เบอร์) ได้โดยไม่ออกจากขั้นนี้
- **ช่องทางส่ง** ต่อราย: LINE (ถ้ามี LINE ID และเชื่อม LINE OA แล้ว) / SMS / คัดลอกลิงก์ส่งเอง — ค่าเริ่มต้น "คัดลอกลิงก์" ถ้ายังไม่ตั้งค่าช่องทาง
- **ตัวอย่างก่อนส่ง**: แสดงหน้าที่ซับจะเห็น (preview) — ยืนยันว่าไม่มีราคาประเมินหลุดไป
- **primary action**: "ส่งคำเชิญ n ราย"

**กฎตอนส่ง**
- ระบบ **snapshot** แถวที่เลือก (desc, unit, qty E, H, trade, วัสดุโดยใคร) + `boqRevisionHash` ไว้ในแพ็กเกจ ตั้งแต่ตอนนี้ไม่อิง BOQ สด
- แพ็กเกจที่ยังไม่ส่ง = `draft` แก้ได้ทุกอย่าง; ส่งแล้ว = `open` แก้ได้เฉพาะ: ขยายวันปิด, เพิ่มผู้รับ, ตอบคำถาม, แนบไฟล์เพิ่ม (ทุกรายได้รับแจ้ง "มีข้อมูลเพิ่ม")
- แก้ปริมาณ/แถว หลังส่ง → ต้องออก **ฉบับแก้ไข (addendum)** = เวอร์ชันใหม่ของแพ็กเกจ ทุกรายได้รับแจ้ง ราคาที่ส่งมาแล้วถูกติดธง "อิงฉบับเก่า" ซับต้องยืนยันหรือส่งใหม่

### 4.4 หน้าแพ็กเกจ (ระหว่างรอราคา)
- หัว: ชื่อแพ็กเกจ, trade, สถานะ, วันปิดรับ (นับถอยหลัง), มูลค่าประเมิน (ผู้ซื้อเท่านั้น)
- แท็บ **ผู้รับคำเชิญ**: ตาราง ชื่อ · ช่องทาง · ส่งเมื่อ · เปิดดูเมื่อ · สถานะ (ยังไม่เปิด / เปิดดูแล้ว / ปฏิเสธ (เหตุผล) / ส่งราคาแล้ว v2) · ปุ่ม "ส่งซ้ำ" "คัดลอกลิงก์" "บันทึกราคาแทน"
- แท็บ **รายการงาน** (snapshot), **เงื่อนไข**, **ไฟล์**, **คำถาม-คำตอบ** (ซับถาม → ผู้ซื้อตอบ → ทุกรายเห็นคำตอบ แบบไม่ระบุชื่อผู้ถาม ตามมาตรฐานการประมูล)
- **บันทึกราคาแทนซับ** (manual bid entry): สำหรับซับที่โทรบอกราคา/ส่งกระดาษ — ผู้ซื้อกรอกในฟอร์มเดียวกับซับ ระบบติดป้าย "บันทึกโดยผู้ซื้อ" และส่งลิงก์ให้ซับยืนยันได้ (ไม่บังคับ) — ป้องกันปัญหาแบบ BuildingConnected
- **เตือน**: วันปิดรับผ่านแล้วแต่ได้ราคา < 2 (ในโหมดเทียบ) → เสนอ "ขยายเวลา" หรือ "เชิญเพิ่ม" หรือ "ไปต่อด้วยราคาที่มี"
- primary action เปลี่ยนตามสถานะ: *ส่งซ้ำให้คนที่ยังไม่เปิด* → *เปิดตารางเทียบ* เมื่อมีราคา ≥ 1

### 4.5 ตารางเทียบราคา (bid leveling)
- **โครง**: แถว = รายการงาน (ตาม snapshot) · คอลัมน์แรก = **ประเมิน (BOQ)** (ค่าแรง/หน่วย และรวม; ถ้ารวมวัสดุ = I+K) · คอลัมน์ต่อซับ = ราคา/หน่วย, รวม, ต่าง % จากประเมิน; แถวล่าง: รวมสุทธิ, ส่วนลด/บวกเพิ่ม, **รวมหลังปรับให้เทียบได้ (normalized)**, จำนวนวัน, เริ่มได้วันที่, จำนวนช่าง/คนงาน, ราคายืนถึง, เวอร์ชัน, ระดับยืนยัน, คะแนนเดิมจากเรา
- **การปรับให้เทียบได้ (normalize)**: แถวที่ซับไม่ตีราคา/ระบุ "ไม่รวม" → เติมด้วยราคาประเมินและแสดงเป็นตัวเอียงพร้อมป้าย "เติมด้วยประเมิน" ให้ยอด normalized เทียบกันได้; ซับที่เสนอเหมารวม → กระจายลงแถวตามสัดส่วนประเมินเพื่อแสดงเท่านั้น (ยอดจริงคือเหมา)
- **ไฮไลต์**: ต่างจากประเมิน > ±20% (ค่าตั้งได้) สีอำพัน; ต่ำกว่าประเมิน > 30% สีแดงอ่อน พร้อมข้อความ "ต่ำผิดปกติ ตรวจสโคปก่อนตกลง" — ตามหลัก restraint เป็นสีพื้นเบา ไม่มีไอคอน
- **เรียง/ซ่อน**: เรียงตามยอด normalized (ค่าเริ่มต้น), ซ่อนซับที่ปฏิเสธ
- **คะแนนรวม (optional, พับอยู่)**: น้ำหนักราคา/เวลา/ประวัติ — ค่าเริ่มต้นปิด เปิดได้ใน M4 เมื่อมีข้อมูลประวัติ
- **การกระทำ**: *ต่อรอง* (ส่งข้อความ + เสนอราคาเป้าหมายต่อแถวหรือรวม → ซับส่งเวอร์ชันใหม่), *เลือกเป็นผู้ชนะ* ทั้งแพ็กเกจ หรือ **ติ๊กรายแถว** (partial award: แถวหนึ่งให้ได้รายเดียว), *ส่งออก Excel* ตารางเทียบ
- primary action: "ตกลงจ้าง" (ใช้งานได้เมื่อเลือกผู้ชนะครบทุกแถวที่จะจ้าง; แถวที่ไม่จ้างใครกลับเป็น "ยังไม่จัดหา")

### 4.6 ตกลงจ้าง → สัญญา
- หน้า **สรุปก่อนตกลง**: ผู้ชนะ, มูลค่า, แถวที่จ้าง, เงื่อนไข, งวดจ่าย (ค่าจากแพ็กเกจ หรือที่ซับเสนอต่าง — เลือก), retention %, วันเริ่ม-จบ; ต้องการสิทธิ์ `procurement.award`
- กด **ตกลงจ้าง** → สร้าง `subcontract` สถานะ `pending_acceptance` → แจ้งซับให้ "ยอมรับเงื่อนไข"; ซับรายอื่นได้รับแจ้ง "แพ็กเกจนี้ปิดแล้ว ขอบคุณ" (ไม่บอกผู้ชนะ/ราคา); แพ็กเกจ → `awarded`
- **เอกสารสัญญา**: เทมเพลตมาตรฐาน (ภาษาไทย, ตัวแปร: คู่สัญญา, สถานที่, รายการงาน-ปริมาณ-ราคา, มูลค่า, งวด, retention, ประกันผลงาน, ค่าปรับ, การบอกเลิก, ความปลอดภัย) → แก้ข้อความใน rich-text ก่อนออก PDF (font Sarabun ตาม design system) ; เก็บเวอร์ชัน; ผู้ซื้ออัปโหลดสแกนฉบับลงนามแนบได้
- ซับกด **ยอมรับเงื่อนไข** (บันทึกเวลา, ผู้ใช้, IP, เวอร์ชันเอกสาร) → `active`; ซับขอแก้ → ส่งข้อความ ผู้ซื้อแก้แล้วส่งใหม่ (เวอร์ชัน +1)
- ยกเลิกก่อน active ได้ทั้งสองฝ่าย (ระบุเหตุผล) → แพ็กเกจกลับเป็น `open` ให้เลือกรายอื่นได้

### 4.7 งวดงาน ใบเบิก ตรวจรับ และสมุดเงินประกันผลงาน
- หน้า **สัญญา**: หัว (ซับ, มูลค่า, สถานะ), แถบความคืบหน้า = งวดที่อนุมัติแล้ว/ทั้งหมด (มีปริมาณจริงจึงใส่ได้ตามหลัก UX), ตารางงวด: งวด · เงื่อนไขส่งมอบ · % · จำนวนเงิน · retention หัก · สุทธิ · สถานะ (ยังไม่ถึง / ซับขอเบิก / ตรวจรับแล้ว / อนุมัติแล้ว / จ่ายแล้ว) · วันที่
- **ใบเบิกงวด**: ซับกดขอเบิก (แนบรูปงาน, ข้อความ) หรือผู้ซื้อสร้างแทน → ผู้ซื้อ/โฟร์แมน **ตรวจรับ** ด้วย checklist สั้นต่อ trade (เช่น structure: ระดับ-แนว, เหล็กตามแบบ, บ่มคอนกรีต; ผลเป็น ผ่าน / ผ่านมีรายการแก้ (ระบุ) / ไม่ผ่าน) → **อนุมัติ** (สิทธิ์ `procurement.approveClaim`) → **บันทึกจ่าย** (วันที่, จำนวน, ช่องทาง, อ้างอิงสลิป ไม่บังคับ)
- **การคำนวณต่อใบเบิก** (แสดงเป็นตาราง ไม่ซ่อน): มูลค่างวด → หัก retention % → (ถ้าเปิด) หักภาษี ณ ที่จ่าย 3% จากค่าจ้าง → (ถ้าซับจด VAT) +VAT 7% → ยอดจ่ายสุทธิ; ปรับยอดเพิ่ม-ลดได้พร้อมเหตุผล (งานเพิ่ม-ลด = `variation` แยกบรรทัด)
- **งานเพิ่ม-ลด (variation)**: เพิ่มแถวใหม่หรือเปลี่ยนปริมาณในสัญญาที่ active ต้องให้ทั้งสองฝ่ายยอมรับ → มูลค่าสัญญาเปลี่ยน งวดสุดท้ายปรับตาม
- **สมุดเงินประกันผลงาน**: ต่อสัญญา: หักสะสม, กำหนดคืน (ครึ่งแรกเมื่อส่งมอบ, ที่เหลือเมื่อพ้นระยะประกัน — ค่าเริ่มต้นแก้ได้), ปุ่ม "บันทึกคืน"; ระดับ workspace: หน้ารวม retention ค้างคืนทุกโครงการ พร้อมวันครบกำหนด (คุณค่าต่อฝ่ายบัญชี)
- **ปิดสัญญา**: เมื่อทุกงวดจ่ายแล้วและส่งมอบ → `completed` (retention ยังค้างได้) → ขอให้ประเมิน

### 4.8 รายงาน "ประมาณการ vs จริง"
- ต่อโครงการ: ตามหมวด: ค่าแรงประเมิน (BOQ) · ราคาสัญญา · จ่ายจริงสะสม · ต่าง; รวมทั้งโครงการ — ผลพลอยได้ที่ Builk ขายเป็นหลัก
- เขียนกลับ S-Curve: ปุ่ม "ใช้วันจริงจากสัญญา" ใส่ `actual.start/cost` ของ task (ผู้ใช้ยืนยันก่อน ไม่อัตโนมัติ เพราะเป็น project doc)

### 4.9 การแจ้งเตือนฝั่งผู้ซื้อ (in-app + อีเมล ถ้ามี)
ซับเปิดดู (ครั้งแรก), ซับส่ง/แก้ราคา, ซับปฏิเสธ, มีคำถามใหม่, ใกล้วันปิดรับ (1 วัน) และปิดรับแล้ว, ซับยอมรับสัญญา/ขอแก้, ใบเบิกใหม่รอตรวจ, retention ครบกำหนดคืน (7 วันก่อน)

---

## 5. ฝั่งซับคอนแทรค — flow และหน้าจอ (มือถือก่อน)

### 5.0 เส้นทางหลัก
```
ได้ลิงก์ทาง LINE/SMS ─► หน้าแพ็กเกจ (ไม่ต้องล็อกอิน) ─► "เสนอราคา" ─► OTP เบอร์โทร (ครั้งแรก) ─► ฟอร์มราคา ─► ส่ง
   ─► รอผล ─► ได้งาน: ยอมรับเงื่อนไขสัญญา ─► ขอเบิกงวด (แนบรูป) ─► เห็นสถานะจ่าย/retention ─► ให้คะแนนผู้ว่าจ้าง
```

### 5.1 หน้าแพ็กเกจผ่านลิงก์ (guest view)
- URL `/s/<token>` token ผูกกับคำเชิญหนึ่งรายการ อายุถึงวันปิดรับ +30 วัน (ต่ออายุได้เมื่อผู้ซื้อส่งซ้ำ)
- เนื้อหา: ชื่อผู้ว่าจ้าง (workspace), ชื่องาน, trade, อำเภอ/จังหวัด, ช่วงเวลาที่ต้องการ, รูปแบบจ้าง, **ตารางรายการ-ปริมาณ-หน่วย** (อ่านง่ายบนมือถือ: การ์ดต่อหมวด), เงื่อนไขหลัก (retention, ประกันผลงาน, ค่าปรับ, ใครจัดหาน้ำไฟ), ไฟล์แนบ (เปิดดู/ดาวน์โหลด), คำถาม-คำตอบ, **วันปิดรับ**
- ปุ่ม: **เสนอราคา** (primary), *ถามคำถาม*, *ไม่รับงานนี้* (เหตุผล 1 แตะ: คิวเต็ม / ไกล / งานไม่ตรง / อื่น ๆ)
- บันทึก "เปิดดูแล้ว" ครั้งแรกที่โหลด (แจ้งผู้ซื้อ)
- ถ้าเป็นฉบับแก้ไข: แถบบน "มีการแก้ไขเมื่อ … ดูสิ่งที่เปลี่ยน" (diff แถว/ปริมาณ)

### 5.2 สมัคร/ล็อกอินด้วยเบอร์โทร (ครั้งแรก)
- กด "เสนอราคา" → กรอกเบอร์ → OTP (SMS) → ชื่อทีม (prefill จากที่ผู้ซื้อจด) + ชื่อผู้ติดต่อ → เสร็จ (3 ช่อง) → ระบบสร้าง user (phone identity) + personal workspace + vendor profile ขั้น L0 และผูกคำเชิญกับ vendor นี้
- เบอร์ที่มีบัญชีอยู่แล้ว → OTP ล็อกอิน → ถ้าผู้ใช้อยู่หลาย workspace ที่มี vendor profile ให้เลือกทีม
- ตั้งรหัสผ่าน/อีเมลทีหลังได้ (ไม่บังคับ) เพื่อใช้ฝั่งผู้รับเหมาด้วย — **ระบบ identity เดิมต้องรองรับ phone + OTP เป็นวิธีเข้าใช้ที่สอง** (งานใน M1)

### 5.3 ฟอร์มเสนอราคา
- โหมดตามที่ผู้ซื้อกำหนด: **ต่อหน่วยรายแถว** (ช่องราคา/หน่วย ต่อแถว คีย์บอร์ดตัวเลข ยอดรวมแถวคำนวณให้ เห็นยอดรวมลอยอยู่ล่าง) / **เหมารวม** (ช่องเดียว + รายการที่รวม-ไม่รวม) / เลือกเอง
- ต่อแถว: ติ๊ก "ไม่รวม" ได้ (พร้อมเหตุผลสั้น); ถ้ารูปแบบ "วัสดุโดยซับ" แสดงช่องราคาวัสดุแยกจากค่าแรง (เพื่อให้เทียบกับ I/K ได้)
- ส่วนท้าย: ส่วนลด/บวกเพิ่มรวม, จำนวนวันทำงาน, เริ่มได้เร็วสุดวันที่, จำนวนช่าง/คนงาน, ราคายืนถึง (ค่าเริ่มต้นตามแพ็กเกจ), งวดจ่าย (ยอมรับที่เสนอ / เสนอต่าง), ตอบคำถามเฉพาะงาน, หมายเหตุ, รูปผลงานที่เกี่ยวข้อง (≤ 10)
- **บันทึกร่างอัตโนมัติ** (กลับมาทำต่อได้), **ส่ง** → ยืนยันหน้าสรุป → ส่งแล้วแก้ไม่ได้ แต่ **ส่งฉบับใหม่** ได้จนถึงวันปิดรับ (เวอร์ชัน +1, เวอร์ชันเก่าผู้ซื้อยังเห็น); **ถอนราคา** ได้ก่อนปิดรับ
- ซับไม่เห็น: ราคาประเมิน, จำนวน/ชื่อคู่แข่ง, ราคาคู่แข่ง
- ตรวจสอบเบา ๆ: ราคา/หน่วยเป็น 0 ในแถวที่ไม่ได้ติ๊ก "ไม่รวม" → เตือนก่อนส่ง (ไม่บล็อก)

### 5.4 หน้า "งานของฉัน" (inbox ของทีมช่าง)
- แท็บ: **รอเสนอราคา** (เรียงตามวันปิดรับ) · **ส่งราคาแล้ว** · **สัญญา** (กำลังทำ / รอยอมรับ / จบแล้ว) · **ประวัติ**
- การ์ดละ: ผู้ว่าจ้าง, งาน, พื้นที่, ช่วงเวลา, สถานะ, สิ่งที่ต้องทำ (ปุ่มเดียว)
- เมื่อได้รับแจ้ง "แพ็กเกจปิดแล้ว" การ์ดย้ายไปประวัติพร้อมผล: ได้งาน / ไม่ได้ / ผู้ว่าจ้างยกเลิก

### 5.5 สัญญาฝั่งซับ
- เห็นเงื่อนไขทั้งหมด + PDF; ปุ่ม **ยอมรับเงื่อนไข** / **ขอแก้ไข** (ข้อความ)
- หลัง active: ตารางงวดเหมือนฝั่งผู้ซื้อแต่มุมมองของตน: งวดถัดไป, ยอดคาดรับสุทธิ (หลังหัก retention/ภาษี), ปุ่ม **ขอเบิกงวด** (รูปงาน ≥ 1, ข้อความ), เห็นผลตรวจรับและรายการแก้, เห็น "บันทึกจ่ายแล้ว" และ **retention ค้างคืนของฉัน** พร้อมวันครบกำหนด (หลักฐานที่ซับต้องการมากที่สุด)
- งานเพิ่ม-ลด: เห็นและกดยอมรับ/ปฏิเสธ
- ถ้าผู้ซื้อปิดโมดูลขณะสัญญาค้าง: ซับยังเข้าหน้านี้ได้แบบอ่านอย่างเดียว

### 5.6 โปรไฟล์ทีมช่าง (เฟสนี้ถึง L1)
- **L0** (สร้างอัตโนมัติ): ชื่อทีม, เบอร์ (ยืนยัน), ประเภทงาน, จังหวัดที่รับงาน
- **L1** (กรอกเอง): ขนาดทีม (ช่าง/คนงาน), ผลงาน ≥ 3 รายการ (รูป, ประเภท, ปี, อำเภอ/จังหวัด), เครื่องมือหลัก (chips), อัตราค่าแรงอ้างอิงต่อหน่วยตาม trade (ไม่บังคับ; ใช้เป็นค่าตั้งต้นตอนเสนอราคา), เดือนที่ว่าง (ปฏิทินอย่างง่าย) → ครบแล้วแสดงป้าย "โปรไฟล์ครบ" ให้ผู้ซื้อเห็นในทะเบียน
- สิ่งที่ผู้ซื้อเห็นจากโปรไฟล์: เฉพาะที่ซับกรอก + สถิติจากระบบ (จำนวนสัญญาที่จบกับผู้ซื้อ **รายนั้น**; สถิติข้าม workspace รอ L3 ในเฟส 2)
- L2 (ตรวจเอกสาร) และ L3 (ประวัติข้ามผู้ซื้อ) ออกแบบช่องข้อมูลไว้ แต่ไม่ทำ UI ในโมดูลนี้

### 5.7 การแจ้งเตือนฝั่งซับ
คำเชิญใหม่, ฉบับแก้ไข/ไฟล์เพิ่ม, คำตอบคำถาม, ใกล้ปิดรับ (1 วัน), ผลการพิจารณา, สัญญารอยอมรับ, ผลตรวจรับ (ผ่าน/แก้), บันทึกจ่ายแล้ว, retention ครบกำหนดคืน
ช่องทาง: **LINE (ผ่าน LINE OA ของ ConTrack, ซับกดเพิ่มเพื่อน-ผูกบัญชีครั้งเดียว)** → SMS (เฉพาะคำเชิญ/OTP/ผล เพราะมีต้นทุน) → in-app เสมอ

---

## 6. กฎธุรกิจที่ต้องบังคับในโดเมน (ไม่ใช่แค่ UI)

1. **Snapshot ไม่เปลี่ยน**: แถว/ปริมาณในแพ็กเกจเวอร์ชันหนึ่งไม่เปลี่ยนหลังส่ง; เปลี่ยนได้เฉพาะด้วย addendum (เวอร์ชันใหม่) ซึ่งเก็บ diff
2. **ตรวจจับ BOQ เปลี่ยน**: ทุกครั้งที่เปิดแพ็กเกจ ระบบเทียบ `boqRevisionHash` ปัจจุบันกับที่ snapshot → ถ้าแถวในแพ็กเกจมีปริมาณต่าง > 0 แสดงแถบ "BOQ เปลี่ยนแล้ว n แถว — ออกฉบับแก้ไข?" (ไม่อัตโนมัติ)
3. **ซองปิด**: ก่อนวันปิดรับ ผู้ซื้อเห็นราคาทุกรายได้ทันที (ไม่ใช่การประมูลภาครัฐ) แต่ซับไม่มีทางเห็นราคากันเอง; log การเปิดดูราคาเก็บใน activity
4. **ความถูกต้องของราคา**: ราคา ≥ 0; แถวที่ไม่รวมต้องมีเหตุผล; ยอดรวม = Σ(ราคา×ปริมาณสุทธิ E) ± ปรับ (ใช้ **ปริมาณสุทธิ** เป็นฐานค่าแรงเหมือน BOQ L = K×E; แถวที่ BOQ ใช้ฐาน gross (ท่อ/สายไฟ/วงกบ) ใช้ H ตาม `labourBasis` ของแถวนั้น — snapshot เก็บ basis ไว้)
5. **เวอร์ชันราคา**: แก้ = เวอร์ชันใหม่ เวอร์ชันเก่าอ่านได้ตลอด; award อ้างอิงเวอร์ชันที่เลือกเท่านั้น
6. **ราคาหมดอายุ**: หลังวัน "ราคายืนถึง" ตกลงจ้างได้แต่ระบบขอให้ซับยืนยันราคาอีกครั้ง (สถานะ `pending_acceptance` ครอบคลุมอยู่แล้ว)
7. **Partial award**: หนึ่งแถว → ผู้ชนะได้รายเดียว; แถวที่ไม่จ้างกลับเป็นว่างและสร้างแพ็กเกจใหม่ได้; สัญญาแยกต่อผู้ชนะ
8. **สัญญาเปลี่ยนได้เฉพาะด้วย variation ที่ทั้งสองฝ่ายยอมรับ**; มูลค่าสัญญา = ราคาตกลง + Σ variation ที่ยอมรับ
9. **งวด**: Σ% = 100; ใบเบิกต่องวดมีได้ใบเดียวที่ไม่ถูกปฏิเสธ; อนุมัติต้องผ่านตรวจรับ (ผ่าน หรือ ผ่านมีรายการแก้ โดยรายการแก้ต้องปิดก่อนงวดถัดไป ค่าเริ่มต้น; ตั้งเป็น "ไม่บังคับ" ได้)
10. **Retention**: หัก = round(มูลค่างวด × %, 2); คืนได้ไม่เกินยอดสะสม; ปิดสัญญาแล้วคืนได้; ค่าปรับหักจาก retention ได้พร้อมเหตุผล
11. **ภาษี**: เป็นการแสดงผลช่วยคำนวณ ไม่ใช่เอกสารภาษี; ค่า default WHT 3% (ค่าจ้างทำของ), VAT ตามสถานะซับ (ติ๊กในโปรไฟล์)
12. **ยกเลิก**: แพ็กเกจยกเลิกได้ทุกสถานะก่อน active (ระบุเหตุผล แจ้งทุกราย); สัญญา active ยกเลิกได้ (`terminated`) ต้องระบุเหตุผล และงวดที่อนุมัติแล้วคงอยู่
13. **PDPA**: ข้อมูลโปรไฟล์ซับเป็นของซับ ผู้ซื้อได้สิทธิ์ดูผ่านคำเชิญ/ทะเบียน; ซับลบบัญชี → โปรไฟล์ถูก anonymize แต่สัญญา/ราคาที่เคยส่งคงอยู่ในรูปนิติบุคคล/ชื่อทีม ณ เวลานั้น (หลักฐานทางสัญญา)
14. **ทุกการเปลี่ยนสถานะเขียน activity** (ใคร เมื่อไร จากอะไรเป็นอะไร) ใช้ตาราง activity ของโมดูล (ไม่ใช่ `activity_log` ของโครงการ เพื่อแยกตอนปิดโมดูล)

---

## 7. สถานะ (state machines)

**WorkPackage**: `draft → open → (reviewing) → awarded → closed` · `open/reviewing → cancelled` · `open → expired` (ปิดรับแล้วไม่มีราคา; ขยายเวลา → `open`) · addendum ไม่เปลี่ยนสถานะ แต่ `version++`
**Invitation**: `sent → viewed → (declined | submitted)` · `submitted → superseded` (ถูกตัดสินแล้ว) · `sent/viewed → withdrawn` (ผู้ซื้อถอนคำเชิญ)
**Bid**: `draft → submitted → (revised = เวอร์ชันใหม่ submitted, อันเก่า superseded) | withdrawn | selected | not_selected`
**Subcontract**: `pending_acceptance → active → completed` · `pending_acceptance → cancelled` · `active → terminated` · `completed → closed` (retention คืนครบ)
**Claim**: `requested → inspected(pass | pass_with_fixes | fail) → approved → paid` · `fail → requested` (ส่งใหม่) · `requested/inspected → rejected`
**Variation**: `proposed → accepted | rejected`

---

## 8. Data model (PostgreSQL, prefix `sc_`) — ตารางของโมดูล แยก migration

ทุกตารางมี `id uuid`, `created_at`, และคอลัมน์เจ้าของ `buyer_workspace_id` (ยกเว้นตารางของ vendor) ; ชื่อย่อ: WS = workspace

```
sc_vendor_profiles        workspace_id PK(→workspaces), team_name, contact_name, phone (unique, verified_at),
                          line_user_id?, trades text[], provinces text[], crew_skilled int?, crew_labourers int?,
                          tools text[], vat_registered bool, tier ('L0'|'L1'|'L2'|'L3'), tier_updated_at,
                          availability jsonb?, created_at, updated_at
sc_vendor_portfolio       id, vendor_workspace_id, title, trade, year, district, province, photos jsonb, note, created_at
sc_vendor_documents       id, vendor_workspace_id, kind ('id_card'|'dbd'|'vat20'|'sso'|'license_elec'|'license_eng'|'insurance'),
                          file_ref, status ('uploaded'|'verified'|'rejected'), verified_by?, verified_at?, expires_at?   -- UI ใน เฟส 2

sc_vendor_list_entries    id, buyer_workspace_id, vendor_workspace_id?, display_name, phone, line_id?, trades text[],
                          province?, private_note?, hidden_at?, created_by, created_at, updated_at
                          UNIQUE(buyer_workspace_id, phone)

sc_work_packages          id, buyer_workspace_id, project_id (→projects via tenantFk), title, trade,
                          status, version int, sourcing_mode ('direct'|'rfq'|'open'), pricing_mode ('unit'|'lump'|'vendor_choice'),
                          supply_mode ('labour_only'|'with_materials'|'per_line'),
                          hide_owner_identity bool, terms jsonb (retention_pct, warranty_months, penalty, provisions[], safety, questions[]),
                          schedule jsonb (start?, finish?, days?), proposed_installments jsonb [{no, pct, condition}],
                          bid_deadline timestamptz, price_valid_until date, boq_revision_hash text,
                          estimate_total numeric(14,2)   -- ผู้ซื้อเท่านั้น
                          created_by, sent_at?, awarded_at?, closed_at?, cancelled_at?, cancel_reason?
sc_package_versions       id, package_id, version, snapshot_lines jsonb [{line_key?, section, desc, unit, qty_net, qty_gross,
                          labour_basis, material_by ('buyer'|'vendor'), est_lab_unit, est_mat_unit}], diff jsonb?, note?, created_by, created_at
                          UNIQUE(package_id, version)
sc_package_files          id, package_id, kind ('drawing'|'spec'|'generated_schedule'|'other'), file_ref, name, size, uploaded_by, created_at
sc_package_questions      id, package_id, asked_by_invitation_id, question, answer?, answered_by?, answered_at?, visible_to_all bool default true

sc_invitations            id, package_id, buyer_workspace_id, vendor_list_entry_id, vendor_workspace_id?,
                          token_hash (unique), channel ('line'|'sms'|'link'), status, sent_at, viewed_at?, declined_at?, decline_reason?,
                          withdrawn_at?, expires_at, resent_count int
sc_bids                   id, package_id, invitation_id, vendor_workspace_id?, package_version int, version int, status,
                          mode ('unit'|'lump'), lines jsonb [{line_idx, unit_price?, mat_unit_price?, excluded bool, reason?}],
                          lump_total?, adjustment numeric, adjustment_note?, total numeric(14,2), normalized_total numeric(14,2),
                          days?, earliest_start?, crew jsonb?, valid_until?, installments_proposal jsonb?, answers jsonb?, note?,
                          photos jsonb?, entered_by_buyer bool, submitted_by?, submitted_at?, withdrawn_at?
                          UNIQUE(invitation_id, version)
sc_awards                 id, package_id, buyer_workspace_id, decided_by, decided_at, allocations jsonb [{line_idx, bid_id}]

sc_subcontracts           id, buyer_workspace_id, project_id, package_id, bid_id, vendor_workspace_id, vendor_list_entry_id,
                          status, contract_no text, title, trade, lines jsonb (แถวที่จ้าง + ราคาตกลง), base_total, variations_total,
                          total numeric(14,2), terms jsonb (retention_pct, warranty_months, penalty, wht_pct?, vat bool),
                          schedule jsonb, installments jsonb [{no, pct, condition, amount}],
                          document_version int, document_html text, document_pdf_ref?, signed_scan_ref?,
                          accepted_by?, accepted_at?, accepted_ip?, activated_at?, completed_at?, closed_at?, terminated_at?, terminate_reason?
sc_variations             id, subcontract_id, proposed_by_workspace_id, lines jsonb, amount, reason, status, decided_at?, decided_by?
sc_claims                 id, subcontract_id, buyer_workspace_id, vendor_workspace_id, installment_no, status,
                          requested_by?, requested_at, photos jsonb, note?, inspection jsonb {result, checklist[], fixes[], by, at}?,
                          gross_amount, retention_amount, wht_amount, vat_amount, adjustments jsonb, net_amount,
                          approved_by?, approved_at?, paid_at?, paid_amount?, paid_channel?, paid_ref?, rejected_reason?
sc_retention_entries      id, subcontract_id, kind ('withheld'|'released'|'forfeited'), amount, claim_id?, due_at?, note?, created_by, created_at
sc_ratings                id, subcontract_id, from_workspace_id, to_workspace_id, scores jsonb {quality, time, communication | payment}, comment?, created_at
sc_activity               id bigserial, buyer_workspace_id, vendor_workspace_id?, entity ('package'|'invitation'|'bid'|'subcontract'|'claim'), entity_id,
                          action, actor_user_id, data jsonb?, at
sc_notifications          id, user_id, channel, template, payload jsonb, status ('queued'|'sent'|'failed'), sent_at?, error?

workspace_modules         workspace_id, module, enabled bool, settings jsonb, enabled_by, enabled_at   PK(workspace_id, module)
users (เพิ่ม)              phone text? (unique), phone_verified_at?   -- identity รองรับ OTP
```

**หลักการเก็บ**: ราคาและปริมาณทั้งหมดเป็น snapshot ใน jsonb ของแถวนั้น ๆ (ไม่ join กลับ BOQ) — สัญญาต้องอ่านได้ถูกต้องแม้ BOQ/โครงการเปลี่ยนหรือโมดูลถูกปิด · `file_ref` ชี้ object storage (S3-compatible) — ระบบเดิมยังไม่มี file storage → งานใน M1 · ดัชนีสำคัญ: `(buyer_workspace_id, project_id)`, `(vendor_workspace_id, status)`, token_hash, phone

---

## 9. API (NestJS module `procurement`) และ realtime

ทุก route ตรวจ `module_disabled` ก่อน (guard) ; โครงเดียวกับ `backend/API.md`

**ผู้ซื้อ**
| Method | Path | ใช้ทำ |
|---|---|---|
| GET/POST | `/workspaces/:ws/vendor-list` · PATCH/DELETE `/vendor-list/:id` · POST `/vendor-list/import` | ทะเบียนทีมช่าง |
| GET | `/projects/:projectId/procurement/overview` | ภาพรวม §4.1 (คำนวณฝั่ง server จาก snapshot + สัญญา; ค่าประเมินจาก `computeProject` ที่ server รันได้อยู่แล้ว) |
| GET/POST | `/projects/:projectId/packages` · GET/PATCH `/packages/:id` | แพ็กเกจ (PATCH เฉพาะสถานะ draft; field ที่อนุญาตหลัง open จำกัด) |
| POST | `/packages/:id/send` · `/packages/:id/addendum` · `/packages/:id/extend` · `/packages/:id/cancel` | เปลี่ยนสถานะ |
| POST/DELETE | `/packages/:id/invitations` · `/invitations/:id/resend` · `/invitations/:id/withdraw` | คำเชิญ |
| POST | `/packages/:id/files` (multipart → storage) | ไฟล์ |
| GET/POST | `/packages/:id/questions` · PATCH `/questions/:id/answer` | ถาม-ตอบ |
| GET | `/packages/:id/leveling` | ตารางเทียบ (คำนวณ normalized ฝั่ง server) |
| POST | `/packages/:id/bids/manual` | บันทึกราคาแทนซับ |
| POST | `/packages/:id/negotiate` | ข้อความต่อรองถึงคำเชิญหนึ่งราย |
| POST | `/packages/:id/award` | ตกลงจ้าง (allocations) → สร้างสัญญา |
| GET/PATCH | `/subcontracts/:id` · POST `/subcontracts/:id/document` (render) · `/subcontracts/:id/signed-scan` | สัญญา |
| POST | `/subcontracts/:id/variations` · PATCH `/variations/:id` | งานเพิ่ม-ลด |
| POST | `/subcontracts/:id/claims` (สร้างแทน) · PATCH `/claims/:id/inspect` · `/claims/:id/approve` · `/claims/:id/pay` · `/claims/:id/reject` | ใบเบิก |
| POST | `/subcontracts/:id/retention/release` · `/retention/forfeit` · GET `/workspaces/:ws/retention` | เงินประกันผลงาน |
| POST | `/subcontracts/:id/complete` · `/terminate` · `/close` · `/ratings` | ปิดงาน |
| GET | `/projects/:projectId/procurement/report` | ประมาณการ vs จริง |
| GET/PUT | `/workspaces/:ws/modules` · `/workspaces/:ws/procurement/settings` | เปิด-ปิดโมดูล, ค่าเริ่มต้น |

**ซับ (public token + auth)**
| Method | Path | ใช้ทำ |
|---|---|---|
| GET | `/s/:token` **public** | แพ็กเกจแบบ guest (บันทึก viewed) |
| POST | `/s/:token/decline` **public** · `/s/:token/questions` | ปฏิเสธ / ถาม |
| POST | `/auth/otp/request` · `/auth/otp/verify` **public** | OTP เบอร์โทร → `AuthResponse` (+ สร้าง workspace/vendor profile ถ้าใหม่) และผูกคำเชิญจาก token |
| GET | `/vendor/inbox` | งานของฉัน |
| GET/PUT | `/vendor/invitations/:id/bid-draft` · POST `/bid` (submit) · `/bid/withdraw` | เสนอราคา |
| GET | `/vendor/subcontracts` · `/vendor/subcontracts/:id` · POST `/accept` · `/request-change` | สัญญา |
| POST | `/vendor/subcontracts/:id/claims` · `/variations/:id/respond` · `/ratings` | เบิกงวด, งานเพิ่ม-ลด, ให้คะแนน |
| GET/PUT | `/vendor/profile` · `/vendor/portfolio` · `/vendor/line/link` | โปรไฟล์ |

**Realtime (namespace เดิม)**: `procurement.package.updated {packageId}`, `procurement.bid.received`, `procurement.claim.updated`, ส่งห้อง `project:<id>` (ผู้ซื้อ) และ `vendor:<ws>` (ซับ)

**Notification worker**: คิวในตาราง `sc_notifications` + งานประมวลผลทุก 30 วิ (ไม่ต้องมี Redis ในเฟสนี้) ส่ง LINE Messaging API / SMS gateway (ผู้ให้บริการไทย เช่น ThaiBulkSMS; เลือกตอน M1) / อีเมล (SMTP) — adapter ตาม port

---

## 10. สิทธิ์ (เพิ่มใน permission matrix ทั้ง client และ server)

| permission | owner | admin | estimator | viewer | site* |
|---|---|---|---|---|---|
| `procurement.read` (ดูแพ็กเกจ/สัญญา) | ✓ | ✓ | ✓ | ✓ | ✓ |
| `procurement.readPrices` (เห็นราคาซับ/ตารางเทียบ) | ✓ | ✓ | ✓ | ตั้งค่าได้ | ✗ |
| `procurement.vendors.manage` | ✓ | ✓ | ✓ (เพิ่ม/แก้) | ✗ | ✗ |
| `procurement.packages.manage` (สร้าง/ส่ง/แก้/ยกเลิก) | ✓ | ✓ | ✓ | ✗ | ✗ |
| `procurement.award` | ✓ | ✓ | ตั้งค่าได้ (default ✗) | ✗ | ✗ |
| `procurement.claims.inspect` | ✓ | ✓ | ✓ | ✗ | ✓ |
| `procurement.claims.approve` | ✓ | ✓ | ตั้งค่าได้ (default ✗) | ✗ | ✗ |
| `procurement.payments.record` | ✓ | ✓ | ✗ | ✗ | ✗ |
| `procurement.settings` / `modules.manage` | ✓ | ✓ | ✗ | ✗ | ✗ |

ฝั่ง vendor ใช้บทบาท workspace ของเขาเอง: owner/admin = ส่งราคา ยอมรับสัญญา ขอเบิก; estimator = ร่างราคา; viewer = ดู

---

## 11. สถาปัตยกรรมและจุดต่อกับโค้ดเดิม

**Frontend (Next.js app router)**
- โฟลเดอร์ใหม่ `src/features/procurement/` (buyer) และ `src/features/vendor/` (sub) ; โดเมนล้วน `src/domain/procurement/` (trades, package snapshot builder, leveling/normalize, claim math, state machines — pure, มี unit test)
- Routes: `/(app)/procurement` (ภาพรวมโครงการ), `/procurement/packages/[id]`, `/procurement/packages/[id]/leveling`, `/procurement/subcontracts/[id]`, `/settings/vendors`, `/settings/modules`; ฝั่งซับ: `/s/[token]`, `/vendor` (inbox), `/vendor/bids/[invitationId]`, `/vendor/subcontracts/[id]`, `/vendor/profile`
- `ModuleRegistry` ([README](README.md) §1) gate เมนู + route + ปุ่มใน BOQ; โค้ดโมดูลโหลด lazy
- Snapshot builder รับ `ProjectComputed` (ผลจาก `computeProject`) + รายการ line key → แถว snapshot; **ไม่แก้ engine**
- ฝั่งซับ: layout มือถือแยก (ไม่มี sidebar ของผู้รับเหมา), ใช้ design tokens เดิม

**Backend**
- โมดูล `src/modules/procurement/` ตามโครง CONVENTIONS (entities: WorkPackage, Invitation, Bid, Subcontract, Claim, VendorProfile; policies: leveling, claim-math, state transitions) ; `src/modules/identity` เพิ่ม phone+OTP ; `src/shared` เพิ่ม `FileStorage` port + `Notifier` port + `ModuleGuard`
- `computeProject` รันฝั่ง server อยู่แล้ว (summary) → ใช้คำนวณค่าประเมินตอนสร้าง snapshot และ overview
- Migration `0001_procurement.sql` แยกจาก core; ปิดโมดูลไม่ drop

**ของใหม่ที่ core ต้องมีก่อน (prerequisites ใน M1)**
1. File storage (S3-compatible, presigned upload) — ยังไม่มีในระบบ
2. OTP ทางโทรศัพท์ + SMS adapter — ยังไม่มี (ข้อ 40 ใน OWNER_QUESTIONS บอกว่ายังไม่มีแม้อีเมล)
3. PDF render ฝั่ง server (HTML → PDF ด้วย headless Chromium หรือ library) สำหรับสัญญา/ใบรายการงาน; ส่งออก BOQ ปัจจุบันใช้ exceljs ฝั่ง client จึงยังไม่มีตัวนี้
4. `workspace_modules` + guard + ModuleRegistry
5. rate limit ที่ public endpoints (`/s/:token`, OTP) — ข้อ 41 ใน OWNER_QUESTIONS

---

## 12. แผนส่งมอบ (milestones) พร้อม acceptance criteria

ประมาณการสำหรับนักพัฒนา 1 คนเต็มเวลา (ผู้เขียนโค้ดคือ agent ร่วมกับเจ้าของระบบรีวิว) ; ตัวเลขเป็นช่วง เผื่อรีวิวและแก้

| M | ชื่อ | เนื้อหา | ผลที่ใช้ได้ | ประมาณ |
|---|---|---|---|---|
| **M0** | ฐานราก | `workspace_modules` + ModuleGuard + ModuleRegistry + เมนู/route gate; file storage port + S3 adapter + in-memory; phone OTP (identity) + SMS port (+ adapter จำลองสำหรับ dev); Notifier port + คิว; `src/domain/procurement/trades.ts` + snapshot builder + unit tests; migration โครงตาราง | เปิด-ปิดโมดูลได้จริง BOQ ไม่กระทบ; อัปโหลดไฟล์ได้; ล็อกอินด้วย OTP ได้ (ยังไม่มีหน้าจอโมดูล) | 2 สัปดาห์ |
| **M1** | ทะเบียน + แพ็กเกจ + คำเชิญ | ทะเบียนทีมช่าง (CRUD, import CSV); สร้างแพ็กเกจ 3 ขั้น; ส่งคำเชิญ (คัดลอกลิงก์ + SMS); หน้าแพ็กเกจ + ถาม-ตอบ; guest view `/s/:token`; ปฏิเสธ; addendum/extend/cancel | ผู้รับเหมาส่งงานให้ทีมช่างของตัวเองดูผ่านลิงก์ได้ | 2.5 สัปดาห์ |
| **M2** | เสนอราคา + ตารางเทียบ + ตกลงจ้าง | OTP สมัครจากลิงก์ → vendor profile L0; ฟอร์มราคา (unit/lump, ร่างอัตโนมัติ, เวอร์ชัน, ถอน); บันทึกราคาแทน; leveling + normalize + ไฮไลต์; ต่อรอง; award (ทั้งก้อน/รายแถว); สัญญา `pending_acceptance`; ซับยอมรับ/ขอแก้; inbox ซับ | **ใช้งานจริงได้ครบวงจรถึงตกลงจ้าง** — เริ่มนำร่อง | 3 สัปดาห์ |
| **M3** | สัญญา + งวด + retention | เทมเพลตสัญญา + rich-text + PDF; งวด/ใบเบิก/ตรวจรับ checklist/อนุมัติ/บันทึกจ่าย; คำนวณ retention/WHT/VAT; variation; สมุด retention (สัญญา + workspace); ปิดสัญญา; ให้คะแนน; บทบาท `site` (ถ้าตัดสินใจทำ) | ครบวงจรถึงปิดงาน | 3 สัปดาห์ |
| **M4** | โปรไฟล์ L1 + แจ้งเตือน + รายงาน | โปรไฟล์ทีมช่าง L1 (ผลงาน รูป ว่าง); LINE OA ผูกบัญชี + ส่งแจ้งเตือน; อีเมลผู้ซื้อ; รายงานประมาณการ vs จริง; เขียนวันจริงกลับ S-Curve (ยืนยันก่อน); ภาพรวมโครงการสมบูรณ์; ส่งออก Excel ตารางเทียบ | ประสบการณ์ครบตามแผน | 2 สัปดาห์ |
| **M5** | แข็งแรงก่อนเปิดกว้าง | rate limit, audit, PDPA (ลบบัญชี/anonymize), ทดสอบ e2e สองฝั่ง, โหลดทดสอบ public endpoints, คู่มือผู้ใช้สั้น (ไทย), เก็บ metrics §13, เตรียมช่องข้อมูล L2/L3 และ `open` mode ไว้ (ไม่มี UI) | พร้อมขยายผู้ใช้ และพร้อมต่อโมดูล 2 | 1.5 สัปดาห์ |

**Acceptance criteria (ตัวอย่างที่จะเขียนเป็น test)**
- M0: ปิด `subcontracting` ที่ระดับ workspace → เมนู/ปุ่ม/route หายทั้งหมด, `GET /projects/:id/packages` → 404 `module_disabled`, golden test ของ `computeProject` ไม่เปลี่ยน; bundle หน้า BOQ ไม่มีโค้ดโมดูล (ตรวจด้วย `next build` analyze)
- M1: สร้างแพ็กเกจจากหมวด 17–18 ได้แถวตรงกับ BOQ (desc/unit/qty E,H, basis) และ `estimate_total` = Σ L ของแถวที่เลือก; เปิดลิงก์ guest โดยไม่ล็อกอิน เห็นปริมาณ ไม่เห็นราคาประเมิน (ทดสอบ response ไม่มี field); แก้ BOQ แล้วเปิดแพ็กเกจ → เห็นแถบ "BOQ เปลี่ยน n แถว"; addendum เก็บ diff
- M2: ซับส่งราคา unit ครบ → total = Σ price×E (หรือ H ตาม basis); ซับ A ไม่สามารถอ่าน bid ของ B (404); normalized เติมแถว "ไม่รวม" ด้วยประเมิน; award รายแถวให้สองรายได้สัญญาสองฉบับ ยอดรวมตรง; ซับรายอื่นได้แจ้ง "ปิดแล้ว" โดย payload ไม่มีชื่อ/ราคาผู้ชนะ
- M3: ใบเบิกงวด 40% ของ 500,000 บาท retention 5% WHT 3% → gross 200,000, retention 10,000, wht 6,000, net 184,000 (ไม่มี VAT); อนุมัติไม่ได้ถ้ายังไม่ตรวจรับ; สมุด retention ยอดคงเหลือ = Σwithheld − Σreleased − Σforfeited; ปิดโมดูลขณะสัญญา active → ซับยังอ่านสัญญาได้ ผู้ซื้อเห็นคำเตือนก่อนปิด
- M4: แจ้งเตือนทุกเหตุการณ์ใน §4.9/§5.7 มี record ใน `sc_notifications` และเทมเพลตภาษาไทย; รายงานประมาณการ vs จริง ตรงกับผลรวมใบเบิกที่จ่าย
- ทุก M: unit test ทุก use case (happy + error + สิทธิ์ทุกบทบาททั้งสองฝั่ง) ตาม CONVENTIONS, lint/typecheck สะอาด, ไม่มี `any`

---

## 13. ตัวชี้วัดที่ต้องเก็บตั้งแต่ M2 (event log อย่างง่าย)
- แพ็กเกจที่สร้าง / ส่ง / ได้ราคา ≥ 1 / ≥ 2 / ตกลงจ้าง (funnel)
- เวลา: ส่ง → ราคาแรก, ส่ง → ตกลงจ้าง
- อัตราซับเปิดลิงก์, สมัครสำเร็จ (OTP), ส่งราคาเอง vs ผู้ซื้อบันทึกแทน
- % มูลค่า BOQ (ค่าแรง) ที่อยู่ในสัญญา ต่อโครงการ
- ราคาตกลง vs ประเมิน (median % ต่าง) ต่อ trade — ข้อมูลตั้งต้นของเฟส 3
- ซับที่ถูกเชิญจากผู้ซื้อ ≥ 2 ราย (สัญญาณว่าเครือข่ายเริ่มเกิด)

---

## 14. ความเสี่ยงเฉพาะการพัฒนา
| ความเสี่ยง | รับมือ |
|---|---|
| cross-tenant รั่ว (ซับเห็นราคาประเมิน/คู่แข่ง) | DTO ฝั่งซับเป็นคนละ schema กับฝั่งผู้ซื้อ (zod แยก); test "ไม่มี field" ทุก endpoint สาธารณะ; review checklist |
| ความซับซ้อนของ leveling กับ basis net/gross และ lump | logic อยู่ใน domain ล้วน มี golden case จาก BOQ ตัวอย่าง v5 |
| SMS/LINE ต้นทุนและผู้ให้บริการ | adapter ตาม port, dev ใช้ตัวจำลอง, เปิดใช้จริงตอน M4 หลังเลือกผู้ให้บริการ |
| ฝั่งซับใช้มือถือเก่า/เน็ตช้า | หน้า guest เป็น server-rendered เบา ไม่พึ่ง store ของแอปหลัก; รูปย่อก่อนอัปโหลด |
| ขอบเขตบวม | ทุกอย่างใน §1 "ไม่ทำ" ต้องกลับมาเป็นข้อเสนอใหม่ ไม่แทรกใน milestone |

---

## 15. คำถามที่ต้องตอบก่อน/ระหว่างทำ (ไม่บล็อกการเริ่ม M0)
1. estimator ตกลงจ้าง/อนุมัติใบเบิกได้เองไหม (ค่าเริ่มต้นเสนอ: ไม่ได้ ต้อง admin/owner)
2. ต้องการบทบาท `site` (โฟร์แมน) ไหม — ตัดสินใจก่อน M3
3. ผู้ให้บริการ SMS และ LINE OA ของบริษัท (ชื่อ, งบ) — ก่อน M4
4. เทมเพลตสัญญาจ้างช่วงที่ใช้จริงอยู่ (ถ้ามีไฟล์ .docx ส่งมาได้ จะใช้เป็นฐาน) — ก่อน M3
5. ค่าเริ่มต้น retention % และระยะประกันของบริษัทผู้ใช้นำร่อง
6. ซ่อนราคาซับจาก viewer เป็นค่าเริ่มต้นหรือไม่
7. จะใช้ชื่อเมนูว่า "จ้างช่วง" หรือ "จัดหาผู้รับเหมาช่วง"
