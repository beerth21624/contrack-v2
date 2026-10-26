# Excel spec 01: BOQ (Home) + Steps 00 to 05

Source workbook: "โปรแกรมประมาณราคา BOQ … บ้านชั้นเดียว – Training Edition v5" (sheet 01 `BOQ (Home)` plus calculator sheets 34, 35, 36, 37).
Sources used:
- `ctrv2\v5\sheet01.txt`, `sheet34..37.txt`, `sheet02.txt`, `sheet03.txt`, `sheet04.txt` (cell dumps)
- `ctrv2\excel5\BOQ_TABLE.txt`
- review deck pages 1 to 23
- current app code in `src/lib/steps/step00..05.ts` and `src/lib/boq-mapper.ts`

Conventions in this document:
- **Input** = yellow cell (fill `FFFFF2CC`). **Auto** = green (`FFE2F0D9`) or uncoloured formula cell.
- Thai labels are copied verbatim. A trailing space in a label is shown only when it matters.
- Shared formulas: cells that repeat the master formula appear in the dump as `=SHARED(si=N, master CELL: …)`. This document marks them "(shared)" and gives the shifted formula. They were checked against the regenerated dump. Cells described as typed or static have no formula and no `SHARED` entry.
- "Deck pN" = page N of the customer review deck. "BOQM" in the deck means the Excel/Google-Sheets program. "ConTrack" means today's app.

---

## Part A: BOQ (Home), sheet 01

### A.1 Layout

| Area | Cells | Content |
|---|---|---|
| Side navigation bar | Column A, rows 1 to 308. Dark fill `FF061F38` | Menu labels that are hyperlinks to other sheets (A.6). It is a navigation menu, not data. |
| Title row | B1 | `  โปรแกรมประมาณราคางานก่อสร้าง (BOQ)   บ้านพักอาศัย คสล. 1 ชั้น` |
| | G1 | `Contrepreneur.com – สงวนลิขสิทธิ์ © 2026 ตามกฎหมาย` (copyright line) |
| | N1 | `เลขที่เอกสาร : BOQ-2026-001 Rev.00 – Draft` (document number: static text, not built from M2) |
| Project info block | B2:D4, K2:M4 | See A.2 |
| Legend | E3:F4 | See A.2 |
| Row 5 | | Blank spacer |
| Column group header | Row 6 | I6:J6 merged = `ค่าวัสดุ` (material). K6:L6 merged = `ค่าแรงงาน` (labour). Other cells B6:N6 blank with header fill `FFE3EBF9`. |
| Column header | Row 7 | B `No.`, C `ขั้นตอน`, D `รายการ`, E `ปริมาณ`, F `หน่วย`, G `%เผื่อ`, H `ปริมาณ เผื่อแล้ว`, I `ต่อหน่วย`, J `รวม`, K `ต่อหน่วย`, L `รวม`, M `รวมทั้งหมด`, N `หมายเหตุ` |
| Auto-filter | B7:N308 | Defined name `_xlnm._FilterDatabase`. Every header has a filter dropdown (visible in deck p4 and p7). |
| Body | Rows 8 to 308 | 32 sections (No. 0 to 31). Each section has a header row, item rows and a `รวม >> ` sub-total row. |
| Grand total | Row 310 | L310 `รวมต้นทุนก่อสร้างทั้งหมด`, M310 formula, N310 `บาท`. M310 fill is `FFF3F3F3`. |

### A.2 Header fields (rows 2 to 4)

| Cell | Label (cell) | Default value | Type | Notes |
|---|---|---|---|---|
| D2 | `  📂 โครงการ` (B2) | `บ้านพักอาศัย คสล. 1 ชั้น` | text | Project name. Not yellow but meant to be edited. |
| D3 | `  📍 สถานที่ก่อสร้าง` (B3) | `[ที่อยู่โครงการ]` | text | Site address (placeholder) |
| D4 | `  👤 เจ้าของบ้าน` (B4) | `[ชื่อเจ้าของบ้าน]` | text | Owner name (placeholder) |
| M2 | `📝 Revision` (K2) | `00` | text | Revision number |
| M3 | `📅 Date` (K3) | `xx/xx/xxxx` | date (text placeholder) | |
| M4 | `👤 Prepared By` (K4) | `[ผู้จัดทำ / บริษัท]` | text | Preparer or company |

Legend (E3:F4):
- E3 `รายการ` is shown in blue as a hyperlink to `'BOQ (Home)'!A1`. F3 reads `(ตัวสีน้ำเงิน) คลิ๊กที่นี่เพื่อกรอกข้อมูลก่อน`. Meaning: blue text is a link; click it and fill that calculator first.
- E4 `เจ้าหน้าที่` is a yellow sample swatch. F4 reads `(ช่องสีเหลือง) ต้องกรอกข้อมูลเอง`. Meaning: yellow cells must be filled by the user.

Man-Day_Basic, S-Curve and CashFlow repeat these header values as separate static text. They are not linked to D2:M4.

### A.3 Column formulas (every item row)

| Col | Meaning | Formula (row r) | Plain language |
|---|---|---|---|
| B | Section No. | (header rows only) 0.0, 1.0 … 31.0 | Displayed as 0, 1, 2 … |
| C | Item no. | text `1)`, `2)` … | Sub-lines such as `- เหล็ก RB9` have no number |
| D | Description | text, or a formula pulling the name from a calculator (sections 24, 29, 30, 31 and others) | Blue text when hyperlinked |
| E | Quantity (net) | Input (yellow) **or** a formula linking to a calculator | See each section |
| F | Unit | text | |
| G | % waste | Input (yellow), fraction (0.1 = 10%), shown as % | |
| H | Qty incl. waste | `=E r*(100%+G r)` | net × (1 + waste) |
| I | Material unit price | Input (yellow) | baht per unit |
| J | Material total | `=I r*H r` | Material is charged on the quantity **including** waste |
| K | Labour unit price | Input (yellow) | baht per unit |
| L | Labour total | `=K r*E r` | Labour is charged on the **net** quantity, without waste |
| M | Row total | `=J r+L r` | |
| N | Note | text | Free text, for example `ลูกค้าจัดหาเอง` or a spec |

Section header rows (e.g. row 8): B = No., C = section title, fill `FFE3EBF9` across B:N, no numbers.

### A.4 Sub-totals and grand total

Sub-total row (the last row of each section):
- D = `รวม >> `
- J = `=SUM(J first:J last)`
- L = `=SUM(L first:L last)`
- M = `=SUM(M first:M last)`, the sum of the item-row M values.

For most sections, M_sub is a shared formula copied from the L sub-total one column to the left, so it uses the same row range as L. Examples: M10 = `SUM(M9)`, M30 = `SUM(M19:M29)`, M150 = `sum(M148:M149)`. M95, M216 and M243 have their own formulas with a different range from J/L (see below). **Implementation:** M_sub = SUM of the item-row M values in the section.

Grand total M310:
```
=M14+M17+M30+M33+M36+M59+M66+M81+M95+M105+M112+M135+M146+M150+M160+M177+M187+M197+M203+M208+M216+M221+M232+M243+M253+M271+M277+M280+M292+M298+M308
```
It sums every section sub-total **except M10 (section 0, land inspection = 7,500)**. The cached value is 1,850,317.34.

Section map (header row, sub-total row, and which sheets supply the quantities):

| No. | Title (C) | Header | Items | Sub-total | Qty sources (E formulas) |
|---|---|---|---|---|---|
| 0 | `งานตรวจสอบที่ดิน ` | 8 | 9 | 10 (**not in M310**) | none (hard-coded 1 เหมา) |
| 1 | `งานเตรียมพื้นที่` | 11 | 12–13 | 14 | `ถมดิน`!D9 |
| 2 | `งานน้ำ-ไฟชั่วคราว` | 15 | 16 | 17 | none |
| 3 | `งานเตรียมพื้นที่หน้างาน` | 18 | 19–29 | 30 | none (inputs) |
| 4 | `งานวางผัง / ปักหมุด` | 31 | 32 | 33 | none (input) |
| 5 | `งานเสาเข็ม` | 34 | 35 | 36 | none (input) |
| 6 | `งานฐานราก` | 37 | 38–58 | 59 | ฐานราก_Footing, ตารางสรุปวัสดุงานโครงสร้าง, =E35 |
| 7 | `งานเสาตอม่อ` | 60 | 61–65 | 66 | ตารางสรุปวัสดุงานโครงสร้าง |
| 8 | `งานคานคอดิน` | 67 | 68–80 | 81 | ตารางสรุป…, คานคอดิน_Beam |
| 9 | `งานพื้นหล่อในที่` | 82 | 83–94 | 95 | ท่อน้ำทิ้ง_Waste Pipe, ตารางสรุป… |
| 10 | `งานพื้นสำเร็จรูป ` | 96 | 97–104 | 105 | พื้นสำเร็จรูป_PS, ตารางสรุป… |
| 11 | `งานเสาชั้น 1` | 106 | 107–111 | 112 | ตารางสรุป… |
| 12 | `งานคาน + พื้นดาดฟ้า` | 113 | 114–134 | 135 | ตารางสรุป… |
| 13 | `งานโครงสร้างบันได` | 136 | 137–145 | 146 | ตารางสรุป… |
| 14 | `งานเพลทหัวเสา` | 147 | 148–149 | 150 | none (21 จุด typed) |
| 15 | `งานโครงหลังคา` | 151 | 152–159 | 160 | โครงสร้างหลังคา Roof Structure |
| 16 | `งานมุงหลังคา` | 161 | 162–176 | 177 | มุงหลังคา_Roofing |
| 17 | `งานก่ออิฐ ` | 178 | 179–186 | 187 | ก่ออิฐ_Brick (SUMIFS), ท่อร้อยสายไฟ_Electrical Pipe |
| 18 | `งานฉาบปูน ` | 188 | 189–196 | 197 | ฉาบปูน_Plaster, ประตู-หน้าต่าง, สายไฟ_Electrical Cable |
| 19 | `งานฝ้าเพดาน` | 198 | 199–202 | 203 | ฝ้าเพดาน_Ceiling |
| 20 | `งานปูกระเบื้องพื้น` | 204 | 205–207 | 208 | ปูกระเบื้องพื้น_Floor Tile |
| 21 | `งานปูกระเบื้องห้องน้ำ` | 209 | 210–215 | 216 | ปูกระเบื้องห้องน้ำ_Toilet, ท่อน้ำดี_Water Pipe |
| 22 | `งานตกแต่งผนัง` | 217 | 218–220 | 221 | ตกแต่งผนัง_Wall Finishing |
| 23 | `งานทาสีรองพื้น` | 222 | 223–231 | 232 | ทาสี_Paint |
| 24 | `งานประตู-หน้าต่างอลูมิเนียม` | 233 | 234–242 | 243 | ประตู-หน้าต่าง_Door&Window (FILTER) |
| 25 | `งานทาสีจริง รอบที่ 1` | 244 | 245–252 | 253 | ทาสี_Paint |
| 26 | `งานติดตั้งอุปกรณ์ไฟฟ้า` | 254 | 255–270 | 271 | ตู้ควบคุม_Load Center, อุปกรณ์ไฟฟ้า_Equipment |
| 27 | `งานระบบสุขาภิบาล` | 272 | 273–276 | 277 | ระบบสุขาภิบาล_Sanitary System |
| 28 | `งานเบ็ดเตล็ด` | 278 | 279 | 280 | เบ็ดเตล็ด_Other |
| 29 | `งานสุขภัณฑ์` | 281 | 282–291 | 292 | สุขภัณฑ์_Sanitary |
| 30 | `งานประตู-หน้าต่างไม้` | 293 | 294–297 | 298 | ประตู-หน้าต่าง_Door&Window (FILTER) |
| 31 | `งานทาสีรอบสุดท้าย` | 299 | 300–307 | 308 | ทาสี_Paint |

Sub-total ranges that do not cover the whole section. These are outside steps 0 to 5 but they are BOQ Home formulas:
- **J95 / L95** = `SUM(J88:J94)` / `SUM(L88:L94)`. They skip the waste-pipe rows 83–87. **M95** = `SUM(M83:M94)` does include them, so J95 + L95 (47,098.31) ≠ M95 (55,173.03).
- **J216 / L216** = `SUM(J210:J211)`. They skip the water-pipe rows 212–215. **M216** = `SUM(M210:M215)` includes them.
- **L243** = `SUM(L236:L242)`. It skips rows 234–235. This is harmless today because labour is 0.
- J66 / L66 start at row 62, skipping row 61. That row is an empty group header, so it is harmless.

### A.5 Category grouping

The Excel has **no cost-category roll-up**: no หมวด sub-totals and no grouping column. The only grouping is:
1. The 32 numbered sections (A.4). The BOQ is a flat list of sections in construction order.
2. The column-A navigation menu (A.6), which groups the *calculator sheets* by trade (structure, roof, architecture, electrical, sanitary) and links to the planning sheets.

### A.6 Hyperlink map: every `# LINK` on sheet 01

Column A navigation menu:

| Cell | Label | Target |
|---|---|---|
| A8 | `ESTIMATE (BOQ)` (menu heading, no link) | none |
| A9 | `   📄 ข้อมูล BOQ (Home)` | `'BOQ (Home)'!A1` |
| A10 | `   🏗️ งานโครงสร้าง` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| A11 | `   🏠  งานหลังคา` | `โครงสร้างหลังคา Roof Structure` |
| A12 | `   🧱  งานสถาปัตย์` | `ประตู-หน้าต่าง_Door&Window` |
| A13 | `   ⚡  งานระบบไฟฟ้า` | `ท่อร้อยสายไฟ_Electrical Pipe` |
| A14 | `   🚿  งานระบบสุขาภิบาล` | `ท่อน้ำทิ้ง_Waste Pipe` |
| A15 | `    📊  สรุป BOQ ทั้งหมด` | none (no link) |
| A16 | `PLANNING` (menu heading) | none |
| A17 | `   👷 Man-Day` | `Man-Day_Basic` |
| A18 | `   📈 S-Curve` | `S-Curve_Plan_Basic` |
| A19 | `   💰 Cash Flow` | `CashFLOW_Basic` |

BOQ body links (C = section-title link, D = item link):

| Cell | BOQ row: section, description | Linked sheet |
|---|---|---|
| E3 | legend sample `รายการ` | `BOQ (Home)` |
| D9 | 0: `ค่าตรวจสอบที่ดิน` | `ค่าตรวจสอบที่ดิน` (sheet36) |
| D12 | 1: `งานรื้อถอน` | `งานรื้อถอน_Site Preparation` (sheet35) |
| D13 | 1: `ดินถม (ตามสเปค) + บดอัด` | `ถมดิน` (sheet34) |
| D16 | 2: `เดินน้ำ-ไฟชั่วคราว` | `น้ำไฟชั่วคราว` (sheet37) |
| C18 | 3: section title `งานเตรียมพื้นที่หน้างาน` | **External** Google Sheet rId2 `https://docs.google.com/spreadsheets/u/2/d/11qILqKuKq1BA3GtSg2wvuzMnVZiDPKCn/edit` (camp, toilet and store material calculator) |
| C31 | 4: section title `งานวางผัง / ปักหมุด` | **External** Google Sheet rId3 `https://docs.google.com/spreadsheets/u/2/d/13SEtyByNr5n-uiXiKC3pHyExJWC3igwD/edit` (layout calculator) |
| (none) | 5: `เสาเข็ม` | none. Section 5 has no calculator. |
| C37 | 6: `งานฐานราก` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D38 | 6: `ขุดดิน` | `ฐานราก_Footing` |
| D40 | 6: `ทรายหยาบ ` | `ฐานราก_Footing` |
| D41 | 6: `คอนกรีตหยาบ (1:3:5) ` | `ฐานราก_Footing` |
| D42 | 6: `เหล็กเสริม - ***ฟุตติ้ง` | `ฐานราก_Footing` |
| D46 | 6: `เหล็กเสริม - ***เสาตอม่อ` | `เสาตอม่อ_Footing Column` |
| D50 | 6: `เหล็กเสริม - ***เสาชั้น 1` | `เสา_Column` |
| D54 | 6: `แบบหล่อคอนกรีต` | `ฐานราก_Footing` |
| D58 | 6: `คอนกรีตโครงสร้าง (240 ksc cu)` | `ฐานราก_Footing` |
| C60 | 7: `งานเสาตอม่อ` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D61 | 7: `แบบหล่อคอนกรีต` | `เสาตอม่อ_Footing Column` |
| D65 | 7: `คอนกรีตโครงสร้าง` | `เสาตอม่อ_Footing Column` |
| C67 | 8: `งานคานคอดิน` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D68 | 8: `ถมดินกลับ ` | `ฐานราก_Footing` |
| D69 | 8: `คอนกรีตหยาบ (1:3:5) ` | `คานคอดิน_Beam` |
| D74 | 8: `เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป` | ` พื้นสำเร็จรูป_PS` |
| D76 | 8: `แบบหล่อคอนกรีต` | `คานคอดิน_Beam` |
| D80 | 8: `คอนกรีตโครงสร้าง` | `คานคอดิน_Beam` |
| C82 | 9: `งานพื้นหล่อในที่` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D83 | 9: `ท่อน้ำทิ้ง ` | `ท่อน้ำทิ้ง_Waste Pipe` |
| D88–D91, D94 | 9: ถมดินกลับ / ทรายหยาบ / พลาสติกกันชื้น / เหล็กเสริม / คอนกรีต | `พื้นหล่อในที่_S` |
| C96 | 10: `งานพื้นสำเร็จรูป ` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D97, D99, D100, D104 | 10: พื้นสำเร็จรูป / ไวร์เมช / แบบหล่อ / คอนกรีต | ` พื้นสำเร็จรูป_PS` |
| C106 | 11: `งานเสาชั้น 1` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D107, D111 | 11: แบบหล่อ / คอนกรีต | `เสา_Column` |
| C113 | 12: `งานคาน + พื้นดาดฟ้า` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D115, D119, D120, D124 | 12: คานดาดฟ้า เหล็ก / ไม้ค้ำยัน / แบบหล่อ / คอนกรีต | `คานดาดฟ้า_RoofBeam` |
| D126, D129, D130, D134 | 12: พื้นดาดฟ้า เหล็ก / ไม้ค้ำยัน / แบบหล่อ / คอนกรีต | `พื้นดาดฟ้า_RoofSlab` |
| C136 | 13: `งานโครงสร้างบันได` | `ตารางสรุปวัสดุงานโครงสร้าง` |
| D137, D140, D141, D145 | 13: เหล็ก / ไม้ค้ำยัน / แบบหล่อ / คอนกรีต | `บันได_Stair` |
| C151 | 15: `งานโครงหลังคา` | `โครงสร้างหลังคา Roof Structure` |
| C161 | 16: `งานมุงหลังคา` | `มุงหลังคา_Roofing` |
| C178 | 17: `งานก่ออิฐ ` | `ก่ออิฐ_Brick` |
| D184 | 17: `ท่อร้อยสายไฟ` | `ท่อร้อยสายไฟ_Electrical Pipe` |
| D189, D190 | 18: ฉาบปูนผนัง ภายนอก / ภายใน | `ฉาบปูน_Plaster` |
| D191 | 18: `วงกบประตูไม้` | `ประตู-หน้าต่าง_Door&Window` |
| D192 | 18: `สายไฟ` | `สายไฟ_Electrical Cable` |
| C198 | 19: `งานฝ้าเพดาน` | `ฝ้าเพดาน_Ceiling` |
| C204 | 20: `งานปูกระเบื้องพื้น` | `ปูกระเบื้องพื้น_Floor Tile` |
| C209 | 21: `งานปูกระเบื้องห้องน้ำ` | `ปูกระเบื้องห้องน้ำ_Toilet` |
| D212 | 21: `งานระบบประปา ท่อน้ำดี` | `ท่อน้ำดี_Water Pipe` |
| C217 | 22: `งานตกแต่งผนัง` | `ตกแต่งผนัง_Wall Finishing` |
| C222 | 23: `งานทาสีรองพื้น` | `ทาสี_Paint ` |
| C233 | 24: `งานประตู-หน้าต่างอลูมิเนียม` | `ประตู-หน้าต่าง_Door&Window` |
| C244 | 25: `งานทาสีจริง รอบที่ 1` | `ทาสี_Paint ` |
| D255 | 26: `งานตู้ควบคุมระบบไฟฟ้า` | `ตู้ควบคุม_Load Center` |
| D264 | 26: `อุปกรณ์ไฟฟ้า ` | `อุปกรณ์ไฟฟ้า_Equipment ` |
| C272 | 27: `งานระบบสุขาภิบาล` | `ระบบสุขาภิบาล_Sanitary System` |
| C278 | 28: `งานเบ็ดเตล็ด` | `เบ็ดเตล็ด_Other` |
| C281 | 29: `งานสุขภัณฑ์` | `สุขภัณฑ์_Sanitary` |
| C293 | 30: `งานประตู-หน้าต่างไม้` | `ประตู-หน้าต่าง_Door&Window` |
| C299 | 31: `งานทาสีรอบสุดท้าย` | `ทาสี_Paint ` |

Sections with no link at all: 5 (piles) and 14 (column-cap plates).
Every calculator sheet has a `Back Home` link to `'BOQ (Home)'!A1`: sheet36 I2, sheet35 D2, sheet34 G3, sheet37 I2.

### A.7 Dropdowns

BOQ (Home) has **no** data-validation dropdowns. The dump has no `# DROPDOWN` lines, and the calculator sheets 34 to 37 have none either. The only dropdown-like controls on BOQ Home are the auto-filter buttons on row 7.

### A.8 How BOQ Home feeds Man-Day / S-Curve / CashFlow

Another agent specs these sheets. In summary:

- **Man-Day_Basic (sheet02)** is a **full independent copy** of the BOQ. It has the same rows 8 to 308, shifted one column left:
  - Columns: A No., B ขั้นตอน, C รายการ, D ปริมาณ, E หน่วย, F %เผื่อ, G เผื่อแล้ว, H mat unit, I mat total, J lab unit, K lab total, L total, M note.
  - It has its **own yellow inputs**: qty, waste and unit prices currently hold the same values as BOQ Home.
  - It links to the calculator sheets directly (e.g. D13 `='ถมดิน'!D9`). It does **not** reference BOQ Home cells.
  - Planning columns O to U sit on each section header row:
    - O `1.ช่าง` (input) and P `2.คนงาน` (input)
    - Q `=SUM(O:P)`
    - R `=(800*O)+(500*P)` (hard-coded daily wages: 800 for a skilled worker, 500 for a labourer)
    - S `=K_sub/R` (days = labour budget ÷ daily crew cost)
    - T `6.ประเมิน (วัน)` (input)
    - U `=L_sub` (section budget).
  - Sections 0 and 1 have empty O to U, so they are not planned.
- **S-Curve_Plan_Basic (sheet03)**:
  - Its task list starts at `1.1 งานน้ำ-ไฟชั่วคราว`, so sections 0 and 1 are not scheduled.
  - G14 (budget for water/power) = `='BOQ (Home)'!M17`. This is the **only direct BOQ Home cell reference** in S-Curve.
  - Every other task budget is G = `'Man-Day_Basic'!U<header row>` and every duration is D = `'Man-Day_Basic'!T<header row>`. Examples: camp U18/T18, layout U31/T31, piles U34/T34.
  - D7 project budget = `SUMIF(I:I,"PLAN",G:G)`, which equals 1,850,317.34.
- **CashFLOW_Basic (sheet04)**: D2 = `='BOQ (Home)'!M310` (grand total).

---

## Part B: Steps 0 to 5

### Section 0: งานตรวจสอบที่ดิน (STEP 00 "ตรวจสอบที่ดิน / หมุดหลัก")

#### (a) BOQ Home rows

| Row | Desc | Unit | Qty source | Waste | Mat (I) | Lab (K) | Note |
|---|---|---|---|---|---|---|---|
| 9 | `ค่าตรวจสอบที่ดิน` (link to sheet36) | เหมา | E9 = **1.0, typed** (cell not yellow) | G9 = 0 (input) | I9 = 0 (input) | **K9 = 7,500 (typed input)** | none |
| 10 | `รวม >> ` | | | | J10 `=SUM(J9)` = 0 | L10 `=SUM(L9)` = 7,500 | M10 = 7,500 |

K9 (7,500) is the same number as the calculator total `'ค่าตรวจสอบที่ดิน'!F14`, but it is **not linked**. The user retypes it.

#### (b) Calculator sheet36 `ค่าตรวจสอบที่ดิน`

Purpose: list the pre-construction land-inspection costs and give one lump-sum total. Title B2 (merged B2:H2): `โปรแกรมคำนวณค่าตรวจสอบที่ดิน 🔍`.

Header inputs (all yellow, blank by default):

| Cell | Label | Type | Default |
|---|---|---|---|
| C4 | `ชื่อโครงการ` (B4) | text | blank |
| F4 | `จังหวัด` (E4) | text | blank |
| C5 | `วันที่เข้าสำรวจ` (B5) | date | blank |
| F5 | `ผู้ตรวจสอบ` (E5) | text | blank |

Cost table. Header row 7: B `รายการค่าใช้จ่าย`, C `จำนวน`, D `หน่วย`, E `ราคาต่อหน่วย`, F `รวม`, G `หมายเหตุ`.

| Row | B label (fixed) | C qty (input) | D unit (input, text) | E unit price (input) | F total (auto) | G note |
|---|---|---|---|---|---|---|
| 8 | `ค่าแรงตรวจสอบที่ดิน` | 2 | `วัน` | 1,500 | `=C8*E8` = 3,000 | `เอกสารสำรวจหน้างาน`, a hyperlink to the external Google Doc (see below) |
| 9 | `ค่าเดินทาง` | 1 | `เที่ยว` | 2,500 | `=C9*E9` (shared) = 2,500 | none |
| 10 | `ค่าที่พัก` | 1 | `คืน` | 1,200 | `=C10*E10` = 1,200 | none |
| 11 | `ค่าอุปกรณ์สำรวจ / เอกสาร` | 1 | `งาน` | 800 | `=C11*E11` = 800 | none |
| 12 | `+ เพิ่ม` (fixed label) | blank | blank | blank | `=C12*E12` = 0 | none |
| 14 | `ต้นทุนรวม` | | | | **F14 `=SUM(F8:F12)` = 7,500** | |

Footnotes:
- B16: `หมายเหตุ: ราคานี้เป็นตัวอย่างเบื้องต้น สามารถปรับจำนวน / หน่วย / ราคาต่อหน่วย ตามพื้นที่จริงได้`. These are sample prices; adjust them to the real site.
- B17: `ช่องสีเหลือง = ช่องกรอกข้อมูล / ช่องสีเขียว = สูตรคำนวณอัตโนมัติ`.

Free rows: exactly **one** ("+ เพิ่ม", row 12). In that row only qty, unit and price are inputs; the description label is fixed text.

Output: F14 = lump-sum land-inspection cost. In the Excel it is **not linked** to BOQ. The intended target is BOQ K9 (labour, 1 เหมา).

External Google Doc (sheet36 G8 → rId1 `https://docs.google.com/document/u/2/d/1IqouKou4vrKb1WOzsfhXVAv25SnYKGMJ/edit`):
- The deck p4 preview shows a doc titled `Site_Inspection_Che…`, apparently a site-inspection checklist ("ใบสำรวจพื้นที่…"). The preview is too small to read the text.
- The deck p4 also shows a 5-point checklist as the doc's content:
  1. `ที่ดินอยู่ตรงไหน`
  2. `เข้าใช้ได้หรือไม่`
  3. `แนวเขตถูกต้องหรือไม่`
  4. `มีหมุดอ้างอิงหรือไม่`
  5. `มีข้อมูลเพียงพอสำหรับเริ่มงานหรือไม่`

  Suggested app equivalent: a checklist with these 5 yes/no and notes items, attached to step 0. Its result does not change the cost.

#### (c) Review deck notes
- p3 (ConTrack): today's app asks for land area, boundary length, number of benchmarks, survey crew count and waste %. Its cost preview (฿3,950) is made of survey crew, BM markers, boundary markers and photos.
- p4 (BOQM): shows the BOQ rows 8 to 10, with an arrow from `ค่าตรวจสอบที่ดิน` to sheet36 and from G8 to the Google Doc checklist. Note in black on the slide: `ก่อนสร้าง ต้องเสียค่าอะไรบ้าง`, i.e. "what must be paid before building". The step is a list of pre-construction expenses, not a survey-quantity calculator.

#### (d) Today's app vs Excel
- The app derives survey days, man-days, BM points and markers from land area and boundary length (`step00.ts`). The Excel has no geometry inputs: it is a free cost list (qty × unit price) of 4 fixed lines plus 1 free line.
- The app writes up to 6 BOQ lines from `price-list.ts` (SRV-CREW 800/man-day, SRV-BM, SRV-MARKER, SRV-TOPO, SRV-EQUIP, SRV-PHOTO). The Excel writes **one** line: `ค่าตรวจสอบที่ดิน` 1 เหมา, with the labour unit price = calculator total.
- App labels do not exist in the Excel, for example the section name `งานสำรวจที่ดิน / หมุดหลัก` (Excel: `งานตรวจสอบที่ดิน`) and Topo or equipment options.
- The app has no project, province, survey date or inspector header fields, and no checklist document.
- The app applies waste % to marker counts. In the Excel, waste G9 = 0 and labour is on net qty anyway.

#### (e) Oddities
- **M10 is excluded from the grand total M310**, and section 0 is not in S-Curve or CashFlow either. This may be deliberate (a pre-contract cost) or a bug. **Owner decision.**
- K9 = 7,500 is retyped instead of `='ค่าตรวจสอบที่ดิน'!F14`.
- The total is put in the *labour* column, even though it includes travel, lodging and equipment.
- The `+ เพิ่ม` row has no editable description cell.

---

### Section 1: งานเตรียมพื้นที่ (STEP 01: demolition + fill)

#### (a) BOQ Home rows

| Row | Desc | Unit | Qty source | Waste | Mat (I) | Lab (K) | Note |
|---|---|---|---|---|---|---|---|
| 12 | `งานรื้อถอน` (link to sheet35) | เหมา | E12 = **0, input** (yellow, not linked) | 0 | 0 | 0 | `ไม่มีงานรื้อถอน` |
| 13 | `ดินถม (ตามสเปค) + บดอัด` (link to sheet34) | ลบ.ม. | **E13 `='ถมดิน'!D9` = 234** | **G13 = 0.1 (10%)** | 0 | 0 | `ลูกค้าจัดหาเอง` |
| 14 | `รวม >> ` | | | | J14 `=SUM(J13)` | L14 `=SUM(L13)` | M14 = 0 |

- Row 13: H13 = 234 × 1.1 = 257.4. J13 = I13 × H13, L13 = K13 × E13 (net 234). Both are 0 because the customer supplies the fill.
- J14/L14 sum only row 13, so **row 12 (demolition) is left out of the section sub-total**. It is 0 today.

#### (b-1) Calculator sheet35 `งานรื้อถอน_Site Preparation`

Purpose: quantity × rate list of demolition and clearing items.
- A1: `เพจผู้รับเหมาพันธุ์ใหม่ – สงวนลิขสิทธิ์ © 2026 ตามกฎหมาย`
- A2: `โปรแกรมถอดแบบ – งานรื้อถอน_Site Preparation 🏗️`
- Header row 3: A `No.`, B `รายการ`, C `หน่วย`, D `ปริมาณ`, E `Rate`, F `รวม`, G `รายละเอียดที่ต้องตรวจสอบ`

| Row | No. | B item (fixed) | C unit (fixed) | D qty (input, light-blue `FFD9EAF7`) | E rate (input, light-blue) | F total | G what to check (fixed hint) |
|---|---|---|---|---|---|---|---|
| 4 | 1 | `รื้อถอนอาคาร/สิ่งปลูกสร้างเดิม` | ตร.ม. | blank | blank | 0 | `ประเภท / จำนวนชั้น / พื้นที่` |
| 5 | 2 | `รื้อถอนต้นไม้` | ต้น | blank | blank | 0 | `ขนาดต้น / จำนวน` |
| 6 | 3 | `รื้อถอนท่อระบายน้ำ` | ม. | blank | blank | 0 | `ขนาดท่อ / ความยาว` |
| 7 | 4 | `รื้อรั้ว / กำแพง` | ตร.ม. | blank | blank | 0 | `ประเภท / ความสูง / ความยาว` |
| 8 | 5 | `รื้อถนน / พื้นภายนอก` | ตร.ม. | blank | blank | 0 | `คอนกรีต / Asphalt` |
| 9 | 6 | `เคลียร์พื้นที่ / เปิดหน้าดิน` | ตร.ม. | blank | blank | 0 | `พื้นที่รวม` |
| 10 | 7 | `ขนขยะทิ้ง` | เที่ยว | blank | blank | 0 | `จำนวนเที่ยวรถ` |
| 11 | | E11 `รวมทั้งหมด` | | | | F11 = 0 (gold fill `FFFACC15`) | |

- Footnote B14 (merged B14:F14): `Rate = ค่าแรง + เครื่องมือพื้นฐาน + ค่าใช้จ่ายเบื้องต้นต่อหน่วย`. The rate is all-in: labour, basic tools and incidentals per unit.
- **F4:F10 and F11 hold static 0.0 with no formula.** This was re-checked in the regenerated dump: there is no `SHARED` entry, so they really are static. Intended: F = D × E and F11 = SUM(F4:F10). Build it that way.
- Free rows: none. The list is fixed at 7 items.
- Output: F11. **It is not linked to BOQ** (E12 is a typed 0 เหมา). Intended mapping: probably BOQ row 12 = 1 เหมา with K12 (or I12) = F11, or 0 when F11 = 0. **Owner decision.**

#### (b-2) Calculator sheet34 `ถมดิน`

Purpose: fill volume to order. Title B3 (merged B3:E3): `โปรแกรมคำนวณปริมาณดินถม (คิว) 🚜`.

Inputs. Fills are white ("theme0"), not yellow, but these cells are the inputs:

| Cell | Label | Default | Unit |
|---|---|---|---|
| D4 | `ขนาดที่ดิน` (B4:B5 merged) / `กว้าง` (C4) | 20 | เมตร |
| D5 | `ยาว` (C5) | 20 | เมตร |
| D6 | `ถมดินสูง` (B6:C6) | 0.45 | เมตร |
| D7 | `เผื่อดินยุบตัว` (B7:C7) | 30 | % (a whole number that the formula divides by 100) |

The labels carry a garbled prefix `_x009f_`, a bullet or tofu glyph (deck p7 shows "▢"). Drop it.

| Cell | Label | Formula | Plain language |
|---|---|---|---|
| D9 | `ปริมาณดินที่ต้องสั่ง (Output)`; unit E9 `คิว (ลูกบาศก์เมตร)` | `=D4*D5*D6*(1+D7/100)` = 234 | width × length × fill height × (1 + settlement %) |

- Footer: B14 `เพจผู้รับเหมาพันธุ์ใหม่ สงวนลิขสิทธิ์`; B15 `แจกฟรี ห้ามคัดลอก รวมทั้งดัดแปลง และเผยแพร่ ก่อนได้รับอนุญาต`.
- Free rows: none. There is only one rectangle and no "add area" feature.
- Output: D9 → BOQ E13 (linked).

#### (c) Review deck notes
- p6 (ConTrack): today's app shows multiple fill areas, each with fill material type, W, L, H, compaction factor 1.30 and layer thickness 0.30. It also has a waste %, and its live preview has 12 lines (soil types, layers, trucks, backhoe hours).
- p7 (BOQM): BOQ rows 11 to 14, the demolition sheet and the fill sheet. **Red note: `วัสดุถม (ถ้ามี) ระบุที่ หมายเหตุ`**, with an arrow to N13 (`ลูกค้าจัดหาเอง`). Meaning: the fill material (if any) is stated in the **note** column. There should be no material-type dropdown or soil-type split.

#### (d) Today's app vs Excel
- The app has no demolition calculator; it has only optional `site_clearance_area_m2` and `demolition_trips`. The Excel has a fixed 7-line qty × rate list.
- App fill: multi-area, compaction factor, layers, 5 soil-type volumes, trucks, backhoe, roller and FDT. Excel: 4 inputs (W, L, H, settlement %) and one output in คิว.
- The app writes up to 11 BOQ lines (FILL-SITE, FILL-TRUCK, FILL-BACKHOE…). The Excel writes 2 lines (`งานรื้อถอน` เหมา; `ดินถม (ตามสเปค) + บดอัด` ลบ.ม.).
- App waste is applied in the calculator, and labour is priced on the gross qty. Excel: 30% settlement in the calculator, a further 10% waste in BOQ G13 that applies to material only, and labour on the net 234.
- The app's section is named `งานถมดิน`. The Excel section is `งานเตรียมพื้นที่`.

#### (e) Oddities
- **Two allowances stack**: 30% settlement (sheet34 D7) and then 10% waste (BOQ G13). Material is bought for 234 × 1.1 = 257.4 m³ on 180 m³ of compacted volume. Owner: keep both?
- The percent format differs between sheets: sheet34 D7 is entered as 30 (÷100), while BOQ G and sheet37 C13 use fractions (0.1).
- The demolition sheet has no formulas (static zeros), and its total is not linked.
- J14/L14 omit row 12.
- Unit mismatch: the calculator says "คิว" and BOQ says "ลบ.ม.". They are the same unit.

---

### Section 2: งานน้ำ-ไฟชั่วคราว (STEP 02 "เดินน้ำ–ไฟชั่วคราว")

#### (a) BOQ Home rows

| Row | Desc | Unit | Qty source | Waste | Mat (I) | Lab (K) | Note |
|---|---|---|---|---|---|---|---|
| 16 | `เดินน้ำ-ไฟชั่วคราว` (link to sheet37) | เหมา | E16 = 1.0 typed (not yellow) | 0 | **I16 = 6,500 (typed input)** | **K16 = 1,500 (typed input)** | none |
| 17 | `รวม >> ` | | | | J17 = 6,500 | L17 = 1,500 | **M17 = 8,000 → S-Curve G14** |

I16 (6,500) roughly equals the calculator total C30 (6,469), rounded up, but it is **not linked**. K16 (1,500) has no source in the v5 calculator.

#### (b) Calculator sheet37 `น้ำไฟชั่วคราว`

Purpose: materials for temporary water and power, exported to BOQ as **one** line (note E31). Title B2 (merged B2:H2): `โปรแกรมคำนวณ เดินน้ำ–ไฟชั่วคราว ⚡`.

Header inputs (yellow, blank by default): C5 `ชื่อโครงการ` (B5); F5 `ผู้คำนวณ` (E5); C6 `วันที่คำนวณ` (B6, date); F6 `หมายเหตุ` (E6).

Inputs. Section header B8 `ข้อมูลที่ต้องกรอก`:

| Cell | Label (B) | Default | Unit (D) | Hint (E) |
|---|---|---|---|---|
| C9 | `ระยะจากมิเตอร์ไฟ` | 25 | ม. | `ใช้คำนวณสายไฟ THW` |
| C10 | `ระยะจากมิเตอร์น้ำ` | 25 | ม. | `ใช้คำนวณท่อ PVC` |
| C11 | `จำนวนจุดใช้น้ำ` | 3 | จุด | `เช่น ก๊อกน้ำ / จุดล้าง` |
| C12 | `จำนวนจุดไฟ / ปลั๊ก` | 6 | ชุด | `หลอดไฟ + ปลั๊กไฟ` |
| C13 | `เผื่อวัสดุสูญเสีย` | 0.10 (10%) | % | `แนะนำ 5–10%` |
| C14 | `อุปกรณ์ต่อท่อน้ำ` | 0.30 (30%) | `% ของค่าวัสดุน้ำหลัก` | `ข้องอ/ข้อต่อ/วาล์ว/เทป/กาว` |
| C15 | `อุปกรณ์ประกอบไฟฟ้า` | 0.15 (15%) | `% ของค่าวัสดุไฟหลัก` | `เทปพันสาย/แคล้มป์/อื่น ๆ` |

Item table. Header row 17: B `รายการ`, C `ปริมาณ`, D `หน่วย`, E `สูตร/ที่มา`, F `ราคาต่อหน่วย`, G `รวมราคา`, H `หมายเหตุ`.

| Row | Item (B) | Qty (C) formula | Unit | Formula hint (E) | Unit price F (input) | Total G |
|---|---|---|---|---|---|---|
| 18 | `ท่อ PVC 1/2 นิ้ว` | `=CEILING(($C$10/4)*(1+$C$13),1)` = 7 | เส้น | `ปัดขึ้น ระยะน้ำ ÷ 4 ม. × Waste` | 60 | `=F18*C18` = 420 |
| 19 | `ก๊อกน้ำ 1/2 นิ้ว` | `=$C$11` = 3 | อัน | `เท่ากับจำนวนจุดใช้น้ำ` | 120 | `=F19*C19` (shared) = 360 |
| 20 | `อุปกรณ์ต่อท่อน้ำ` | blank | blank | `% ของค่าวัสดุหลัก` | (yellow, blank, unused) | `=(SUM(G18:G19))*(C14)` = 234 |
| 21 | `ตู้ไฟฟ้าชั่วคราว 30A` | `=1` = 1 | ชุด | blank | 1,200 | `=F21*C21` = 1,200 |
| 22 | `สายไฟ THW 1x10 ตร.มม.` | `=CEILING(($C$9/50)*(1+$C$13),1)` = 1 | ม้วน | `ปัดขึ้น ระยะไฟ ÷ 50 ม.` | 2,500 | `=F22*C22` (shared) = 2,500 |
| 23 | `หลอดไฟ + ปลั๊กไฟ` | `=$C$12` = 6 | ชุด | `เท่ากับจำนวนจุดไฟ/ปลั๊ก` | 200 | `=F23*C23` (shared) = 1,200 |
| 24 | `อุปกรณ์ประกอบไฟฟ้า` | blank | blank | `% ของค่าวัสดุหลัก` | (yellow, blank, unused) | `=(SUM(G22:G23))*(C15)` = 555 |

In plain language:
- Pipe sticks = roundup(water distance ÷ 4 m per stick × (1 + waste)).
- Cable rolls = roundup(power distance ÷ 50 m per roll × (1 + waste)).
- Water fittings = 30% × (pipe + faucets).
- Electrical accessories = 15% × (cable + lights/plugs). The 30A box is not included in this base.

Summary. Header B26 `สรุปราคา STEP 02`:

| Cell | Label | Formula | Value |
|---|---|---|---|
| C27 | `ค่าวัสดุน้ำประปาชั่วคราว` | `=SUM(G18:G20)` | 1,014 |
| C28 | `ค่าวัสดุไฟฟ้าชั่วคราว` | `=SUM(G21:G24)` | 5,455 |
| C29 | (blank) | | |
| C30 | `รวมต้นทุน` (pink fill) | `=SUM(C27:C29)` | **6,469** |

Warning box E27:H31, header `คำเตือน / ข้อควรระวัง`:
1. `ราคานี้เป็นต้นทุนตั้งต้น ปรับ Rate ได้`
2. `ถ้าระยะไฟไกลมาก ควรให้ช่างไฟตรวจขนาดสายจริง`
3. `อุปกรณ์ต่อท่อและไฟฟ้าคิดเป็น % เพื่อลดความรกใน BOQ`
4. `BOQ หลักส่งออกเป็นรายการเดียว: เดินน้ำ–ไฟชั่วคราว`

- Free rows: none.
- Output: C30, which is intended for BOQ I16 (material). It is **not linked** today.

**Newer variant shown in deck p10.** The BOQM screenshot differs from the v5 dump:
- Two extra inputs: `ค่าแรงติดตั้งน้ำ` 30% `% ของค่าวัสดุน้ำ` `ปรับได้`, and `ค่าแรงติดตั้งไฟ` 30% `% ของค่าวัสดุไฟ` `ปรับได้`.
- Two extra item rows: `ค่าแรงติดตั้งน้ำ` (บาท, `% ของค่าวัสดุน้ำรวม`) and `ค่าแรงติดตั้งไฟ` (บาท, `% ของค่าวัสดุไฟรวม`).
- The 30A box hint becomes `Default 1 ชุด`.
- The fittings and accessories rows have the note `คิดเป็น % ไม่แตกย่อย`.
- The accessories hint becomes `เทปพันสาย/แคล้มป์/หางปลา/อื่น ๆ`.
- Summary: `ค่าวัสดุน้ำประปาชั่วคราว`, `ค่าวัสดุไฟฟ้าชั่วคราว`, `ค่าแรงรวม`, `รวมต้นทุน`, `กำไร/บริหาร`, `รวมเสนอราคา` (shown in red). All values are 0.00 in the screenshot and the profit % is not visible.

This variant would supply the BOQ labour figure, which v5 hard-codes as K16 = 1,500.

#### (c) Review deck notes
- p9 (ConTrack, titled `ขั้นตอน 2 : เดินน้ำ–ไฟชั่วคราว`): today's dropdowns are highlighted with arrows:
  - meter `1 เฟส 15(45)A / 1 เฟส 30(100)A / 3 เฟส 30(100)A`
  - main breaker `15A/30A/45A/60A/100A`
  - main cable `4/10/16/25/35/70 มม²`
  - water meter `1/2 นิ้ว (4 หุน) / 3/4 นิ้ว (6 หุน)`
  - pipe `PE / PVC`
  - The app's cost preview totals ฿22,438.40, including a meter 12,000 and a permit 2,000.
- p10: the BOQM calculator (newer variant above).
- p11: MEA (การไฟฟ้านครหลวง) table `คำแนะนำการติดตั้งระบบไฟฟ้า`, i.e. the main cable and main switch size that suits each meter size for houses in the MEA area. The rows `15(45)`, 1 phase, are boxed in red. Table transcribed below.
- p12: MEA table `ค่าบริการขอใช้ไฟฟ้าชั่วคราว แรงดันต่ำ` (temporary-supply fees). Transcribed below.
- There is no red text on p9 to p12. **Interpretation:** the customer wants the electrical dropdowns to follow the MEA rules. Choosing a meter size and breaker should fix the main cable size from the MEA table, and the MEA connection fee, monthly rental and deposit should come from the fee table, instead of the app's invented values. This needs confirmation (Open questions).

MEA table 1 (deck p11): main cable size [ground-conductor size] in mm², by meter and breaker.

| Meter (A) | Phase | Max CB (A) | VAF on wall | 60227 IEC 01 on insulators | 60227 IEC 01 in conduit / wall / ceiling | Underground CV*** | Underground NYY |
|---|---|---|---|---|---|---|---|
| 5(15) | 1 | 16 | 4 [10] | 4* [10] | 4 [10] | 10 [10] | 10 [10] |
| **15(45)** | 1 | 40 | 6 [10] | 10 [10] | 10 [10] | 10 [10] | 10 [10] |
| **15(45)** | 1 | 50 | 10 [10] | 10 [10] | 10 [10] | 10 [10] | 10 [10] |
| 30(100) | 1 | 63 | 16 [10] | 16 [10] | 16 [10] | 16 [10] | 16 [10] |
| 30(100) | 1 | 80 | - | 25 [10] | 25 [10] | 16 [10] | 25 [10] |
| 30(100) | 1 | 100 | - | 25 [10] | 35 [10] | 25 [10] | 25 [10] |
| 15(45) | 3 | 40 | - | 10 [10] | 10 [10] | 10 [10] | 10 [10] |
| 15(45) | 3 | 50 | - | 10 [10] | 16 [10] | 10 [10] | 10 [10] |
| 30(100) | 3 | 63 | - | 16 [10] | 25 [10] | 16 [10] | 16 [10] |
| 30(100) | 3 | 80 | - | 25 [10] | 35 [10] | 16 [10] | 25 [10] |
| 30(100) | 3 | 100 | - | 25 [10] | 50 [16] | 25 [10] | 35 [10] |
| 50(150) | 3 | 125 | - | 35 [10] | 70 [25] | 35 [10] | 50 [16] |
| 200 | 3 | 160 | - | 50 [16] | 95 [25] | 70 [25] | 70 [25] |
| 200 | 3 | 200 | - | 70 [25] | 120 [35] | 95 [25] | 95 [25] |
| 200 | 3 | 250 | - | 95 [25] | 185 [35] | 120 [35] | 150 [35] |
| 400 | 3 | 300 | - | 120 [35] | 2x95** [50] | 150 [35] | 2x95** [50] |
| 400 | 3 | 320 | - | 150 [35] | 2x95** [50] | 185 [35] | 2x95** [50] |
| 400 | 3 | 400 | - | 185 [35] | 2x120** [50] | 2x95** [50] | 2x150** [50] |
| 400 | 3 | 500 | - | 2x95 [50] | 2x185** [70] | 2x150** [50] | 2x185** [70] |

Footnotes to table 1:
- `*` 6 mm² is recommended for mechanical strength.
- `**` Parallel cables must be the same type, size, length and route.
- `***` CV = XLPE-insulated, PVC-sheathed copper, 0.6/1 kV.
- `[…]` = ground-conductor size.
- Source: MEA guide based on the 2564 wiring standard, revised 29 เมษายน 2567.

MEA table 2 (deck p12): `ค่าบริการขอใช้ไฟฟ้าชั่วคราว แรงดันต่ำ`.

| Supply size (A) | Meter (A) | Phase | Connection fee (บาท/ครั้ง) | Equipment rental (บาท/เดือน) | Deposit, type 1 | Deposit, type 2 |
|---|---|---|---|---|---|---|
| ไม่เกิน 30 | 15 (45) | 1 | 400 | 0 | 2,000 | 10,000 |
| 31-75 | 30 (100) | 1 | 500 | 930 | 4,000 | 20,000 |
| ไม่เกิน 30 | 15 (45) | 3 | 1,000 | 2,250 | 6,000 | 30,000 |
| 31-75 | 30 (100) | 3 | 1,200 | 2,550 | 12,000 | 60,000 |
| 76-100 | 50 (150) | 3 | 1,500 | 3,090 | 24,000 | 90,000 |
| 101-200 | 200 | 3 | 2,500 | 4,440 | 48,000 | 150,000 |
| 201-400 | 400 | 3 | 4,000 | 22,800 | 96,000 | 300,000 |

Notes to table 2:
- Type 1 = temporary supply for building one's own house, or temporary use inside one's own house.
- Type 2 = all other cases: more than one building, row houses, commercial buildings, factories.
- A letter guaranteeing outstanding temporary-supply debts is required, signed by the landowner or premises owner (government and similar bodies are exempt).
- Without the guarantee letter, the deposit is doubled ("เพิ่มขึ้นอีก 1 เท่า").

#### (d) Today's app vs Excel
- App inputs: distances, waste, sockets, lights, breaker, cable size, PE/PVC, pipe Ø, ground rods, tank, meter type, water meter, permit. Excel inputs: 2 distances, water points, light/plug points, waste, fitting %, accessory %.
- App quantities are in metres (cable = distance × waste; conduit +15%; fittings every 6 m; valves; DB by area/400). Excel uses **purchase units**: PVC sticks of 4 m, cable rolls of 50 m, both rounded up. Fittings and accessories are a **% of main material**, and the 30A box is fixed at 1.
- The app's cable lookup `CABLE_SIZE_BY_AMP` (15→2.5, 30→10, 45→16, 100→70 …) is invented and does not match MEA table 1. The Excel itself fixes the cable as THW 1x10 mm².
- The app writes about 16 BOQ lines (UTIL-CABLE, UTIL-METER-E30 12,000, UTIL-PERMIT …). The Excel writes **1 line**, `เดินน้ำ-ไฟชั่วคราว` 1 เหมา, with mat 6,500 and lab 1,500.
- The app has no labour % and no profit or overhead line (both are in the deck-p10 variant).

#### (e) Oddities
- I16 and K16 are typed, not linked to C30. 6,500 ≠ 6,469.
- K16 = 1,500 labour has no source in v5. The p10 variant would compute it as 30% of materials.
- F20 and F24 are yellow but unused. G20 and G24 use lowercase `sum` (Google Sheets).
- C21 is hard-coded `=1` (one box regardless of the inputs).
- Waste is applied only to pipe and cable counts, then rounded up.
- C30 sums C27:C29 with C29 empty; that slot is reserved for "ค่าแรงรวม" in the variant.
- MEA meter connection fees and deposits are **not** in the Excel at all. Including them is an owner decision.

---

### Section 3: งานเตรียมพื้นที่หน้างาน (STEP 03 "เตรียมพื้นที่หน้างาน")

#### (a) BOQ Home rows (v5 dump)

All of E, G, I and K are yellow inputs. H, J, L and M follow the standard formulas.

| Row | No. | Desc | Unit | Qty E | Waste | Mat I | Lab K | Row total M |
|---|---|---|---|---|---|---|---|---|
| 19 | 1) | `ห้องพักคนงาน` | ห้อง | 4 | 0 | 7,000 | 1,000 | 32,000 |
| 20 | 2) | `ห้องน้ำคนงาน` | ห้อง | 2 | 0 | 4,700 | 500 | 10,400 |
| 21 | 3) | `ห้องอาบน้ำ` | ห้อง | 1 | 0 | 4,500 | 500 | 5,000 |
| 22 | 4) | `สโตร์เก็บของ` | ห้อง | 1 | 0 | 7,000 | 1,000 | 8,000 |
| 23 | 5) | `โรงเก็บปูน` | ห้อง | 0 | 0 | 0 | 0 | 0 |
| 24 | 6) | `พื้นที่ทำงานชั่วคราว (ดัดเหล็ก)` | เหมา | 0 | 0 | 0 | 0 | 0 |
| 25 | 7) | `รั้วชั่วคราว` | เหมา | 0 | 0 | 0 | 0 | 0 |
| 26 | 8) | `ประตูเข้า–ออก` | เหมา | 0 | 0 | 0 | 0 | 0 |
| 27 | 9) | `ผ้าใบกันฝุ่น` | เหมา | 0 | 0 | 0 | 0 | 0 |
| 28 | 10) | `จุดกองวัสดุ` | เหมา | 0 | 0 | 0 | 0 | 0 |
| 29 | 11) | `พื้นที่ทิ้งขยะ` | เหมา | 0 | 0 | 0 | 0 | 0 |
| 30 | | `รวม >> ` | | | | J30 `=SUM(J19:J29)` = 48,900 | L30 `=SUM(L19:L29)` = 6,500 | M30 = 55,400 |

- No row has a calculator formula. The section title C18 links to the **external** camp calculator.
- The deck p16 BOQ screenshot (an older or other version) has a different list. It has 10 items, all with prices 5,000/1,000 for ห้องพัก / สโตร์ / ห้องน้ำ: `1) ห้องพักคนงาน 4`, `2) สโตร์เก็บของ 1`, `3) ห้องน้ำคนงาน 2`, `4) ห้องอาบน้ำ –`, `5) รั้วชั่วคราว`, `6) ประตูเข้า–ออก`, `7) ผ้าใบกันฝุ่น`, `8) จุดกองวัสดุ`, `9) พื้นที่ทำงานชั่วคราว 1 เหมา 3,000/500`, `10) พื้นที่ทิ้งขยะ`. It has no โรงเก็บปูน. **Treat the v5 dump as authoritative unless the owner says otherwise.**

#### (b) Calculator: external Google Sheet (rId2), reconstructed from deck p16

- Title: `โปรแกรมคำนวณวัสดุแคมป์คนงาน / ห้องน้ำ / ห้องอาบน้ำ / สโตร์เก็บของ`
- Subtitle: `STEP 03 : เตรียมพื้นที่หน้างาน (Site Preparation)`

Inputs. Header `ข้อมูลที่ต้องกรอก`, yellow:

| Label | Default | Unit | Hint |
|---|---|---|---|
| `จำนวนห้องพักคนงาน` | 4 | ห้อง | `ฐานตัวอย่าง: 4 ห้อง ขนาด 2.4 x 3.6 ม.` |
| `จำนวนห้องน้ำ` | 2 | ห้อง | `ฐานตัวอย่าง: 2 ห้อง ขนาด 1.2 x 1.2 ม.` |
| `จำนวนห้องอาบน้ำ` | 1 | ห้อง | `ฐานตัวอย่าง: 1 ห้อง ขนาด 1.5 x 3.0 ม.` |
| `จำนวนสโตร์เก็บของ` | 1 | ห้อง | `ฐานตัวอย่าง: 1 ห้อง ขนาด 2.4 x 2.4 ม.` |
| `เผื่อวัสดุสูญเสีย` | 5% | % | `แก้เป็น 0.05 = 5%` |
| `ค่าแรงติดตั้ง` | 20% | `% ของค่าวัสดุ` | `ใช้คำนวณ BOQ รวม` |

Material table columns:
- `หมวด` (group)
- `รหัส` (code)
- `รายการวัสดุ` (item)
- `หน่วย` (unit)
- `ปริมาณฐาน` (base qty for the sample)
- `ฐานต่อ` (number of rooms the base qty covers)
- `จำนวนที่กรอก` (rooms entered)
- `ปริมาณคำนวณ` (calculated qty)
- `ปริมาณรวมเผื่อ` (qty incl. waste)
- `ราคาต่อหน่วย` (unit price)
- `รวมวัสดุ` (material total)
- `หมายเหตุ` (note)

Formulas, inferred from the values and consistent on every visible row:
- `ปริมาณคำนวณ` = ปริมาณฐาน × จำนวนที่กรอก ÷ ฐานต่อ
- `ปริมาณรวมเผื่อ` = ROUNDUP(ปริมาณคำนวณ × (1 + เผื่อ), 0). Examples: 12 → 13, 1 → 2, 55 → 58.
- `รวมวัสดุ` = ปริมาณรวมเผื่อ × ราคาต่อหน่วย
- Labour = 20% × material total. This is only stated by the input hint; the summary is not visible.

Visible rows (the screenshot is cut off after about 22 rows; the ห้องอาบน้ำ and สโตร์ groups are not visible):

| หมวด | รหัส | รายการวัสดุ | หน่วย | ฐาน | ฐานต่อ | กรอก | คำนวณ | รวมเผื่อ | ราคา | รวม | หมายเหตุ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| แคมป์คนงาน | PLY15 | ไม้อัดดำ 4x8 ฟุต หนา 15 มม. | แผ่น | 12 | 4 | 4 | 12 | 13 | 550 | 7,150 | ฐาน 4 ห้อง |
| แคมป์คนงาน | EUCALYPTUS | ไม้ยูคา 2.5 นิ้ว x 3 ม. | ท่อน | 200 | 4 | 4 | 200 | 210 | 55 | 11,550 | |
| แคมป์คนงาน | ZINC6 | สังกะสี 66.5 ซม. x 6 ฟุต (หลังคา) | แผ่น | 55 | 4 | 4 | 55 | 58 | 150 | 8,700 | |
| แคมป์คนงาน | ZINC7 | สังกะสี 66.5 ซม. x 7 ฟุต (ผนัง) | แผ่น | 15 | 4 | 4 | 15 | 16 | 170 | 2,720 | |
| แคมป์คนงาน | ZINC8 | สังกะสี 66.5 ซม. x 8 ฟุต | แผ่น | 15 | 4 | 4 | 15 | 16 | 190 | 3,040 | |
| แคมป์คนงาน | NAIL3X10_BOX | ตะปู 3 x 10 (กล่อง 18 กก.) | กล่อง | 1 | 4 | 4 | 1 | 2 | 850 | 1,700 | |
| แคมป์คนงาน | NAIL15_BOX | ตะปู 1-1/2 x 14 (ถุง 1 กก.) | กล่อง | 3 | 4 | 4 | 3 | 4 | 60 | 240 | |
| แคมป์คนงาน | ZINC_NAIL | ตะปูตอกสังกะสี 1-3/4 นิ้ว x 13 (กล่อง 0.154 กก.) | กล่อง | 5 | 4 | 4 | 5 | 6 | 35 | 210 | |
| แคมป์คนงาน | STRING60 | สายเอ็น สีเขียว #60 | ม้วน | 2 | 4 | 4 | 2 | 3 | 45 | 135 | |
| ห้องน้ำ | EUCALYPTUS | ไม้ยูคา 2.5 นิ้ว x 3 ม. | ท่อน | 13 | 2 | 2 | 13 | 14 | 55 | 770 | ฐาน 2 ห้อง |
| ห้องน้ำ | ZINC6 | สังกะสี 66.5 ซม. x 6 ฟุต | แผ่น | 3 | 2 | 2 | 3 | 4 | 150 | 600 | |
| ห้องน้ำ | ZINC7 | สังกะสี 66.5 ซม. x 7 ฟุต | แผ่น | 11 | 2 | 2 | 11 | 12 | 170 | 2,040 | |
| ห้องน้ำ | CONCRETE_RING80 | วงส้วม ขนาด 80 ซม. | วง | 4 | 2 | 2 | 4 | 5 | 280 | 1,400 | |
| ห้องน้ำ | RING_COVER80 | ฝาปิดวงส้วม ขนาด 80 ซม. | อัน | 2 | 2 | 2 | 2 | 3 | 160 | 480 | |
| ห้องน้ำ | TOILET_FLAT | ส้วมนั่งราบ | ตัว | 2 | 2 | 2 | 2 | 3 | 850 | 2,550 | |
| ห้องน้ำ | CEMENT_TPI50 | ปูนเขียว TPI 50 กก. | ถุง | 2 | 2 | 2 | 2 | 3 | 165 | 495 | |
| ห้องน้ำ | SAND25 | ทรายหยาบ ถุง 25 กก. | ถุง | 10 | 2 | 2 | 10 | 11 | 45 | 495 | |
| ห้องน้ำ | STONE25 | หิน 3/4 ถุง 25 กก. | ถุง | 6 | 2 | 2 | 6 | 7 | 55 | 385 | |
| ห้องน้ำ | FAUCET12 | ก๊อกน้ำ 1/2 นิ้ว | อัน | 2 | 2 | 2 | 2 | 3 | 120 | 360 | |
| ห้องน้ำ | PVC12_PIPE | ท่อหนา PVC 1/2 นิ้ว | เส้น | 2 | 2 | 2 | 2 | 3 | 85 | 255 | |
| ห้องน้ำ | PVC12_FEMALE_ELBOW | ข้องอเกลียวใน หนา PVC 1/2 นิ้ว | ตัว | 1 | 2 | 2 | 1 | 2 | 25 | 50 | |
| ห้องน้ำ | PVC12_TEE | สามทาง หนา PVC 1/2 นิ้ว | อัน | 2 | 2 | 2 | 2 | 3 | 18 | 54 | |
| … | (more rows cut off: ห้องอาบน้ำ, สโตร์เก็บของ groups) | | | | | | | | | | |

- Free rows: unknown, because the sheet is external.
- Output: no live link to BOQ. The 4 room counts correspond to BOQ E19:E22. Group material totals ÷ rooms, or the totals themselves, would feed I19:I22, and 20% labour would feed K. The camp group visible so far is 35,445 for 4 rooms (8,861 per room), which is not the 7,000 in I19, so the BOQ prices are retyped or estimated by hand.

#### (c) Review deck notes
- p14 and p15 (ConTrack): today's inputs:
  - site width and length, peak workers, waste %
  - fence material dropdown `แผ่นสังกะสีลูกฟูก (Corrugated Zinc) / ตาข่ายเหล็กถัก (Chain Link Mesh) / รั้วบล็อกคอนกรีต (Concrete Block)`
  - fence height, gate count and width, access road length and width, rebar yard area, storage and drainage ratios
  - toilets, duration, area per worker, safety signs, billboard toggle, mobilisation in and out
  - The cost preview of ฿8,400 is only gate, billboard and safety signs.
- p16 (BOQM): BOQ section 3 with an arrow to the external camp-materials calculator. There is no red text.

#### (d) Today's app vs Excel
- The app derives everything from site W × L and the worker count (fence area, camp m², storage ratio, drains, 1 toilet per 15 workers). The Excel is a **fixed list of 11 room and lump-sum items** with typed qty, unit price and labour price, plus a materials take-off by **room count**.
- The app writes about 12 BOQ lines from the price list (SITE-FENCE-ZINC, SITE-CAMP 800/m² …). The Excel lines are `ห้องพักคนงาน` ห้อง, `ห้องน้ำคนงาน`, `ห้องอาบน้ำ`, `สโตร์เก็บของ`, `โรงเก็บปูน`, and six `เหมา` items.
- These exist in the app but not in the Excel: fence types, access road, signage, mobilisation, toilet rental. These exist in the Excel but are missing from the app: ห้องอาบน้ำ, โรงเก็บปูน, ผ้าใบกันฝุ่น, พื้นที่ทิ้งขยะ, and the camp material list.

#### (e) Oddities
- The calculator is external and not linked. BOQ prices (7,000 / 4,700 / 4,500 / 7,000) do not equal the calculator output.
- The v5 dump and the deck p16 screenshot disagree on item order, the item set and the prices.
- Items 5 to 11 are all 0 and `เหมา`. Is the list meant to be optional or user-extensible?

---

### Section 4: งานวางผัง / ปักหมุด (STEP 04)

#### (a) BOQ Home rows

| Row | Desc | Unit | Qty | Waste | Mat I | Lab K | Note |
|---|---|---|---|---|---|---|---|
| 32 | `วางผัง / ปักหมุด` | เหมา | E32 = 1 (input) | 0 | **4,000 (input)** | **1,500 (input)** | none |
| 33 | `รวม >> ` | | | | J33 `=SUM(J32)` = 4,000 | L33 `=SUM(L32)` = 1,500 | M33 = 5,500 |

Deck p19 shows an older version: I32 = 6,000, total 7,500. The section title C31 links to the **external** layout calculator.

#### (b) Calculator: external Google Sheet (rId3), reconstructed from deck p19

Title: `STEP 04 : โปรแกรมคำนวณวางผัง / ปักหมุด`.

INPUT block (yellow):

| Label | Default | Unit |
|---|---|---|
| `จำนวนผัง (จุด)` | 26 | จุด (layout points / batter-board stations) |
| `จำนวนไม้ปักหมุด (ต้น)` | 21 | ต้น (equals the 21 piles / footing centres) |
| `เผื่อวัสดุ (%)` | 5% | % |
| `ค่าแรงวางผัง / ปักหมุด` | 0 | บาท (lump sum) |
| `หมายเหตุ` | `กรอกช่องสีเหลืองเท่านั้น` | |

Material table. Columns: `รายการวัสดุ`, `หน่วย`, `ฐานต่อ 1 ผัง`, `ฐานคงที่`, `จำนวนก่อนเผื่อ`, `จำนวนสั่งซื้อ`, `ราคาต่อหน่วย`, `รวมราคา`.

| Item | Unit | Per 1 ผัง | Fixed | Before waste | Order qty | Unit price | Total |
|---|---|---|---|---|---|---|---|
| `ไม้หน้าสาม 1-1/2" x 3" ยาว 1 ม.` | ท่อน | 1 | 0 | 26 | 28 | 0.00 | 0.00 |
| `ไม้ยูคา 3 นิ้ว x 3 ม.` | ท่อน | 3 | 0 | 78 | 82 | 0.00 | 0.00 |
| `ไม้ปักหมุด` | ต้น | 0 | 21 (= stake input) | 21 | 23 | 0.00 | 0.00 |
| `ตะปู 1-1/2 x 14 (ถุง 1 กก.)` | กล่อง | 0 | 1 | 1 | 2 | 0.00 | 0.00 |
| `สายเอ็น สีเขียว #60` | ม้วน | 0 | 1 | 1 | 2 | 0.00 | 0.00 |

Formulas, inferred and consistent with all rows:
- Before waste = per-ผัง × จำนวนผัง + ฐานคงที่
- Order qty = ROUNDUP(before × (1 + เผื่อ), 0). Examples: 26 → 28, 78 → 82, 21 → 23, 1 → 2.
- Total = order qty × unit price.

All unit prices are 0 in the screenshot. They are probably inputs, but their colour cannot be confirmed.

LIVE PREVIEW block:
- `จำนวนผัง` 26 ผัง
- `ไม้หน้าสาม` 28 ท่อน
- `ไม้ยูคา` 82 ท่อน
- `ไม้ปักหมุด` 23 ต้น
- `รวมค่าวัสดุ` = SUM(total) บาท
- `ค่าแรง` = labour input บาท
- `รวม Step 04` = materials + labour

BOQ PREVIEW block:
- Columns: `หมวด | รายการ | หน่วย | ปริมาณ | ค่าวัสดุ | ค่าแรง | รวม | หมายเหตุ`
- Row: `ขั้นตอน 4 | วางผัง / ปักหมุด | เหมา | 1 | <รวมค่าวัสดุ> | <ค่าแรง> | <รวม> | รวมวัสดุตามรายการคำนวณ`
- In other words, it maps to BOQ row 32 as qty 1 เหมา, I32 = material total and K32 = labour.

- Free rows: unknown, because the sheet is external.
- Output: the BOQ PREVIEW row → BOQ I32 / K32. This is **not live-linked** in the Excel.

#### (c) Review deck notes
- p18 (ConTrack): today's inputs are building W and L, column count and waste. Its preview has perimeter, string, boards, posts, nails, concrete markers, spray paint, survey crew and diagonal, and a cost of ฿1,730 (spray 130 + crew 1,600). It also shows warnings about offset, board height and diagonal QC.
- p19 (BOQM): BOQ row 32 and the external calculator above. There is no red text.

#### (d) Today's app vs Excel
- App inputs are building dimensions and column count. Excel inputs are **number of layout points (ผัง)**, **number of stakes**, waste % and a labour lump sum.
- The app computes perimeter-based string and profile boards with offset and post spacing. The Excel uses fixed per-point quantities (1 ไม้หน้าสาม + 3 ไม้ยูคา per ผัง), fixed extras (1 box of nails, 1 roll of string) and roundup after waste.
- The app writes 7 BOQ lines (LAYOUT-STR, LAYOUT-BOARD, LAYOUT-CREW 800/man-day …). The Excel writes 1 line, `วางผัง / ปักหมุด` 1 เหมา (mat = materials total, lab = typed lump sum).
- Diagonal QC, offset and board-height warnings exist only in the app.

#### (e) Oddities
- The calculator is external, so BOQ I32/K32 are retyped (4,000 / 1,500 vs the calculator's 0 / 0 in the screenshot).
- The stake count (21) duplicates the pile count E35 (21) by hand.
- The nail unit is `กล่อง` while the description says "ถุง 1 กก." (the same mismatch appears in the camp sheet).

---

### Section 5: งานเสาเข็ม (STEP 05)

#### (a) BOQ Home rows

| Row | Desc | Unit | Qty | Waste | Mat I | Lab K | Note |
|---|---|---|---|---|---|---|---|
| 35 | `เสาเข็ม` | ต้น | **E35 = 21 (input)** | 0 | 0 | **2,500 (input)** | `เสาเข็มตอก (I - 22 x 22 ยาว 6 ม.)` |
| 36 | `รวม >> ` | | | | J36 = 0 | L36 = 52,500 | M36 = 52,500 |

- E35 is reused downstream: E39 `ตัดหัวเสาเข็ม` = `=E35`, in section 6.
- In deck p22 the spec text is the description itself (`เสาเข็มตอก (I - 22 x 22 ยาว 6 ม.)` in the D column, yellow). In v5 the description is `เสาเข็ม` and the spec sits in the note N35.

#### (b) Calculator
**None.** Section 5 has no linked sheet. The whole step is one BOQ line: piles × lump price per pile.

#### (c) Review deck notes
- p21 (ConTrack): today's app has pile type `เสาเข็มตอก (Driven Pile)`, total piles, length/depth and waste. Its preview shows piles, work days (8/day), driving duration, total length and head cutting. Warnings: section not specified; mobilisation days not set.
- p22 (BOQM): **red note: `ประเมินราคาแบบเหมา แต่ต้องใส่ spec ให้ครบ`**. Price it as a lump sum per pile, but the spec must be complete (type, section, length) in the description or note.

#### (d) Today's app vs Excel
- The app is a full pile engine:
  - driven, bored or mini piles
  - I-15 to I-52.5 sections, spun piles
  - machine days, transport, surcharge for fewer than 50 piles
  - welding, load, seismic and soil tests
  - about 50 possible BOQ codes priced per metre or per piece
- The Excel is **one line**: qty (piles) × labour unit price per pile (2,500, all-in), mat 0, plus a spec text.
- The app prices piles per metre with waste. The Excel prices per pile with no waste and no length maths.
- The app has no free-text spec field that is carried into the BOQ description or note, which is what the customer asked for.

#### (e) Oddities
- The supply and driving cost of a pile sits entirely in the *labour* column (I35 = 0).
- The spec is free text. Which spec fields are mandatory is undefined ("ให้ครบ"). **Owner decision.**
- The pile count is typed, not derived from the footing calculator. It is also duplicated by hand as the stake count in step 4.

---

## Part C: Open questions for the owner
1. **Grand total**: M310 excludes section 0 (M10 = 7,500), and S-Curve and CashFlow also start at section 2. Is this intentional (a pre-contract cost), or should section 0 be added?
2. **Authoritative version**: the v5 dump differs from the deck screenshots in three places:
   - section 3 items, order and prices
   - layout price 4,000 vs 6,000
   - the temporary-utility calculator: p10 adds labour % and a profit/overhead → `รวมเสนอราคา` chain

   Which version should the app follow?
3. **Calculator → BOQ links**: should BOQ K9, E12/I12/K12, I16/K16, I19:K22 and I32/K32 be fed automatically from the calculators? In the Excel they are typed copies. If they should be fed, which column (material or labour) does each lump sum go to?
4. **Demolition sheet35**: confirm F = D × E and total → BOQ row 12 as 1 เหมา, and say which column. Also, should J14/L14 include row 12?
5. **Fill allowances**: keep 30% settlement (calculator) plus 10% waste (BOQ) stacked?
6. **MEA rules (deck p9 to p12)**:
   - Should the meter size and breaker dropdowns drive the main cable size from MEA table 1?
   - Should MEA connection fee, monthly rental and deposit (type 1 or 2, doubled without a guarantee letter) become BOQ cost lines?
   - Which wiring method column applies by default?
7. **External sheets**: the camp/toilet/store and layout calculators live in external Google Sheets, and only partial screenshots are available. Please supply the full sheets, including all groups (ห้องอาบน้ำ, สโตร์), price cells and the summary rows.
8. **Pile spec**: which fields are mandatory, for example type, section, length, count, and whether the price includes driving? Should the spec go in D or N?
9. **Free rows**: the Excel allows exactly one "+ เพิ่ม" row in the land-inspection list and none elsewhere. Should the app allow unlimited extra rows, and with an editable description?
10. **BOQ sub-total bugs** outside steps 0 to 5 (J95/L95, J216/L216, L243 ranges): fix them to cover the whole section?
11. **Man-Day_Basic** is an independent copy of the BOQ with its own price inputs. Should the app instead derive Man-Day from the single BOQ?
12. **Header fields**: should the project name, date and preparer typed on BOQ Home (D2:M4) auto-fill the calculator headers and the planning sheets? Today each sheet has its own copy.
