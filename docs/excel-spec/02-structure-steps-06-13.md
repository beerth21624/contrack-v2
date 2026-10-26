# 02 — Structural work: BOQ sections 6–13 (STEP 06–13)

Source of truth: workbook "โปรแกรมประมาณราคา BOQ … บ้านชั้นเดียว – Training Edition v5". The sheets covered here are:
`24 ตารางสรุปวัสดุงานโครงสร้าง` (the summary), `25 ฐานราก_Footing`, `26 เสาตอม่อ_Footing Column`, `27 คานคอดิน_Beam`,
`28 พื้นหล่อในที่_S`, `29  พื้นสำเร็จรูป_PS` (the sheet name has a leading space), `30 เสา_Column`, `31 คานดาดฟ้า_RoofBeam`,
`32 พื้นดาดฟ้า_RoofSlab`, `33 บันได_Stair`, plus the `BOQ (Home)` rows 37–146.

Conventions used in this document:
- **Input** means a yellow cell (fill FFFFF2CC) or a cell with dropdown validation. Bar-size cells have a dropdown but no yellow fill, and they are still user inputs.
- **Computed** means a grey or green cell holding a formula.
- The **example** values are the cached values in v5. Use them as test fixtures. The deck screenshots come from an older revision and show slightly different numbers (for example concrete 2,200 and rebar 28 ฿/kg, backfill 43.84, pedestal 0.20×0.20). **The v5 dump wins.**
- Row 8 is the first data row on every element sheet. Row 6 is the totals row ("`>>`" cells), and row 7 holds the column headers.
- Rebar weight table (identical `SWITCH` in every element sheet; kg per metre):

  | Size | kg/m | kg per 10 m bar (sheet24 row 19 divisor) |
  |---|---|---|
  | RB6 | 0.222 | 2.22 |
  | RB9 | 0.499 | 4.99 |
  | DB12 | 0.888 | 8.888 |
  | DB16 | 1.58 | 15.85 (sic: 1.58×10 would be 15.8) |
  | DB20 | 2.47 | 24.7 |
  | anything else | 0 | — |

  Excel form: `= len * SWITCH(size,"RB6",0.222,"RB9",0.499,"DB12",0.888,"DB16",1.58,"DB20",2.47,0)` (sometimes wrapped in `IFERROR(…,0)`).
- Per-size totals on every element sheet: `=SUMIF($<sizeCol>$8:$<sizeCol>$100,"RB6",$<kgCol>$8:$<kgCol>$100)`, repeated for RB9, DB12, DB16 and DB20 (some sheets use `$99`). In plain words, each group sums its weight column by bar size.

---

## 1. Sheet 24 — ตารางสรุปวัสดุงานโครงสร้าง (summary → BOQ)

Title: `ตารางสรุปวัสดุงานโครงสร้าง 🏗️`. C2 holds the link "Back Home", which goes to `'BOQ (Home)'!A1`.

### 1.1 Columns (header rows 4–5)

| Col | Header (verbatim) | Unit |
|---|---|---|
| A | (no.) | — |
| B | ` รวมงานโครงสร้าง` (element name — **used as MATCH key by BOQ**) | — |
| C | ดินขุด (ลบ.ม.) | m³ |
| D | ทรายหยาบ (ลบ.ม.) | m³ |
| E | คอนกรีตหยาบ (ลบ.ม.) | m³ |
| F | พลาสติก กันชื้น (ตร.ม.) | m² |
| G | พื้นสำเร็จรูป (ตร.ม.) | m² |
| H | เหล็กไวร์เมช (ตร.ม.) | m² |
| I–M | เหล็กเสริม (กก.) → sub-headers I5 `RB6`, J5 `RB9`, K5 `DB12`, L5 `DB16`, M5 `DB20` | kg |
| N | ไม้ค้ำยัน (ต้น) | pcs |
| O | ไม้แบบ (ตร.ม.) | m² |
| P | คอนกรีต โครงสร้าง (ลบ.ม.) | m³ |
| Q | ดิน ถมกลับ (ลบ.ม.) | m³ |

I5:M5 carries a dropdown (`DB12,DB16,DB20,RB6,RB9`), so in Excel a user could re-label a column. **Treat these as fixed constants** in the app.

### 1.2 Element rows. Every cell is a direct reference (no arithmetic other than `+`).

| Row | A | B (exact key string) | Cells filled → source |
|---|---|---|---|
| 6 | 1 | `งานฐานราก_Footing` | C=`Footing!H6`; D=`Footing!J6`; E=`Footing!L6`; I..M = short-side + long-side + tie-ring groups (`O6+T6+Y6`, `P6+U6+Z6`, `Q6+V6+AA6`, `R6+W6+AB6`, `S6+X6+AC6`); O=`Footing!AE6`; P=`Footing!AG6`; **Q=`Footing!AI6` (backfill)** |
| 7 | 2 | `งานเสาตอม่อ_Footing Column` | I..M = main + stirrup (`H6+M6`, `I6+N6`, `J6+O6`, `K6+P6`, `L6+Q6`); O=`Ped!T6`; P=`Ped!V6` |
| 8 | 3 | `งานคานคอดิน_Beam` | E=`Beam!G6` (lean); I..M = `J6+O6` … `N6+S6`; O=`Beam!V6`; P=`Beam!X6` |
| 9 | 4 | `งานพื้นหล่อในที่_Slab` | D=`S!I6` (sand); F=`S!K6` (plastic); I..M=`S!M6..Q6`; P=`S!S6`; **Q=`S!G6` (backfill under slab)** |
| 10 | 5 | `งานพื้นสำเร็จรูป_PS Slab(PS)` | G=`PS!E6`; H=`PS!G6` (wire-mesh m²); I..M=`PS!H6..L6` (shear-key bars); O=`PS!O6`; P=`PS!R6` |
| 11 | 6 | `งานเสาชั้น1_Column` | I..M = `H6+M6` … `L6+Q6`; O=`Col!T6`; P=`Col!V6` |
| 12 | 8 | `งานคานดาดฟ้า_RoofBeam` | I..M = `G6+L6` … `K6+P6`; N=`RB!S6`; O=`RB!T6`; P=`RB!V6` |
| 13 | 9 | `งานพื้นดาดฟ้า_RoofSlab` | I..M=`RS!G6..K6`; N=`RS!M6`; O=`RS!N6`; P=`RS!P6` |
| 14 | 7 | `งานบันได_Stair` | I..M = 4 groups (`L6+Q6+V6+AA6`, `M6+R6+W6+AB6`, `N6+S6+X6+AC6`, `O6+T6+Y6+AD6`, `P6+U6+Z6+AE6`); N=`Stair!AG6`; O=`Stair!AH6`; P=`Stair!AN6` |
| 15–17 | 8, 9, 10 | (empty spare rows) | — |
| 18 | — | `รวม` | C18 `=SUM(C6:C17)`; D18..P18 use the same formula shared across, i.e. `=SUM(D6:D17)` … `=SUM(P6:P17)` (cached: D 5.70375, E 3.21, F 50.1, G 74.75, H 74.75, I 419.7576, J 942.3859, K 1835.5848, L 0, M 0, N 114, O 267.4119, P 32.8802); **Q18 `=SUM(Q7:Q17)` (excludes Q6!) = 20.04** |
| 19 | — | G19 `จำนวนเหล็ก - เส้น` | I19 `=I18/2.22`, J19 `=J18/4.99`, K19 `=K18/8.888`, L19 `=L18/15.85`, M19 `=M18/24.7` (number of 10 m bars, display only) |
| 20 | — | — | I20 `=sum(I18:M18)` total rebar kg (merged I20:M20) = 3197.73 |

Column A numbering is out of order (…6, 8, 9, 7); it is cosmetic. Rows 18–20 are informational. **The BOQ does not read them.**

Cached v5 element values (fixtures):

| Row | C | D | E | F | G | H | I RB6 | J RB9 | K DB12 | N | O | P | Q |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 6 Footing | 53.508 | 2.5725 | 2.058 | | | | 0 | 50.2992 | 335.664 | | 30.24 | 4.536 | 43.7115 |
| 7 Pedestal | | | | | | | 33.5664 | 0 | 156.6432 | | 11.34 | 0.63 | |
| 8 Ground beam | | | 1.152 | | | | 208.1028 | 0 | 708.9792 | | 94.16 | 9.416 | |
| 9 Slab | | 3.13125 | | 50.1 | | | 0 | 499.998 | 0 | | | 5.01 | 20.04 |
| 10 PS | | | | | 74.75 | 74.75 | 26.9952 | 0 | 0 | | 5.14 | 3.7375 | |
| 11 Column | | | | | | | 100.6992 | 0 | 453.1464 | | 68.04 | 3.402 | |
| 12 Roof beam | | | | | | | 50.394 | 0 | 181.152 | 57 | 20.8 | 2.04 | |
| 13 Roof slab | | | | | | | 0 | 239.52 | 0 | 42 | 24 | 2.4 | |
| 14 Stair | | | | | | | 0 | 152.5687 | 0 | 15 | 13.6919 | 1.70865 | |

### 1.3 How BOQ rows pull from sheet 24

**Rebar size routing (dynamic rows).** In each BOQ rebar block, column D (description) uses an original Google-Sheets spill formula:

```
=TRANSPOSE( FILTER( "- เหล็ก "&'ตารางสรุปวัสดุงานโครงสร้าง'!$I$5:$M$5,
     INDEX('ตารางสรุปวัสดุงานโครงสร้าง'!$I:$M, MATCH("<element key>", 'ตารางสรุปวัสดุงานโครงสร้าง'!$B:$B,0), 0) > 0 ))
```

It produces one line per bar size whose weight is > 0, labelled `- เหล็ก RB6` and so on. Sizes come in header order RB6, RB9, DB12, DB16, DB20, spilled downward. Column E (qty) of each such line then evaluates:

```
=IFERROR( INDEX('ตารางสรุปวัสดุงานโครงสร้าง'!$I$<row>:$M$<row>,
     MATCH(REGEXEXTRACT($D<r>,"RB6|RB9|DB12|DB16|DB20"), 'ตารางสรุปวัสดุงานโครงสร้าง'!$I$5:$M$5,0)), 0)
```

It reads the size from its own label and looks up the kg for that size in the element's sheet-24 row.

**App rule to mirror:** for each element, emit one BOQ line `- เหล็ก <size>` per size with kg > 0, ordered RB6 → RB9 → DB12 → DB16 → DB20. Each line's qty is the net kg from sheet 24, followed by one `- ลวดผูกเหล็ก` line. In Excel the slots are fixed, so a third size would cause a spill collision (see Oddities §13).

**Waste per rebar line (BOQ column G, yellow input):**

| BOQ block | Line 1 | Line 2 |
|---|---|---|
| 6.5 ฟุตติ้ง | RB9 0.09 | DB12 0.12 |
| 6.6 เสาตอม่อ | RB6 0.06 | DB12 0.12 |
| 6.7 เสาชั้น 1 | RB6 0.06 | DB12 0.12 |
| 8.3 คานคอดิน | RB6 0.06 | DB12 0.12 |
| 8.4 เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป | RB6 0.06 | — |
| 9.5 พื้นหล่อในที่ | RB9 0.09 | — |
| 12 คานดาดฟ้า | **RB6 0.12** | **DB12 0.06** (swapped, see Oddities) |
| 12 พื้นดาดฟ้า | RB9 0.09 | — |
| 13 บันได | RB9 0.09 | — |

The pattern is RB6 6 %, RB9 9 %, DB12 12 %. The workbook has no example for DB16/DB20. In Excel the waste is attached to the **slot**, not the size.

**Tie wire (`- ลวดผูกเหล็ก`):** E is blank and the unit is กก. **H (qty incl. waste) = (sum of H of the rebar lines in the same block) × 0.03.** For example H45 `= (H43+H44)*0.03` and H93 `= (H92)*0.03`. I = 50, K = 0 and L = K×H. H is yellow (editable), G is blank, and no waste is applied. Material J = I×H. Block 8.4 (PS shear key) has **no** tie-wire line.

**Formwork accessories.** Every `แบบหล่อคอนกรีต` block has three lines:
- ` - ไม้แบบ` ตร.ม. qty = sheet-24 col O (or a direct ref), waste 0, mat 250, lab 150
- ` - ไม้คร่าวยึดแบบ` ลบ.ฟ. `E = 0.6 × E(ไม้แบบ)`, mat 350, lab 0
- ` - ตะปูยึดแบบ` กก. `E = 0.25 × E(ไม้แบบ)`, mat 50, lab 0

**Structural concrete rounding.** On rows 58, 65, 80, 94, 104, 111, 134 and 145, H (qty incl. waste) is `=MAX(1, CEILING(E*(1+G), 0.25))`: round up to 0.25 m³ with a minimum of 1 m³. **Exception:** row 124 (roof-beam concrete) has a plain `E*(1+G)` = 2.244. Lean concrete, sand and the other rows use plain `H = E*(1+G)`.

**Backfill chain:**
- BOQ 8.1 `ถมดินกลับ` = sheet24 **Q6** = Footing!AI6 = Σ per footing row (`I − K − M − AG − Pedestal!V(same row)`). That is excavation − sand (incl. 25 %) − lean − footing concrete − pedestal concrete. The footing backfill sits in the ground-beam section (deck p37: "ถมดินกลับ จะคำนวณมาจากโปรแกรมฐานราก").
- BOQ 9.2 `ถมดินกลับ` = sheet24 **Q9** = Slab!G6 = Σ (slab area × fill depth).
- Nothing subtracts ground-beam volume, and no `MAX(0, …)` guard exists.

**Generic BOQ pricing (all rows):** H = E×(1+G); J (material) = I×H; L (labour) = K×**E** (net qty); M = J+L. The exceptions are pipe rows 84–86, where L = K×**H**.

---

## 2. Element sheets

### 2.1 Sheet 25 — ฐานราก_Footing (title `โปรแกรมถอดแบบ – งานฐานราก Footing 🏗️`)

Purpose: excavation, sand bed, lean concrete, bottom-mat rebar (short and long direction), tie ring, side formwork, footing concrete, and backfill. **Capacity 11 rows (8–18).** Totals use rows 8–18; SUMIFs use rows 8–100.

Group headers in row 3: H3 `วัสดุรองพื้น`, O3 `เหล็กเสริม`, AE3 `ไม้แบบ`, AG3 `คอนกรีต`, AI3 `ถมดิน`. Block label A4 is `ข้อมูลงานฐานราก Footing`.

**Inputs per row**

| Col | Label (row 7) | Type | Example r8 | Unit | Dropdown |
|---|---|---|---|---|---|
| B | ชื่อ ฐานราก | list | F1 | — | `F1,F2,F4` |
| C | จำนวน ฐานราก (ฐาน) | number | 21 | pcs | |
| D | กว้าง (ม.) | number | 0.6 | m | |
| E | ยาว (ม.) | number | 0.6 | m | |
| F | ลึก (ม.) (footing thickness) | number | 0.6 | m | |
| H | ลึก (ม.) (excavation depth, under header `ดินขุด (ลบ.ม.)`) | number | 1.3 | m | |
| J | หนา (ม.) (sand thickness, under `ทรายหยาบ (ลบ.ม.)`) | number | 0.05 | m | |
| L | หนา (ม.) (lean thickness, under `คอนกรีตหยาบ (ลบ.ม.)`) | number | 0.05 | m | |
| O | ขนาด (main bar short side, under `เหล็กเสริมหลัก (ด้านสั้น) (กก.)`) | list | DB12 | — | `RB6,RB9,DB12,DB16,DB20,DB20` |
| P | จำนวน (เส้น) (bars per footing) | number | 5 | bars | |
| T | ขนาด (long side, `เหล็กเสริมหลัก (ด้านยาว) (กก.)`) | list | DB12 | — | same |
| U | จำนวน (เส้น) | number | 5 | bars | |
| Y | ขนาด (tie ring, `เหล็กรัดรอบ (กก.)`) | list | RB9 | — | same |
| Z | จำนวน (เส้น) (rings per footing) | number | 2 | pcs | |

**Computed per row**

| Col | Label | Excel | Plain | r8 |
|---|---|---|---|---|
| I | ปริมาณ (ลบ.ม.) excavation | `=C8*((D8+0.4+0.4)*(E8+0.4+0.4))*H8` | n·(W+0.8)(L+0.8)·depth (0.40 m working space each side, hard-coded) | 53.508 |
| K | ปริมาณ (ลบ.ม.) sand | `=C8*((D8+0.4+0.4)*(E8+0.4+0.4))*J8*(100%+25%)` | n·(W+0.8)(L+0.8)·t_sand·1.25 | 2.5725 |
| M | ปริมาณ (ลบ.ม.) lean | `=C8*((D8+0.4+0.4)*(E8+0.4+0.4))*L8` | n·(W+0.8)(L+0.8)·t_lean | 2.058 |
| Q | ความยาว /เส้น (ม.) | `=D8+(2*F8)` | width + 2×thickness (bent up both ends) | 1.8 |
| R | ความยาว รวม (ม.) | `=C8*P8*Q8` | n·bars·len | 189 |
| S | น้ำหนัก (กก.) | `=R8*SWITCH(O8,…)` | | 167.832 |
| V | ความยาว /เส้น (ม.) | `=E8+(2*F8)` | length + 2×thickness | 1.8 |
| W | ความยาว รวม (ม.) | `=C8*U8*V8` | | 189 |
| X | น้ำหนัก (กก.) | `=W8*SWITCH(T8,…)` | | 167.832 |
| AA | ความยาว ต่อเส้น (ม.) | `=(2*D8)+(2*E8)` | ring perimeter | 2.4 |
| AB | ความยาว รวม (ม.) | `=C8*Z8*AA8` | | 100.8 |
| AC | น้ำหนัก (กก.) | `=AB8*SWITCH(Y8,…)` | | 50.2992 |
| AE | ปริมาณ (ตร.ม.) formwork | `=C8*((2*D8)+(2*E8))*F8` | n·perimeter·thickness (sides only) | 30.24 |
| AG | ปริมาณ (ลบ.ม.) concrete | `=C8*(D8*E8)*F8` | n·W·L·T | 4.536 |
| AI | ปริมาณ (backfill, header `ถมดิน กลับ >> (ลบ.ม.)`) | `=I8-K8-M8-AG8-'เสาตอม่อ_Footing Column'!V8` | exc − sand − lean − concrete − **pedestal concrete of the same row number** | 43.7115 |

**Totals row 6:** H6 `=SUM(I8:I18)`, J6 `=SUM(K8:K18)`, L6 `=SUM(M8:M18)`. O6..S6 SUMIF short side (size col O, kg col S). T6..X6 SUMIF long side (T, X). Y6..AC6 SUMIF tie ring (Y, AC). AE6 `=SUM(AE8:AE18)`, AG6 `=SUM(AG8:AG18)`, AI6 `=SUM(AI8:AI18)`.
Cached: O6..S6 = 0, 0, 167.832, 0, 0. T6..X6 = 0, 0, 167.832, 0, 0. Y6..AC6 = 0, 50.2992, 0, 0, 0.

**Outputs:** sheet24 row 6 (C, D, E, I..M, O, P, Q). BOQ 6.1 reads H6 directly.

### 2.2 Sheet 26 — เสาตอม่อ_Footing Column (pedestal; title `โปรแกรมถอดแบบ – งานเสาตอม่อ Footing Column 🏗️`)

**Capacity 10 rows (8–17).** Row n is assumed to belong to footing row n. Block label A4 is `สรุปปริมาณงานเสาตอม่อ`.

**Inputs**

| Col | Label | Type | Example r8 | Unit | Dropdown |
|---|---|---|---|---|---|
| B | ชื่อเสา | list | C1 (B9 preset "C2", no data) | — | `C1,C2,C3` |
| C | จำนวน เสา (ต้น) | number | 21 | pcs | |
| D | กว้าง (ม.) | number | 0.25 | m | |
| E | ยาว (ม.) | number | 0.2 | m | |
| F | สูง (ม.) | number | 0.6 | m | |
| H | ขนาด (main, `ปริมาณเหล็กเสริมหลัก (กก.)`) | list | DB12 | | `RB6,RB9,DB12,DB16,DB20` |
| I | จำนวน (เส้น) (bars per pedestal) | number | 6 | | |
| M | ขนาด (stirrup, `ปริมาณเหล็กปลอก (กก.)`) | list | RB6 | | same |
| N | ระยะห่าง (ม.) | number | 0.15 | m | |

**Computed**

| Col | Label | Excel | Plain | r8 |
|---|---|---|---|---|
| J | ความยาว /เส้น (ม.) | `=F8+'ฐานราก_Footing'!F8+('ฐานราก_Footing'!D8/3)` | pedestal height + footing thickness + footing width/3 (row-aligned footing) | 1.4 |
| K | ความยาว รวม (ม.) | `=C8*J8*I8` | | 176.4 |
| L | น้ำหนัก (กก.) | `=K8*SWITCH(H8,…)` | | 156.6432 |
| O | จำนวน (ปลอก) | `=IFERROR(ROUNDUP((('ฐานราก_Footing'!$F$8+F8)/N8),0),"-")` | ceil((footing **row-1** thickness + H)/spacing), no +1 | 8 |
| P | ความยาว /เส้น (ม.) | `=(2*(D8+E8))` | stirrup perimeter, no hook | 0.9 |
| Q | ความยาว รวม (ม.) | `=IFERROR(C8*O8*P8,"-")` | | 151.2 |
| R | น้ำหนัก (กก.) | `=IFERROR(Q8*SWITCH(M8,…),0)` | | 33.5664 |
| T | ไม้แบบ (ตร.ม.) | `=C8*(2*(D8+E8))*F8` | | 11.34 |
| V | คอนกรีต โครงสร้าง (ลบ.ม.) | `=C8*(D8*E8)*F8` | | 0.63 |

**Totals row 6:** H6..L6 SUMIF main (H, L). M6..Q6 SUMIF stirrup (M, R). R6 shows "-". T6 `=SUM(T8:T17)`, V6 `=SUM(V8:V17)`.
**Cross refs:** reads Footing F and D (same row) and Footing $F$8 (absolute). Footing AI subtracts V of the same row.
**Outputs:** sheet24 row 7, which feeds BOQ **6.6** (rebar), 7.1 (formwork) and 7.2 (concrete).

### 2.3 Sheet 27 — คานคอดิน_Beam (ground beam; title `โปรแกรมถอดแบบ – คานคอดิน Ground Beam 🏗️`)

**Capacity 14 rows (8–21)**, but some totals stop early (see below). One row is one beam line; there is no count column. Block label A4 is `สรุปปริมาณงานคานคอดิน`.

**Inputs**

| Col | Label | Type | Example rows 8–11 | Dropdown |
|---|---|---|---|---|
| B | ชื่อคาน | list | B1, B2, B3, B4 | `B1,B2,B3,B4,B5,B6` |
| C | กว้าง (ม.) | number | 0.2, 0.2, 0.2, 0.2 | |
| D | ลึก (ม.) | number | 0.5, 0.4, 0.4, 0.4 | |
| E | ยาว (ม.) | number | 10, 86, 3.2, 16 (E11 typed as `=14+2`) | |
| G | หนา (ม.) lean (under `คอนกรีตหยาบ (ลบ.ม.)`) | number | 0.05 each | |
| J | ขนาด (main) | list | DB12 | `RB6,RB9,DB12,DB16,DB20` |
| K | จำนวน (เส้น) | number | 10, 6, 7, 10 | |
| O | ขนาด (stirrup) | list | RB6 | same |
| P | ระยะห่าง (ม.) | number | 0.15 | |

**Computed**

| Col | Label | Excel | Plain | r8 / r9 |
|---|---|---|---|---|
| H | ปริมาณ (ลบ.ม.) lean | `=C8*E8*G8` | b·L·t | 0.1 / 0.86 |
| L | ความยาว รวม (ม.) | `=K8*E8` | bars × length (no lap or hook) | 100 / 516 |
| M | น้ำหนัก (กก.) | `=IFERROR(L8*SWITCH(J8,…),0)` | | 88.8 / 458.208 |
| N | - | "-" | spacer column | |
| Q | จำนวน (ปลอก) | `=IFERROR(ROUNDUP((E8/P8),0),"_")` | ceil(L/s) | 67 / 574 |
| R | ความยาว /เส้น (ม.) | `=(2*(C8+D8))` | | 1.4 / 1.2 |
| S | ความยาว รวม (ม.) | `=IFERROR(Q8*R8,"_")` | | 93.8 / 688.8 |
| T | น้ำหนัก (กก.) | `=IFERROR(S8*SWITCH(O8,…),0)` | | 20.8236 / 152.9136 |
| V | ไม้แบบ (ตร.ม.) | `=2*D8*E8` | 2 sides only (no soffit, because it sits on lean) | 10 / 68.8 |
| X | คอนกรีต โครงสร้าง (ลบ.ม.) | `=C8*D8*E8` | | 1 / 6.88 |

Rows 10 and 11 cached: H 0.032, 0.16; M 19.8912, 142.08; Q 22, 107; T 5.8608, 28.5048; V 2.56, 12.8; X 0.256, 1.28.
**Totals:** G6 `=SUM(H8:H18)`. J6..N6 SUMIF main (J, M), rows 8–100. O6..S6 SUMIF stirrup (O, T). **V6 `=SUM(V8:V17)`**, **X6 `=SUM(X8:X17)`**. Rows 18–21 are therefore ignored for formwork, concrete and lean (lean stops at row 18).
**Outputs:** sheet24 row 8, which feeds BOQ 8.2 (lean), 8.3 (rebar) and 8.6 (concrete). BOQ 8.5 formwork reads `'คานคอดิน_Beam'!V6` directly.

### 2.4 Sheet 28 — พื้นหล่อในที่_S (slab-on-grade; title `โปรแกรมถอดแบบ – พื้นหล่อในที่ (S) 🏗️`)

**Capacity 17 rows (8–24).** One row is one slab panel. There is no formwork. Block label A4 is `สรุปปริมาณงานพื้นหล่อในที่`.

**Inputs**

| Col | Label | Type | Example | Dropdown |
|---|---|---|---|---|
| B | ชื่อพื้น | list | S1 | `S1,S2` |
| C | กว้าง (ม.) | number | see list | |
| D | ยาว (ม.) | number | | |
| E | หนา (ม.) | number | 0.1 | |
| G | ถมลึก (ม.) (fill depth, under `ดินถมกลับ (ลบ.ม.)`) | number | 0.4 | |
| I | หนา (ม.) sand (under `ทรายหยาบ (ลบ.ม.)`) | number | 0.05 | |
| M | ขนาด | list | RB9 | `RB6,RB9,DB12,DB16` (no DB20) |
| N | วางเหล็ก (ชั้น) (layers) | list | 2 | `1,2` |
| O | ระยะห่าง (ม.) | number | 0.2 | |

Example panels (C×D) for rows 8–17: 1.8×2.0, 0.9×7.0, 2.3×3.0, 1.0×1.0, 2.0×4.0, 1.5×4.0, 1.5×4.0, 1.5×4.0, 0.9×3.5, 0.9×3.5. All are S1 with E 0.1, G 0.4, I 0.05, RB9, 2 layers, @0.2. Column A numbering repeats "9" on rows 16 and 17.

**Computed**

| Col | Label | Excel | Plain | r8 |
|---|---|---|---|---|
| H | ปริมาณ (ลบ.ม.) backfill | `=(C8*D8)*G8` | area × fill depth | 1.44 |
| J | ปริมาณ (ลบ.ม.) sand | `=(C8*D8)*I8*(100%+25%)` | area × t × 1.25 | 0.225 |
| K | ปริมาณ (ตร.ม.) plastic | `=C8*D8` | area | 3.6 |
| P | รวม (ม.) | `=(IFERROR(((C8*D8)/O8)*2,"0"))*N8` | area/spacing × 2 directions × layers | 72 |
| Q | น้ำหนัก (กก.) | `=IFERROR(P8*SWITCH(M8,…),0)` | | 35.928 |
| S | (ลบ.ม.) concrete | `=C8*D8*E8` | | 0.36 |

**Totals:** G6 `=SUM(H8:H24)`, I6 `=SUM(J8:J24)`, K6 `=SUM(K8:K24)`. M6..Q6 SUMIF (M, Q), rows 8–100. S6 `=SUM(S8:S24)`.
Cached: G6 20.04, I6 3.13125, K6 50.1, N6 (RB9) 499.998, S6 5.01.
**Outputs:** sheet24 row 9, which feeds BOQ 9.2 (backfill Q9), 9.3 (sand), 9.4 (plastic), 9.5 (rebar) and 9.6 (concrete).

### 2.5 Sheet 29 — ` พื้นสำเร็จรูป_PS` (precast plank; title `โปรแกรมถอดแบบ – งานพื้นสำเร็จรูป (PS) 🏗️`)

**Capacity 17 rows (8–24).** Group headers: E3 `แผ่นพื้น`, G3 `เหล็กเสริม`, O3 `ไม้แบบ`, R3 `คอนกรีต`. Block label A4 is `สรุปปริมาณงานพื้นสำเร็จรูป`.

**Inputs**

| Col | Label | Type | Example | Dropdown |
|---|---|---|---|---|
| B | กว้าง (ม.) | number | 2.0 | |
| C | ยาว (ม.) | number | 1.2 | |
| H | ขนาด (shear-key bar, `ปริมาณเหล็ก Shear Key (กก.)`) | list | RB6 | `RB6,RB9,DB12,DB16,DB20` |
| I | ระยะห่าง (ม.) | number | 0.35 | |
| J | ความยาว /เส้น (ม.) | number (yellow) | 0.8 | |
| R | หนา (ม.) topping | number | 0.05 | |

Example rows 8–16 (B×C): 2×1.2, 3×3, 3×3, 3×4, 3×3, 3×3.5, 3×1.2, 2×3.5, 3.5×3.5. All use RB6, @0.35, 0.8 m and t 0.05.

**Computed**

| Col | Label | Excel | Plain | r8 |
|---|---|---|---|---|
| E | แผ่นพื้น (ตร.ม) | `=B8*C8` | | 2.4 |
| G | ไวร์เมช (ตร.ม.) | `=E8` | wire-mesh area = slab area | 2.4 |
| K | จำนวน (เส้น) | `=IFERROR(ROUNDUP((2*B8/I8),0),"_")` | ceil(2·width/spacing) | 12 |
| L | ความยาว รวม (ม.) | `=IFERROR(K8*J8,"_")` | | 9.6 |
| M | น้ำหนัก (กก.) | `=IFERROR(L8*SWITCH(H8,…),0)` | | 2.1312 |
| O | ยาว (ม.) | `=2*(B8+C8)` | perimeter | 6.4 |
| P | ปริมาณ (ตร.ม.) | `=O8*R8` | edge formwork = perimeter × topping | 0.32 |
| S | คอนกรีต (ลบ.ม.) | `=E8*R8` | topping | 0.12 |

**Totals:** E6 `=SUM(E8:E24)`, G6 `=SUM(G8:G24)`. H6..L6 SUMIF (H, M), rows 8–100. **O6 `=SUM(P8:P24)`** (formwork m²). **R6 `=SUM(S8:S24)`** (topping m³). M6 "-".
Cached: E6 74.75, G6 74.75, H6 26.9952, O6 5.14, R6 3.7375.
**Outputs:** sheet24 row 10. BOQ 10.1 reads `' พื้นสำเร็จรูป_PS'!E6` directly. BOQ 10.2 wire-mesh comes from H10, 10.3 formwork from O10 and 10.4 concrete from P10. **The shear-key rebar goes to BOQ 8.4 (ground-beam section), not section 10.**

### 2.6 Sheet 30 — เสา_Column (column floor 1; title `โปรแกรมถอดแบบ – เสา Column 🏗️`)

**Capacity 10 rows (8–17).** Block label A4 is `สรุปปริมาณงานเสา`.

**Inputs**

| Col | Label | Type | Example r8 | Dropdown |
|---|---|---|---|---|
| B | ชื่อเสา | list | C1 | `C1,C2,C3` |
| C | จำนวน เสา (ต้น) | number | 21 | |
| D | กว้าง (ม.) | number | 0.2 | |
| E | ยาว (ม.) | number | 0.2 | |
| F | สูง (ม.) | number (yellow), typed as `=0.55+3.5` | 4.05 | |
| H | ขนาด (main) | list | DB12 | `RB6,RB9,DB12,DB16,DB20` |
| I | จำนวน (เส้น) | number | 6 | |
| M | ขนาด (stirrup) | list | RB6 | same |
| N | ระยะห่าง (ม.) | number | 0.15 | |

**Computed**

| Col | Label | Excel | Plain | r8 |
|---|---|---|---|---|
| J | ความยาว /เส้น (ม.) | `=F8` (shared down to J9:J17, so each row uses its own F) | = height, no lap | 4.05 |
| K | ความยาว รวม (ม.) | `=C8*J8*I8` | | 510.3 |
| L | น้ำหนัก (กก.) | `=K8*SWITCH(H8,…)` | | 453.1464 |
| O | จำนวน (ปลอก) | `=IFERROR(ROUNDUP((F8/N8),0),"_")` | ceil(H/s) | 27 |
| P | ความยาว /เส้น (ม.) | `=(2*(D8+E8))` | | 0.8 |
| Q | ความยาว รวม (ม.) | `=IFERROR(C8*O8*P8,"-")` | | 453.6 |
| R | น้ำหนัก (กก.) | `=IFERROR(Q8*SWITCH(M8,…),0)` | | 100.6992 |
| T | ไม้แบบ (ตร.ม.) | `=C8*(2*(D8+E8))*F8` | | 68.04 |
| V | คอนกรีต โครงสร้าง (ลบ.ม.) | `=C8*(D8*E8)*F8` | | 3.402 |

**Totals:** H6..L6 SUMIF (H, L), rows 8–99. M6..Q6 SUMIF (M, R). T6 `=SUM(T8:T17)`, V6 `=SUM(V8:V17)`.
**Cross refs:** none. The column height is **not** linked to the footing or pedestal; the user types it (example 0.55 + 3.5).
**Outputs:** sheet24 row 11, which feeds BOQ **6.7** (rebar), 11.2 (formwork) and 11.3 (concrete).

### 2.7 Sheet 31 — คานดาดฟ้า_RoofBeam (title `โปรแกรมถอดแบบ BOQ – คานดาดฟ้า RoofBeam 🏗️`)

**Capacity 14 rows (8–21).** S6 and V6 sum rows 8–17 only. Block label A4 is `สรุปปริมาณงานคานดาดฟ้า`.

**Inputs**

| Col | Label | Type | Example r8 / r9 | Dropdown |
|---|---|---|---|---|
| B | ชื่อคาน | list | B5 / B5 | `B1,B2,B3,B4,B5,B6` |
| C | กว้าง (ม.) | number | 0.2 / 0.2 | |
| D | ลึก (ม.) | number | 0.3 / 0.3 | |
| E | ยาว (ม.) | number | 25 / 9 | |
| G | ขนาด (main) | list | DB12 | `RB6,RB9,DB12,DB16,DB20` |
| H | จำนวน (เส้น) | number | 6 | |
| L | ขนาด (stirrup) | list | RB6 | same |
| M | ระยะห่าง @ (ม.) | number | 0.15 | |

**Computed**

| Col | Label | Excel | Plain | r8 / r9 |
|---|---|---|---|---|
| I | ความยาว รวม (ม.) | `=H8*E8` | | 150 / 54 |
| J | น้ำหนัก (กก.) | `=IFERROR(I8*SWITCH(G8,…),0)` | | 133.2 / 47.952 |
| K | - | "-" | | |
| N | จำนวน (ปลอก) | `=IFERROR(ROUNDUP((E8/M8),0),"_")` | | 167 / 60 |
| O | ความยาว /เส้น (ม.) | `=(2*(C8+D8))` | | 1 / 1 |
| P | ความยาว รวม (ม.) | `=IFERROR(N8*O8,"_")` | | 167 / 60 |
| Q | น้ำหนัก (กก.) | `=IFERROR(P8*SWITCH(L8,…),0)` | | 37.074 / 13.32 |
| S | ไม้ค้ำยัน (ต้น) | `=ROUNDUP((E8/0.6),0)` | one prop per 0.6 m of beam | 42 / 15 |
| T | ไม้แบบ (ตร.ม.) | `=(2*D8*E8)+C8` | 2 sides + **width (not width × length)** | 15.2 / 5.6 |
| V | คอนกรีต โครงสร้าง (ลบ.ม.) | `=C8*D8*E8` | | 1.5 / 0.54 |

**Totals:** G6..K6 SUMIF main (G, J). L6..P6 SUMIF stirrup (L, Q). S6 `=SUM(S8:S17)`, T6 `=SUM(T8:T17)` (shared from S6) = 20.8, V6 `=SUM(V8:V17)`. All three stop at row 17 although the table runs to row 21.
**Outputs:** sheet24 row 12, which feeds the BOQ 12 roof-beam block.

### 2.8 Sheet 32 — พื้นดาดฟ้า_RoofSlab (title `โปรแกรมถอดแบบ – พื้นดาดฟ้า RoofSlab 🏗️`)

**Capacity 17 rows (8–24).** Block label A4 is `สรุปปริมาณงานพื้นดาดฟ้า`.

**Inputs**

| Col | Label | Type | Example rows 8–11 | Dropdown |
|---|---|---|---|---|
| B | ชื่อพื้น | list | S1 | `S1,S2` |
| C | กว้าง (ม.) | number | 1.0, 3.0, 1.5, 1.5 | |
| D | ยาว (ม.) | number | 4.5, 3.5, 3.0, 3.0 | |
| E | หนา (ม.) | number | 0.1 | |
| G | ขนาด | list | RB9 | `RB6,RB9,DB12,DB16` |
| H | วางเหล็ก (ชั้น) | list | 2 | `1,2` |
| I | ระยะห่าง (ม.) | number | 0.2 | |

**Computed**

| Col | Label | Excel | Plain | r8 / r9 |
|---|---|---|---|---|
| J | ยาวรวม (ม.) | `=(IFERROR(((C8*D8)/I8)*2,"0"))*H8` | area/s × 2 × layers | 90 / 210 |
| K | น้ำหนัก (กก.) | `=IFERROR(J8*SWITCH(G8,…),0)` | | 44.91 / 104.79 |
| M | ไม้ค้ำยัน (ต้น) | `=ROUNDUP((N8/0.6),0)` | ceil(**area**/0.6) | 8 / 18 |
| N | ไม้แบบ (ตร.ม.) | `=C8*D8` | soffit area | 4.5 / 10.5 |
| P | คอนกรีต โครงสร้าง (ลบ.ม.) | `=C8*D8*E8` | | 0.45 / 1.05 |

**Totals:** G6..K6 SUMIF (G, K), rows 8–100. M6 `=SUM(M8:M17)`, N6 `=SUM(N8:N17)` (shared from M6) = 24, P6 `=SUM(P8:P24)`. Props and formwork stop at row 17, while concrete runs to row 24.
**Outputs:** sheet24 row 13, which feeds the BOQ 12 roof-slab block.

### 2.9 Sheet 33 — บันได_Stair (title `โปรแกรมถอดแบบ – งานบันได Stair 🏗️`)

**Capacity 10 rows (8–17).** Header groups: C4 `ขนาดแม่บันได`, H4 `ขนาดลูกบันได`, L4 `ปริมาณเหล็กเสริมหลัก - แม่บันได (กก.)`, Q4 `ปริมาณเหล็กกันร้าว - แม่บันได (กก.)`, V4 `ปริมาณเหล็กเสริมหลัก - ลูกบันได (กก.)`, AA4 `ปริมาณเหล็กกันร้าว - ลูกบันได (กก.)`, AG4 `ไม้ค้ำยัน (ต้น)`, AH4 `ไม้แบบ (ตร.ม.)`, AN4 `คอนกรีตโครงสร้าง (ลบ.ม.)`. Block label A4 is `สรุปปริมาณงานงานบันได`.

**Inputs**

| Col | Label | Type | Example r8 / r9 / r10 | Dropdown |
|---|---|---|---|---|
| B | ชื่อบันได | list | บันไดหน้าบ้าน / บันไดข้างบ้าน / บันไดหลังบ้าน | `บันไดข้างบ้าน,บันไดหน้าบ้าน,บันไดหลังบ้าน` |
| C | กว้าง (ม.) | number | 3.3 / 2.0 / 2.9 | |
| D | หนา (ม.) (waist) | number | 0.14 | |
| E | สูง (ม.) (total rise) | number | 0.45 | |
| F | ยาว แนวราบ (ม.) (horizontal run) | number | 0.9 | |
| H | จำนวน (ขั้น) | number | 3 | |
| I | สูง ลูกตั้ง (ม.) | number | 0.15 | |
| J | กว้าง ลูกนอน (ม.) | number | 0.3 | |
| L / M | ขนาด / ระยะห่าง (ม.): waist main bar | list / number | RB9 / 0.15 | `RB6,RB9,DB12,DB16,DB20` |
| Q / R | ขนาด / ระยะห่าง: waist temperature bar | list / number | RB9 / 0.15 | same |
| V / W | ขนาด / ระยะห่าง: step main bar | list / number | RB9 / 0.15 | same |
| AA / AB | ขนาด / ระยะห่าง: step temperature bar | list / number | RB9 / 0.15 (**AB is not used by any formula**) | same |

**Computed** (row 8 values; rows 9 and 10 are in brackets)

| Col | Label | Excel | Plain | r8 |
|---|---|---|---|---|
| G | ยาว แนวเอียง (ม.) | `=SQRT((F8^2)+(E8^2))` | inclined length | 1.00623 |
| N | จำนวน (เส้น) | `=IFERROR(ROUNDUP((C8/M8),0),"_")` | ceil(width/s) | 22 (14, 20) |
| O | ยาว รวม (ม.) | `=IFERROR((G8+1.2)*N8,"_")` | (inclined + **1.2 m anchorage, hard-coded**) × N | 48.537 |
| P | น้ำหนัก (กก.) | `=IFERROR(O8*SWITCH(L8,…),0)` | | 24.22 (15.4127, 22.0182) |
| S | จำนวน (เส้น) | `=IFERROR(ROUNDUP((G8/R8),0),"_")` | ceil(inclined/s) | 7 |
| T | ยาว รวม (ม.) | `=IFERROR(C8*S8,"_")` | width × S | 23.1 |
| U | น้ำหนัก (กก.) | `=IFERROR(T8*SWITCH(Q8,…),0)` | | 11.5269 (6.986, 10.1297) |
| X | จำนวน (เส้น) | `=IFERROR(ROUNDUP((C8/W8),0),"_")` | | 22 |
| Y | ยาว รวม (ม.) | `=IFERROR(X8*(F8+E8),"_")` | X × (run + rise) | 29.7 |
| Z | น้ำหนัก (กก.) | `=IFERROR(Y8*SWITCH(V8,…),0)` | | 14.8203 (9.4311, 13.473) |
| AC | จำนวน (เส้น) | `=2*H8` | 2 bars per step | 6 |
| AD | ยาว รวม (ม.) | `=AC8*C8` | | 19.8 |
| AE | น้ำหนัก (กก.) | `=IFERROR(AD8*SWITCH(AA8,…),0)` | | 9.8802 (5.988, 8.6826) |
| AG | ไม้ค้ำยัน (ต้น) | `=ROUNDUP((AH8/0.6),0)` | ceil(soffit **area**/0.6) | 6 (4, 5) |
| AH | ท้อง แม่บันได (ตร.ม.) | `=C8*G8` | soffit | 3.32056 |
| AI | ข้าง แม่บันได (ตร.ม.) | `=2*(D8*G8)` | waist sides | 0.28174 |
| AJ | ข้าง ลูกบันได (ตร.ม.) | `=2*I8*G8` | step sides (riser × inclined, ×2) | 0.30187 |
| AK | กั้น ขั้นบันได (ตร.ม.) | `=H8*I8*C8` | riser boards | 1.485 |
| AL | รวม (ตร.ม.) | `=SUM(AH8:AK8)` | | 5.38917 (3.49607, 4.80668) |
| AN | แม่บันได (ลบ.ม.) | `=(D8*G8)*C8` | waist slab | 0.46488 |
| AO | ลูกบันได (ลบ.ม.) | `=H8*((1/2)*J8*I8)*C8` | triangular steps | 0.22275 |
| AP | รวม (ลบ.ม.) | `=SUM(AN8:AO8)` | | 0.68763 (0.41674, 0.60428) |

**Totals:** L6..P6 SUMIF (L, P); Q6..U6 SUMIF (Q, U); V6..Z6 SUMIF (V, Z); AA6..AE6 SUMIF (AA, AE); all over rows 8–100. AG6 `=SUM(AG8:AG17)`. **AH6 `=SUM(AL8:AL17)`** (formwork total). **AN6 `=SUM(AP8:AP17)`** (concrete total).
Cached: M6 61.6509, R6 28.6426, W6 37.7244, AB6 24.5508 (RB9 total 152.5687). AG6 15, AH6 13.6919, AN6 1.70865.
**Outputs:** sheet24 row 14, which feeds BOQ 13.

---

## 3. BOQ (Home) rows for sections 6–13

Columns: E qty, F unit, G waste, I material ฿/unit, K labour ฿/unit, N note. Pricing rule from §1.3: H = E·(1+G) unless noted, J = I·H, L = K·E, M = J+L. Section subtotal rows (`รวม >>`) are J = SUM(J…) and L = SUM(L…). "S24" means sheet 24.

| Row | No. | Desc (verbatim) | Unit | Qty source | Waste | Mat | Lab | Note |
|---|---|---|---|---|---|---|---|---|
| 37 | **6.0** | งานฐานราก | | | | | | |
| 38 | 1) | ขุดดิน | ลบ.ม. | `='ฐานราก_Footing'!H6` (53.508) | 0 | 0 | 125 | รถแมคโครเล็ก |
| 39 | 2) | ตัดหัวเสาเข็ม | ต้น | `=E35` (pile count, BOQ 5.1 = 21) | 0 | 0 | 170 | |
| 40 | 3) | ทรายหยาบ | ลบ.ม. | S24!D6 (2.5725) | 0.3 | 750 | 500 | |
| 41 | 4) | คอนกรีตหยาบ (1:3:5) | ลบ.ม. | S24!E6 (2.058) | 0.1 | 2100 | 1000 | |
| 42 | 5) | เหล็กเสริม - ***ฟุตติ้ง | | header | | | | |
| 43 | | - เหล็ก RB9 | กก. | S24 row 6 by size (50.2992) | 0.09 | 25 | 15 | |
| 44 | | - เหล็ก DB12 | กก. | S24 row 6 by size (335.664) | 0.12 | 25 | 15 | |
| 45 | | - ลวดผูกเหล็ก | กก. | H = (H43+H44)·0.03 (12.923) | — | 50 | 0 | |
| 46 | 6) | เหล็กเสริม - ***เสาตอม่อ | | header | | | | |
| 47 | | - เหล็ก RB6 | กก. | S24 row 7 (33.5664) | 0.06 | 25 | 15 | |
| 48 | | - เหล็ก DB12 | กก. | S24 row 7 (156.6432) | 0.12 | 25 | 15 | |
| 49 | | - ลวดผูกเหล็ก | กก. | H = (H47+H48)·0.03 (6.3306) | — | 50 | 0 | |
| 50 | 7) | เหล็กเสริม - ***เสาชั้น 1 | | header | | | | |
| 51 | | - เหล็ก RB6 | กก. | S24 row 11 (100.6992) | 0.06 | 25 | 15 | |
| 52 | | - เหล็ก DB12 | กก. | S24 row 11 (453.1464) | 0.12 | 25 | 15 | |
| 53 | | - ลวดผูกเหล็ก | กก. | H = (H51+H52)·0.03 (18.428) | — | 50 | 0 | |
| 54 | 8) | แบบหล่อคอนกรีต | | header | | | | |
| 55 | | - ไม้แบบ | ตร.ม. | S24!O6 (30.24) | 0 | 250 | 150 | |
| 56 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E55 | 0 | 350 | 0 | |
| 57 | | - ตะปูยึดแบบ | กก. | =0.25·E55 | 0 | 50 | 0 | |
| 58 | 9) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P6 (4.536); H=MAX(1,CEILING(E·1.1,0.25))=5 | 0.1 | 2500 | 500 | |
| 60 | **7.0** | งานเสาตอม่อ | | | | | | |
| 61 | 1) | แบบหล่อคอนกรีต | | header | | | | |
| 62 | | - ไม้แบบ | ตร.ม. | S24!O7 (11.34) | 0 | 250 | 150 | |
| 63 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E62 | 0 | 350 | 0 | |
| 64 | | - ตะปูยึดแบบ | กก. | =0.25·E62 | 0 | 50 | 0 | |
| 65 | 2) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P7 (0.63); CEILING rule → 1 | 0.1 | 2500 | **1000** | |
| 67 | **8.0** | งานคานคอดิน | | | | | | |
| 68 | 1) | ถมดินกลับ | ลบ.ม. | **S24!Q6** (footing backfill, 43.7115) | 0 | 0 | 125 | รถแมคโครเล็ก |
| 69 | 2) | คอนกรีตหยาบ (1:3:5) | ลบ.ม. | S24!E8 (1.152) | 0.1 | 2100 | 1000 | |
| 70 | 3) | เหล็กเสริม | | header | | | | |
| 71 | | - เหล็ก RB6 | กก. | S24 row 8 (208.1028) | 0.06 | 25 | 15 | |
| 72 | | - เหล็ก DB12 | กก. | S24 row 8 (708.9792) | 0.12 | 25 | 15 | |
| 73 | | - ลวดผูกเหล็ก | กก. | H = (H71+H72)·0.03 (30.439) | — | 50 | 0 | |
| 74 | 4) | เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป | | header | | | | |
| 75 | | - เหล็ก RB6 | กก. | **S24 row 10 (PS shear key)** (26.9952) | 0.06 | 25 | 15 | (no tie-wire line) |
| 76 | 5) | แบบหล่อคอนกรีต | | header | | | | |
| 77 | | - ไม้แบบ | ตร.ม. | `='คานคอดิน_Beam'!V6` (94.16) | 0 | 250 | 150 | |
| 78 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E77 | 0 | 350 | 0 | |
| 79 | | - ตะปูยึดแบบ | กก. | =0.25·E77 | 0 | 50 | 0 | |
| 80 | 6) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P8 (9.416); CEILING → 10.5 | 0.1 | 2500 | 500 | |
| 82 | **9.0** | งานพื้นหล่อในที่ | | | | | | |
| 83 | 1) | ท่อน้ำทิ้ง | | header | | | | |
| 84 | | (D = `'ท่อน้ำทิ้ง_Waste Pipe'!B5`) ท่อน้ำทิ้งชักโครก PVC 4" | ม. | `='ท่อน้ำทิ้ง_Waste Pipe'!F5` (6) | 0.15 | 200 | 100 | L = K·**H** |
| 85 | | (D = B6) ท่อน้ำทิ้ง ØW ØFD PVC 2" | ม. | `…!F6` (21.1) | 0.15 | 60 | 50 | L = K·H |
| 86 | | (D = B7) ท่ออากาศถังบำบัด PVC 1" | ม. | `…!F7` (8) | 0.15 | 20 | 50 | L = K·H |
| 87 | | - วัสดุอุปกรณ์และของใช้สิ้นเปลือง | เหมา | 1 | 0 | `=SUM(J84:J86,L84:L86)*50%` (2691.575) | 0 | (50% ของค่าวัสดุและค่าแรง) |
| 88 | 2) | ถมดินกลับ | ลบ.ม. | **S24!Q9** (slab backfill, 20.04) | 0 | 0 | 125 | รถแมคโครเล็ก |
| 89 | 3) | ทรายหยาบ | ลบ.ม. | S24!D9 (3.13125) | 0.3 | 750 | 500 | |
| 90 | 4) | พลาสติกกันชื้น | ตร.ม. | S24!F9 (50.1) | 0.3 | 10 | 10 | |
| 91 | 5) | เหล็กเสริม | | header | | | | |
| 92 | | - เหล็ก RB9 | กก. | S24 row 9 (499.998) | 0.09 | 25 | 15 | |
| 93 | | - ลวดผูกเหล็ก | กก. | H = (H92)·0.03 (16.35) | — | 50 | 0 | |
| 94 | 6) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P9 (5.01); CEILING → 5.75 | 0.1 | 2500 | 500 | |
| 95 | | รวม >> | | J95 `=SUM(J88:J94)`, L95 `=SUM(L88:L94)` (**exclude pipes**), M95 `=SUM(M83:M94)` (includes pipes) | | | | |
| 96 | **10.0** | งานพื้นสำเร็จรูป | | | | | | |
| 97 | 1) | พื้นสำเร็จรูป (LL 250 กก./ตร.ม.) | ตร.ม. | `=' พื้นสำเร็จรูป_PS'!E6` (74.75) | 0 | 300 | 60 | |
| 98 | | - ไม้ค้ำยัน | ลบ.ฟ. | `=E97*0.1` (7.475) | 0 | 350 | 0 | |
| 99 | 2) | เหล็กไวร์เมช 4 มม. #20 ซม. | ตร.ม. | S24!H10 (74.75) | 0.1 | 40 | 30 | |
| 100 | 3) | แบบหล่อคอนกรีต | | header | | | | |
| 101 | | - ไม้แบบ | ตร.ม. | S24!O10 (5.14) | 0 | 250 | 150 | |
| 102 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E101 | 0 | 350 | 0 | |
| 103 | | - ตะปูยึดแบบ | กก. | =0.25·E101 | 0 | 50 | 0 | |
| 104 | 4) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P10 (3.7375); CEILING → 4.25 | 0.1 | 2500 | 500 | |
| 106 | **11.0** | งานเสาชั้น 1 | | (numbering starts at 2; item 1, the rebar, lives in 6.7) | | | | |
| 107 | 2) | แบบหล่อคอนกรีต | | header | | | | |
| 108 | | - ไม้แบบ | ตร.ม. | S24!O11 (68.04) | 0 | 250 | 150 | |
| 109 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E108 | 0 | 350 | 0 | |
| 110 | | - ตะปูยึดแบบ | กก. | =0.25·E108 | 0 | 50 | 0 | |
| 111 | 3) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P11 (3.402); CEILING → 3.75 | 0.1 | 2500 | **1000** | |
| 113 | **12.0** | งานคาน + พื้นดาดฟ้า | | | | | | |
| 114 | | งานคานดาดฟ้า | | sub-header | | | | |
| 115 | 1) | เหล็กเสริม | | header | | | | |
| 116 | | - เหล็ก RB6 | กก. | S24 row 12 (50.394) | **0.12** | 25 | 15 | |
| 117 | | - เหล็ก DB12 | กก. | S24 row 12 (181.152) | **0.06** | 25 | 15 | |
| 118 | | - ลวดผูกเหล็ก | กก. | H = (H116+H117)·0.03 (7.454) | — | 50 | 0 | |
| 119 | 2) | ไม้ค้ำยัน | ต้น | S24!N12 (57) | 0 | 150 | 50 | |
| 120 | 3) | แบบหล่อคอนกรีต | | header | | | | |
| 121 | | - ไม้แบบ | ตร.ม. | S24!O12 (20.8) | 0 | 250 | 150 | |
| 122 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E121 | 0 | 350 | 0 | |
| 123 | | - ตะปูยึดแบบ | กก. | =0.25·E121 | 0 | 50 | 0 | |
| 124 | 4) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P12 (2.04); **H = E·(1+G) = 2.244 (shared from H121's formula, no CEILING)** | 0.1 | 2500 | 500 | |
| 125 | | งานพื้นดาดฟ้า | | sub-header | | | | |
| 126 | 1) | เหล็กเสริม | | header | | | | |
| 127 | | - เหล็ก RB9 | กก. | S24 row 13 (239.52) | 0.09 | 25 | 15 | |
| 128 | | - ลวดผูกเหล็ก | กก. | H = (H127)·0.03 (7.832) | — | 50 | 0 | |
| 129 | 2) | ไม้ค้ำยัน | ต้น | S24!N13 (42) | 0 | 150 | 50 | |
| 130 | 3) | แบบหล่อคอนกรีต | | header | | | | |
| 131 | | - ไม้แบบ | ตร.ม. | S24!O13 (24) | 0 | 250 | 150 | |
| 132 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E131 | 0 | 350 | 0 | |
| 133 | | - ตะปูยึดแบบ | กก. | =0.25·E131 | 0 | 50 | 0 | |
| 134 | 4) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P13 (2.4); CEILING → 2.75 | 0.1 | 2500 | 500 | |
| 135 | | รวม >> | | J `=SUM(J115:J134)` covers both sub-blocks | | | | |
| 136 | **13.0** | งานโครงสร้างบันได | | | | | | |
| 137 | 1) | เหล็กเสริม | | header | | | | |
| 138 | | - เหล็ก RB9 | กก. | S24 row 14 (152.5687) | 0.09 | 25 | 15 | |
| 139 | | - ลวดผูกเหล็ก | กก. | H = (H138)·0.03 (4.989) | — | 50 | 0 | |
| 140 | 2) | ไม้ค้ำยัน | ต้น | S24!N14 (15) | 0 | 150 | 50 | |
| 141 | 3) | แบบหล่อคอนกรีต | | header | | | | |
| 142 | | - ไม้แบบ | ตร.ม. | S24!O14 (13.6919) | 0 | 250 | 150 | |
| 143 | | - ไม้คร่าวยึดแบบ | ลบ.ฟ. | =0.6·E142 | 0 | 350 | 0 | |
| 144 | | - ตะปูยึดแบบ | กก. | =0.25·E142 | 0 | 50 | 0 | |
| 145 | 4) | คอนกรีตโครงสร้าง (240 ksc cu) | ลบ.ม. | S24!P14 (1.70865); CEILING → 2 | 0.1 | 2500 | 500 | |
| 146 | | รวม >> | | | | | | |

Section subtotals in v5: 6 = 104,693.07; 7 = 10,189.15; 8 = 140,614.30; 9 = 55,173.03 (M); 10 = 50,751.15; 11 = 55,131.90; 12 = 82,961.78; 13 = 24,073.03.
The `Man-Day_Basic` sheet (02) mirrors these BOQ qty cells with the same references, so a rebuild must keep them consistent. That sheet is covered elsewhere.

---

## 4. Review notes (customer deck)

The deck alternates "ConTrack" app screenshots with "โปรแกรม BOQM" Excel screenshots. The implied message on every step: **make the app reproduce the Excel calculator and BOQ block.**

| Step | Pages | What the customer showed or said |
|---|---|---|
| 06 ทำฐานราก | 23–28 | p24–25: the app form has L/W/T per type, global lean/sand/waste, optional excavation depth, working space, rebar factor kg/m³, tie-wire %, spacer. Live preview shows ลูกปูน and เครื่องจี้คอนกรีต. p25: the operations box (curing, pump, dewatering) is boxed in red with "เอาไว้/แจ้งภายหลัง" (keep for now; the customer will advise later). p26: Excel BOQ section 6. p27: footing calculator. p28: **"Note : เหล็กในฐานรากมีเหล็กเสาตอม่อกับเหล็กเสาชั้น1ด้วย"** (the footing section's rebar also includes the pedestal and floor-1 column rebar), with arrows from 6.6 to the pedestal sheet and 6.7 to the column sheet. |
| 07 เสาตอม่อ | 29–32 | p30–31: the app has P1 count/W/L/H, waste, rebar factor, main bars, dowel, formwork reuse, spacer, curing, pump, vibrator; preview items include spacer, vibrator and curing plastic. p32: Excel BOQ 7 (formwork + concrete only), with an arrow to the pedestal sheet. |
| 08 คานคอดิน | 33–38 | p34–35: the app has total length, b, h, lean, waste, plus excavation/sand, beam count, kg/m³, dowels, reuse, spacer, tie wire, curing, pump, vibrator, shoring, and an untranslated key `steps.step8.termite`. Preview shows sand, excavation and backfill computed locally. p36: Excel BOQ 8. p37: **"ถมดินกลับ จะคำนวณมาจากโปรแกรมฐานราก"** (backfill comes from the footing program). p38: ground-beam calculator (B1–B4). |
| 09 เทพื้นหล่อในที่ | 39–44 | p40–41: the app has area, thickness, sand, plastic factor, waste, wire-mesh kg/m², perimeter/edge formwork, control/expansion joints, sleeves, slope, hardener, curing, pump, vibrator. p42: Excel BOQ 9. p43: **"ท่อน้ำทิ้ง จะคำนวณมาจากโปรแกรม ท่อน้ำทิ้ง"** (waste pipes come from the Waste Pipe sheet; the MEP spec covers that sheet). p44: slab calculator. |
| 10 วางแผ่นพื้นสำเร็จ | 45–48 | p46–47: the app has area, topping, waste, shear-key toggle; the preview shows **NaN** for shoring/crane/delivery. Optional fields: hollow-core type, span, panel width/thickness/count, shoring, grout, wire-mesh kg/m², termite pipe, crane days, delivery trips. p48: PS calculator (9 panels). |
| 11 ทำเสาชั้น 1 | 49–51 | p50: the app has C1 21 × 0.2 × 0.2 × **4.25**, kg/m³ and waste. p51: Excel BOQ 11 with an arrow to the column sheet (height 4.05). |
| 12 คาน + พื้นดาดฟ้า | 52–55 | p53: the app has beams (count, b, h, average length), one slab area and thickness, kg/m³, waste; the preview shows a pump at 8,000 ฿. p54: Excel BOQ 12. p55: roof-beam and roof-slab calculators. |
| 13 โครงสร้างบันได | 56–60 | p57–58: the app has flights, steps per flight, rise, going, width, landing area, kg/m³, waste, waist and landing thickness, storey height, spacer, tie wire, nosing, operations. p59–60: stair calculator (3 stairs, 4 bar groups, formwork split, concrete split). |

---

## 5. Today's app vs Excel

Code reviewed: `src/lib/steps/step06..13.ts`, `src/lib/engines/structural-engine.ts`, `src/components/steps/Step6..13*.tsx`, `src/lib/boq-mapper.ts`.

**Cross-cutting**
- The app derives rebar from **kg/m³ ratios or a "direct kg"**. The Excel has **no ratio anywhere**: every element is a bar schedule (size dropdown + count or spacing), weights come from the SWITCH table, and totals are split **per bar size**. `boq-mapper.ts` has no per-size rebar rows (no RB6/RB9/DB12 lines).
- `structural-engine` applies a default 10 % rebar waste to the total. Excel applies per-line waste by size (6/9/12 %), and its tie wire is 3 % of the qty incl. waste per block; the engine's 3 % matches, but the steps override it with `tie_wire_factor` (default 1.5).
- Many app outputs have **no Excel counterpart**: spacers (ลูกปูน), vibrator days, pump, dewatering, curing plastic or compound, waterproof admix, crane, delivery, grout, termite, joints, sleeves, hardener, nosing, roof drains, waterproofing. The customer said to keep operations for now (p25), but they must not enter the BOQ sections 6–13 total unless confirmed.
- Excel's structural-concrete CEILING(…, 0.25) with a minimum of 1 m³ is not implemented. Concrete waste defaults to 5 % in the steps; Excel uses 10 %.
- The app has a single "type" list per step. Excel has fixed-capacity tables (10–17 rows) with names chosen from dropdowns.

**Step 06 (footing)**
- The app collects count/L/W/T and global lean/sand thickness. Excel adds per-row excavation depth (H), sand (J) and lean (L) thickness, plus three bar groups (short side size/count, long side size/count, tie ring size/count).
- The app makes excavation depth optional and global, with margin `EXCAVATION_MARGIN`. Excel requires it per row and hard-codes 0.40 m each side.
- The app reads pedestal volume from an optional input (`pedestal_volume_m3`). Excel subtracts the pedestal sheet's V of the same row. In Excel the backfill lands in **BOQ 8.1**, not section 6.
- Missing BOQ lines: 6.2 ตัดหัวเสาเข็ม (= pile count), 6.6 pedestal rebar, 6.7 column-1 rebar, battens and nails (the mapper comment says these are added; verify).
- The app formwork n·2(L+W)·T matches Excel AE.

**Step 07 (pedestal)**
- The app uses `main_bar_count`, a dowel length and kg/m³. Excel uses main bar size + count with length = H + footing T + footing W/3, and stirrup size + spacing with count = ceil((footing!$F$8 + H)/s).
- The pedestal rebar must be emitted into **BOQ 6.6**. Section 7 holds only formwork and concrete (labour 1000/m³).
- Pedestals need row-pairing with footings (row n ↔ row n) for the bar length and backfill.
- Formwork and concrete formulas match Excel (2(D+E)·H·n, D·E·H·n).

**Step 08 (ground beam)**
- The app takes one total length × b × h. Excel has per-beam rows (B1–B6) with b, h, length, lean t, main size/count and stirrup size/spacing.
- The app computes its own excavation, sand under lean and backfill `(exc − conc − lean)·1.2`. **Excel has no excavation or sand for ground beams**; backfill 8.1 = the footing sheet's backfill.
- Excel formwork is 2·h·L (sides only). The app uses a factor.
- Missing BOQ 8.4 `เหล็กล๊อคหัวแผ่นพื้นสำเร็จรูป` (the PS shear-key RB6 from step 10).
- Invented fields: termite (untranslated), dowels, shoring, spacer.

**Step 09 (slab on grade)**
- The app takes area + thickness. Excel has per-panel rows (W, L, t, fill depth, sand t, bar size, layers 1/2, spacing).
- The app defaults the reinforcement to wire-mesh kg/m² with +15 % lap. Excel uses **RB9 bars**: area/spacing × 2 × layers, then 9 % BOQ waste.
- The app plastic factor is 1.10 and sand is generic. Excel plastic = area (BOQ waste 30 %) and sand = area·t·1.25 (BOQ waste 30 %).
- Missing BOQ 9.1 waste pipes (from the Waste Pipe sheet F5..F7, labour on gross qty, plus a 50 % consumables line) and 9.2 backfill under slab (area × fill depth).
- Edge formwork, joints, sleeves, slope and hardener do not exist in Excel section 9.

**Step 10 (precast slab)**
- The app takes a total area. Excel has per-panel rows W × L; wire-mesh is **m² = area** (not kg), shear key = ceil(2W/0.35) × 0.8 m of RB6, edge formwork = perimeter × topping t, topping = area × t.
- The app preview shows NaN for shoring, crane and delivery (p46). In Excel, props = area × 0.1 ลบ.ฟ. (BOQ 10.1 sub-line).
- The shear-key steel goes to BOQ 8.4, not section 10.
- Invented fields: hollow-core/plank type, panel width/thickness/count, span-based shoring, crane, grout, termite pipe, delivery.

**Step 11 (column floor 1)**
- The app uses kg/m³. Excel has main bar size + count with length = H, and stirrup size + spacing with count = ceil(H/s).
- The rebar must go to **BOQ 6.7**. Section 11 holds formwork and concrete only (concrete labour 1000).
- The app example height is 4.25; the Excel input is 4.05 (= 0.55 + 3.5, typed, not linked).
- Formwork and concrete formulas match Excel.

**Step 12 (roof beam + roof slab)**
- The app has one beam list (count, b, h, average length) and one slab area/thickness with a shared kg/m³. Excel has two calculators: roof beam (per-row b, h, L, main size/count, stirrup size/spacing) and roof slab (per-panel W, L, t, size, layers, spacing).
- The app formwork is beam fw + slab area, and props are per m² × h/3. Excel: beam formwork = 2hL + b (sic), beam props = ceil(L/0.6), slab formwork = W·L, slab props = ceil(W·L/0.6).
- The BOQ needs two sub-blocks (งานคานดาดฟ้า / งานพื้นดาดฟ้า), each with rebar, tie wire, props (ต้น, 150/50), formwork + accessories and concrete.
- The pump (8,000 ฿), waterproofing, roof drains and slope concrete are not in Excel section 12.

**Step 13 (stair)**
- The app has flights × steps × rise/going/width + landing + kg/m³. Excel has per-stair rows (name dropdown, width, waist t, total height, horizontal run, steps, riser, tread) and four bar groups (waist main / waist temp / step main / step temp).
- The app formwork includes the landing and triangular sides. Excel = soffit C·G + waist sides 2·D·G + step sides 2·I·G + risers H·I·C; there is no landing.
- App props = shoreArea·1.5·h/3. Excel = ceil(soffit area/0.6).
- App concrete includes the landing and waist. Excel = waist D·G·C + steps H·(½·J·I)·C.
- Nosing, spacer and operations are not in Excel.

---

## 6. Oddities needing a decision

1. **Roof-beam rebar waste is swapped:** BOQ G116 RB6 = 0.12 and G117 DB12 = 0.06. Everywhere else RB6 = 0.06 and DB12 = 0.12. Recommend normalising to the per-size waste (RB6 6 %, RB9 9 %, DB12 12 %) and deciding DB16/DB20, which have no example.
2. **Roof-beam formwork** `T = (2*D*E)+C` adds the beam width once instead of the soffit area C·E. The expected value would be 2·D·E + C·E (= 20.0 m² vs 15.2 for row 8). Mirror or fix?
3. **Short total ranges on roof sheets:** RoofBeam!T6 is SUM(T8:T17) and RoofSlab!N6 is SUM(N8:N17); both are shared formulas, not typed values. They stop before the last table rows (roof beam table rows 8–21, roof slab 8–24). In the rebuild, sum every row.
4. **Concrete rounding:** structural concrete uses `MAX(1, CEILING(E·(1+G), 0.25))`, except roof-beam concrete (row 124), which is plain. Apply the rule uniformly?
5. **Props from area/0.6:** RoofSlab M = ceil(area/0.6) and Stair AG = ceil(soffit area/0.6) divide an area by a length. Beam props ceil(L/0.6) are dimensionally fine. PS props are area × 0.1 ลบ.ฟ., a different unit from the ต้น used elsewhere.
6. *(Withdrawn: Column J9:J17 do carry the shared formula `=F`, so every row is computed. No action needed.)*
7. **Column height is typed** as `=0.55+3.5` inside an input cell and is not linked to the footing or pedestal. The deck app used 4.25. Decide on the default and whether to derive it.
8. **The pedestal stirrup count** uses `'ฐานราก_Footing'!$F$8` (absolute: footing row 1 thickness for every pedestal), while the bar length uses the same-row footing F and D. Use same-row?
9. **Row pairing:** pedestal row n is assumed to sit on footing row n (bar length, backfill subtraction). The footing has 11 rows and the pedestal 10, so footing row 18 references Pedestal!V18 (outside the table, which reads as 0). Should the app link pedestals to footing types explicitly?
10. **Inconsistent total ranges** (rows silently ignored): Beam G6 = SUM(H8:H18), V6/X6 = rows 8–17, while the table has 14 rows; RoofBeam S6/T6/V6 = rows 8–17 of 14; RoofSlab M6/N6 = rows 8–17 of 17. The rebuild should sum all rows.
11. **Sheet24 Q18** `=SUM(Q7:Q17)` omits the footing backfill Q6. It is informational only.
12. **Double waste on sand:** the calculators multiply sand by 1.25, and the BOQ adds another 30 %. Backfill also subtracts the 1.25-inflated sand. The backfill has no `MAX(0,…)` guard and never subtracts the ground-beam volume.
13. **Fixed BOQ rebar slots:** the Google-Sheets FILTER spills sizes into fixed rows (2 slots for footing, pedestal, column, ground beam and roof beam; 1 slot for slab, roof slab, stair and PS). A third size would hit the tie-wire row (spill error), and the tie-wire formula only sums the fixed slots. Waste is per slot, not per size. Decision: generate size lines dynamically, with waste per size.
14. **PS shear-key steel** is booked under section 8 (8.4) with no tie wire. Keep it there?
15. **Section 9 subtotal:** J95/L95 exclude the pipe rows 84–87, while M95 includes them, so material + labour ≠ total. Pipe labour uses gross qty (K·H), unlike every other row (K·E).
16. **BOQ 9.1 reads pipe rows by position** (Waste Pipe B5..B7 / F5..F7), not by pipe type.
17. **Stair formulas:** the step temperature bars `AC = 2*H` ignore their spacing input AB. The main bar adds a hard-coded 1.2 m anchorage. Step-side formwork `AJ = 2·I·G` (riser × inclined length) is not the triangle area. Riser I and tread J are independent of total height E and run F (no consistency check). There are no landings.
18. **No +1 on bar counts** (ceil(L/s) everywhere) and **no laps or hooks** on beam and column main bars. Footing bars are bent up by the thickness on both ends. Mirror as-is?
19. **Dropdown quirks:** footing names `F1,F2,F4` (no F3). The footing bar list has a duplicate DB20. The slab and roof-slab lists exclude DB20. Sheet24 I5:M5 headers are editable. Beam E11 is typed as `=14+2`. Slab numbering repeats "9". Sheet24 column A is out of order. BOQ section 11 numbering starts at "2)".
20. **Labour on concrete differs:** pedestal (7.2) and column (11.3) use 1000 ฿/m³; the others use 500.
21. **Version drift:** the deck screenshots (older revision) show concrete 2,200, rebar 28, pile-head 167, backfill 43.84 and pedestal 0.2×0.2 with formwork 10.08. v5 has 2,100 / 25 / 170 / 43.7115 / 0.25×0.2 / 11.34. This spec follows v5.
22. **Workbook-level defined names** `ระยะSpacing`, `Pile_Type`, `จำนวน` and `Dimension` = `#REF!`. They are unused by sheets 24–33 and can be ignored. There are no `#REF!` cells in sheets 24–33.
