# Excel Spec 05: MEP, Sanitary and Miscellaneous

Source: workbook "โปรแกรมประมาณราคา BOQ … บ้านชั้นเดียว – Training Edition v5". The sheet dumps are in `%TEMP%\ctrv2\v5\sheet05..11,20,21.txt` and the BOQ is in `sheet01.txt`.
Review deck: `%TEMP%\ctrv2\review\pageNN.png`.

The spec is written so the app can be rebuilt without opening the Excel. Every string in `backticks` is **verbatim**, including Excel typos, double spaces and trailing spaces. A trailing space is called out as *(trailing sp)*.

---

## 0. Conventions that apply to every sheet in this file

### 0.1 BOQ (Home) row arithmetic (verified cell by cell for every row below)

| Col | Header (row 7) | Formula | Notes |
|---|---|---|---|
| D | รายการ | `='<calc sheet>'!B<n>` **or** typed text | Many rows pull their description from the calc sheet (see each section). |
| E | ปริมาณ | `='<calc sheet>'!<cell>` or typed `1` | Net quantity. |
| F | หน่วย | **typed in BOQ**. It is never linked to the calc sheet's unit column. | |
| G | %เผื่อ | input (yellow) | Waste fraction, for example 0.15 = 15%. |
| H | ปริมาณ เผื่อแล้ว | `=E*(100%+G)` | Gross quantity. |
| I | ค่าวัสดุ ต่อหน่วย | input (yellow), typed price | The consumables rows hold a formula here instead (see 0.2). |
| J | ค่าวัสดุ รวม | `=I*H` | Material is charged on the **gross** quantity. |
| K | ค่าแรงงาน ต่อหน่วย | input (yellow) | |
| L | ค่าแรงงาน รวม | **depends on the row; see below** | |
| M | รวมทั้งหมด | `=J+L` | |
| N | หมายเหตุ | typed | |

**Labour basis: IMPORTANT, and it differs from the general rule in the brief ("L = K*E").**
Every **length-based MEP row with waste** in this scope has the anchor formula `L = K*H`, so labour is charged on the **gross** quantity. The stored values confirm it:

- Row 84: `=K84*H84` → 100 × 6.9 = **690** (it would be 600 on net).
- Rows 85 and 86: shared formula from L84 (`=K85*H85`, `=K86*H86`): L85 = 50 × 24.265 = 1213.25; L86 = 50 × 9.2 = 460.
- Row 185: `=K185*H185` → 35 × 425.385 = 14,888.475.
- Row 193: `=K193*H193`. Rows 194 and 195: shared formula from L193 (`=K194*H194`, `=K195*H195`): 10 × 304.175 = 3041.75; 15 × 588.57 = 8828.55.
- Row 213: `=K213*H213`. Row 214: shared formula from L213 (`=K214*H214`): 40 × 15.065 = 602.6.
- H, J and M on rows 85–86, 194–195 and 214 are likewise shared copies of the row above (`=E*(100%+G)`, `=I*H`, `=J+L`). Nothing in these rows except G, I and K is typed.
- The deck shows the same thing. On p42, the 4" pipe line has 100 × 2.30 = 230.00.

The count-based rows in sections 26–29 and the consumables rows use `L = K*E`. Their G is 0 or blank, so net and gross are identical there.
➡ The app's `makeRow(labQty = net)` convention would **under-cost these 8 rows**. See Decision D1.

### 0.2 Consumables rows ("วัสดุอุปกรณ์และของใช้สิ้นเปลือง")
These are lump-sum rows: E = 1, F = `เหมา`, K = 0, L = `K*E` = 0. **I is a formula**: a percentage of the material total (J) **plus** the labour total (L) of the pipe/cable rows directly above.

| BOQ row | I formula | % | N note |
|---|---|---|---|
| 87 | `=SUM(J84:J86,L84:L86)*50%` | 50% | `(50% ของค่าวัสดุและค่าแรง)` |
| 186 | `=SUM(J185,L185)*15%` | 15% | `(15% ของค่าวัสดุและค่าแรง)` |
| 196 | `=SUM(J193:J195,L193:L195)*15%` | 15% | `(15% ของค่าวัสดุและค่าแรง)` |
| 215 | `=SUM(J213:J214,L213:L214)*50%` | 50% | *(no note text)* |

- J = `I*H` on rows 87 and 196, where G = 0 and H = 1. J = `I*E` on rows 186 and 215, where the G and H cells are empty. The result is the same either way.
- The I cell keeps the yellow "input" fill even though it holds a formula (rows 87, 186 and 196; row 215 has no fill). The user could overwrite it.
- The base is J + L of the gross-quantity rows. The consumables therefore inherit the labour-on-gross behaviour.

### 0.3 Calc-sheet → BOQ coupling is POSITIONAL
Each BOQ row references a **fixed cell** in the calc sheet, for example `D256 ='ตู้ควบคุม_Load Center'!B5` and `E256 = …!C5`. Consequences:

- The BOQ shows only as many rows as were hard-wired: waste pipe rows 5–7, water pipe 5–6, sanitary system 5–8, load center 5–12, equipment 5–10, other 5, sanitary ware 5–14. **Any extra rows the user fills in a calc sheet never reach the BOQ.**
- The BOQ description follows the dropdown choice, because D links to B. **The price (I/K) and the unit (F) are typed in the BOQ and do not follow.** If a user changes calc row 5 to a different item, the BOQ shows the new name with the old price and unit.
- The calc sheet's own unit column (D, a dropdown) is **not read by the BOQ**.

See Decision D2.

### 0.4 Common calc-sheet chrome
- Every calc sheet has: A1 `เพจผู้รับเหมาพันธุ์ใหม่ – สงวนลิขสิทธิ์ © 2026 ตามกฎหมาย`, an A2 title, a "Back Home" hyperlink to `'BOQ (Home)'!A1`, a B3 subtitle, and a header row.
- Column A holds a pre-printed running number (1.0, 2.0, …). It is not an input.
- Colour code: yellow FFFFF2CC = input. Grey F2F2F2 or EFEFEF = formula/total. Dropdown cells with no fill are still user inputs.

### 0.5 BOQ (Home) navigation that touches this scope
- Sidebar A13 `   ⚡  งานระบบไฟฟ้า` links to the Electrical Pipe sheet.
- Sidebar A14 `   🚿  งานระบบสุขาภิบาล` links to the Waste Pipe sheet.
- Section and sub-header hyperlinks:

| Cell | Text | Target |
|---|---|---|
| D83 | `ท่อน้ำทิ้ง ` | Waste Pipe |
| D184 | `ท่อร้อยสายไฟ` | Electrical Pipe |
| D192 | `สายไฟ` | Electrical Cable |
| D212 | `งานระบบประปา ท่อน้ำดี` | Water Pipe |
| D255 | `งานตู้ควบคุมระบบไฟฟ้า` | Load Center |
| D264 | `อุปกรณ์ไฟฟ้า ` | Equipment |
| C272 | `งานระบบสุขาภิบาล` | Sanitary System |
| C278 | `งานเบ็ดเตล็ด` | Other |
| C281 | `งานสุขภัณฑ์` | Sanitary |

### 0.6 Where these items live in the BOQ (deck "STEP" numbers = BOQ section numbers)

| Calc sheet | BOQ section (STEP) | BOQ rows |
|---|---|---|
| 05 ท่อน้ำทิ้ง_Waste Pipe | 9 งานพื้นหล่อในที่, sub-item 1) | 83–87 |
| 08 ท่อร้อยสายไฟ_Electrical Pipe | 17 งานก่ออิฐ, sub-item 6) | 184–186 |
| 09 สายไฟ_Electrical Cable | 18 งานฉาบปูน, sub-item 4) | 192–196 |
| 06 ท่อน้ำดี_Water Pipe | 21 งานปูกระเบื้องห้องน้ำ, sub-item 3) | 212–215 |
| 10 ตู้ควบคุม_Load Center | 26 งานติดตั้งอุปกรณ์ไฟฟ้า, group "งานตู้ควบคุมระบบไฟฟ้า" | 255–263 |
| 11 อุปกรณ์ไฟฟ้า_Equipment | 26, group "อุปกรณ์ไฟฟ้า" | 264–270 |
| 07 ระบบสุขาภิบาล_Sanitary System | 27 งานระบบสุขาภิบาล | 272–277 |
| 20 เบ็ดเตล็ด_Other | 28 งานเบ็ดเตล็ด | 278–280 |
| 21 สุขภัณฑ์_Sanitary | 29 งานสุขภัณฑ์ | 281–292 |

The pipe and cable items are **embedded inside architectural/structural sections**, not in a separate MEP section. The deck highlights this: p43 has the red note `ท่อน้ำทิ้ง จะคำนวณมาจากโปรแกรม ท่อน้ำทิ้ง`, and p74 draws a red box around `6) ท่อร้อยสายไฟ` inside section 17.

---

## 1. Sheet 05 ท่อน้ำทิ้ง_Waste Pipe → BOQ section 9 rows 84–87

**Purpose:** a list of waste and vent pipe runs. For each run the user enters the horizontal and vertical length, and the sheet gives the total length per run.
- Title A2: `โปรแกรมถอดแบบ –  งานท่อน้ำทิ้ง Waste Pipe 🚿`. It has a double space after the dash.
- Subtitle B3: `: ตารางคำนวณปริมาณความยาวท่อน้ำดี`. This says "water supply" and is a copy-paste error.

**Row capacity:** rows 5–18, which is 14 lines numbered 1–14. Header row 4.

### Inputs
| Col | Header | Type | Example (v5) | Unit | Dropdown (verbatim) |
|---|---|---|---|---|---|
| B | `รายการ` | dropdown | r5 `ท่อน้ำทิ้งชักโครก PVC 4"`, r6 `ท่อน้ำทิ้ง ØW ØFD PVC 2"`, r7 `ท่ออากาศถังบำบัด PVC 1"` | – | `ท่อน้ำทิ้งชักโครก PVC 4"`, `ท่อน้ำทิ้ง ØW ØFD PVC 2"`, `ท่ออากาศถังบำบัด PVC 1"` |
| C | `ขนาดท่อ/ชนิด` | dropdown | r5 `PVC 4"`, r6 `PVC 2"`, r7 `PVC 1" ` *(trailing sp)* | – | `PVC 1" ` *(trailing sp)*, `PVC 2"`, `PVC 4"` |
| D | `ยาว แนวราบ (ม.)` | number (yellow) | r5 4.0, r6 15.6 (typed as `=14.5+1.1`), r7 4.0 | m | – |
| E | `ยาว แนวดิ่ง (ม.)` | number (yellow) | r5 2.0, r6 5.5, r7 4.0 | m | – |

### Computed
| Cell | Header | Formula | Meaning | v5 value |
|---|---|---|---|---|
| F5:F18 | `ยาว รวม (ม.)` | `=D+E` (anchor F5; the other rows are shared) | Total length per run | 6 / 21.1 / 8 / 0… |

C (size) is informational only and nothing reads it.

### Outputs → BOQ
| BOQ row | C | D (desc) | E (qty) | F | G | I mat | K lab | N |
|---|---|---|---|---|---|---|---|---|
| 83 | `1)` | `ท่อน้ำทิ้ง ` (typed sub-header; hyperlink) | – | – | – | – | – | – |
| 84 | | `='ท่อน้ำทิ้ง_Waste Pipe'!B5` | `='ท่อน้ำทิ้ง_Waste Pipe'!F5` (6) | `ม.` | 0.15 | 200 | 100 | |
| 85 | | `=…!B6` | `=…!F6` (21.1) | `ม.` | 0.15 | 60 | 50 | |
| 86 | | `=…!B7` | `=…!F7` (8) | `ม.` | 0.15 | 20 | 50 | |
| 87 | | ` - วัสดุอุปกรณ์และของใช้สิ้นเปลือง ` (typed) | 1 | `เหมา` | 0 | `=SUM(J84:J86,L84:L86)*50%` | 0 | `(50% ของค่าวัสดุและค่าแรง)` |

v5 results:

| Row | H | J | L | M |
|---|---|---|---|---|
| 84 | 6.9 | 1380 | 690 | 2070 |
| 85 | 24.265 | 1455.9 | 1213.25 | 2669.15 |
| 86 | 9.2 | 184 | 460 | 644 |
| 87 | – | 2691.575 | 0 | 2691.575 |

L uses `K*H`, as described in 0.1.

**Section 9 subtotal (row 95), a quirk:** `J95 =SUM(J88:J94)` and `L95 =SUM(L88:L94)` **exclude** the waste-pipe rows, but `M95 =SUM(M83:M94)` includes them. The grand total (M310) sums the M subtotals, so the money is counted. Only the section's J and L subtotals understate it. See D5.

---

## 2. Sheet 06 ท่อน้ำดี_Water Pipe → BOQ section 21 rows 212–215

**Purpose:** the same layout as Waste Pipe, for water-supply runs.
- Title: `โปรแกรมถอดแบบ – งานท่อน้ำดี Water Pipe 💧`
- Subtitle: `: ตารางคำนวณปริมาณความยาวท่อน้ำดี`

**Row capacity:** rows 5–18 (14 lines).

### Inputs
| Col | Header | Type | Example | Unit | Dropdown (verbatim) |
|---|---|---|---|---|---|
| B | `รายการ` | dropdown | r5 `ท่อเมนภายนอก PVC 3/4"`, r6 `ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"` | – | `ท่อเมนภายนอก PVC 3/4"`, `ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2"` |
| C | `ขนาดท่อ/ชนิด` | dropdown | r5 `PVC 3/4"`, r6 `PVC 1/2"` | – | `PVC 1/2"`, `PVC 3/4"` |
| D | `ยาว แนวราบ (ม.)` | number | r5 58.5, r6 7.8 | m | – |
| E | `ยาว แนวดิ่ง (ม.)` | number | r5 0.0, r6 5.3 | m | – |

### Computed
F5:F18 `ยาว รวม (ม.)` = `=D+E`. v5 values: 58.5 / 13.1 / 0…

### Outputs → BOQ
| BOQ row | C | D | E | F | G | I | K | N |
|---|---|---|---|---|---|---|---|---|
| 212 | `3)` | `งานระบบประปา ท่อน้ำดี` (sub-header, hyperlink) | | | | | | |
| 213 | | `='ท่อน้ำดี_Water Pipe'!B5` | `='ท่อน้ำดี_Water Pipe'!F5` (58.5) | `ม.` | 0.15 | 20 | 40 | |
| 214 | | `=…!B6` | `=…!F6` (13.1) | `ม.` | 0.15 | 15 | 40 | |
| 215 | | ` - วัสดุอุปกรณ์และของใช้สิ้นเปลือง ` | 1 | `เหมา` | (blank) | `=SUM(J213:J214,L213:L214)*50%` | 0 | (none) |

v5 results:

| Row | H | J | L | M |
|---|---|---|---|---|
| 213 | 67.275 | 1345.5 | 2691 (`=K213*H213`) | 4036.5 |
| 214 | 15.065 | 225.975 | 602.6 | 828.575 |
| 215 | – | 2432.5375 | – | 2432.5375 |

**Section 21 subtotal (row 216), a quirk:** `J216 =SUM(J210:J211)` and `L216 =SUM(L210:L211)` **exclude** rows 213–215. `M216 =SUM(M210:M215)` includes them. This is the same pattern as section 9 (D5).

---

## 3. Sheet 07 ระบบสุขาภิบาล_Sanitary System → BOQ section 27 rows 272–277

**Purpose:** a pick-list of drainage and treatment equipment with quantities.
- Title: `โปรแกรมถอดแบบ – อุปกรณ์ระบบระบายน้ำทิ้ง Waste System 🌊`
- Subtitle: `: ตารางคำนวณปริมาณอุปกรณ์ระบบระบายน้ำทิ้ง`

**Row capacity:** rows 5–19 (15 lines). There are no formulas.

### Inputs
| Col | Header | Type | Example | Dropdown (verbatim) |
|---|---|---|---|---|
| B | `รายการ` | dropdown | r5 `ถังดักไขมัน ขนาด 20 ลิตร`, r6 `ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร ` *(trailing sp)*, r7 `บ่อพักน้ำทิ้งสำเร็จรูป ขนาด 40 x 40 ซม. ` *(trailing sp)*, r8 `ท่อระบายน้า AC Dia.8”` | `ถังดักไขมัน ขนาด 20 ลิตร`, `ถังบำบัดน้ำเสียสาเร็จรูป ขนาด 600 ลิตร `, `ท่อระบายน้า AC Dia.8”`, `บ่อพักน้ำทิ้งสำเร็จรูป ขนาด 40 x 40 ซม. ` |
| C | `จำนวน` | number (yellow) | 1 / 2 / 6 / 36 | – |
| D | `หน่วย` | dropdown | `ชุด` / `ชุด` / `ชุด` / `ม.` | `ชุด`, `ม.` |

Notes on the strings:
- "สาเร็จรูป" is missing its ำ and "ระบายน้า" is missing ำ. Both are typos.
- `Dia.8”` uses a curly closing quote ” (U+201D), not `"`.

### Outputs → BOQ (L = K*E)
| BOQ row | C | D | E | F | G | I | K | N | M (v5) |
|---|---|---|---|---|---|---|---|---|---|
| 273 | `1)` | `='ระบบสุขาภิบาล_Sanitary System'!$B$5` | `=…!$C$5` (1) | `ชุด` | 0 | 1500 | 300 | | 1800 |
| 274 | `2)` | `=…!B6` | `=…!C6` (2) | `ชุด` | 0 | 7000 | 3000 | `รถแมคโครเล็ก` | 20000 |
| 275 | `3)` | `=…!B7` | `=…!C7` (6) | `ชุด` | 0 | 300 | 200 | `รถแมคโครเล็ก` | 3000 |
| 276 | `4)` | `=…!B8` | `=…!C8` (36) | `ม.` | 0 | 200 | 150 | `รถแมคโครเล็ก` | 12600 |
| 277 | | `รวม >> ` | | | | | | | J 24500 / L 12900 / M 37400 |

The subtotal formulas are `=SUM(J273:J276)` and `=SUM(L273:L276)`. There are no consumables row and no waste.

---

## 4. Sheet 08 ท่อร้อยสายไฟ_Electrical Pipe (conduit) → BOQ section 17 rows 184–186

**Purpose:** a circuit table. For each circuit the user enters the conduit length in four parts:

- horizontal run of the branch circuit (main)
- horizontal run to the devices
- vertical run of the branch circuit
- vertical drop to the devices

Their sum is the conduit length. The grand total feeds one BOQ line.
- Title: `โปรแกรมถอดแบบ – งานท่อร้อยสายไฟ Electrical Pipe ⚡`
- Subtitle: `: ตารางคำนวณปริมาณความยาวท่อร้อยสายไฟ`
- Header layout: D4 `ความยาวท่อร้อยสายไฟ >> `; E4:F4 merged `แนวราบ`; G4:H4 merged `แนวดิ่ง`; I4 = grand total. Row 5 holds the column headers.

**Row capacity:** rows 6–29 (24 lines numbered 1–24). ⚠ Only rows 6–19 contain the I total formula. In the v5 file, I20:I29 are **blank with no formula**, so circuits 15–24 would not be summed (D6).

### Inputs
| Col | Header | Type | Example (v5 row 6 … 19) | Unit | Dropdown |
|---|---|---|---|---|---|
| B | `วงจร` | free text (yellow) | see the circuit list below | – | – |
| C | `ขนาด CB` | dropdown (no fill) | `16A.` rows 6–7, `20A.` rows 8–19 | – | `16A.`, `20A.`, `32A.`, `40A.` |
| D | `ชนิดท่อ` | dropdown (no fill) | `PVC 1/2"` all rows | – | `PVC 1/2"`, `PVC 3/4"` |
| E | `วงจรย่อย (ม.) (สายเมน)`, horizontal | number | 22.4, 24.5, 27.4, 21.0, 20.0, 12.0, 3.0, 17.0, 11.0, 7.0, 7.0, 8.0, 5.0, 5.0 | m | – |
| F | `เข้าอุปกรณ์ (ม.)`, horizontal | number | 25.6, 27.5, then 0 | m | – |
| G | `วงจรย่อย (ม.) (สายเมน)`, vertical | number | 1.5 (lights/sockets); 3 = `1.5+(1*1.5)` heater; 2.4 = `1.5+(1*0.9)` bedroom AC; 1.8 = `1.5+(1*0.3)` living/dining AC; 4.4 = `1.5+(1*2.9)` pump | m | – |
| H | `เข้าอุปกรณ์ (ม.)`, vertical | number | `=7*2.3` 16.1, `=11*2.3` 25.3, `=9*3.2` 28.8, `=4*3.2` 12.8, `=2*3.2` 6.4, 0…, `=3*2.3` 6.9 | m | – |

G6 is stored as `=1.5`; G7–G10 and G19 are plain 1.5. G12, G14, G15 and G17 are Excel shared-formula copies of the constant arithmetic in G11, G13 and G16 (`=1.5+(1*1.5)`, `=1.5+(1*0.9)`, `=1.5+(1*0.3)`). They contain no cell references and keep the yellow fill, so they are still inputs.

The users type arithmetic into the input cells, for example "number of points × drop height". The heights used are 2.3 m for lighting and kitchen sockets and 3.2 m for sockets. The app must accept plain numbers. Optionally it could offer a "points × height" helper.

**v5 example circuit names (column B, verbatim, typos included):**

| # | Circuit name | CB |
|---|---|---|
| 1 | `แสงสว่าง : ห้องนอน , ห้องน้ำ` | 16A. |
| 2 | `แสงสว่าง : ห้องนั้งเล่น , ห้องทานอาหาร , ครัว , ภายนอก` | 16A. |
| 3 | `เต้ารับไฟฟ้า : ห้องนอน 1,2,3` | 20A. |
| 4 | `เต้ารับไฟฟ้า : ห้องนั่งเล่น , ห้องทานอาหาร` | 20A. |
| 5 | `เต้ารับไฟฟ้า : ห้องน้ำ , เครื่องซักผ้า , ภายนอก` | 20A. |
| 6 | `เครื่องทำน้ำอุ่น : ห้องน้ำ 1` | 20A. |
| 7 | `เครื่องทำน้ำอุ่น : ห้องน้ำ 2` | 20A. |
| 8 | `เครื่องปรับอากาศห้องนอน 1 (12,000 BTU)` | 20A. |
| 9 | `เครื่องปรับอากาคห้องนอน 2 (12,000 BTU)` | 20A. |
| 10 | `เครื่องปรับอากาคห้องนอน 3 (9,000 BTU)` | 20A. |
| 11 | `เครื่องปรับอากาคห้องรับแขก (15,000 BTU)` | 20A. |
| 12 | `เครื่องปรับอากาคห้องทานอาหาร (9,000 BTบ)` | 20A. |
| 13 | `เครื่องปั้มน้ำ` | 20A. |
| 14 | `เต้ารับไฟฟ้า : ห้องครัว` | 20A. |

### Computed
| Cell | Header | Formula | v5 |
|---|---|---|---|
| I6:I19 | `รวม (ม.)` | `=SUM(E6:H6)` (shared) | 65.6, 78.8, 57.7, 35.3, 27.9, 15, 6, 19.4, 13.4, 9.4, 8.8, 9.8, 9.4, 13.4 |
| I4 | grand total | `=SUM(I6:I29)` | **369.9** |

C (CB) and D (pipe type) do **not** affect any calculation. I4 adds every circuit regardless of pipe type.

### Outputs
- **Conduit BOQ rows** (L = **K*H**):

  | BOQ row | C | D | E | F | G | I | K | N |
  |---|---|---|---|---|---|---|---|---|
  | 184 | `6)` | `ท่อร้อยสายไฟ` (sub-header, hyperlink) | | | | | | |
  | 185 | | ` - ท่อร้อยสายไฟ ท่อ PVC 1/2"` (typed, **not** linked) | `='ท่อร้อยสายไฟ_Electrical Pipe'!I4` (369.9) | `ม.` | 0.15 | 25 | 35 | |
  | 186 | | ` - วัสดุอุปกรณ์และของใช้สิ้นเปลือง  ` (2 trailing sp) | 1 | `เหมา` | (blank) | `=SUM(J185,L185)*15%` | 0 | `(15% ของค่าวัสดุและค่าแรง)` |

  v5 results: row 185 H 425.385, J 10,634.625, L 14,888.475, M 25,523.1. Row 186 = 3,828.465.

  The section 17 subtotal (row 187) `=SUM(J179:J186)` / `=SUM(L179:L186)` **includes** the conduit. v5 values: J 91,783.0775, L 90,266.375, M 182,049.4525.
- **Feeds sheet 09 (cable):** for each row r = 6…19, Cable!G r = Pipe!E r + Pipe!G r, and Cable!H r = Pipe!F r + Pipe!H r. See §5.

---

## 5. Sheet 09 สายไฟ_Electrical Cable → BOQ section 18 rows 192–196

**Purpose:** for each circuit, pick the cable size of the branch (main) run and of the device drops, plus the number of conductors. The sheet multiplies the lengths, which come from the conduit sheet, by the conductor count and buckets them by THW size.
- Title: `โปรแกรมถอดแบบ – งานสายไฟ Electrical Cable 🔌`
- Subtitle: `: ตารางคำนวณปริมาณความยาวสายไฟ`

**Row capacity:** rows 6–28 (23 lines). Only rows 6–19 (14 circuits) are numbered in A and linked to the conduit sheet. In rows 20–28, G and H are **empty, with no link**, while I–L hold formulas that evaluate to 0 (D6).

### Inputs
| Col | Header | Type | Example | Dropdown (verbatim) |
|---|---|---|---|---|
| B | `วงจร` | free text (yellow). It is **re-typed** and not linked to the conduit sheet's B. | Same 14 circuits, with slightly different typos: r7 `แสงสว่าง : ห้องนั้งเล่น , ห้องรับประทาหาร , ครัว , ภายนอก`, r9 `เต้ารับไฟฟ้า : ห้องนั่งเล่น , ห้องทางอาหาร`, r10 `เต้ารับไฟฟ้า : ห้องน้ำ , เครื่องซักผ้า , ถายนอก` | – |
| C | `ขนาด CB` | dropdown, informational | as on sheet 08 | `16A.`, `20A.`, `32A.`, `40A.` |
| D | `ขนาดสาย วงจรย่อย (สายเมน)` | dropdown | r6–7 `THW 2.5`; r8–19 `THW 4` | `THW 1.5`, `THW 2.5`, `THW 4`, `THW 6` (the D6:E28 dropdown covers D and E) |
| E | `ขนาดสาย เข้าอุปกรณ์` | dropdown (may be blank) | r6–7 `THW 1.5`; r8–10 `THW 2.5`; r11–18 blank; r19 `THW 2.5` | same list |
| F | `จำนวนสาย (เส้น)` | dropdown | r6–7 `2`; r8–19 `3` | `2`, `3` |

### Computed
| Cell | Header | Formula (row 6. G/H are written out separately on each of rows 6–19 and are absent on 20–28. I–L are shared formulas on rows 7–28.) | Meaning |
|---|---|---|---|
| G6 | `ความยาวสาย วงจรย่อย (ม.) (สายเมน)` | `='ท่อร้อยสายไฟ_Electrical Pipe'!E6+'ท่อร้อยสายไฟ_Electrical Pipe'!G6` | Branch-run length = conduit horizontal main + vertical main. |
| H6 | `ความยาวสาย เข้าอุปกรณ์ (ม.)` | `='ท่อร้อยสายไฟ_Electrical Pipe'!F6+'ท่อร้อยสายไฟ_Electrical Pipe'!H6` | Device-drop length = horizontal + vertical to devices. |
| I6 | `THW #1.5 (ม.)` | `=IF(D6="THW 1.5", G6*F6, 0) + IF(E6="THW 1.5", H6*F6, 0)` | Each bucket receives the main run × conductors if the main size matches, plus the device run × conductors if the device size matches. |
| J6 | `THW #2.5 (ม.)` | `=IF(D6="THW 2.5", G6*F6, 0) + IF(E6="THW 2.5", H6*F6, 0)` | |
| K6 | `THW #4 (ม.)` | `=IF(D6="THW 4", G6*F6, 0) + IF(E6="THW 4", H6*F6, 0)` | |
| L6 | `THW #6 (ม.)` | `=IF(D6="THW 6", G6*F6, 0) + IF(E6="THW 6", H6*F6, 0)` | |
| I4 | total THW 1.5 | `=SUM(I6:I28)` | **189** |
| J4 | total THW 2.5 | (shared sum) | **264.5** |
| K4 | total THW 4 | (shared sum) | **511.8** |
| L4 | total THW 6 | (shared sum) | **0** |

The same conductor count F applies to both the main run and the device run. The string matching is exact: `"THW 1.5"` etc.

v5 row values:

| Row | G | H | I | J | K |
|---|---|---|---|---|---|
| 6 | 23.9 | 41.7 | 83.4 | 47.8 | 0 |
| 7 | 26 | 52.8 | 105.6 | 52 | |
| 8 | 28.9 | 28.8 | | 86.4 | 86.7 |
| 9 | 22.5 | 12.8 | | 38.4 | 67.5 |
| 10 | 21.5 | 6.4 | | 19.2 | 64.5 |
| 11 | 15 | | | | 45 |
| 12 | 6 | | | | 18 |
| 13 | 19.4 | | | | 58.2 |
| 14 | 13.4 | | | | 40.2 |
| 15 | 9.4 | | | | 28.2 |
| 16 | 8.8 | | | | 26.4 |
| 17 | 9.8 | | | | 29.4 |
| 18 | 9.4 | | | | 28.2 |
| 19 | 6.5 | 6.9 | | 20.7 | 19.5 |

### Outputs → BOQ (L = **K*H**)
| BOQ row | C | D (typed) | E | F | G | I | K | N |
|---|---|---|---|---|---|---|---|---|
| 192 | `4)` | `สายไฟ` (sub-header, hyperlink) | | | | | | |
| 193 | | ` - รวมสายไฟฟ้า THW 1.5 ตร.มม. ` | `='สายไฟ_Electrical Cable'!I4` (189) | `ม.` | 0.15 | 15 | 7 | |
| 194 | | ` - รวมสายไฟฟ้า THW 2.5 ตร.มม.` | `=…!J4` (264.5) | `ม.` | 0.15 | 20 | 10 | |
| 195 | | ` - รวมสายไฟฟ้า THW 4 ตร.มม.` | `=…!K4` (511.8) | `ม.` | 0.15 | 30 | 15 | |
| 196 | | ` - วัสดุอุปกรณ์และของใช้สิ้นเปลือง  ` | 1 | `เหมา` | 0 | `=SUM(J193:J195,L193:L195)*15%` | 0 | `(15% ของค่าวัสดุและค่าแรง)` |

v5 results:

| Row | H | J | L | M |
|---|---|---|---|---|
| 193 | 217.35 | 3260.25 | 1521.45 | 4781.7 |
| 194 | 304.175 | 6083.5 | 3041.75 | 9125.25 |
| 195 | 588.57 | 17657.1 | 8828.55 | 26485.65 |
| 196 | – | 6058.89 | – | 6058.89 |

- **There is no BOQ row for THW 6** (L4). D7.
- The section 18 order in v5 is: 1) ฉาบภายนอก (189), 2) ฉาบภายใน (190), 3) วงกบประตูไม้ (191), 4) สายไฟ (192–196). The deck p79 shows an older order with สายไฟ as 3) and วงกบ as 4). **Use v5.**
- Subtotal row 197: `=SUM(J189:J196)` / `=SUM(L189:L196)`. It includes the cable rows. v5 values: J 66,789.99, L 98,637.175, M 165,427.165.

---

## 6. Sheet 10 ตู้ควบคุม_Load Center → BOQ section 26 rows 255–263

**Purpose:** a pick-list of consumer unit, breakers, main cable and grounding, with quantities.
- Title: `โปรแกรมถอดแบบ – งานตู้ควบคุมระบบไฟฟ้า Load Center ⚙️`
- Subtitle: `: ตารางคำนวณปริมาณอุปกรณ์ตู้ควบคุม`

**Row capacity:** rows 5–19 (15 lines). There are no formulas.

### Inputs
| Col | Header | Type | Dropdown (verbatim, in Excel's list order) |
|---|---|---|---|
| B | `รายการ` | dropdown | `เซอร์กิตเบรกเกอร์เมน  ขนาด100 A    ` (double sp after เมน, no sp before 100, 4 trailing sp) · `เซอร์กิตเบรกเกอร์ย่อยชนิดกันดูด (ELCB) 20 A ` *(trailing sp)* · `เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 16 A ` *(trailing sp)* · `เซอร์กิตเบรกเกอร์ย่อย (CB) ขนาด 20 A ` *(trailing sp)* · `ตู้ Consumer Unit ชนาด 18 ช่อง` ("ชนาด" is a typo) · `แท่งกราวด์ทองแดง 5/8" ยาว 2.40 ม. ` *(trailing sp)* · `สายไฟกราวด์ THW 10 ตร.มม.` · `สายเมนไฟฟ้า THW ขนาด 25 ตร.มม.` (in the raw dump the list source is split as `"สายเม"&"นไฟฟ้า…"`, but the value is the same) |
| C | `จำนวน` | number (yellow) | – |
| D | `หน่วย` | dropdown | `ชุด`, `ตัว`, `ท่อน`, `ม.` |

v5 rows 5–12:

| Row | Item | Qty | Unit |
|---|---|---|---|
| 5 | `ตู้ Consumer Unit ชนาด 18 ช่อง` | 1 | ชุด |
| 6 | `เซอร์กิตเบรกเกอร์เมน  ขนาด100 A    ` | 1 | ตัว |
| 7 | `…(CB) ขนาด 16 A ` | 2 | ตัว |
| 8 | `…(CB) ขนาด 20 A ` | 8 | ตัว |
| 9 | `…(ELCB) 20 A ` | 4 | ตัว |
| 10 | `สายเมนไฟฟ้า THW ขนาด 25 ตร.มม.` | 50 | ม. |
| 11 | `แท่งกราวด์ทองแดง 5/8" ยาว 2.40 ม. ` | 1 | ท่อน |
| 12 | `สายไฟกราวด์ THW 10 ตร.มม.` | 5 | ม. |

The quantities are typed. The breaker count is **not** derived from the circuit table: there are 2 × 16 A and 12 × 20 A circuits, versus 2 CB16 + 8 CB20 + 4 ELCB20 = 14 breakers.

### Outputs → BOQ (L = K*E, G = 0)
| BOQ row | C | D | E | F | I | K | M (v5) |
|---|---|---|---|---|---|---|---|
| 254 | section header `26.0` / `งานติดตั้งอุปกรณ์ไฟฟ้า` | | | | | | |
| 255 | | `งานตู้ควบคุมระบบไฟฟ้า` (group header, hyperlink) | | | | | |
| 256 | `1)` | `='ตู้ควบคุม_Load Center'!B5` | `=…!C5` (1) | `ชุด` | 3000 | 3000 | 6000 |
| 257 | `2)` | `=…!B6` | `=…!C6` (1) | `ตัว` | 1500 | 0 | 1500 |
| 258 | `3)` | `=…!B7` | `=…!C7` (2) | `ตัว` | 120 | 0 | 240 |
| 259 | `4)` | `=…!B8` | `=…!C8` (8) | `ตัว` | 140 | 0 | 1120 |
| 260 | `5)` | `=…!B9` | `=…!C9` (4) | `ตัว` | 1200 | 0 | 4800 |
| 261 | `6)` | `=…!B10` | `=…!C10` (50) | `ม.` | 200 | 100 | 15000 |
| 262 | `7)` | `=…!B11` | `=…!C11` (1) | `ท่อน` | 500 | 300 | 800 |
| 263 | `8)` | `=…!B12` | `=…!C12` (5) | `ม.` | 70 | 30 | 500 |

---

## 7. Sheet 11 อุปกรณ์ไฟฟ้า_Equipment → BOQ section 26 rows 264–270

The sheet name has a **trailing space**: `'อุปกรณ์ไฟฟ้า_Equipment '`.
- Title: `โปรแกรมถอดแบบ – งานอุปกรณ์ไฟฟ้า Electrical Equipment 💡`
- Subtitle: `: ตารางคำนวณปริมาณอุปกรณ์ไฟฟ้า`

**Row capacity:** rows 5–18 (14 lines). There are no formulas.

### Inputs
| Col | Header | Type | Dropdown (verbatim, list order) |
|---|---|---|---|
| B | `รายการ` | dropdown | `โคมไฟซาลาเปา`, `โคมไฟดาวน์ไลท์`, `โคมไฟฟลูออเรสเซนต์ ชนิดกันน้ำ`, `เต้ารับไฟฟ้าคู่ชนิดมีกราวน์ ชนิดกันน้ำ (พร้อมหน้ากาก)`, `เต้ารับไฟฟ้าคู่ชนิดมีกราวน์ (พร้อมหน้ากาก)`, `สวิตซ์ทางเดียว (พร้อมหน้ากาก)` |
| C | `จำนวน` | number (yellow) | – |
| D | `หน่วย` | dropdown | `ชุด`, `ตัว` |

v5 rows 5–10:

| Row | Item | Qty | Unit |
|---|---|---|---|
| 5 | ดาวน์ไลท์ | 25 | ชุด |
| 6 | ซาลาเปา | 5 | ชุด |
| 7 | ฟลูออเรสเซนต์ กันน้ำ | 1 | ชุด |
| 8 | สวิตซ์ทางเดียว | 18 | ตัว |
| 9 | เต้ารับคู่มีกราวน์ | 17 | ตัว |
| 10 | เต้ารับคู่มีกราวน์ กันน้ำ | 2 | ตัว |

### Outputs → BOQ (L = K*E, G = 0)
| BOQ row | C | D | E | F | I | K | M (v5) |
|---|---|---|---|---|---|---|---|
| 264 | | `อุปกรณ์ไฟฟ้า ` (group header, hyperlink) | | | | | |
| 265 | `1)` | `='อุปกรณ์ไฟฟ้า_Equipment '!B5` | `=…!C5` (25) | `ชุด` | 150 | 120 | 6750 |
| 266 | `2)` | `=…!B6` | `=…!C6` (5) | `ชุด` | 300 | 200 | 2500 |
| 267 | `3)` | `=…!B7` | `=…!C7` (1) | `ชุด` | 250 | 200 | 450 |
| 268 | `4)` | `=…!B8` | `=…!C8` (18) | `ตัว` | 80 | 80 | 2880 |
| 269 | `5)` | `=…!B9` | `=…!C9` (17) | `ตัว` | 140 | 100 | 4080 |
| 270 | `6)` | `=…!B10` | `=…!C10` (2) | `ตัว` | 300 | 150 | 900 |
| 271 | | `รวม >> ` | | | `=SUM(J256:J270)` 31,430 | `=SUM(L256:L270)` 16,090 | 47,520 |

---

## 8. Sheet 20 เบ็ดเตล็ด_Other → BOQ section 28 rows 278–280

- Title: `โปรแกรมถอดแบบ – งานเบ็ดเตล็ด Other 🛠️`
- Subtitle: `: ตารางคำนวณปริมาณงานเบ็ดเตล็ด`

**Row capacity:** rows 5–18 (14 lines). There are no formulas.

### Inputs
| Col | Header | Type | Dropdown |
|---|---|---|---|
| B | `รายการ` | dropdown | **one option only**: `ราวกันตกกระจก เฉลียง 1 และ 2` |
| C | `ปริมาณ` | number (yellow) | – (v5: 7.1) |
| D | `หน่วย` | dropdown | `ม.` (only) |

### Outputs → BOQ
| BOQ row | C | D | E | F | G | I | K | M |
|---|---|---|---|---|---|---|---|---|
| 279 | `1)` | `='เบ็ดเตล็ด_Other'!B5` | `='เบ็ดเตล็ด_Other'!C5` (7.1) | `ม.` | 0 | 4000 | 0 | 28,400 |
| 280 | | `รวม >> ` | | | | `=SUM(J279)` 28,400 | `=SUM(L279)` 0 | 28,400 |

---

## 9. Sheet 21 สุขภัณฑ์_Sanitary (sanitary ware) → BOQ section 29 rows 281–292

- Title: `โปรแกรมถอดแบบ – งานสุขภัณฑ์ Sanitary 🚽`
- Subtitle: `: ตารางคำนวณปริมาณสุขภัณฑ์`

**Row capacity:** rows 5–19 (15 lines). There are no formulas.

### Inputs
| Col | Header | Type | Dropdown (verbatim, list order) |
|---|---|---|---|
| B | `รายการ` | dropdown | `กระจกเงา`, `ก๊อกเดี่ยวอ่างล้างหน้า`, `ชักโครกนั่งราบ`, `ตะแกรงกันกลิ่น ` *(trailing sp)*, `ที่ใส่กระดาษชำระ ` *(trailing sp)*, `ที่ใส่สบู่`, `ฝักบัวอาบน้ำ`, `ราวแขวนผ้า ` *(trailing sp)*, `สายชำระ`, `อ่างล้างหน้า ` *(trailing sp)* |
| C | `จำนวน (ชุด)` | number (yellow) | – |
| D | `หน่วย` | dropdown | `ชุด` (only) |

v5 rows 5–14, all with unit ชุด:

| Row | Item | Qty |
|---|---|---|
| 5 | ชักโครกนั่งราบ | 2 |
| 6 | สายชำระ | 2 |
| 7 | อ่างล้างหน้า | 2 |
| 8 | ก๊อกเดี่ยวอ่างล้างหน้า | 2 |
| 9 | กระจกเงา | 2 |
| 10 | ที่ใส่กระดาษชำระ | 2 |
| 11 | ราวแขวนผ้า | 2 |
| 12 | ตะแกรงกันกลิ่น | 3 |
| 13 | ที่ใส่สบู่ | 2 |
| 14 | ฝักบัวอาบน้ำ | 2 |

### Outputs → BOQ (L = K*E, G = 0, F = `ชุด` for all)
| BOQ row | C | D | E | I | K | M (v5) |
|---|---|---|---|---|---|---|
| 282 | `1)` | `='สุขภัณฑ์_Sanitary'!B5` | `=…!C5` (2) | 5000 | 800 | 11,600 |
| 283 | `2)` | `=…!B6` | `=…!C6` (2) | 500 | 100 | 1,200 |
| 284 | `3)` | `=…!B7` | `=…!C7` (2) | 3500 | 500 | 8,000 |
| 285 | `4)` | `=…!B8` | `=…!C8` (2) | 800 | 70 | 1,740 |
| 286 | `5)` | `=…!B9` | `=…!C9` (2) | 1000 | 100 | 2,200 |
| 287 | `6)` | `=…!B10` | `=…!C10` (2) | 350 | 70 | 840 |
| 288 | `7)` | `=…!B11` | `=…!C11` (2) | 800 | 70 | 1,740 |
| 289 | `8)` | `=…!B12` | `=…!C12` (3) | 300 | 100 | 1,200 |
| 290 | `9)` | `=…!B13` | `=…!C13` (2) | 500 | 100 | 1,200 |
| 291 | `10)` | `=…!B14` | `=…!C14` (2) | 1000 | 100 | 2,200 |
| 292 | | `รวม >> ` | | `=SUM(J282:J291)` 27,800 | `=SUM(L282:L291)` 4,120 | 31,920 |

---

## 10. Default price catalog (typed in BOQ I/K, needed as app defaults)

| Item (BOQ desc) | Unit | Waste | Mat/unit | Lab/unit |
|---|---|---|---|---|
| ท่อน้ำทิ้งชักโครก PVC 4" | ม. | 15% | 200 | 100 |
| ท่อน้ำทิ้ง ØW ØFD PVC 2" | ม. | 15% | 60 | 50 |
| ท่ออากาศถังบำบัด PVC 1" | ม. | 15% | 20 | 50 |
| consumables, waste pipe | เหมา | – | 50% × (J+L of pipes) | 0 |
| ท่อเมนภายนอก PVC 3/4" | ม. | 15% | 20 | 40 |
| ท่อย่อยภายใน (ห้องน้ำ) PVC 1/2" | ม. | 15% | 15 | 40 |
| consumables, water pipe | เหมา | – | 50% × (J+L) | 0 |
| ท่อร้อยสายไฟ ท่อ PVC 1/2" | ม. | 15% | 25 | 35 |
| consumables, conduit | เหมา | – | 15% × (J+L) | 0 |
| THW 1.5 ตร.มม. | ม. | 15% | 15 | 7 |
| THW 2.5 ตร.มม. | ม. | 15% | 20 | 10 |
| THW 4 ตร.มม. | ม. | 15% | 30 | 15 |
| consumables, cable | เหมา | – | 15% × (J+L) | 0 |
| Load center items | see §6 | 0 | 3000 / 1500 / 120 / 140 / 1200 / 200 / 500 / 70 | 3000 / 0 / 0 / 0 / 0 / 100 / 300 / 30 |
| Equipment items | see §7 | 0 | 150 / 300 / 250 / 80 / 140 / 300 | 120 / 200 / 200 / 80 / 100 / 150 |
| Sanitary system items | see §3 | 0 | 1500 / 7000 / 300 / 200 | 300 / 3000 / 200 / 150 |
| ราวกันตกกระจก | ม. | 0 | 4000 | 0 |
| Sanitary ware | see §9 | 0 | 5000 / 500 / 3500 / 800 / 1000 / 350 / 800 / 300 / 500 / 1000 | 800 / 100 / 500 / 70 / 100 / 70 / 70 / 100 / 100 / 100 |

The deck screenshots come from an **older revision** with different numbers. Always use v5:
- p42/p43: waste pipe 2.0 + 0 and 15.6 + 0 m; consumables 1,653.70.
- p79: cable material prices 10 / 15 / 25; consumables 5,226.32.

---

## 11. Review-deck notes (customer comments)

| Page | What it shows | Comment / implication |
|---|---|---|
| p40–41 | App STEP 09 "เทพื้นหล่อในที่" | It has no waste-pipe lines at all (only a "จำนวน Sleeve ท่อ" field). |
| p42 | Excel BOQ section 9 | The waste-pipe rows (1) ท่อน้ำทิ้ง) are part of slab-on-grade, with a 50% consumables line. |
| p43 | Excel Waste Pipe sheet | Red note: **`ท่อน้ำทิ้ง จะคำนวณมาจากโปรแกรม ท่อน้ำทิ้ง`**: the quantities must come from the waste-pipe calculator. |
| p73 | App STEP 17 ก่ออิฐ | It has no conduit. |
| p74 | Excel BOQ section 17 | A red box highlights `6) ท่อร้อยสายไฟ`: conduit belongs in the brick section. |
| p76 | Excel Electrical Pipe sheet | The circuit table (14 circuits, total 369.90). |
| p78 | App STEP 18 ฉาบปูน | It has no cable. |
| p79 | Excel BOQ section 18 | It contains the THW 1.5 / 2.5 / 4 cable rows and 15% consumables. |
| p81 | Excel Electrical Cable sheet | Dropdowns for main and device cable size and conductor count; totals 189 / 264.5 / 511.8 / 0. |
| p91 | App STEP 21 ปูกระเบื้องห้องน้ำ | It has no water pipe (invented waterproofing, grout and glue items instead). |
| p92 | Excel Toilet Tile and Water Pipe sheets | The water pipe (2 runs) belongs to STEP 21. |
| p108–109 | App STEP 26 ระบบไฟฟ้า | Invented model: point counts, AC circuits, main breaker dropdown (30A/40A/50A/63A/100A), phase 1/3, avg run, VAF/VCT cables, EV, HVAC copper. |
| p110 | Excel BOQ section 26 | Two groups (Load Center 8 rows, Equipment 6 rows), straight qty × price. |
| p111 | Excel Load Center and Equipment sheets | Simple item + qty + unit lists. |
| p112–114 | App STEP 27 "สุขาภิบาลภายใน" and STEP 28 "สุขาภิบาลภายนอก" | Two invented steps (pipe auto-estimate, valves, FD, P-trap, cleanout; septic sized by residents, chambers per 6 m, meter, rain gutter, pump). |
| p115–116 | Excel BOQ section 27 and the Sanitary System sheet | Only 4 equipment lines. Note `รถแมคโครเล็ก` (p115 shows it on row 2 only; in v5 it is on rows 274–276). |
| p117–118 | Deck "STEP 28 อุปกรณ์เบ็ดเตล็ด" vs app "STEP 29 อุปกรณ์เบ็ดเตล็ด" | The app has 12+ invented misc items (curtain rail, blinds, door closer, peephole, cabinets, …) and is off by one step number. |
| p119 | Excel BOQ section 28 and the Other sheet | Only one line: glass railing 7.1 m × 4,000. |
| p120–121 | Deck "STEP 29 สุขภัณฑ์" vs app "STEP 30 สุขภัณฑ์" | The app invents kitchen sink, heater, silicone and PTFE auto items, uses ×10 test values, and is off by one step. |
| p122–123 | Excel BOQ section 29 and the Sanitary sheet | 10 ware lines, qty × price. |

---

## 12. Today's app vs Excel

**Waste pipe (section 9)**
- `step09.ts` has no waste-pipe input or output. The Excel has a 14-line run table (item, size, horizontal, vertical) → 3 BOQ rows + 50% consumables.
- `step27.ts` instead auto-estimates "ท่อน้ำทิ้ง PVC Ø2"-4"" from bathroom and kitchen counts (8 m per bath, 4 m per kitchen). This logic is invented and lands in the wrong section.
- There is no consumables % row in the app.

**Water pipe (section 21)**
- `step21.ts` has no water pipe. The Excel has a 14-line run table → 2 BOQ rows + 50% consumables inside the bathroom-tiling section.
- `step27.ts` supply pipe = 12 m/bath + 6 m/kitchen + 5 m laundry, plus an invented hot-water PPR line. Delete it.
- `step02.ts` (temp utilities) also has a water pipe. That is section 2 and unrelated. Do not merge it.

**Conduit and cable (sections 17 and 18)**
- `step17.ts` and `step18.ts` contain no conduit or cable. In the Excel both are driven by one circuit table (24 conduit rows, 23 cable rows).
- `step26.ts` invents the quantities: conduit = points × avg-run × 0.8; main cable = 15 m × 3/5 conductors; "VAF 2×2.5" branch cable; "VCT" AC cable at 12 m/unit. None of these exist in the Excel.
- The Excel buckets cable by THW 1.5 / 2.5 / 4 / 6 using the `IF(D="THW x", G*F) + IF(E="THW x", H*F)` logic. The app has no size buckets.
- There are no 15% consumables rows.

**Electrical equipment and load center (section 26)**
- App inputs (`lighting_count`, `single/double_socket_count`, `switch_count`, `ac_circuit_count`, `water_heater_circuit`, `main_breaker_amp`, `phase`, `ev_charger`, `hvac_*`, `ground_rod_count`, `avg_cable_run_m`) and the auto circuit/slot sizing are all invented.
- The Excel is two plain lists: Load Center (8 catalogue items, units ชุด/ตัว/ท่อน/ม.) and Equipment (6 catalogue items, units ชุด/ตัว). Each line is item + qty + unit, and the price is typed in the BOQ.
- The app's BOQ section is titled "งานไฟฟ้า" with 12 SKU rows (ELC-*). The Excel section is `งานติดตั้งอุปกรณ์ไฟฟ้า` with two sub-groups and 14 rows.

**Sanitary system (section 27)**
- The app splits this into STEP 27 (interior) and STEP 28 (exterior), with invented engineering (septic 0.5 m³ per person, chamber every 6 m, meter, rain gutter, pump).
- The Excel is one 4-item list (grease trap, septic 600 L, chamber 40×40, AC Ø8" drain pipe) with qty and unit.
- Because of the extra step, app step numbers from here on are **+1** compared with the Excel/deck (app 29 = Excel 28 misc; app 30 = Excel 29 sanitary ware).

**Misc (section 28)**
- App `step29.ts` has 14 invented fields (curtain rail, blinds, towel bar, soap, paper holder, mirror, door stopper, closer, peephole, house number, shelves, cabinets, mailbox, clothesline).
- The Excel has a 14-line list whose dropdown has **one** option, `ราวกันตกกระจก เฉลียง 1 และ 2` (ม.). The bathroom accessories in the app's list actually belong to the Excel section 29.

**Sanitary ware (section 29)**
- App `step30.ts` uses its own set of fixed fields (toilet, basin, shower set, bidet, faucet, kitchen sink/faucet, water heater + type, bathtub, urinal, laundry sink) plus auto silicone and PTFE lines.
- The Excel is a 10-item dropdown list (§9) with qty in ชุด. There is no kitchen sink, heater, silicone or PTFE.

**BOQ mapper (all areas)**
- The rows are SKU/price-list based. The Excel takes the description from the calc sheet, takes prices typed per BOQ row, and charges labour on gross for the pipe and cable rows (0.1).
- The consumables % rows are missing.

---

## 13. Oddities needing a decision

- **D1 Labour on gross vs net.** The pipe, conduit and cable rows (84–86, 185, 193–195, 213–214) use `L=K*H`, while the brief's global rule is `L=K*E`. The consumables (rows 87, 186, 196, 215) are computed on that gross-labour total.
  - Mirroring the Excel exactly needs a per-row "labour basis = gross" flag.
  - The v5 delta if net were used: row 84 is 600 instead of 690. Across all 8 rows it is about 15% of their labour.
  - *Recommend mirroring Excel (gross) for these rows.*
- **D2 Positional coupling.** The BOQ rows read fixed calc-sheet rows. Extra calc rows are dropped, and changing a dropdown item keeps the old price and unit.
  - *Recommend:* emit one BOQ row per non-empty calc line, in calc order. Look up the default price and unit from the item catalogue (§10). Let the user override price per BOQ row.
  - Confirm whether the BOQ unit should come from the calc sheet's D column. That column exists but the Excel ignores it.
- **D3 Single conduit line.** Electrical Pipe I4 sums every circuit regardless of pipe type (`PVC 1/2"` / `PVC 3/4"` dropdown), but the BOQ text says `ท่อ PVC 1/2"`. Options:
  - mirror the Excel (one line), or
  - split by pipe type. That would need a price for 3/4".
- **D4 Circuit table is duplicated.** The conduit sheet (B, C) and the cable sheet (B, C) are typed separately. Cable G/H link to conduit E–H **by row number**.
  - *Recommend* one shared circuit list with these fields: name, CB, pipe type, 4 lengths, main cable size, device cable size, conductors.
  - CB has no calculation effect in either sheet. Confirm whether to keep it as informational.
- **D5 Section subtotal formulas.** `J95/L95` and `J216/L216` exclude the embedded pipe rows, while M95/M216 include them. In the Excel, the section's J + L ≠ M. *Recommend* that app subtotals include all rows. Confirm.
- **D6 Dead capacity.**
  - Conduit rows 20–29 have no `SUM(E:H)`, so they are not totalled.
  - Cable rows 20–28 have no G/H links.
  - So only 14 circuits really work, although the sheets look like they hold 24 and 23. *Recommend* an unlimited or 24-row circuit list with the formulas applied to every row.
- **D7 THW 6 has no BOQ row.** L4 is computed, but no BOQ line reads it. Selecting `THW 6` silently loses that cable. Add a 4th cable BOQ row? It would need prices.
- **D8 Blank device cable size.** If E is blank while H > 0, the device-drop cable is not counted in any bucket. It is 0 in v5 because H = 0 on those rows. Should the app require E whenever H > 0, or warn?
- **D9 Consumables details.**
  - Rows 186 and 215 have no G/H cells.
  - Row 215 has no note text, although it uses 50%.
  - The percentages are fixed in the formulas: 50% plumbing, 15% electrical. Should the % be user-editable with these defaults?
  - Should the I cells stay overridable? In the Excel they are yellow, i.e. look like inputs.
- **D10 Verbatim strings.**
  - Typos: สาเร็จรูป, ระบายน้า, ชนาด, ปรับอากาค, BTบ, นั้งเล่น, ทางอาหาร, ถายนอก, รับประทาหาร. The Waste Pipe subtitle also says "ท่อน้ำดี".
  - Spacing: double, trailing and missing spaces (`เมน  ขนาด100 A    `).
  - There is a curly quote in `Dia.8”`.
  - Keep them verbatim for parity, or normalise (trim, fix typos)? *Recommend* trimming whitespace and fixing typos in display only, while keeping the Excel strings as catalogue keys.
- **D11 Load-center quantities are independent of the circuit table.** 2 × 16 A and 12 × 20 A circuits sit against 2 CB16 + 8 CB20 + 4 ELCB20. Should the app pre-fill breaker counts from the circuits, or stay manual like the Excel?
- **D12 Step numbering and scope.** Merge app STEP 27 and 28 into a single "ระบบสุขาภิบาล" step. App 29 then becomes 28 (misc) and app 30 becomes 29 (sanitary ware), matching the deck. Waste pipe, conduit, cable and water pipe become sub-tables inside STEPs 9, 17, 18 and 21.
- **D13 Misc dropdown has a single option.** Should users be able to add free-text items, with a typed price, in the Other list? And likewise in the other pick-lists? Excel data validation would normally reject anything not in the list.

---

## 14. Verification (shared formulas)

Re-checked against the regenerated v5 dump, which now prints Excel shared formulas as `=SHARED(si=N, master CELL: …)`. Sheets 05, 06, 07, 08, 09, 10, 11, 20 and 21, and BOQ (Home) rows 83–95, 184–187, 192–197, 210–216, 254–292 and 310 were checked.

**What changed in this spec**
- §0.1: the labour-on-gross rows that were described "(values)" are now confirmed as formulas. L85–L86, L194–L195 and L214 are shared copies of `=K*H` from L84, L193 and L213. All 8 pipe, conduit and cable rows use `L = K*H`. H, J and M on those rows are shared copies too.
- §4 (Electrical Pipe inputs): G12, G14, G15 and G17 are shared-formula copies of the constant arithmetic in G11, G13 and G16. They are yellow and have no references, so they stay inputs. A note was added.
- §5 (Electrical Cable computed): the column header said rows 7–28 were shared for every column. In fact, G/H are separate per-row links on rows 6–19 only, and only I–L are shared on rows 7–28.

**Confirmed unchanged (no edit needed)**
- No cell that this spec calls an input is a shared formula. The yellow cells are Waste/Water D, E; Sanitary System, Load Center, Equipment, Other and Sanitary C; Electrical Pipe B, E–H; Electrical Cable B; and BOQ G, I, K. Sheets 07, 10, 11, 20 and 21 contain no formulas.
- Waste/Water Pipe F6:F18 are shared copies of `=D5+E5`.
- Conduit I6:I19 are shared copies of `=SUM(E6:H6)`. **I20:I29 have no formula** (D6 holds). I4 = `=SUM(I6:I29)`.
- Cable G20:H28 are **empty, with no link** (D6 holds). I20:L28 are shared IF formulas that evaluate to 0. J4:L4 are shared copies of I4 `=SUM(I6:I28)`.
- The count-based rows in sections 26–29 use `L = K*E`. The masters are L256, L265, L273, L279 and L282, and the other rows are shared copies.
- On the consumables rows, H87/H196 and J87/J196 are shared `=E*(100%+G)` / `=I*H`. J186 and J215 are `=I*E`.
- The M subtotal cells M187, M197, M271, M277, M280 and M292 are shared copies of the L subtotal one column to the left, so they are `=SUM(M…)` over the same rows. M95 and M216 are explicit `=SUM(M83:M94)` / `=SUM(M210:M215)` (D5 holds).
