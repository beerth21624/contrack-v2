# 04 — Ceiling, Floor Tile, Toilet Tile, Wall Finishing, Paint (BOQ sections 19–23, 25, 31)

Source: workbook "โปรแกรมประมาณราคา BOQ … บ้านชั้นเดียว – Training Edition v5".
Dumps: `ctrv2/v5/sheet01.txt` (BOQ (Home)), `sheet14` (ฉาบปูน_Plaster, read only for cross-links), `sheet15`–`sheet19`; deck `ctrv2/review/page83–99, 104–107, 127–130`.

This spec replaces reading the Excel for these sections. All cell addresses are Excel addresses.

---

## 0. Conventions shared by every section below

### 0.1 BOQ (Home) row math (identical for every item row unless noted)

| Col | Meaning | Formula |
|---|---|---|
| E | ปริมาณ (net qty) | from calculator sheet (see each section) |
| F | หน่วย | text |
| G | %เผื่อ (waste) | **user input** (yellow) |
| H | ปริมาณเผื่อแล้ว (gross qty) | `=E*(100%+G)` |
| I | ค่าวัสดุ ต่อหน่วย | **user input** (yellow) |
| J | ค่าวัสดุ รวม | `=I*H` (material on GROSS qty) |
| K | ค่าแรง ต่อหน่วย | **user input** (yellow) |
| L | ค่าแรง รวม | `=K*E` (labour on NET qty) |
| M | รวมทั้งหมด | `=J+L` |
| N | หมายเหตุ | text |

Subtotal row "รวม >>": J = SUM(J of item rows), L = SUM(L …), M = SUM(M …) (M usually = J+L; see §3 for the one exception).
Grand total `M310 = M14+M17+…+M203+M208+M216+M221+M232+M243+M253+…+M308` (uses the M subtotals).

### 0.2 Fill colours in calculator sheets
- yellow `FFFFF2CC` = user input; grey `FFF2F2F2`/`FFF3F3F3`/`FFEFEFEF` = computed or header.
- Columns with a dropdown but no fill (symbol, item text, location, paint flag) are also **user inputs**.

### 0.3 Text-key matching
All the calculator→BOQ links are `SUMIF` on **text** (codes like `C1`, or full Thai descriptions). Many keys carry trailing / double spaces (`"ปูกระเบื้องแกรนิตโต้ "`, `"ทาสีฝ้า - ไม้ระแนง "`, `"ทาสีผนัง -  ภายนอก "`, `"ฉาบภายใน "`). The cached values prove matching worked, i.e. it behaves as trimmed matching. **App rule: use enum codes internally; never match on display strings.** Keep the display strings below verbatim (trimmed) as labels.

---

## 1. Section 19 งานฝ้าเพดาน — sheet 15 `ฝ้าเพดาน_Ceiling`

### 1.1 Purpose
Room-by-room ceiling take-off. Each row = one ceiling panel (room or part of room) with a type code C1–C4, area, location and a **paint-group flag** that sheet 19 (Paint) uses to split ceiling paint into interior / exterior / timber-slat.

### 1.2 Layout
Title A2 "โปรแกรมถอดแบบ – งานฝ้าเพดาน Ceiling", D2 hyperlink "Back Home" → `'BOQ (Home)'!A1`. Header row 4. Data rows **5–28 (24 rows)**; A = running number 1–24 (static).

### 1.3 INPUT columns (per row)

| Col | Label | Type | Unit | Options / notes |
|---|---|---|---|---|
| B | สัญลักษณ์ (type code) | dropdown | – | `C1, C2, C3, C4` (B5:B28) — **this is the key the BOQ sums on** |
| C | รายการ (description) | dropdown | – | (C5:C28) 4 strings, see 1.4. Independent of B in Excel (not auto-filled). |
| D | กว้าง (ม.) | number (yellow) | m | |
| E | ยาว (ม.) | number (yellow) | m | |
| G | ตำแหน่ง (location) | free text | – | room name, e.g. ทานอาหาร |
| H | แยกงานทาสี (paint group) | dropdown | – | `ทาสีฝ้า - ภายใน`, `ทาสีฝ้า - ภายนอก`, `ทาสีฝ้า - ไม้ระแนง` (H5:H28). Independent of B. |

### 1.4 Type code list (use as enum; description auto-filled in app)

| Code | Calculator description (C column) | BOQ description (D199–D202) |
|---|---|---|
| C1 | ฝ้าเพดานยิปซัมบอร์ด หนา 9 มม. โครงเคร่าซีลาย ทาสีอะคลีลิค | ฝ้าเพดานยิปซัมบอร์ด โครงเคร่าซีลาย หนา 9 มม. |
| C2 | ฝ้าเพดานยิปซัมบอร์ด ชนิดกันชื้น หนา 9 มม. โครงเคร่าซีลาย ทาสีอะคลีลิค | ฝ้าเพดานยิปซัมบอร์ด ชนิดกันชื้น โครงเคร่าซีลาย หนา 9 มม. |
| C3 | ฝ้าเพดานไฟเบอร์ซีเมนต์ หนา 4 มม. โครงเคร่าซีลาย ทาสีอะคลีลิค | ฝ้าเพดานไฟเบอร์ซีเมนต์ หนา 4 มม. |
| C4 | ฝ้าเพดานระแนงไม้ไฟเบอร์ซีเมนต์ กว้าง 4 นิ้ว หนา 9 มม. โครงเคร่าเหล็กกล่อง ทาสีย้อมไม้ | ฝ้าเพดานระแนงไม้ไฟเบอร์ซีเมนต์บอร์ด กว้าง 4 นิ้ว หนา 9 มม. |

Typical paint flag per type in the example: C1/C2 → ภายใน, C3 → ภายนอก, C4 → ไม้ระแนง (but user can choose any).

### 1.5 Computed field

| Cell | Label | Excel formula | Plain language |
|---|---|---|---|
| F5…F15, F18…F28 | รวม (ตร.ม.) | `=D*E` | flat ceiling area |
| F16, F17 | รวม (ตร.ม.) | `=(D*E)/COS(RADIANS(40))` | **sloped** ceiling (verandas under a 40° roof): plan area ÷ cos 40° (×1.3054) |

Empty rows show 0. The slope variant is a per-row formula difference (hard-coded 40°), not an input → see Oddities O-1.

### 1.6 Example data (training default; reproduce as seed)

| # | Code | W | L | F (m²) | Location | Paint group |
|---|---|---|---|---|---|---|
| 1 | C1 | 3.0 | 3.0 | 9.00 | ทานอาหาร | ภายใน |
| 2 | C1 | 3.0 | 3.0 | 9.00 | ครัว | ภายใน |
| 3 | C1 | 3.0 | 5.0 | 15.00 | รับแขก | ภายใน |
| 4 | C1 | 1.2 | 2.0 | 2.40 | โถงทางเดิน (1) | ภายใน |
| 5 | C1 | 1.2 | 1.5 | 1.80 | โถงทางเดิน (2) | ภายใน |
| 6 | C1 | 3.5 | 3.5 | 12.25 | ห้องนอน 1 (1) | ภายใน |
| 7 | C1 | 1.2 | 1.5 | 1.80 | ห้องนอน 1 (2) | ภายใน |
| 8 | C1 | 3.0 | 4.0 | 12.00 | ห้องนอน 2 | ภายใน |
| 9 | C1 | 3.0 | 3.0 | 9.00 | ห้องนอน 3 | ภายใน |
| 10 | C2 | 2.3 | 3.0 | 6.90 | ห้องน้ำ 1 | ภายใน |
| 11 | C2 | 1.8 | 2.0 | 3.60 | ห้องน้ำ 2 | ภายใน |
| 12 | C2 | 1.0 | 3.5 | 4.568925513 (sloped) | เฉลียง 1 | ภายใน |
| 13 | C2 | 1.0 | 4.0 | 5.221629157 (sloped) | เฉลียง 2 | ภายใน |
| 14 | C3 | 0.6 | 62.3 | 37.38 | ชายคาภายนอก | ภายนอก |
| 15 | C4 | 1.0 | 1.0 | 1.00 | เฉลียงพักผ่อน (1) | ไม้ระแนง |
| 16 | C4 | 3.5 | 4.0 | 14.00 | เฉลียงพักผ่อน (2) | ไม้ระแนง |
| 17 | C4 | 1.5 | 3.0 | 4.50 | เฉลียงพักผ่อน (3) | ไม้ระแนง |

Totals: C1 72.25 · C2 20.29055467 · C3 37.38 · C4 19.5. Paint groups: ภายใน 92.54055467 · ภายนอก 37.38 · ไม้ระแนง 19.5.

### 1.7 Outputs → consumers
- `SUM(F where B=Cn)` → BOQ E199–E202 (section 19).
- `SUM(F where H=group)` → Paint sheet C7/C8/C9 → BOQ rows 225–227, 247–249, 302–304.

### 1.8 BOQ rows — section 19 (rows 198 header … 203 subtotal)

| Row | Item | Desc | Unit | Qty source (E) | Waste G | Mat I | Lab K | Note |
|---|---|---|---|---|---|---|---|---|
| 199 | 1) | ฝ้าเพดานยิปซัมบอร์ด โครงเคร่าซีลาย หนา 9 มม. | ตร.ม. | `IFERROR(SUMIF(Ceiling!B:B,"C1",Ceiling!F:F),0)` = 72.25 | 0 | 185 | 130 | |
| 200 | 2) | ฝ้าเพดานยิปซัมบอร์ด ชนิดกันชื้น โครงเคร่าซีลาย หนา 9 มม. | ตร.ม. | SUMIF "C2" = 20.29 | 0 | 205 | 130 | |
| 201 | 3) | ฝ้าเพดานไฟเบอร์ซีเมนต์ หนา 4 มม. | ตร.ม. | SUMIF "C3" = 37.38 | 0 | 350 | 150 | |
| 202 | 4) | ฝ้าเพดานระแนงไม้ไฟเบอร์ซีเมนต์บอร์ด กว้าง 4 นิ้ว หนา 9 มม. | ตร.ม. | SUMIF "C4" = 19.5 | 0 | 700 | 350 | |
| 203 | รวม >> | | | | | J 44,258.81 | L 24,462.27 | M 68,721.09 |

Row M values: 22,758.75 · 6,797.34 · 18,690.00 · 20,475.00.
Note: the ceiling sheet has no frame (โครงคร่าว), no cornice (บัวฝ้า), no separate board quantity — the per-m² rate is all-in.

---

## 2. Section 20 งานปูกระเบื้องพื้น — sheet 16 `ปูกระเบื้องพื้น_Floor Tile`

### 2.1 Purpose
Room-by-room floor finish take-off (excluding bathrooms → section 21). Each row has a type code F1/F3/F4.

### 2.2 Layout
Title "โปรแกรมถอดแบบ – งานปูกระเบื้องพื้น Floor Tile", D2 Back Home. Header row 4. Data rows **5–34 (30 rows)**.

### 2.3 INPUT columns

| Col | Label | Type | Unit | Options |
|---|---|---|---|---|
| B | สัญลักษณ์ | dropdown | – | `F1, F3, F4` (no F2) — **BOQ key** |
| C | รายการ | dropdown | – | `ปรับระดับ ทำกันซึม`, `ปูกระเบื้องแกรนิตโต้ `, `ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น ` |
| D | กว้าง (ม.) | number (yellow) | m | |
| E | ยาว (ม.) | number (yellow) | m | may be an expression, e.g. E20 `=0.9+0.45`. E21 and E22 are **shared copies** of E20 (`=0.9+0.45`, no cell refs), not typed 1.35 |
| G | ตำแหน่ง | free text | – | |

Type code enum:

| Code | Calculator description | BOQ description |
|---|---|---|
| F1 | ปูกระเบื้องแกรนิตโต้ | ปูกระเบื้องแกรนิตโต้ |
| F3 | ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น | ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น (เฉลียง และบันได) |
| F4 | ปรับระดับ ทำกันซึม | ปรับระดับ ทำกันซึม (ดาดฟ้า ค.ส.ล.) |

(F3 is also used by the toilet sheet with a different BOQ row — code namespaces are per sheet.)

### 2.4 Computed
| Cell | Label | Formula |
|---|---|---|
| F5…F34 | รวม (ตร.ม.) | `=D*E` (0 if blank) |

No waste, no tile size, no adhesive/grout/skirting — all-in m² rate.

### 2.5 Example data

| # | Code | W | L | m² | Location |
|---|---|---|---|---|---|
| 1–9 | F1 | (same 9 rooms & dims as ceiling C1 rows 1–9) | | 9, 9, 15, 2.4, 1.8, 12.25, 1.8, 12, 9 | ทานอาหาร, ครัว, รับแขก, โถงทางเดิน (1), (2), ห้องนอน 1 (1), (2), ห้องนอน 2, ห้องนอน 3 |
| 10 | F3 | 1.0 | 3.5 | 3.5 | เฉลียง 1 |
| 11 | F3 | 1.0 | 4.0 | 4.0 | เฉลียง 2 |
| 12 | F3 | 1.0 | 3.0 | 3.0 | เฉลียง 3 |
| 13 | F3 | 1.0 | 1.0 | 1.0 | เฉลียงพักผ่อน (1) |
| 14 | F3 | 3.5 | 4.0 | 14.0 | เฉลียงพักผ่อน (2) |
| 15 | F3 | 1.5 | 3.0 | 4.5 | เฉลียงพักผ่อน (3) |
| 16 | F3 | 3.3 | 1.35 (`=0.9+0.45`) | 4.455 | บันได (1) |
| 17 | F3 | 2.0 | 1.35 (`=0.9+0.45`, shared from E20) | 2.7 | บันได (2) |
| 18 | F3 | 2.9 | 1.35 (`=0.9+0.45`, shared from E20) | 3.915 | บันได (3) |
| 19 | F4 | 1.0 | 1.0 | 1.0 | ดาดฟ้า ค.ส.ล. (1) |
| 20 | F4 | 3.5 | 4.0 | 14.0 | ดาดฟ้า ค.ส.ล. (1) |
| 21 | F4 | 1.5 | 3.0 | 4.5 | ดาดฟ้า ค.ส.ล. (1) |

Totals: F1 72.25 · F3 41.07 · F4 19.5.

### 2.6 BOQ rows — section 20 (204 … 208)

| Row | Item | Desc | Unit | Qty source | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|---|
| 205 | 1) | ปูกระเบื้องแกรนิตโต้ | ตร.ม. | `IFERROR(SUMIF(FloorTile!B:B,"F1",FloorTile!F:F),0)` = 72.25 | 0 | 500 | 250 | ราคากระเบื้องไม่เกิน 300.-/ตร.ม. |
| 206 | 2) | ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น (เฉลียง และบันได) | ตร.ม. | SUMIF "F3" = 41.07 | 0 | 500 | 250 | ราคากระเบื้องไม่เกิน 300.-/ตร.ม. |
| 207 | 3) | ปรับระดับ ทำกันซึม (ดาดฟ้า ค.ส.ล.) | ตร.ม. | SUMIF "F4" = 19.5 | 0 | 250 | 120 | |
| 208 | รวม >> | | | | | J 61,535 | L 30,670 | M 92,205 |

Row M: 54,187.50 · 30,802.50 · 7,215.00.

---

## 3. Section 21 งานปูกระเบื้องห้องน้ำ — sheet 17 `ปูกระเบื้องห้องน้ำ_Toilet`

### 3.1 Purpose
Bathroom floor (F3) and wall (P3) tile areas, wall area net of openings. Rows 21.3 (water pipe) come from sheet 06 ท่อน้ำดี_Water Pipe — **link only; specified by the MEP spec**.

### 3.2 Layout
Title "โปรแกรมถอดแบบ – งานปูกระเบื้องห้องน้ำ_Toilet Tile", E2 Back Home. Header row 4. Data rows **5–15 (11 rows)**.

### 3.3 INPUT columns

| Col | Label | Type | Unit | Options / notes |
|---|---|---|---|---|
| B | สัญลักษณ์ | dropdown | – | `F3, P3` — **BOQ key** |
| C | พื้น/ผนัง | dropdown | – | `พื้น, ผนัง` (informational; not used by formulas) |
| D | รายการ | dropdown | – | `ปูกระเบื้องแกรนิตโต้ ชนิดกันลื่น `, `กรุกระเบื้องแกรนิตโต้ ` |
| E | กว้าง (ม.) | number (yellow) | m | floor rows only; blank for wall rows |
| F | ยาว (ม.) | number (yellow) | m | floor: length; wall: **perimeter**, typed as expression e.g. `=2*(2.3+3)` |
| G | สูง (ม.) | number (yellow) | m | wall tile height; blank for floor rows |
| H | ช่องเปิด (ตร.ม.) | number (yellow) | m² | openings to deduct, typed as expression e.g. `=(0.7*2)+(0.5*1.8)` (door 0.7×2 + window 0.5×1.8) |
| J | ตำแหน่ง | free text | – | |

Codes: F3 = floor non-slip granito; P3 = wall granito.

### 3.4 Computed

| Cell | Label | Excel formula | Plain language |
|---|---|---|---|
| I5…I15 | รวม (ตร.ม.) | `=IF(COUNTA(E:G)=0,"",PRODUCT(IF(E=" ",1,E),IF(F=" ",1,F),IF(G=" ",1,G)) - IF(H=" ",0,H))` | product of whichever of W, L, H are filled (blanks ignored), minus openings; blank if W, L, H all empty |

App rule: `area = (product of non-empty {W,L,H}) − (openings or 0)`; empty row → no value.

### 3.5 Example data

| # | Code | พื้น/ผนัง | W | L / perimeter | H | Openings | I (m²) | Location |
|---|---|---|---|---|---|---|---|---|
| 1 | F3 | พื้น | 2.3 | 3.0 | – | – | 6.90 | ห้องน้ำ 1 |
| 2 | F3 | พื้น | 1.8 | 2.0 | – | – | 3.60 | ห้องน้ำ 2 |
| 3 | P3 | ผนัง | – | 10.6 (`=2*(2.3+3)`) | 2.4 | 2.3 (`=(0.7*2)+(0.5*1.8)`) | 23.14 | ห้องน้ำ 1 |
| 4 | P3 | ผนัง | – | 7.6 (`=2*(1.8+2)`) | 2.4 | 2.3 (`=(0.7*2)+(0.5*1.8)`, shared from H7) | 15.94 | ห้องน้ำ 2 |

Totals: F3 10.5 · P3 39.08.

### 3.6 BOQ rows — section 21 (209 … 216)

| Row | Item | Desc | Unit | Qty source | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|---|
| 210 | 1) | ปูกระเบื้องแกรนิตโต้พื้น ชนิดกันลื่น | ตร.ม. | `SUMIF(Toilet!B:B,"F3",Toilet!I:I)` = 10.5 | 0 | 500 | 250 | กระเบื้องราคาไม่เกิน 300.-/ตร.ม. |
| 211 | 2) | กรุกระเบื้องแกรนิตโต้ผนัง | ตร.ม. | SUMIF "P3" = 39.08 | 0 | 400 | 250 | กระเบื้องราคาไม่เกิน 300.-/ตร.ม. |
| 212 | 3) | งานระบบประปา ท่อน้ำดี (sub-header, no numbers) | | | | | | |
| 213 | | ท่อเมนภายนอก PVC 3/4" (D = `'ท่อน้ำดี_Water Pipe'!B5`) | ม. | `='ท่อน้ำดี_Water Pipe'!F5` = 58.5 | 0.15 | 20 | 40 | **L = K\*H (gross)** |
| 214 | | ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2" (D = `…!B6`) | ม. | `='ท่อน้ำดี_Water Pipe'!F6` = 13.1 | 0.15 | 15 | 40 | L = K\*H (gross) |
| 215 | | - วัสดุอุปกรณ์และของใช้สิ้นเปลือง | เหมา | 1 | – | `I215 = SUM(J213:J214,L213:L214)*50%` = 2,432.54 | 0 | (50 % of pipe mat+lab) |
| 216 | รวม >> | | | | | J `=SUM(J210:J211)` 20,882 | L `=SUM(L210:L211)` 12,395 | M `=SUM(M210:M215)` 40,574.61 |

Row M: 7,875 · 25,402 · 4,036.50 · 828.575 · 2,432.5375.
Section-specific anomalies (pipe labour on gross, 50 % consumables, subtotal J/L excluding pipe rows) → Oddities O-6, O-7. Note the water pipe rows physically sit inside section 21 in the BOQ; the MEP spec owns their calculator (sheet 06).

---

## 4. Section 22 งานตกแต่งผนัง — sheet 18 `ตกแต่งผนัง_Wall Finishing`

### 4.1 Purpose
Decorative wall mouldings (บัว, measured in running metres) and fibre-cement timber-slat cladding (ระแนง, measured in m²).

### 4.2 Layout
Title "โปรแกรมถอดแบบ – งานตกแต่งผนัง_Wall Finishing", D2 Back Home. Header row 4. Data rows **5–15 (11 rows)**.
**Header labels are swapped vs content**: column C is headed "ตำแหน่ง" but holds the item description (dropdown); column H is headed "รายการ" but holds the location. App should label C = รายการ, H = ตำแหน่ง.

### 4.3 INPUT columns

| Col | Label (actual meaning) | Type | Unit | Options |
|---|---|---|---|---|
| B | สัญลักษณ์ | dropdown | – | `P1, P2, P3, P4` (not used by any formula; example uses P2 for บัว, P4 for ระแนง) |
| C | รายการ (item) — **BOQ key** | dropdown | – | `บัวตกแต่งผนัง ขนาด 0.1 หนา 0.1 ม.`, `บัวตกแต่งผนัง ขนาด 0.3 หนา 0.1 ม.`, `กรุไม้ระแนงไฟเบอร์ซีเมนต์บอร์ด กว้าง 4 นิ้ว หนา 9 มม.` |
| D | กว้าง (ม.) | number (yellow) | m | บัว rows: 0 (unused); ระแนง rows: height/width |
| E | ยาว (ม.) | number (yellow) | m | length |
| H | ตำแหน่ง (location) | free text | – | e.g. ผนังภายนอก, ผนังเฉลียง 1 |

Item enum (proposal): `MOULD_0_1` = บัว 0.1×0.1 ม. (m), `MOULD_0_3` = บัว 0.3 (face) × 0.1 (projection) ม. (m), `SLAT_WALL` = ระแนงไฟเบอร์ซีเมนต์ 4" หนา 9 มม. (m²).

### 4.4 Computed

| Cell | Label | Formula | Plain language |
|---|---|---|---|
| F5, F6 | ยาว (ม.) (total length) | `=D+E` | running length for บัว rows (D is 0, so F = E) |
| G7…G15 | พื้นที่ (ตร.ม.) | `=D*E` | area for ระแนง rows |

In Excel rows 5–6 carry only the F formula, rows 7–15 only the G formula (template differs per row). App: compute by item type — บัว → length = E (+D), unit m; ระแนง → area = D×E, unit m².

### 4.5 Example data

| # | Code | Item | D | E | F (m) | G (m²) | Location |
|---|---|---|---|---|---|---|---|
| 1 | P2 | บัว ขนาด 0.3 หนา 0.1 ม. | 0 | 13 | 13 | – | ผนังภายนอก |
| 2 | P2 | บัว ขนาด 0.1 หนา 0.1 ม. | 0 | 11 | 11 | – | ผนังภายนอก |
| 3 | P4 | ระแนงไฟเบอร์ซีเมนต์ 4" 9 มม. | 1.65 | 2.0 | – | 3.30 | ผนังเฉลียง 1 |
| 4 | P4 | ระแนงไฟเบอร์ซีเมนต์ 4" 9 มม. | 1.2 | 4.0 | – | 4.80 | ผนังเฉลียง 2 |

### 4.6 BOQ rows — section 22 (217 … 221)

| Row | Item | Desc (D) | Unit | Qty source (E) as in Excel | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|---|
| 218 | 1) | `='Wall Finishing'!C5` → "บัวตกแต่งผนัง ขนาด 0.3 หนา 0.1 ม." | ม. | `SUMIF(WF!C:C,"บัวตกแต่งผนัง ขนาด **0.1** หนา 0.1 ม.",WF!F:F)` = **11** | 0.10 | 400 | 200 | |
| 219 | 2) | `='Wall Finishing'!C6` → "บัวตกแต่งผนัง ขนาด 0.1 หนา 0.1 ม." | ม. | `SUMIF(WF!C:C,"บัวตกแต่งผนัง ขนาด **0.3** หนา 0.1 ม.",WF!F:F)` = **13** | 0.10 | 180 | 100 | |
| 220 | 3) | `='Wall Finishing'!$C$7` → "กรุไม้ระแนงไฟเบอร์ซีเมนต์บอร์ด กว้าง 4 นิ้ว หนา 9 มม." | ตร.ม. | `SUMIF(WF!C:C,"กรุไม้ระแนง…",WF!G:G)` = 8.1 | 0.10 | 400 | 150 | (deck version: "ไม้เทียมราคาไม่เกิน 350.-/ตร.ม."; empty in v5) |
| 221 | รวม >> | | | | | J 10,978 | L 4,715 | M 15,693 |

Row M (as Excel computes): 7,040 · 3,874 · 4,779.

**Rows 218/219 are swapped (O-2).** Description is a live link to the calculator row (C5 = 0.3, C6 = 0.1), the price pairs follow the description (0.3 moulding is the expensive one, 400/200; 0.1 is 180/100), but the SUMIF criteria are crossed, so the 0.3 price is applied to the 0.1 length and vice versa. Recommended fix: row "บัว 0.3" = SUM(length where item = MOULD_0_3) → 13 m; row "บัว 0.1" = SUM(length where item = MOULD_0_1) → 11 m. Corrected values: 0.3 row J 13×1.1×400 = 5,720, L 2,600, M 8,320; 0.1 row J 11×1.1×180 = 2,178, L 1,100, M 3,278; section M 16,377 (vs Excel 15,693). Owner must confirm (mirror Excel exactly vs fix).

---

## 5. Paint calculator — sheet 19 `ทาสี_Paint ` (feeds sections 23, 25, 31)

### 5.1 Purpose
A 9-line area summary that collects paintable areas from other sheets (plaster, ceiling) plus a few hard-coded areas. The same 8 areas are priced three times in the BOQ (primer, coat 1, final coat); the skim-coat line only in the primer section.

### 5.2 Layout
Title "โปรแกรมถอดแบบ – งานทาสี Paint", C2 Back Home. Header row 4: ลำดับ / แยกส่วนผนัง / พื้นที่ (ตร.ม.). Rows **5–19 (15 rows)**; only 5–13 used; C14–C19 empty (no formula).

### 5.3 INPUT
| Col | Label | Type | Options |
|---|---|---|---|
| B5:B19 | แยกส่วนผนัง (paint line) | dropdown | `งานฉาบบาง (สกิมโค๊ท) - รวม`, `ทาสีผนัง - เชิงชาย`, `ทาสีผนัง - บัว `, `ทาสีผนัง -  ภายนอก `, `ทาสีผนัง - ภายใน `, `ทาสีผนัง - ไม้ระแนง`, `ทาสีฝ้า - ภายนอก`, `ทาสีฝ้า - ภายใน`, `ทาสีฝ้า - ไม้ระแนง ` |

In practice B is fixed (the BOQ links by cell address C5…C13, not by label), so B behaves as a static label. Only B7–B9 matter functionally: they are the SUMIF criteria into the ceiling sheet. C column has no user inputs (all formulas/hard-codes); the "inputs" are hidden inside hard-coded formulas (O-3/O-4/O-5).

### 5.4 Computed lines

| Cell | Line (B) | Excel formula | Plain language | Value |
|---|---|---|---|---|
| C5 | ทาสีผนัง - ภายนอก | `=SUMIF('ฉาบปูน_Plaster'!C5:C100,"ฉาบภายนอก",'ฉาบปูน_Plaster'!E5:E100)` | exterior wall paint = exterior plaster area | 191.8225 |
| C6 | ทาสีผนัง - ภายใน | `=SUMIF(Plaster!C5:C100,"ฉาบภายใน",Plaster!E5:E100)` | interior wall paint = interior plaster area | 314.7825 |
| C7 | ทาสีฝ้า - ภายนอก | `=SUMIF('ฝ้าเพดาน_Ceiling'!H:H,B7,Ceiling!F:F)` | ceiling rows flagged ภายนอก | 37.38 |
| C8 | ทาสีฝ้า - ภายใน | `=SUMIF(Ceiling!H:H,B8,Ceiling!F:F)` | ceiling rows flagged ภายใน (incl. sloped C2 rows) | 92.54055467 |
| C9 | ทาสีฝ้า - ไม้ระแนง | `=SUMIF(Ceiling!H:H,B9,Ceiling!F:F)` | ceiling rows flagged ไม้ระแนง | 19.5 |
| C10 | ทาสีผนัง - ไม้ระแนง | `=3.3+4.8` **hard-coded** | = Wall Finishing G7+G8 (slat cladding area) typed by hand | 8.1 |
| C11 | ทาสีผนัง - บัว | `=(0.5*13)+(0.3*11)` **hard-coded** | moulding girth × length: บัว 0.3×0.1 → girth 0.5 m (0.3 face + 2×0.1 edges) × 13 m; บัว 0.1×0.1 → girth 0.3 m × 11 m | 9.8 |
| C12 | ทาสีผนัง - เชิงชาย | `=63.2*0.23` **hard-coded** | fascia length 63.2 m × fascia height 0.23 m | 14.536 |
| C13 | งานฉาบบาง (สกิมโค๊ท) - รวม | `=C6+C5` | skim coat = interior + exterior plaster area | 506.605 |

### 5.5 Cross-sheet links (who supplies what)

| Paint line | Supplier | Field |
|---|---|---|
| Wall ext / int, skim coat | sheet 14 ฉาบปูน_Plaster | E (รวม ตร.ม.) grouped by C (`ฉาบภายนอก` / `ฉาบภายใน `). Plaster E itself = SUMIF of brick sheet I by wall group × "ฉาบกี่ด้าน" (1/2) + hard-coded E11 `=((1*25)+(0.8*2.6*3))` — see masonry/plaster spec. Example: ext = 114.1325+17.5+28.95+31.24; int = 114.1325+171.7+28.95. |
| Ceiling ext / int / slat | sheet 15 Ceiling | F grouped by H paint flag |
| Wall slat | (should be) sheet 18 Wall Finishing | G of ระแนง rows — currently hard-coded |
| บัว | (should be) sheet 18 Wall Finishing | F of บัว rows × girth — currently hard-coded |
| เชิงชาย | (should be) sheet 23 มุงหลังคา_Roofing row 16 "ไม้เชิงชาย" E16 = **62.3 m** (also BOQ E176) × 0.23 m — currently hard-coded 63.2 |

Recommended app formulas (if owner approves "derive, don't hard-code"):
- `wall_slat = Σ WallFinishing.area where item = SLAT_WALL`
- `moulding = Σ over บัว rows of length × (face + 2 × thickness)` (0.3×0.1 → 0.5; 0.1×0.1 → 0.3)
- `fascia = Roofing.fascia_length × fascia_height` with `fascia_height` input default 0.23 m
- `skim = wall_ext + wall_int`

### 5.6 BOQ rows — section 23 งานทาสีรองพื้น (222 … 232)

| Row | Item | Desc (`='ทาสี_Paint '!Bn`) | Unit | Qty (`='ทาสี_Paint '!Cn`) | Waste | Mat | Lab |
|---|---|---|---|---|---|---|---|
| 223 | 1) | ทาสีผนัง - ภายนอก | ตร.ม. | C5 = 191.8225 | 0 | 20 | 30 |
| 224 | 2) | ทาสีผนัง - ภายใน | ตร.ม. | C6 = 314.7825 | 0 | 20 | 30 |
| 225 | 3) | ทาสีฝ้า - ภายนอก | ตร.ม. | C7 = 37.38 | 0 | 20 | 30 |
| 226 | 4) | ทาสีฝ้า - ภายใน | ตร.ม. | C8 = 92.5406 | 0 | 20 | 30 |
| 227 | 5) | ทาสีฝ้า - ไม้ระแนง | ตร.ม. | C9 = 19.5 | 0 | 50 | 50 |
| 228 | 6) | ทาสีผนัง - ไม้ระแนง | ตร.ม. | C10 = 8.1 | 0 | 50 | 50 |
| 229 | 7) | ทาสีผนัง - บัว | ตร.ม. | C11 = 9.8 | 0 | 50 | 50 |
| 230 | 8) | ทาสีผนัง - เชิงชาย | ตร.ม. | C12 = 14.536 | 0 | **50** | 50 |
| 231 | 9) | งานฉาบบาง (สกิมโค๊ท) - รวม | ตร.ม. | C13 = 506.605 | **0.10** | 25 | 40 |
| 232 | รวม >> | | | | | J 29,258.95 | L 41,956.77 → M 71,215.72 |

Row M: 9,591.13 · 15,739.13 · 1,869.00 · 4,627.03 · 1,950 · 810 · 980 · 1,453.60 · 34,195.84.
No notes (N empty).

### 5.7 BOQ rows — section 25 งานทาสีจริง รอบที่ 1 (244 … 253)

Same 8 lines (rows 245–252 → Paint C5…C12), **no skim-coat line**. Waste 0 on all.

| Row | Line | Mat | Lab |
|---|---|---|---|
| 245 | ทาสีผนัง - ภายนอก | 20 | 30 |
| 246 | ทาสีผนัง - ภายใน | 20 | 30 |
| 247 | ทาสีฝ้า - ภายนอก | 20 | 30 |
| 248 | ทาสีฝ้า - ภายใน | 20 | 30 |
| 249 | ทาสีฝ้า - ไม้ระแนง | 50 | 50 |
| 250 | ทาสีผนัง - ไม้ระแนง | 50 | 50 |
| 251 | ทาสีผนัง - บัว | 50 | 50 |
| 252 | ทาสีผนัง - เชิงชาย | **20** | 50 |
| 253 | รวม >> | J 14,891.23 | L 21,692.57 → M 36,583.80 |

### 5.8 BOQ rows — section 31 งานทาสีรอบสุดท้าย (299 … 308)
Identical to section 25 (rows 300–307 → Paint C5…C12; same prices incl. เชิงชาย mat 20 / lab 50; waste 0). Subtotal row 308: J 14,891.23 · L 21,692.57 · M 36,583.80.

### 5.9 Price differences between the three paint sections (v5 workbook)

| Line | §23 primer mat/lab | §25 coat 1 mat/lab | §31 final mat/lab |
|---|---|---|---|
| walls ext/int, ceilings ext/int | 20 / 30 | 20 / 30 | 20 / 30 |
| ฝ้าไม้ระแนง, ผนังไม้ระแนง, บัว | 50 / 50 | 50 / 50 | 50 / 50 |
| เชิงชาย | **50** / 50 | **20** / 50 | **20** / 50 |
| skim coat | 25 / 40, waste 10 % | – | – |

Each section's prices are independent user inputs in the BOQ (yellow I/K/G); the app must store prices per section, not one price per paint line.

---

## 6. Review deck notes

The deck pages are side-by-side screenshots (ConTrack app vs "โปรแกรม BOQM" Excel); the comment is implicit: *the app must look/work like the Excel*.

| Page | Shows | Point |
|---|---|---|
| p83 | Title "STEP 19 ปิดฝ้าเพดาน" | |
| p84 | App step 19: "+ เพิ่มห้อง", one global ceiling-type dropdown (ยิปซั่มบอร์ด 9 มม. / ไฟเบอร์ซีเมนต์ 4 มม. / แคลเซียมซิลิเกต 6 มม.), Waste %, optional บัวฝ้า (Cornice) m; preview: พื้นที่แผ่นฝ้า m², โครงคร่าวฝ้า m | App invents frame/cornice; type is global not per row; wrong type list. |
| p85 | Excel BOQ §19 + Ceiling sheet (17 rows, per-row C1–C4, location, แยกงานทาสี colour-coded) | Target. Deck prices: C1 mat **150**, C2 **170**, C3 **250**, C4 700 (v5 workbook: 185/205/350/700). Section M 61,744.17 in deck vs 68,721.09 in v5. |
| p86 | Title "STEP 20 ปูกระเบื้องพื้น" | |
| p87 | App step 20: rooms with tile size 60×60, laying pattern "ปูตรง (Waste ~10%)", waste %, skirting m; preview: tile m², กาวซีเมนต์ ถุง, บัวพื้น m, ยาแนว ถุง; cost preview | App invents adhesive/skirting/grout and tile sizes. |
| p88 | Excel BOQ §20 | Deck prices mat **475** for F1/F3 (v5: 500). Deck M 89,372 vs v5 92,205. |
| p89 | Excel Floor Tile sheet, 21 rows F1/F3/F4 | Target layout. |
| p90 | Title "STEP 21 ปูกระเบื้องห้องน้ำ (พื้น-ผนัง)" | |
| p91 | App step 21: per bathroom W, L, tile height, door width; waterproof height / area; waste; outputs floor, wall, waterproof, adhesive, grout | App invents waterproofing/adhesive/grout; door-only deduction vs Excel free "openings m²". |
| p92 | Excel Toilet sheet (F3/P3 rows, wall perimeter + height − openings) **and** Water Pipe sheet (ท่อเมนภายนอก PVC 3/4" 58.5 m; ท่อย่อยภายใน PVC 1/2" 7.8 + 5.3 = 13.1 m) | Section 21 includes water-pipe rows (MEP spec). |
| p93 | Title "STEP 22 ตกแต่งผนังภายนอก" | |
| p94 | App step 22: facade area m² + finish type (สีทาอย่างเดียว / เทกซ์เจอร์ / กระเบื้อง / หินเทียม / ไม้ฝา), waste | App's whole concept is wrong; Excel is บัว (m) + ระแนง (m²). |
| p95 | Excel BOQ §22 + Wall Finishing sheet | Deck prices บัว 0.3 mat **380**/200, บัว 0.1 **160**/100, ระแนง 400/150 with note "ไม้เทียมราคาไม่เกิน 350.-/ตร.ม."; deck M 15,165. Same swapped qty (0.3 → 11, 0.1 → 13) visible in the deck. |
| p96 | Title "STEP 23 ทาสีรองพื้น" | |
| p97 | App step 23: interior/exterior area inputs, primer type dropdowns (อะคริลิก / Alkali Seal / รองพื้นน้ำ), coats 1/2, waste, surface prep toggles; preview in gallons | App should be the 9 Excel lines in m², areas auto from earlier steps. |
| p98 | Excel BOQ §23 | Deck prices walls mat **25** (v5 20), skim mat **20** (v5 25); deck M 70,962.41. |
| p99 | Excel Paint sheet (9 lines, 15 rows) | Target. |
| p104 | Title "STEP 25 ทาสีจริง รอบที่ 1" | |
| p105 | App step 25: wall int/ext, ceiling, paint-ceiling toggle, paint grade, sheen, waste, accent, wood, colour count; outputs gallons, rollers, tape, drop cloth | Invented. |
| p106 | Excel BOQ §25 | Deck: walls mat 25, เชิงชาย mat 20/50; M 39,116.82 (v5 36,583.80). |
| p107 | Paint sheet again | |
| p127 | Title "STEP 31 ทาสีรอบสุดท้าย" | |
| p128 | App shows it as **"STEP 32 ทาสีรอบสุดท้าย"** (Final Paint Coat 2): areas "เหมือน Step 25", paint grade, waste, wood, touch-up % | Numbering off by one; invented inputs. |
| p129 | Excel BOQ §31 | Same as §25 (deck: walls mat 25, M 39,116.82). |
| p130 | Paint sheet again | |

The deck screenshots come from a slightly different price revision than the v5 dump (see O-9).

---

## 7. Today's app vs Excel

- **Per-row type codes missing.** App step 19 has one global `ceiling_type` (6 invented types incl. fire-rated/calcium silicate) and invents C-line frame + cornice; step 20 has tile sizes, laying pattern, adhesive, grout, skirting. Excel: per-row C1–C4 / F1·F3·F4 with all-in m² rates, 4 and 3 BOQ lines.
- **Ceiling paint flag and slope missing.** App has no per-row ภายใน/ภายนอก/ไม้ระแนง flag, so it can't feed paint lines 3–5; no sloped-ceiling (÷cos 40°) rows.
- **Step 21** invents waterproofing, adhesive, grout and a door-only deduction; Excel is F3 floor + P3 wall (perimeter × height − free openings m²), plus the two water-pipe lines and a 50 % consumables line from sheet 06.
- **Step 22** is modelled as "exterior facade finish" (paint/texture/tile/stone/wood by m²); Excel is บัว 0.3, บัว 0.1 (m) and ระแนง (m²).
- **Paint steps 23/25/32** compute gallons from coverage rates, grades, coats, rollers, brushes, tape; Excel prices 8 m² lines (+ skim coat in §23 only) with areas auto-pulled from plaster/ceiling/wall-finishing/roofing. App puts skim coat under step 18 (`PLS-SKIM 18.3`); Excel puts it in §23 row 231.
- **Numbering:** app's final paint is step 32 (boq-mapper `build(32, 'งานทาสี รอบ 2')`) and app step 31 is wood doors; Excel §30 = wood doors/windows, §31 = final paint.

---

## 8. Oddities needing an owner decision

| # | Where | What | Options |
|---|---|---|---|
| O-1 | Ceiling F16:F17 | Sloped rows use `/COS(RADIANS(40))`, hard-coded 40°, only on 2 rows; other rows plain D×E. | (a) per-row optional "slope °" input (default 0 = flat; example rows 12–13 = 40); (b) per-row "sloped" toggle using the roof pitch from the roof sheet. |
| O-2 | BOQ E218/E219 | SUMIF criteria swapped vs description/price (0.3 moulding priced 400/200 gets the 0.1 length 11 m). Excel total 15,693 vs corrected 16,377. | Fix (recommended) or mirror bug. |
| O-3 | Paint C10 `=3.3+4.8` | Wall slat paint area typed by hand instead of linked to Wall Finishing G7+G8. | Derive from sheet 18 (recommended). |
| O-4 | Paint C11 `=(0.5*13)+(0.3*11)` | Moulding paint area hard-coded; girth constants 0.5 / 0.3 implied by size+2×thickness. | Derive: Σ length × (face + 2×thickness). |
| O-5 | Paint C12 `=63.2*0.23` | Fascia length 63.2 m hard-coded; roofing sheet fascia (E16) and ceiling eave row are **62.3 m** — likely transposed digits (14.536 vs 14.329 m²). 0.23 m fascia height has no source. | Link to roofing fascia length + input fascia height (default 0.23). Confirm 62.3. |
| O-6 | BOQ L213/L214 | Pipe labour `=K*H` (gross qty incl. 15 % waste), unlike the standard `K*E`. | Standardise to net (MEP spec decides). |
| O-7 | BOQ row 215/216 | Consumables = **50 %** of pipe mat+lab (other sections' notes say 15 %); subtotal J216/L216 sum only rows 210–211 while M216 sums 210–215 → J+L ≠ M on the subtotal row (grand total uses M, so the total is correct). | Fix subtotal to include all rows; confirm 50 %. |
| O-8 | Wall Finishing headers | C header "ตำแหน่ง" holds item, H header "รายการ" holds location; B codes P1–P4 unused and collide with toilet P3. | Relabel; drop or keep codes. |
| O-9 | Prices | Deck screenshots show other unit prices (C1 150, C2 170, C3 250; tiles 475; บัว 380/160; paint walls 25; skim 20) and a note on row 220, vs v5 dump (185, 205, 350; 500; 400/180; 20; 25; no note). | Which price set is the default seed? (spec uses v5.) |
| O-10 | เชิงชาย mat price | 50 in §23, 20 in §25 and §31 — inconsistent; likely §23 typo or intentional (primer on timber dearer). | Confirm. |
| O-11 | Floor F4 rows | Three F4 rows all labelled "ดาดฟ้า ค.ส.ล. (1)" with dims identical to เฉลียงพักผ่อน (1)–(3) F3 floor & C4 ceiling rows. Likely copy-paste labels; maths fine. | Seed with (1)/(2)/(3). |
| O-12 | Toilet inputs | Wall perimeter `=2*(2.3+3)` and openings `=(0.7*2)+(0.5*1.8)` typed as formulas duplicating floor dims. H8 is a shared copy of H7's `=(0.7*2)+(0.5*1.8)`, not a pasted value, so bathroom 2 silently reuses bathroom 1's door and window sizes. | App: let user enter perimeter or auto = 2×(W+L) of matching floor row; openings as list of W×H items or a m² field. |
| O-13 | Code gaps / overlaps | No F2 in floor list; F3 means "non-slip granito" in both floor and toilet sheets but goes to different BOQ rows; C and B dropdowns are independent (user can pick code C1 with C2 description). | App: code drives description (single selector). |
| O-14 | Ceiling dropdown order | C-column list order is C1, C2, C4, C3 (descriptions) vs B list C1–C4. Cosmetic. | Use code order. |
| O-15 | Paint sheet B dropdown | Labels are selectable but BOQ links by cell position (C5…C13), so changing B7–B9 changes the ceiling SUMIF, and re-ordering lines would silently mis-price. Rows 14–19 empty and unused. | Make the 9 lines fixed in the app. |
| O-16 | Plaster SUMIF ranges | Paint uses `C5:C100`, BOQ §18 uses whole columns; plaster key `"ฉาบภายใน "` has a trailing space but criteria has none (cached values show it matched). | Use enums; ranges irrelevant in app. |

---

## 9. Acceptance values (seed = v5 example, Excel-as-is)

| Section | J (mat) | L (lab) | M |
|---|---|---|---|
| 19 | 44,258.81 | 24,462.27 | 68,721.09 |
| 20 | 61,535.00 | 30,670.00 | 92,205.00 |
| 21 | 20,882.00* | 12,395.00* | 40,574.61 |
| 22 | 10,978.00 | 4,715.00 | 15,693.00 (16,377.00 if O-2 fixed) |
| 23 | 29,258.95 | 41,956.77 | 71,215.72 |
| 25 | 14,891.23 | 21,692.57 | 36,583.80 |
| 31 | 14,891.23 | 21,692.57 | 36,583.80 |

\* Excel's J216/L216 exclude the pipe and consumables rows. Including them: J = 20,882 + 1,345.5 + 225.975 + 2,432.5375 = 24,886.01; L = 12,395 + 2,691 + 602.6 = 15,688.60; J+L = 40,574.61 = M216.
Sheet 02 Man-Day_Basic mirrors these BOQ rows (same row numbers) — see the man-day spec.

---

## 10. Verification (shared formulas)

The spec was re-checked against the regenerated dump, which now shows shared-formula cells as `=SHARED(si=N, master …)`. All sheets were checked: 15 Ceiling, 16 Floor Tile, 17 Toilet, 18 Wall Finishing, 19 Paint, and BOQ (Home) rows 199–232, 245–253 and 300–310. No acceptance value changed.

Changes made:
- **Floor Tile E21, E22:** these are shared copies of E20 `=0.9+0.45` (1.35), not typed values. Noted in §2.3 and in example rows 17–18. The cells are yellow, and the app should treat them as stair-length inputs (default 1.35).
- **Toilet H8:** this is a shared copy of H7 `=(0.7*2)+(0.5*1.8)` (2.3), not a pasted value. Corrected in §3.5 row 4 and in O-12.

Confirmed unchanged:
- **Ceiling F:** F6:F15 are shared from F5 (`D*E`). F16 is explicit and F17 is shared from it (`/COS(RADIANS(40))`). F19:F28 are shared from F18 (`D*E`). This matches §1.5, and the slope formula covers only rows 16–17.
- **Floor Tile F6:F34:** all are shared from F5 (`D*E`).
- **Toilet I6:I15:** all are shared from I5.
- **Wall Finishing:** F6 is shared from F5 (`D+E`). G8:G15 are shared from G7 (`D*E`). F7:F15 and G5:G6 are blank.
- **Paint C5:C13:** all are explicit, and C14:C19 are blank.
- **BOQ sections 19–23, 25 and 31:** every item row is standard `H = E*(1+G)`, `J = I*H`, `L = K*E`, `M = J+L` (anchor row, then shared). There are no labour-on-H surprises apart from the pipe rows L213/L214 already listed.
- **BOQ subtotals:** M on the subtotal rows is a shared copy of the L subtotal (`SUM(M first:last)`), as §0.1 states. M216 is explicit `SUM(M210:M215)`.
- **Row 215:** I215 and K215 carry no yellow fill. I215 is a formula, and `J215 = I*E`, `L215 = K*E`.
