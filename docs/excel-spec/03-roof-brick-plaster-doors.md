# 03 — Column-cap plates, roof structure, roofing, brickwork, plastering, door/window schedule

Source: workbook "โปรแกรมประมาณราคา BOQ … บ้านชั้นเดียว – Training Edition v5" (dump `ctrv2/v5/sheetNN.txt`), sheet **BOQ (Home)** (sheet01) plus calculator sheets:

| Sheet | Dump file | Feeds BOQ section(s) |
|---|---|---|
| *(none)* | — | 14 งานเพลทหัวเสา (rows 147–150) |
| โครงสร้างหลังคา Roof Structure | sheet22 | 15 งานโครงหลังคา (rows 151–160) |
| มุงหลังคา_Roofing | sheet23 | 16 งานมุงหลังคา (rows 161–177), and 15.5/15.6/15.8 through Roof Structure |
| ก่ออิฐ_Brick | sheet13 | 17 งานก่ออิฐ (rows 178–187), and 18 through the Plaster sheet |
| ฉาบปูน_Plaster | sheet14 | 18 งานฉาบปูน (rows 188–197); also the Paint sheet (sections 23/25/31) |
| ประตู-หน้าต่าง_Door&Window | sheet12 | brick openings (17), 18.3 วงกบประตูไม้, 24 อลูมิเนียม (rows 233–243), 30 ไม้ (rows 293–298) |

Conventions used below:
- **Input** = yellow fill `FFFFF2CC` in the workbook, or an unfilled cell that has a dropdown. **Formula** = grey/green fill.
- A formula is written on the first cell of a block (the "anchor"). Cells below it carry the same formula as an Excel shared formula, with relative refs shifted; the regenerated dump shows these as `=SHARED(si=N, master CELL: …)`, so every block below is now confirmed, not assumed (see "Verification (shared formulas)" at the end).
- BOQ (Home) column meanings: D = description, E = net qty, F = unit, G = waste %, H = qty incl. waste, I = material price per unit, J = material amount, K = labour price per unit, L = labour amount, M = J+L, N = note.
- The standard row maths is `H = E*(1+G)`, `J = I*H`, `L = K*E` (labour on **net** qty), `M = J+L`. Every exception is listed per row.
- Section subtotal row ("รวม >>"): `J = SUM(J first:last)`, `L = SUM(L first:last)`, `M = SUM(M first:last)`. In sections 14–18 and 30, M is a shared copy of the L subtotal shifted one column (e.g. M150 = `SUM(M148:M149)`); section 24 types it explicitly (`M243 = SUM(M234:M242)`). Numerically this equals J+L wherever J and L cover the same rows.

---

## 0. BOQ (Home) rounding and labour basis, by section (summary)

| Section | H (qty incl. waste) | L (labour) basis | Notes |
|---|---|---|---|
| 14 | `E*(1+G)` (no rounding) | `K*E` | |
| 15 | `ROUNDUP(E*(1+G),0)` | `K*E` | rounded **again** after the calculator already rounded up |
| 16 | `ROUNDUP(E*(1+G),0)` | `K*E` | same |
| 17 | `E*(1+G)` | `K*E` for 17.1–17.5; **`K*H`** for 17.6 conduit | |
| 18 | `E*(1+G)` | `K*E` for 18.1–18.2; **`K*H`** for 18.3 and the 18.4 cables | J190 is `I*E`, not `I*H` |
| 24 | `E*(1+G)` | `K*E` (K = 0 everywhere) | subtotal L243 sums the wrong range |
| 30 | `E*(1+G)` | `K*E` | |

---

## 1. Section 14 — งานเพลทหัวเสา (Column cap plate)

### Purpose
This is a lump-count line for the steel cap plates set on the column heads (where the roof structure sits) and the non-shrink grout under them. **There is no calculator sheet.** Both quantities are typed straight into BOQ (Home).

### Inputs (all in BOQ (Home))
| Cell | Label | Type | Default (v5) | Unit |
|---|---|---|---|---|
| E148 | Number of plates (points) | number | 21 | จุด |
| E149 | Number of grout points | number | 21 | จุด |
| G148, G149 | Waste % | % | 0 | |
| I148 / K148 | Plate material / labour per point | ฿ | 250 / 50 | |
| I149 / K149 | Grout material / labour per point | ฿ | 100 / 50 | |

The descriptions are fixed text. Plate size and thickness are part of the description, not inputs.

### BOQ rows
| Row | Desc | Unit | Qty source | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|
| 148 | 1) เหล็กเพลทสี่เหลี่ยมหนา 9 มม. ขนาด 8 x 8 นิ้ว | จุด | typed 21 | 0 | 250 | 50 | |
| 149 | 2) ปูนเกร้าท์ นอนชริ้งค์ | จุด | typed 21 | 0 | 100 | 50 | |
| 150 | รวม >> | | | | J = 7,350 | L = 2,100 | M = 9,450 |

Formulas: `H148 = E148*(100%+G148)`, `J148 = I148*H148`, `L148 = K148*E148`, `M148 = J148+L148`. Row 149 uses the same formulas. Subtotal: `J150 = sum(J148:J149)`, `L150 = sum(L148:L149)`, `M150 = sum(M148:M149)` (shared from L150).

### Cross-links
None. The value 21 is the same as the pile count in BOQ E35 (เสาเข็ม 21 ต้น, also typed by hand). The two cells are not linked.

### Review notes
- p61–62: the app's Step 14 form has plate width, depth and thickness in mm, bolts per base, bolt size, bolt type, bolt length, grout thickness, welding and anti-rust toggles. Its preview shows plate kg, anchor bolts, J-bolt template and anti-rust m².
- p63: the BOQM target is just two rows, per point, 21 each: plate 250/50 and grout **50**/50, subtotal 8,400. The v5 workbook has grout material **100**, subtotal 9,450. The deck screenshot is from an older price set.

### Today's app vs Excel
- The app computes plate **kg** from W×D×T×7850 and adds anchor bolts, template, grout bags, welding and paint (rows 14.1–14.6). Excel has only 2 rows, counted per point.
- The app has no "grout per point" row. Excel row 149 is that row.
- Rebuild: one input "จำนวนจุด", default 21 (or linked; see the decisions list), copied to both rows, with editable prices.

---

## 2. Section 15 — โครงหลังคา: sheet "โครงสร้างหลังคา Roof Structure" (sheet22)

### Purpose
Counts the 6-metre steel C-channel sticks needed for each roof member: wall plate, king posts, ridge, valley, rafters and purlins. Linear members are worked out from length × count. Area members (rafters, purlins) are worked out from slope area ÷ spacing × factor.

### Table layout (header row 4, data rows 5–20)
| Col | Header | Meaning |
|---|---|---|
| A | ลำดับ | row no. (1–11; the ดั้ง sub-rows have none) |
| B | รายการ | member description (free text, yellow) |
| C | ซีคู่ | C-section multiplier: 1 = single C, 2 = double C ("2-C") |
| D | Factor Roof | area factor for rafters/purlins |
| E | พื้นที่หลังคา (ตร.ม.) | slope roof area (for area-based members) |
| F | ระยะห่าง (ม.) | spacing (for area-based members) |
| G | ความยาว (ม.) | length of one member (for linear members) |
| H | จำนวน (เส้น) | number of such members |
| I | ความยาวรวม (ม.) | total metres (formula) |
| J | จำนวน (ท่อน) | number of 6 m sticks (formula) |

Dropdowns: `C5, C7:C20` list = `1,2`; `D5, D7:D20` list = `1.15,1.10,1.05,1.00`.

### Inputs (v5 sample values)
| Row | B (desc) | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| 5 | อะเส 2-C 150x50x20x3.2 มม. | 2 | – | 0 | 0 | `=12.5+11+4.5+8+9.2+6+10.6+10+10.6+3.5+3.5+3.5` = 92.9 | 1 |
| 6 | ดั้ง 2-C 100x50x20x2.3 มม. (group header) | – | – | 0 | 0 | 0 | 0 |
| 7 | - ดั้ง-1 | 2 | – | 0 | 0 | 1.6 | 2 |
| 8 | - ดั้ง-2 | 2 | – | 0 | 0 | 1.8 | 3 |
| 9 | - ดั้ง-3 | 2 | – | 0 | 0 | 3.05 | 4 |
| 10 | - ดั้ง-4 | 2 | – | 0 | 0 | 2.65 | 3 |
| 11 | - ดั้ง-5 | 2 | – | 0 | 0 | 1.6 | 6 |
| 12 | อกไก่ 2-C 100x50x20x2.3 มม. | 2 | – | 0 | 0 | `=5+7.5+9.2+4.6+6.6+5.6+5.6` = 44.1 | 1 |
| 13 | ตะเข้ราง C 100x50x20x2.3 มม. | 1 | – | 0 | 0 | `=(SQRT((3.6^2)+(3.6^2)))/COS(RADIANS(40))` = 6.646 | 4 |
| 14 | จันทัน C 100x50x20x2.3 มม. | 1 | 1.15 | `='มุงหลังคา_Roofing'!K7` = 147.511 | 1.0 | 0 | 0 |
| 15 | แปสำเร็จรูป GZ หนา 0.7 มม. | 1 | 1.15 | `='มุงหลังคา_Roofing'!K7` = 147.511 | 0.34 | 0 | 0 |
| 16–20 | (blank rows 7–11) | | | | | | |

Users type length G as a sum expression of the segment lengths taken off the plan. The app should accept either a list of segments or a single total.

### Computed fields
| Cell | Label | Formula | Plain language |
|---|---|---|---|
| I5, I7–I13 | ความยาวรวม | `=(H*G)*C` (anchor I5, I7) | count × length × (1 or 2 for a double C) |
| I6 | ดั้ง total | `=SUM(I7:I11)` | sum of the king-post sub-rows |
| I14, I15 | ความยาวรวม | `=((E/F)*D)*C` (anchor I14) | slope area ÷ spacing × factor × C |
| J5, J6, J12–J15 | จำนวนท่อน | `=ROUNDUP((I/6),0)` | 6 m stock length, rounded up |
| J7–J11 | – | blank | sub-rows do not produce sticks themselves |
| I16–I20 | – | blank, no formula | **blank rows do not compute** |
| J16–J20 | – | 0, formula `ROUNDUP((I/6),0)` (confirmed: shared from the J12 anchor, which covers J13–J20) | blank I gives 0 sticks |

v5 results: I5 185.8 → J5 **31**; I6 76.7 → J6 **13**; I12 88.2 → J12 **15**; I13 26.584 → J13 **5**; I14 169.638 → J14 **29**; I15 498.934 → J15 **84**.

Row capacity: 11 numbered member rows (5, 6 with 5 sub-rows 7–11, 12–20). BOQ links only rows 5, 6, 12, 13, 14 and 15. Rows 16–20 are not linked to the BOQ at all.

### BOQ rows (section 15)
D152–D157 = `='โครงสร้างหลังคา Roof Structure'!B5/B6/B12/B13/B14/B15`, so the description follows the calculator. The unit "ท่อน" is typed. `H = ROUNDUP((E*(100%+G)),0)`, `J = I*H`, `L = K*E`.

| Row | Desc | Unit | Qty source | Waste | Mat | Lab | H (v5) | Note |
|---|---|---|---|---|---|---|---|---|
| 152 | 1) อะเส 2-C 150x50x20x3.2 มม. | ท่อน | Roof!J5 (31) | 10% | 1,010 | 0 | 35 | |
| 153 | 2) ดั้ง 2-C 100x50x20x2.3 มม. | ท่อน | Roof!J6 (13) | 10% | 580 | 0 | 15 | |
| 154 | 3) อกไก่ 2-C 100x50x20x2.3 มม. | ท่อน | Roof!J12 (15) | 10% | 580 | 0 | 17 | |
| 155 | 4) ตะเข้ราง C 100x50x20x2.3 มม. | ท่อน | Roof!J13 (5) | 10% | 580 | 0 | 6 | |
| 156 | 5) จันทัน C 100x50x20x2.3 มม. | ท่อน | Roof!J14 (29) | 10% | 580 | 0 | 32 | |
| 157 | 6) แปสำเร็จรูป GZ หนา 0.7 มม. | ท่อน | Roof!J15 (84) | 10% | 110 | 0 | 93 | |
| 158 | 7) งานทาสีกันสนิม | เหมา | typed 1 (constant; not yellow-filled) | 0 | 8,000 | 2,000 | 1 | lump sum |
| 159 | 8) ค่าแรงโครงสร้างเหล็ก (รวมค่าลวดเชื่อมและใบตัด) | ตร.ม. | Roof!E15 = Roofing!K7 (147.511) | 0 | 0 | 150 | 148 | labour per m² of slope area, L = 150×147.511 = 22,126.65 |
| 160 | รวม >> | | | | J 94,180 | L 24,126.65 | M 118,306.65 | |

### Cross-links
- Takes from Roofing: slope area K7 (into E14, E15 and BOQ E159).
- Feeds BOQ rows 152–159.
- BOQ C151 hyperlinks to the sheet, and the sheet's E2 "Back Home" link returns to the BOQ.

### Review notes
- p65: the app's Step 15 asks for plan area, roof shape (จั่ว/…), pitch, structure type (steel), heavy-tile toggle and purlin spacing, plus optional rafter spacing, screw/weld option, weld %, anti-rust coats, ridge length and waste. Its preview shows slope area "(0 องศา)", steel kg, anti-rust m², weld kg, and purlins "NaN m".
- p66: the BOQM target rows are as above (identical to v5).
- p67: the calculator sheet as above, with the ซีคู่ and Factor dropdowns visible.

### Today's app vs Excel
- The app estimates steel **kg** from plan area × a kg/m² guess by roof shape (12/16/22, +5 for heavy tile). Excel counts **pieces (ท่อน)** for each named member type.
- The app has invented rows: welding rods, anti-rust **m²** and purlin screws. Excel has a single anti-rust lump row (8,000/2,000) and a labour row per m² of slope area.
- The app computes its own slope area from its own pitch input. In Excel the slope area comes **from the Roofing sheet K7**, and the roof structure sheet has no pitch input. G13 hard-codes 40°.
- Purlin spacing and rafter spacing do exist in Excel (F15 = 0.34, F14 = 1.0), together with the 1.15 factor dropdown and the ซีคู่ multiplier. The app has no factor and no single/double-C option.
- Rebuild as a member table: desc, C (1/2), factor, area (default = roofing slope area), spacing, length, count, giving total m and sticks = ceil(m/6). Use exactly the 8 BOQ rows listed.

---

## 3. Section 16 — มุงหลังคา: sheet "มุงหลังคา_Roofing" (sheet23)

### Purpose
Takes off CPAC Monier concrete-tile roofing. It holds the main tiles, the caps and the accessories. Each row has a per-unit factor and a take-off quantity, and these give a rounded purchase quantity. It also contains a helper ("โปรแกรมเสริม : คำนวณพื้นที่หลังคา") that turns plan area and pitch into slope area. The sheet title says "(หลังคาซีแพค)", so it covers CPAC tile only.

### Helper block (J4:L7)
| Cell | Label | Type | Default | Unit |
|---|---|---|---|---|
| K5 | พื้นที่ตามแนวราบ (ตร.ม) | **input** number | 113.0 | ตร.ม. |
| K6 | ความลาดเอียงหลังคา Slope (องศา) | **input** number | 40 | องศา |
| K7 | พื้นที่ตามแนวลาดเอียง (ตร.ม) | formula `=K5/COS(RADIANS(K6))` | 147.511 | ตร.ม. |

### Main table layout (header row 4, data rows 5–21)
| Col | Header | Type |
|---|---|---|
| A | ลำดับ | 1–17 |
| B | รายการวัสดุมุงและครอบ | dropdown (list below) |
| C | ปริมาณ ต่อหน่วย | **input** factor (yellow) |
| D | หน่วย (of the factor) | dropdown: `ตร.ม./ม้วน, แผ่น/ตร.ม., แผ่น/ม., ม./แผ่น, แผ่น` |
| E | ปริมาณ ถอดแบบ | **input** take-off qty (yellow; some rows hold formulas) |
| F | หน่วย (of the take-off) | dropdown: `ตร.ม., ม., จุด` |
| G | ปริมาณ BOQ | formula (rounded up) |
| H | หน่วย (purchase unit) | dropdown: `แผ่น, ม้วน` |

B dropdown list (exact strings; several have trailing spaces): `กระเบื้องหลังคาซีแพคโมเนีย`, `ครอบข้างจั่ว `, `ครอบข้างผนัง `, `ครอบโค้ง 2 ทาง`, `ครอบโค้ง 3 ทาง`, `ครอบโค้ง 4 ทาง`, `ครอบโค้งหางมน`, `ครอบปิดจั่ว`, `ครอบปิดชาย`, `ครอบสันโค้ง `, `ชุดครอบข้างผนัง `, `ชุดครอบระบบแห้ง DRYTECH `, `แผ่นปิดกันนก `, `แผ่นสะท้อนความร้อน (1.25 x 60 ม./ม้วน)`, `ไม้เชิงชาย `, `รางน้ำตะเข้ `. In the raw validation string the last item is joined with `"&"`.

### Rows (v5 values)
| Row | B item | C factor | D | E take-off | F | G formula | G (v5) | H |
|---|---|---|---|---|---|---|---|---|
| 5 | กระเบื้องหลังคาซีแพคโมเนีย | 11 | แผ่น/ตร.ม. | `=K7` 147.511 | ตร.ม. | `ROUNDUP(E*C,0)` | 1623 | แผ่น |
| 6 | ครอบสันโค้ง | 3.3 | แผ่น/ม. | `=2.4+9.2+6.6+0.9` 19.1 (ridge length) | ม. | `ROUNDUP(E*C,0)` | 64 | แผ่น |
| 7 | ครอบข้างจั่ว | 3 | แผ่น/ม. | `=(4.7+6.45+7.2+5.6+5.2+2.35+2.6)/COS(RADIANS(40))` 44.514 (gable rake length) | ม. | `ROUNDUP(E*C,0)` | 134 | แผ่น |
| 8 | ครอบข้างผนัง | 3 | แผ่น/ม. | 7.2 (wall abutment length) | ม. | `ROUNDUP(E*C,0)` | 22 | แผ่น |
| 9 | ครอบปิดชาย | 1 | แผ่น | 8 | จุด | `ROUNDUP(E*C,0)` | 8 | แผ่น |
| 10 | ครอบปิดจั่ว | 1 | แผ่น | 5 | จุด | `ROUNDUP(E*C,0)` | 5 | แผ่น |
| 11 | ครอบโค้ง 2 ทาง | 1 | แผ่น | 1 | จุด | `ROUNDUP(E*C,0)` | 1 | แผ่น |
| 12 | ชุดครอบระบบแห้ง DRYTECH | 3 | ม./แผ่น | `=E6` 19.1 | ม. | `ROUNDUP(E/C,0)` | 7 | แผ่น |
| 13 | ชุดครอบข้างผนัง | 4.8 | ม./แผ่น | `=E8` 7.2 | ม. | `ROUNDUP(E/C,0)` | 2 | แผ่น |
| 14 | รางน้ำตะเข้ | 2 | ม./แผ่น | `=5.09*2` 10.18 (valley length) | ม. | `ROUNDUP(E/C,0)` | 6 | แผ่น |
| 15 | แผ่นปิดกันนก | 0.5 | ม./แผ่น | `=12.5+3+2.6+3+1.5` 22.6 (eave length) | ม. | `ROUNDUP(E/C,0)` | 46 | แผ่น |
| 16 | ไม้เชิงชาย | 4 | ม./แผ่น | 62.3 (fascia length) | ม. | `ROUNDUP(E/C,0)` | 16 | แผ่น |
| 17 | แผ่นสะท้อนความร้อน (1.25 x 60 ม./ม้วน) | 75 | ตร.ม./ม้วน | `=K7` 147.511 | ตร.ม. | `ROUNDUP(E/C,0)` | 2 | ม้วน |
| 18–21 | (blank) | | | | | `ROUNDUP(E*C,0)` | 0 | |

The G formula blocks are G5:G11 = multiply (anchor G5), G12:G17 = divide (anchor G12) and G18:G21 = multiply (anchor G18). **The multiply/divide choice is fixed per row and does not follow D.** For the rebuild, derive it from D: `แผ่น/ตร.ม.`, `แผ่น/ม.` and `แผ่น` mean multiply; `ม./แผ่น` and `ตร.ม./ม้วน` mean divide.

Row capacity: 17 rows. BOQ links rows 5–17 only, **by row position**. Rows 18–21 never reach the BOQ.

### BOQ rows (section 16)
D162–D174 = `='มุงหลังคา_Roofing'!B5…B17`, E = `…!G5…G17`, F = `…!H5…H17`. `H = ROUNDUP((E*(100%+G)),0)`, `J = I*H`, `L = K*E`.

| Row | Desc | Unit | Qty source | Waste | Mat | Lab | H (v5) |
|---|---|---|---|---|---|---|---|
| 162 | 1) กระเบื้องหลังคาซีแพคโมเนีย | แผ่น | Roofing!G5 (1623) | 5% | 12.5 | 0 | 1705 |
| 163 | 2) ครอบสันโค้ง | แผ่น | G6 (64) | 5% | 38 | 0 | 68 |
| 164 | 3) ครอบข้างจั่ว | แผ่น | G7 (134) | 5% | 38 | 0 | 141 |
| 165 | 4) ครอบข้างผนัง | แผ่น | G8 (22) | 5% | 38 | 0 | 24 |
| 166 | 5) ครอบปิดชาย | แผ่น | G9 (8) | 0 | 48 | 0 | 8 |
| 167 | 6) ครอบปิดจั่ว | แผ่น | G10 (5) | 0 | 60 | 0 | 5 |
| 168 | 7) ครอบโค้ง 2 ทาง | แผ่น | G11 (1) | 0 | 55 | 0 | 1 |
| 169 | 8) ชุดครอบระบบแห้ง DRYTECH | แผ่น | G12 (7) | 5% | 620 | 0 | 8 |
| 170 | 9) ชุดครอบข้างผนัง | แผ่น | G13 (2) | 5% | 2,750 | 0 | 3 |
| 171 | 10) รางน้ำตะเข้ | แผ่น | G14 (6) | 5% | 420 | 0 | 7 |
| 172 | 11) แผ่นปิดกันนก | แผ่น | G15 (46) | 5% | 50 | 0 | 49 |
| 173 | 12) ไม้เชิงชาย | แผ่น | G16 (16) | 5% | 400 | 0 | 17 |
| 174 | 13) แผ่นสะท้อนความร้อน (1.25 x 60 ม./ม้วน) | ม้วน | G17 (2) | 5% | 1,680 | 0 | 3 |
| 175 | 14) ค่าแรงมุงหลังคา | ตร.ม. | Roofing!K7 (147.511) | 0 | 0 | 150 | 148 |
| 176 | 15) ค่าแรงติดตั้งไม้เชิงชาย | ม. (=Roofing!F16) | Roofing!E16 (62.3) | 0 | 0 | 100 | 63 |
| 177 | รวม >> | | | | J 61,345.5 | L 28,356.65 | M 89,702.15 |

### Cross-links
- K7 (slope area) feeds Roof Structure E14 and E15 (and so BOQ 15.5, 15.6 and 15.8), plus BOQ 16.1 (via E5), 16.13 (via E17) and 16.14.
- E16 (fascia length) feeds BOQ 16.15. Fascia is also painted in the Paint sheet (BOQ "ทาสีผนัง - เชิงชาย" 14.536 m²); that belongs to the Paint agent's spec.
- BOQ C161 hyperlinks to the sheet, and its E2 links back.

### Review notes
- p69: the app's Step 16 asks for slope area typed by hand, roofing type (dropdown "กระเบื้องคอนกรีตแผ่นลอน (เช่น CPAC)" etc.) and optional ridge, hip, eave and valley lengths, foil toggle, bird-block toggle and waste. Its preview shows only "แผ่นหลังคา 0.00 แผ่น".
- p70: the reviewer wrote **"อันนี้แค่หลังคา CPAC"** above the BOQM section 16 table. The Excel section covers CPAC tile only, so the app's multi-material choice (Excella, metal sheet, corrugated, shingle) has no counterpart in the Excel.
- p71: the calculator sheet, including the helper block (113 m², 40°, 147.51 m²).

### Today's app vs Excel
- The app asks the user for slope area. Excel asks for **plan area + pitch** and computes slope area (K7), then reuses it in 4 places.
- The app has 5 roofing materials with invented coverage factors. Excel has CPAC only, with an editable factor table of 13 items.
- The app gives caps as `(ridge+hip)*3.3` and DryTech/valley/eave/bird-block **in metres**. Excel gives each accessory as a purchase count (`ROUNDUP(len*factor)` or `ROUNDUP(len/coverage)`) and has separate rake caps, wall caps, end caps, 2-way caps and a wall-flashing set.
- The app has no roofing labour row (Excel 16.14, 150 ฿/m² of slope) and no fascia installation labour row (Excel 16.15, 100 ฿/m).
- Foil in the app is m². Excel gives rolls (75 m²/roll).

---

## 4. Section 17 — ก่ออิฐ: sheet "ก่ออิฐ_Brick" (sheet13)

### Purpose
A wall-by-wall table. For each wall it computes gross area (length × height), subtracts the door and window openings for the same wall part, brick type and thickness (from the Door & Window sheet), and gives the net masonry area. The BOQ then sums net area by brick type × thickness.

### Table layout (header row 4, data rows 5–20 = 16 rows)
| Col | Header | Type | Options |
|---|---|---|---|
| A | ลำดับ | 1–16 | |
| B | ส่วนผนัง (wall part) | dropdown | `ผนังภายในบ้าน, ผนังรอบบ้าน-พิเศษ, ผนังรอบบ้าน, ผนังภายนอกบ้าน` |
| C | รายการ (brick type) | dropdown | `อิฐมวลเบา, อิฐมอญ` |
| D | ความหนา | dropdown | `ครึ่งแผ่น, เต็มแผ่น` |
| E | ความยาว (ม.) | **input** (yellow; typed as sums) | |
| F | ความสูง (ม.) | **input** (yellow) | |
| G | พื้นที่ผนัง (ตร.ม.) | formula | |
| H | พื้นที่ช่องเปิด (ตร.ม.) | formula | |
| I | รวม (ตร.ม.) | formula `=G-H` | |

Wall-part meaning (inferred from the plaster sides): ผนังรอบบ้าน = outer wall of the house, plastered once inside and once outside. ผนังภายในบ้าน = interior partition, plastered on both faces inside. ผนังภายนอกบ้าน = free-standing outside wall, plastered on both faces outside. ผนังรอบบ้าน-พิเศษ = "special" outer wall; the samples are gable triangles in AAC.

### v5 sample data
| Row | B | C | D | E | F | G | H | I |
|---|---|---|---|---|---|---|---|---|
| 5 | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | `=9.5+7+2+3+8+3+2+3+1.5+3.5` 42.5 | 3.5 | 148.75 | 34.6175 | 114.1325 |
| 6 | ผนังภายในบ้าน | อิฐมอญ | ครึ่งแผ่น | `=2.2+3+1.3+3.4+4+3+3+3+2+1.8` 26.7 | 3.5 | 93.45 | 7.6 | 85.85 |
| 7 | ผนังภายนอกบ้าน | อิฐมอญ | เต็มแผ่น | `=1-1+1+1+0.5` 2.5 | 3.5 | 8.75 | 0 | 8.75 |
| 8 | ผนังรอบบ้าน-พิเศษ | อิฐมวลเบา | ครึ่งแผ่น | 7 | 3 | 10.5 | 0 | 10.5 |
| 9 | ผนังรอบบ้าน-พิเศษ | อิฐมวลเบา | ครึ่งแผ่น | 6 | 2.65 | 7.95 | 0 | 7.95 |
| 10 | ผนังรอบบ้าน-พิเศษ | อิฐมวลเบา | ครึ่งแผ่น | 7 | 3 | 10.5 | 0 | 10.5 |
| 11–20 | (blank) | | | | | 0 | 0 | 0 |

### Computed fields
| Cell | Formula | Plain language |
|---|---|---|
| G5 (block G5:G7) | `=E5*F5` | rectangle: length × height |
| G8 (block G8:G20, confirmed) | `=0.5*E8*F8` | **triangle** (gable): ½ × base × height. Every blank row 11–20 carries this triangle formula |
| H5:H20 | `=SUMIFS('ประตู-หน้าต่าง_Door&Window'!K:K, …!D:D,$B5, …!E:E,$C5, …!F:F,$D5)` | total opening area of every door/window whose wall part, brick type and thickness all equal this row's |
| I5:I20 | `=G-H` | net masonry area |

Openings for row 5 come to 34.6175. That is every opening on ผนังรอบบ้าน/อิฐมอญ/ครึ่งแผ่น: D1 5.33 + D2 3.075 + D4 1.6 + D6 3.28 + D7 4.3725 + D8 1.59 + D9 4.92 + W1 3.12 + W2 4.32 + W3 1.8 + W4 1.21. Row 6 gets 7.6 = D3 4.8 + D5 2.8.

### BOQ rows (section 17)
| Row | Desc | Unit | Qty source | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|
| 179 | 1) ก่ออิฐมอญ (ครึ่งแผ่น) | ตร.ม. | `SUMIFS(Brick!I:I, Brick!C:C,"อิฐมอญ", Brick!D:D,"ครึ่งแผ่น")` = 199.9825 | 0 | 280 | 220 | |
| 180 | 2) ก่ออิฐมอญ (เต็มแผ่น) | ตร.ม. | same, "อิฐมอญ"/"เต็มแผ่น" = 8.75 | 0 | `=I179*2` 560 | `=K179*2` 440 | full-brick price = 2× half-brick |
| 181 | 3) ก่ออิฐอิฐมวลเบา (ครึ่งแผ่น ) | ตร.ม. | "อิฐมวลเบา"/"ครึ่งแผ่น" = 28.95 | 0 | 280 | 130 | |
| 182 | 4) ก่ออิฐอิฐมวลเบา (เต็มแผ่น ) | ตร.ม. | "อิฐมวลเบา"/"เต็มแผ่น" = 0 | 0 | `=I181*2` 560 | `=K181*2` 260 | |
| 183 | 5) เสาเอ็นและคานทับหลัง | **ม.** | `=SUM(E179:E182)` = 237.6825 (**m² of wall**) | 0 | 35 | 100 | stiffeners and lintels priced per m² of wall, although the unit says ม. |
| 184 | 6) ท่อร้อยสายไฟ (heading) | | | | | | |
| 185 | - ท่อร้อยสายไฟ ท่อ PVC 1/2" | ม. | `='ท่อร้อยสายไฟ_Electrical Pipe'!I4` = 369.9 | 15% | 25 | 35 | **L = K*H** (labour on gross qty). Sheet specced by the MEP agent |
| 186 | - วัสดุอุปกรณ์และของใช้สิ้นเปลือง | เหมา | typed 1 | – | `=SUM(J185,L185)*15%` 3,828.465 | 0 | N: (15% ของค่าวัสดุและค่าแรง) |
| 187 | รวม >> | | | | J 91,783.08 | L 90,266.375 | M 182,049.45 |

Formulas: `H179 = E179*(100%+G179)` (not rounded), `J = I*H`, `L179 = K*E`, `H185 = E185*(100%+G185)`, `J185 = I185*H185`, `L185 = K185*H185`. Row 186: `J186 = I186*E186`, `L186 = K186*E186`.

### Cross-links
- Takes openings from the Door & Window sheet (K by D/E/F).
- Feeds BOQ 17.1–17.5, and the **Plaster** sheet (SUMIF of I by wall part B).
- BOQ C178 hyperlinks to the sheet. Row 17.6 links to the Electrical Pipe sheet (deck p76 shows that sheet; total 369.90).

### Review notes
- p73: the app's Step 17 asks for total wall area, opening area, brick type (อิฐมอญ ธรรมดา / อิฐมวลเบา (AAC)), waste and optional lintel length. Its preview shows bricks **pcs** and net area.
- p74: the BOQM target, with the red box around **"6) ท่อร้อยสายไฟ"**. The reviewer wants the conduit rows inside section 17 and linked to the electrical-pipe sheet. Deck prices are older than v5: 250/500 material against v5's 280/560, and stiffener material 50 against v5's 35. Deck total is 179,090.22; v5 is 182,049.45.
- p75: the brick calculator, with 16 rows and coloured dropdown chips.
- p76: the Electrical Pipe sheet, which feeds 17.6.

### Today's app vs Excel
- The app takes one total wall area and one opening area. Excel has a **wall table** (part × brick × thickness × L × H) and pulls openings **automatically** from the door/window schedule.
- The app converts to **brick pieces** (144/m² clay, 8.78/m² AAC) plus a mortar row. Excel prices **per m² of wall**, split into 4 rows (clay/AAC × half/full). There is no piece count and no mortar row.
- The app has AAC thickness options (7.5–20 cm). Excel has only ครึ่งแผ่น or เต็มแผ่น.
- Excel's stiffener/lintel row is automatic (= total wall area). In the app it is an optional length the user types.
- The app has no conduit rows and no 15% consumables row in this section.

---

## 5. Section 18 — ฉาบปูน: sheet "ฉาบปูน_Plaster" (sheet14)

### Purpose
Turns net brick area into plaster area. Each row picks a wall part, inside or outside plaster, and the number of faces. Area = net brick area of that wall part × faces. The BOQ then sums by inside/outside.

### Table layout (header row 4, data rows 5–22 = 18 rows)
| Col | Header | Type | Options |
|---|---|---|---|
| A | ลำดับ | 1–18 | |
| B | แยกส่วนผนัง | dropdown | `ผนังภายในบ้าน, ผนังรอบบ้าน, ผนังรอบบ้าน-พิเศษ, ผนังภายนอกบ้าน, ผนังโครงสร้าง` |
| C | รายการ | dropdown | `ฉาบภายนอก, ฉาบภายใน ` (the second item has a trailing space) |
| D | ฉาบกี่ด้าน | dropdown | `1, 2` |
| E | รวม (ตร.ม.) | formula | |

### v5 data and formulas
| Row | B | C | D | E formula | E (v5) |
|---|---|---|---|---|---|
| 5 | ผนังรอบบ้าน | ฉาบภายใน | 1 | `=(IFERROR(SUMIF('ก่ออิฐ_Brick'!$B$5:$B$1000,$B5,'ก่ออิฐ_Brick'!$I$5:$I$1000),0))*D5` | 114.1325 |
| 6 | ผนังรอบบ้าน | ฉาบภายนอก | 1 | same | 114.1325 |
| 7 | ผนังภายในบ้าน | ฉาบภายใน | 2 | same | 171.7 |
| 8 | ผนังภายนอกบ้าน | ฉาบภายนอก | 2 | same | 17.5 |
| 9 | ผนังรอบบ้าน-พิเศษ | ฉาบภายใน | 1 | same | 28.95 |
| 10 | ผนังรอบบ้าน-พิเศษ | ฉาบภายนอก | 1 | same | 28.95 |
| 11 | ผนังโครงสร้าง | ฉาบภายนอก | 1 | **`=((1*25)+(0.8*2.6*3))*D11`** (hard-coded) | 31.24 |
| 12–22 | (blank) | | | **no formula** (blank) | |

In plain language, E = (sum of net brick area I for every brick row whose wall part equals B) × number of faces. It ignores brick type and thickness. Row 11 ("ผนังโครงสร้าง", meaning concrete structure faces such as columns and beams) has no brick source. Its area is a typed constant: 25 m² plus 3 × 0.8 × 2.6 = 6.24 m².

Row capacity: 18 rows have dropdowns, but only rows 5–11 have formulas.

### BOQ rows (section 18)
| Row | Desc | Unit | Qty source | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|
| 189 | 1) งานฉาบปูนผนัง (ภายนอก) | ตร.ม. | `IFERROR(SUMIF(Plaster!$C:$C,"ฉาบภายนอก",Plaster!$E:$E),0)` = 191.8225 | 0 | 50 | 180 | |
| 190 | 2) งานฉาบปูนผนัง (ภายใน) | ตร.ม. | `IFERROR(SUMIF(Plaster!$C:$C,"ฉาบภายใน",Plaster!$E:$E),0)` = 314.7825 | 0 | 50 | 150 | J190 = **I190*E190** |
| 191 | 3) วงกบประตูไม้ | ชุด | `IFERROR(SUMIF('ประตู-หน้าต่าง_Door&Window'!$C:$C,"บานไม้",…!$G:$G),0)` = 7 | 0 | 1,200 | 500 | `J = I*H`, **`L = K*H`** |
| 192 | 4) สายไฟ (heading) | | | | | | |
| 193 | - รวมสายไฟฟ้า THW 1.5 ตร.มม. | ม. | `='สายไฟ_Electrical Cable'!I4` = 189 | 15% | 15 | 7 | L = K*H. Sheet specced by the MEP agent |
| 194 | - รวมสายไฟฟ้า THW 2.5 ตร.มม. | ม. | Cable!J4 = 264.5 | 15% | 20 | 10 | L = K*H |
| 195 | - รวมสายไฟฟ้า THW 4 ตร.มม. | ม. | Cable!K4 = 511.8 | 15% | 30 | 15 | L = K*H |
| 196 | - วัสดุอุปกรณ์และของใช้สิ้นเปลือง | เหมา | typed 1 | 0 | `=SUM(J193:J195,L193:L195)*15%` 6,058.89 | 0 | N: (15% ของค่าวัสดุและค่าแรง) |
| 197 | รวม >> | | | | J 66,789.99 | L 98,637.175 | M 165,427.165 |

Formulas: `H = E*(100%+G)` on rows 189–191 and 193–196 (not rounded), `J = I*H` except **J190 = I190*E190**, `L = K*E` on 189–190, `L = K*H` on 191 and 193–195, `L196 = K196*E196`. Row 196 (consumables) keeps the shared H/J (`H196 = E196*(1+G196)` = 1, `J196 = I196*H196`), unlike row 186, which has no G/H and uses `J186 = I186*E186`.

Checks: outside = rows 6+8+10+11 = 114.1325+17.5+28.95+31.24 = 191.8225. Inside = rows 5+7+9 = 114.1325+171.7+28.95 = 314.7825. Wood frames = D3 3 + D4 1 + D5 2 + **W4 1** = 7.

### Cross-links
- Takes from the Brick sheet (I by B) and the Door & Window sheet (G where C = บานไม้).
- Feeds BOQ 18.1–18.3, and the **Paint sheet** (sheet19): `C5 = SUMIF(Plaster!C5:C100,"ฉาบภายนอก",E5:E100)` and `C6 = …"ฉาบภายใน"`. Those drive the wall-paint rows in BOQ sections 23, 25 and 31, and the skim coat in 23.9 (506.605 = 191.8225 + 314.7825).
- The THW 6 total on the cable sheet (L4) is not linked to any BOQ row.
- Hyperlinks: BOQ D189/D190 go to the Plaster sheet, D191 to the Door & Window sheet.

### Review notes
- p78: the app's Step 18 uses a **room list** (กว้าง/ยาว/สูง/หักช่องเปิด, inside or outside), skim-coat toggles and waste. Its preview shows outside, inside and skim m², and a cost preview.
- p79: the BOQM target. Underlined links are งานฉาบปูน, สายไฟ and วงกบประตูไม้. In the deck the row order is 1) outside, 2) inside, 3) สายไฟ, 4) วงกบประตูไม้; v5 has วงกบ as 3) and สายไฟ as 4). Deck prices are older: plaster material 45 against v5's 50, cables 10/15/25 against 15/20/30, consumables 5,226.32 against 6,058.89.
- p80: the Plaster calculator, as above.
- p81: the Electrical Cable sheet (THW 1.5 / 2.5 / 4 / 6 totals 189 / 264.5 / 511.8 / 0). It belongs to the MEP agent.
- p82: the Door & Window sheet, as the source of วงกบประตูไม้.

### Today's app vs Excel
- The app re-measures walls from room perimeters × height minus openings. Excel **does not re-measure**: it reuses the net brick areas by wall part × number of faces (1/2) and adds one structural-wall row.
- The app's skim coat sits in plaster as its own row 18.3. In Excel, skim coat is in section 23 (Paint sheet, 23.9), and 18.3 is **วงกบประตูไม้** (wood door frames, counted from the door schedule).
- The app has no cable rows (18.4) and no 15% consumables row.
- The app applies waste to plaster area. Excel waste is 0 and labour rates differ by side (180 outside, 150 inside).

---

## 6. Shared schedule — sheet "ประตู-หน้าต่าง_Door&Window" (sheet12)

### Purpose
The single door and window schedule. Each row is one door or window type with its count and size. It feeds three things:
1. **brick opening deductions**, through the H3:K3 note "[ ใช้คำนวณงานก่ออิฐ ]";
2. **BOQ section 24** (aluminium) and **section 30** (wood), one BOQ row per schedule row, through a Google-Sheets FILTER;
3. **BOQ 18.3** wood frame count.

### Table layout (header row 4)
- Doors: heading row 5 "ประตู (Door)", data rows **6–16** (11 rows, numbered 1–11).
- Windows: heading row 17 "หน้าต่าง (Window)", data rows **18–25** (8 rows, numbered 1–8).

| Col | Header | Type | Options / notes |
|---|---|---|---|
| A | ลำดับ | number | |
| B | รายการ | **input** text (yellow) | code + description + size, e.g. "D1-บานเลื่อนคู่ และช่องแสงติดตาย ขนาด 2.6 x 2.05 ม." Becomes the BOQ description |
| C | ชนิดบาน | dropdown | `บานไม้, บานอลูมิเนียม ` (the aluminium value has a trailing space) |
| D | ส่วนผนัง | dropdown | `ผนังภายในบ้าน, ผนังรอบบ้าน, ผนังรอบบ้าน-พิเศษ, ผนังภายนอกบ้าน` |
| E | อิฐ | dropdown | `อิฐมวลเบา, อิฐมอญ`. **E6 only** has an extra option, `ผนังเบา` |
| F | ความหนา | dropdown | `ครึ่งแผ่น, เต็มแผ่น` |
| G | จำนวน (บาน) | **input** number (yellow) | count. Becomes the BOQ qty |
| H | กว้าง (ม.) | **input** (yellow) | width |
| I | สูง (ม.) | **input** (yellow) | height |
| J | พื้นที่ ต่อบาน (ตร.ม.) | formula `=H*I` | area per unit |
| K | รวม (ตร.ม.) | formula `=J*G` | total opening area |

Formula anchors: J6/K6 (block 6–14), **row 15 has no formula** (blank J15/K15), J16/K16 have their own formula, and J18/K18 cover rows 18–25.

### v5 data
| Row | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | D1-บานเลื่อนคู่ และช่องแสงติดตาย ขนาด 2.6 x 2.05 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 2.6 | 2.05 | 5.33 | 5.33 |
| 7 | D2-บานเลื่อนสลับ ขนาด 1.5 x 2.05 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 1.5 | 2.05 | 3.075 | 3.075 |
| 8 | D3-บานเปิดเดี่ยว ขนาด 0.8 x 2 ม. | บานไม้ | ผนังภายในบ้าน | อิฐมอญ | ครึ่งแผ่น | 3 | 0.8 | 2.0 | 1.6 | 4.8 |
| 9 | D4-บานเปิดเดี่ยว ขนาด 0.8 x 2 ม. | บานไม้ | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 0.8 | 2.0 | 1.6 | 1.6 |
| 10 | D5-บานเปิดเดี่ยว มีเกล็ดระบายอากาศ ขนาด 0.7 x 2 ม. | บานไม้ | ผนังภายในบ้าน | อิฐมอญ | ครึ่งแผ่น | 2 | 0.7 | 2.0 | 1.4 | 2.8 |
| 11 | D6-บานเลื่อนสลับ ขนาด 1.6 x 2.05 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 1.6 | 2.05 | 3.28 | 3.28 |
| 12 | D7-บานเลื่อนสลับ และช่องแสงติดตาย ขนาด 1.65 x 2.65 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 1.65 | 2.65 | 4.3725 | 4.3725 |
| 13 | D8-บานกระทุ้งข้าง ขนาด 0.6 x 2.65 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 0.6 | 2.65 | 1.59 | 1.59 |
| 14 | D9-บานเลื่อนสลับ ขนาด 2.4 x 2.05 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 2.4 | 2.05 | 4.92 | 4.92 |
| 15–16 | (blank) | | | | | | | | | |
| 18 | W1-บานเลื่อนสลับ ขนาด 1.3 x 1.2 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 2 | 1.3 | 1.2 | 1.56 | 3.12 |
| 19 | W2-บานกระทุ้งข้าง และช่องแสงติดตาย ขนาด 0.6 x 1.8 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 4 | 0.6 | 1.8 | 1.08 | 4.32 |
| 20 | W3-บานกระทุ้งล่าง ขนาด 1.8 x 0.5 ม. | บานอลูมิเนียม | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 2 | 1.8 | 0.5 | 0.9 | 1.8 |
| 21 | W4-บานวงกลม ช่องแสงติดตาย ขนาด Dia.1.1 ม. | บานไม้ | ผนังรอบบ้าน | อิฐมอญ | ครึ่งแผ่น | 1 | 1.1 | 1.1 | 1.21 | 1.21 |
| 22–25 | (blank) | | | | | | | | 0 | 0 |

### Outputs and consumers
| Consumer | Rule |
|---|---|
| Brick H (openings) | `SUMIFS(K, D=wall part, E=brick, F=thickness)` |
| BOQ 18.3 วงกบประตูไม้ | `SUMIF(C,"บานไม้",G)`, covering doors **and** windows |
| BOQ 24 rows 234–242 | D = `FILTER(B6:B994, C6:C994="บานอลูมิเนียม")`, E = `FILTER(G6:G994, C6:C994="บานอลูมิเนียม")`; Google-Sheets array formula that spills downward from row 234 |
| BOQ 30 rows 294–297 | D = `FILTER(B6:B994, C6:C994="บานไม้")`, E = `FILTER(G6:G994, C6:C994="บานไม้")`, spilling from row 294 |

In Excel the FILTER is wrapped as `IFERROR(__xludf.DUMMYFUNCTION("FILTER(…)"), cached)`, so the cached values are what show. The spill runs in schedule order, doors first and then windows. Blank and heading rows drop out because their C is empty.

### BOQ section 24 — งานประตู-หน้าต่างอลูมิเนียม (rows 233–243)
| Row | Desc (FILTER) | Unit | Qty (FILTER of G) | Waste | Mat I (yellow, typed formula) | Lab | Amount |
|---|---|---|---|---|---|---|---|
| 234 | 1) D1-บานเลื่อนคู่ และช่องแสงติดตาย ขนาด 2.6 x 2.05 ม. | ชุด | 1 | 0 | `=2.6*2.05*3000` 15,990 | 0 | 15,990 |
| 235 | 2) D2-บานเลื่อนสลับ ขนาด 1.5 x 2.05 ม. | ชุด | 1 | 0 | `=1.5*2.05*3000` 9,225 | 0 | 9,225 |
| 236 | 3) D6-บานเลื่อนสลับ ขนาด 1.6 x 2.05 ม. | ชุด | 1 | 0 | `=1.6*2.05*3000` 9,840 | 0 | 9,840 |
| 237 | 4) D7-บานเลื่อนสลับ และช่องแสงติดตาย ขนาด 1.65 x 2.65 ม. | ชุด | 1 | 0 | `=1.65*2.65*3000` 13,117.5 | 0 | 13,117.5 |
| 238 | 5) D8-บานกระทุ้งข้าง ขนาด 0.6 x 2.65 ม. | ชุด | 1 | 0 | `=0.6*2.65*3500` 5,565 | 0 | 5,565 |
| 239 | 6) D9-บานเลื่อนสลับ ขนาด 2.4 x 2.05 ม. | ชุด | 1 | 0 | `=2.4*2.05*3000` 14,760 | 0 | 14,760 |
| 240 | 7) W1-บานเลื่อนสลับ ขนาด 1.3 x 1.2 ม. | ชุด | 2 | 0 | `=1.3*1.2*3000` 4,680 | 0 | 9,360 |
| 241 | 8) W2-บานกระทุ้งข้าง และช่องแสงติดตาย ขนาด 0.6 x 1.8 ม. | ชุด | 4 | 0 | `=0.6*1.8*3500` 3,780 | 0 | 15,120 |
| 242 | 9) W3-บานกระทุ้งล่าง ขนาด 1.8 x 0.5 ม. | ชุด | 2 | 0 | `=1.8*0.5*3500` 3,150 | 0 | 6,300 |
| 243 | รวม >> | | | | `J = SUM(J234:J242)` 99,277.5 | **`L = SUM(L236:L242)`** 0 | `M = SUM(M234:M242)` 99,277.5 |

The pricing rule hidden in the I formulas is **unit price = width × height × rate**. The rate is **3,000 ฿/m²** for sliding or fixed types (บานเลื่อน…) and **3,500 ฿/m²** for awning types (บานกระทุ้ง…). Labour is 0 because installation is included. The widths and heights are retyped literals and are **not** linked to the schedule's H/I.

### BOQ section 30 — งานประตู-หน้าต่างไม้ (rows 293–298)
| Row | Desc (FILTER) | Unit | Qty | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|
| 294 | 1) D3-บานเปิดเดี่ยว ขนาด 0.8 x 2 ม. | ชุด | 3 | 0 | 4,000 | 800 | ราคาบานไม่เกิน 3,000 .- |
| 295 | 2) D4-บานเปิดเดี่ยว ขนาด 0.8 x 2 ม. | ชุด | 1 | 0 | 4,000 | 800 | ราคาบานไม่เกิน 3,000 .- |
| 296 | 3) D5-บานเปิดเดี่ยว มีเกล็ดระบายอากาศ ขนาด 0.7 x 2 ม. | ชุด | 2 | 0 | 4,000 | 800 | ราคาบานไม่เกิน 3,000 .- |
| 297 | 4) W4-บานวงกลม ช่องแสงติดตาย ขนาด Dia.1.1 ม. | ชุด | 1 | 0 | 5,000 | 500 | |
| 298 | รวม >> | | | | J 29,000 | L 5,300 | M 34,300 |

Standard maths: `H = E*(1+G)`, `J = I*H`, `L = K*E`. Prices are typed per BOQ row, by position.

### Review notes
- p101: the app's Step 24 has a list of ADW items (type ประตูบานเปิด/หน้าต่าง, count, W, H), glass thickness, waste and sealant length. Its preview shows door set count and area, window set count and area, silicone in m and mosquito net "(คำนวณเผื่อ 50%)". Its cost preview has door set 6,300, window 4,000 and PU sealant 520.
- p102: the BOQM target gives one row per aluminium item from the schedule (9 rows, 99,277.50).
- p103: the shared schedule sheet.
- p125: the app's "STEP 31 ประตู–หน้าต่างไม้" has WD/WW items, frame material (ไม้สัก/ไม้เนื้อแข็ง/ไม้สน/HDF/WPC), waste, hardware and sealant. Its preview shows door+frame, window+frame, hardware set and silicone tubes. **The app numbers this step 31; Excel's section is 30.**
- p126: the BOQM target section 30 (4 rows, 34,300), with the same schedule underneath. One schedule feeds both sections.

### Today's app vs Excel
- The app keeps **two separate item lists** (step 24 and step 31) and has no link to brickwork. Excel has **one schedule** that feeds brick openings, aluminium BOQ, wood BOQ and the wood-frame count.
- The app collapses items into aggregate rows (door set, door area, sliding, window set, window area, sealant). Excel has **one BOQ row per schedule item**, with the item text as the description and the count as the qty.
- The app invents sealant, mosquito net, glass-thickness warnings, hardware sets and wood finish. Excel has none of these. Aluminium price = W×H×3,000 or 3,500. Wood = 4,000/800 per door, 5,000/500 for the round window.
- The schedule fields the app is missing are ชนิดบาน (wood/alu), ส่วนผนัง, อิฐ and ความหนา, and the app needs them to drive brick openings.
- Step numbering is off: app "31" is Excel section 30.

---

## 7. Oddities and decisions needed

Hard-coded numbers and formula quirks found in these sheets. Each needs a decision: mirror it exactly, or fix it.

1. **Brick G triangle formula leaks into blank rows.** G5:G7 = `E*F` (rectangle), but G8 onward = `0.5*E*F` (triangle, for gables). The regenerated dump confirms that blank rows 11–20 carry the triangle formula (shared from G8), so a normal wall added there gets half its area. Suggestion: add a per-row "shape" (rectangle/triangle) column with rectangle as the default.
2. **Brick opening deduction repeats on duplicate keys.** H is a SUMIFS on (wall part, brick, thickness). If two brick rows share a key, both rows subtract the full opening total. Rows 8–10 share a key but have no openings. Decide: deduct per key once, or let the user assign openings to specific wall rows.
3. **Door schedule row 15 has no J/K formula.** A door typed in row "10" adds no opening area. In the rebuild, every row should compute.
4. **Door E6 alone offers "ผนังเบา".** Neither the brick nor the plaster sheet knows that value, so openings in a ผนังเบา wall are never deducted. Decide whether to drop it or add a light-wall type.
5. **Trailing-space values.** The schedule C value is `บานอลูมิเนียม ` while the FILTER compares to `บานอลูมิเนียม`. The plaster C value is `ฉาบภายใน ` while the BOQ SUMIF compares to `ฉาบภายใน`. Several roofing B items also have trailing spaces. The cached results show matches, but the app should compare **trimmed** strings or use enum codes.
6. **The W4 round window is priced and counted as a square.** Its area is 1.1 × 1.1 = 1.21 m², where π·0.55² = 0.95 m². W4 is also wood (`บานไม้`), so BOQ 18.3 **วงกบประตูไม้ counts it as a door frame** (7 = 3+1+2+**1**). Decide whether windows count toward "door frames".
7. **Section 24 unit prices are retyped literals** (`=2.6*2.05*3000`, etc.) that are not linked to the schedule's W/H, and they sit by **position**. Section 30 prices also sit by position. Because the FILTER spill decides which item lands on which row, adding, removing or reordering schedule items puts prices on the wrong items. Section 24 has room for exactly 9 rows and section 30 for 4. Suggestion: unit price = W × H × rate, with the rate chosen by opening type (3,000 sliding/fixed, 3,500 awning) or overridable per item. Store wood prices per item.
8. **Section 24 subtotal `L243 = SUM(L236:L242)`** leaves out rows 234–235. It is harmless today (labour = 0) but it is a bug. `M243 = SUM(M234:M242)`. Every other subtotal also sums M (a shared copy of the L subtotal), so M243 is not an outlier; only L243 is wrong.
9. **17.5 เสาเอ็นและคานทับหลัง has unit "ม." but qty = total brick m²** (`SUM(E179:E182)`). In effect it is a rate per m² of wall (35 + 100 ฿). Decide whether to relabel it ตร.ม. or keep it.
10. **Full-brick price = 2 × half-brick** (`I180 = I179*2`, `K180 = K179*2`; rows 182 and 181 likewise). For AAC the material price 280 is the same as clay. Should this be a fixed rule or a free price?
11. **Plaster "ผนังโครงสร้าง" is hard-coded** as `((1*25)+(0.8*2.6*3))*D11` = 31.24 m², not derived from structure sheets. Plaster rows 12–22 have dropdowns but **no formula**. Plaster ignores reveals at openings.
12. **Labour basis differs from the standard** in 17.6 (conduit), 18.3 (wood frames) and 18.4 (cables): `L = K*H`, on the qty including waste. `J190 = I*E` instead of `I*H` (no effect while waste = 0).
13. **Double rounding in sections 15/16.** The calculator already rounds up (sticks/sheets), then the BOQ does `ROUNDUP(E*(1+G),0)` again. Section 14/17/18 H is not rounded. The labour rows 15.8 and 16.14 show H = 148 (rounded), but L uses E (147.511), so cost is unaffected.
14. **40° is hard-coded** in Roof Structure G13 (valley) and Roofing E7 (gable rake). Neither is linked to the pitch input Roofing K6.
15. **Valley length is inconsistent and approximate.** The structure sheet uses 4 × `√(3.6²+3.6²)/cos40°` = 6.646 m each. The roofing sheet uses valley gutter = `5.09*2` = 10.18 m. Dividing the plan diagonal by cos(roof pitch) overstates a valley: the true 3-D length is a·√(2+tan²θ) ≈ 5.92 m for a = 3.6 m and θ = 40°. Decide whether one valley-length input should feed both sheets.
16. **Roofing G multiply/divide is fixed per row**, not derived from the D unit. Changing an item via the B dropdown does not change the maths. BOQ 16 links roofing rows 5–17 by position, so roofing rows 18–21 never reach the BOQ. Prices stay with their BOQ row, not with the item.
17. **Roof Structure blank rows (16–20) have no I formula**, and BOQ 15 links only 6 member rows. Factor D (1.15) and ซีคู่ C are shown only where they are used. D is blank on linear rows, which is fine. The D dropdown also covers rows 5 and 7–13, which ignore it.
18. **Section 14 has no calculator.** The qty 21 is typed and equals the pile count E35, also typed. Should the plate and grout count be one input, or be linked to the column count from the structure steps?
19. **Roofing E16 fascia 62.3 m and E15 bird-stop 22.6 m are separate typed numbers.** Fascia and eave are usually the same edge. Decide whether to link them.
20. **Consumables rows** (17.6 → `(J185+L185)*15%`, 18.4 → `SUM(J193:J195,L193:L195)*15%`) are formulas placed in the **yellow input cell I**. The rebuild should compute them, not ask for them.
21. **BOQ row order in section 18** differs between the deck screenshot (สายไฟ = 3, วงกบ = 4) and v5 (วงกบ = 3, สายไฟ = 4). Use v5.
22. **Deck prices against v5 prices** (deck is older): 14.2 grout 50 vs 100; 17.1/17.2 material 250/500 vs 280/560; 17.5 material 50 vs 35; 18.1/18.2 material 45 vs 50; cables 10/15/25 vs 15/20/30. Use v5 unless the owner says otherwise.
23. *(Outside this file, for the finishing agent)* BOQ rows 218/219 (section 22 บัว). Row 218's description says "0.3" but its SUMIF looks up "…0.1…", and row 219 is the reverse. Their prices 400/200 and 180/100 suggest the descriptions are right and the lookup criteria are swapped (or the other way round).

---

## 8. Golden test values (v5 sample; the rebuild should reproduce these)

| Item | Expected |
|---|---|
| Roofing K7 slope area | 113 / cos 40° = 147.5110237 |
| Roof structure sticks (J5, J6, J12, J13, J14, J15) | 31, 13, 15, 5, 29, 84 |
| BOQ 15 subtotal | J 94,180 · L 24,126.65355 · M 118,306.6536 |
| Roofing G5…G17 | 1623, 64, 134, 22, 8, 5, 1, 7, 2, 6, 46, 16, 2 |
| BOQ 16 subtotal | J 61,345.5 · L 28,356.65355 · M 89,702.15355 |
| Brick I5…I10 | 114.1325, 85.85, 8.75, 10.5, 7.95, 10.5 |
| BOQ 17 qty E179…E183, E185 | 199.9825, 8.75, 28.95, 0, 237.6825, 369.9 |
| BOQ 17 subtotal | J 91,783.0775 · L 90,266.375 · M 182,049.4525 |
| Plaster E5…E11 | 114.1325, 114.1325, 171.7, 17.5, 28.95, 28.95, 31.24 |
| BOQ 18 qty E189/E190/E191 | 191.8225, 314.7825, 7 |
| BOQ 18 subtotal | J 66,789.99 · L 98,637.175 · M 165,427.165 |
| BOQ 14 subtotal | J 7,350 · L 2,100 · M 9,450 |
| BOQ 24 subtotal | J 99,277.5 · L 0 · M 99,277.5 |
| BOQ 30 subtotal | J 29,000 · L 5,300 · M 34,300 |

---

## 9. Verification (shared formulas)

The spec was re-checked against the regenerated dump, which now shows shared-formula cells as `=SHARED(si=N, master …)`. All sheets were checked: 12 Door&Window, 13 Brick, 14 Plaster, 22 Roof Structure, 23 Roofing, and BOQ (Home) rows 147–198, 233–243 and 293–298. **No cell the spec calls an input turned out to be a shared formula.** All yellow input cells hold typed values or the typed expressions already listed. No golden value changed.

Changes made:
- **Conventions:** the "assumed shared formula" caveat is replaced by "confirmed". The subtotal rule is now `M = SUM(M first:last)`, not `M = J+L`. M150/M160/M177/M187/M197/M298 are shared copies of the L subtotal shifted one column, and M243 is an explicit SUM. The section 14 formulas line now includes M150.
- **Oddity 8:** removed the claim that M243 = SUM(M) is unusual, because every subtotal sums M. Only `L243 = SUM(L236:L242)` is a bug.
- **Brick G11:G20:** confirmed to carry the triangle formula `0.5*E*F` (shared from G8). This was "most likely" before; the computed-fields table and oddity 1 are updated.
- **Roof Structure J16:J20:** confirmed `ROUNDUP((I/6),0)` (shared from J12). This was "assumed" before. I16:I20 are confirmed to have no formula.
- **BOQ 15.7 (E158):** the qty 1 is a typed constant **without** yellow fill, so it is not a marked input. E186 and E196 are the same.
- **BOQ section 18:** added the explicit formulas line. The new information is that row 196 keeps the shared `H = E*(1+G)` and `J = I*H`, while `L196 = K*E`. Row 186 has no H and uses `J = I*E`.

Confirmed unchanged: Door&Window J/K blocks (J7:K14 shared from row 6, row 15 blank, row 16 explicit, J19:K25 shared from row 18). Roof Structure I8:I13 shared from I7, I15 from I14 and J6 from J5. Roofing G6:G11 multiply, G13:G17 divide, G19:G21 multiply. Plaster E5:E11 explicit, E12:E22 blank. BOQ H/J/L/M in sections 14, 15, 16, 17, 24 and 30 follow the standard row maths, except the labour-on-H rows (185, 191, 193–195) and J190, which are already documented.
