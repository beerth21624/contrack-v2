# 06 — Planning sheets: Man-Day_Basic, S-Curve_Plan_Basic, CashFLOW_Basic (Excel v5)

Source: workbook "โปรแกรมประมาณราคา BOQ … บ้านชั้นเดียว – Training Edition v5". The cell dumps are in
`%TEMP%\ctrv2\v5\sheet02.txt`, `sheet03.txt` and `sheet04.txt`.
This spec is meant to replace reading the Excel. Cell addresses refer to the v5 workbook.

**Conventions**
- *Input* means a yellow cell (`FFFFF2CC`) or a typed constant. *Formula* means a computed cell.
- The dump writes typed constants as floats (`1.0`, `46032.0`) and formula results without a trailing `.0` (`46032`). This rule is used below to tell inputs from formulas where the dump does not repeat a shared formula.
- Dates are Excel serials: 46023 = 2026‑01‑01. All example values are the shipped sample (a 1-storey RC house, cost ฿1,850,317.34).
- Where the dump shows a formula only on the first cell of a run, the formula is Excel's shared formula and applies to the whole run. These are described once as a "pattern".

---

## 0. How the three sheets chain together (and with BOQ Home)

```
Calculator sheets (ฐานราก, ก่ออิฐ, ทาสี, …)
   │ quantities (same links BOQ Home uses)
   ├──────────────► BOQ (Home)   cols B..N, total M310 = 1,850,317.34
   └──────────────► Man-Day_Basic cols A..M = a row-for-row COPY of BOQ Home (shifted 1 column left)
                                  + planning cols O..U on each category header row
                                        │ T (estimated days)  U (category budget)
                                        ▼
                    S-Curve_Plan_Basic   D (duration) = Man-Day T,   G (budget) = Man-Day U
                                         E (start) = typed input,    F = E + D − 1
                                         weekly % grid J..BE (4 "weeks" per calendar month, 12 months)
                                        │ weekly PLAN % per task (looked up by task name)
                                        │ month/week labels, project start/finish dates
                                        ▼
                    CashFLOW_Basic       D2 = 'BOQ (Home)'!M310 (cost), K2 = D2×1.3 (quotation)
                                         20 weekly columns D..W (= first 5 months of the S-Curve axis)
                                         Cash-IN installments, Cash-OUT = cost×weekly% (+15% opex), EVM dashboard
```

Key facts:
1. **Man-Day has no formula link to BOQ Home.** It is a full duplicate of BOQ Home rows 7–310. It has the same descriptions and the same links to the calculator sheets. Its unit prices (H = material/unit, J = labour/unit) and waste % (F) are separate typed inputs that only *happen* to equal BOQ Home's. BOQ Home has the same columns shifted one to the right: BOQ E=qty, G=waste, H=qty+waste, I=mat/unit, J=mat total, K=lab/unit, L=lab total, M=total, N=note. Man-Day uses D, F, G, H, I, J, K, L, M. Both totals are ฿1,850,317.34.
2. S-Curve pulls **duration (T)** and **budget (U)** from Man-Day for 31 of its 32 tasks. The two exceptions are in §2.4.
3. CashFlow pulls the **construction cost** from BOQ Home M310. It pulls the **weekly plan weights** from S-Curve (rows 86-style PLAN shares per task) by MATCHing the task name in S-Curve column C. It pulls the **duration** from S-Curve D5/D6.
4. BOQ Home A17/A18/A19 are navigation hyperlinks to the three sheets. Each planning sheet has a "Back Home" link (Man-Day U1, S-Curve H4, CashFlow K1) to `'BOQ (Home)'!A1`.
5. Land survey (BOQ row 9/10, ฿7,500) is **excluded** everywhere. BOQ M310 sums M14+M17+…+M308 and skips M10. Man-Day L310 skips L10. S-Curve has no task for it. See Oddities.

---

## 1. Sheet 02 — Man-Day_Basic ("👷ประเมินจำนวนคน-วัน (Man-Day) และ Budget")

### 1.1 Purpose
For each BOQ work category, the sheet estimates the crew (skilled + labourers) and the daily crew wage. From those it computes how many days the category's labour cost buys, and it lets the user type an estimated duration. The category budget is passed on to the S-Curve.

### 1.2 Layout
| Area | Rows / cols | Content |
|---|---|---|
| Title block | 1–4 | A1 program title, F1 copyright, M1 doc no. "BOQ-2026-001 Rev.00 – Draft", P1 sheet title, U1 "Back Home" link. A2:C4 project/location/owner text, J2:K4 revision/date/prepared-by. Legend: P3 yellow "(ช่องสีเหลือง) ต้องกรอกข้อมูล", P4 red `FFF4CCCC` "(ช่องสีแดง) ต้อง Link ข้อมูล". All are static text (copied, not linked to BOQ Home). |
| Group headers | 6 | H6 "ค่าวัสดุ" (over H:I), J6 "ค่าแรงงาน" (over J:K), O6 "วางแผน Man-Day 👥" (O:T), U6 "วางแผน Budget 💰" |
| Column headers | 7 | A No. · B ขั้นตอน · C รายการ · D ปริมาณ · E หน่วย · F %เผื่อ · G ปริมาณเผื่อแล้ว · H ค่าวัสดุ/หน่วย · I ค่าวัสดุรวม · J ค่าแรง/หน่วย · K ค่าแรงรวม · L รวมทั้งหมด · M หมายเหตุ · O 1.ช่าง · P 2.คนงาน · Q 3.จำนวนคน (คน) · R 4.ค่าแรงต่อวัน (รวม) · S 5.คำนวณ (วัน) · T 6.ประเมิน (วัน) · U 7.งบประมาณ (บาท) |
| BOQ body | 8–308 | Same rows as BOQ Home 8–308. Category header rows (grey `FFF2F2F2`, A = "0.0"…"31.0"), item rows ("1)", "2)"…), sub-item rows ("- เหล็ก DB12"), "รวม >>" subtotal rows |
| Planning block | O..U on each category header row | O..U are **merged vertically** over the whole category (e.g. O37:O59). Only the top-left cell holds the value. |
| Totals | 310–311 | K310 label "รวมต้นทุนก่อสร้างทั้งหมด", L310 grand total, M310 "บาท"; T310 = SUM(T8:T308) "รวมเวลา"; U310 "รวมงบประมาณ" (= ΣU) |

Autofilter: `'Man-Day_Basic'!$A$7:$M$308`.

### 1.3 BOQ-copy columns A..M (same logic as BOQ Home; full detail lives in the BOQ spec)
Row patterns (shared formulas, one per item row):
| Col | Pattern | Plain language |
|---|---|---|
| D | link to calculator sheet (e.g. `='ถมดิน'!D9`, `=SUMIFS('ก่ออิฐ_Brick'!I:I, …"อิฐมอญ", …"ครึ่งแผ่น")`, `=IFERROR(SUMIF('ฉาบปูน_Plaster'!$C:$C,"ฉาบภายนอก",…!$E:$E),0)`, Google-Sheets FILTER/REGEXEXTRACT for rebar & doors) or a typed qty (yellow) | quantity |
| G | `=D*(100%+F)`. Variants: `=ROUNDUP(D*(100%+F),0)` on roof rows 152–159 and 162–176; `=MAX(1,CEILING(D*(1+F),0.25))` on concrete rows 58, 65, 80, 94, 104, 111, 134 and 145 (rounds up to 0.25 m³, minimum 1); tie wire `=(G+G)*0.03` on rows 45, 49, 53, 73 and 118, or `=(G)*0.03` on rows 93, 128 and 139. The tie-wire G cells are formulas but keep the yellow fill. | qty incl. waste |
| I | `=H*G` (3 rows `=H*D`: 186, 190, 215) | material total |
| K | `=J*D`. **18 rows use `=J*G`**: 13 written out (45, 49, 53, 73, 84, 93, 118, 128, 139, 185, 191, 193, 213) and 5 shared copies (85, 86 from K84; 194, 195 from K193; 214 from K213). These are the tie wire, waste pipe, conduit, door frame, cable and water pipe rows. | labour total. **It normally uses the quantity without waste.** |
| L | `=I+K` | line total |
| H on "วัสดุอุปกรณ์และของใช้สิ้นเปลือง" rows | `=SUM(I..,K..)*15%` on rows 186 and 196 (electrical); `=SUM(I..,K..)*50%` on rows 87 (`SUM(I84:I86,K84:K86)`) and 215 (`SUM(I213:I214,K213:K214)`) (plumbing). H87, H186 and H196 keep the yellow fill. | consumables = 15% or 50% of the group's material+labour |
| Subtotal row "รวม >>" | `I=SUM(I first:last)`, `K=SUM(K…)`. **L is `=SUM(L…)`**, a shared copy of the K subtotal (not I+K), except on rows 95, 216 and 243, where it is written out. The ranges differ on three rows. Row 95: I/K `88:94` but L `83:94`. Row 216: I/K `210:211` but L `210:215`. Row 243: K `236:242` but I/L `234:242`. | category subtotal. The embedded waste-pipe and water-pipe rows are counted in L (and U) but **not in K**, so S82 and S209 ignore their labour. |
| L310 | `=L14+L17+L30+L33+L36+L59+L66+L81+L95+L105+L112+L135+L146+L150+L160+L177+L187+L197+L203+L208+L216+L221+L232+L243+L253+L271+L277+L280+L292+L298+L308` | grand total (**excludes L10, the land survey**) = 1,850,317.34 |

Inputs in A..M (yellow): F (%เผื่อ) and H, J (unit prices) on every item row. D is an input on rows not linked to a calculator. The yellow typed D cells are D12 (demolition), D19–D29 (site facilities), D32, D35 (piles = 21) and D148–D149 (column plates = 21). D9, D16, D158 and the consumables rows D87/D186/D196/D215 also hold typed values (no fill). Some H/J are derived, e.g. H180 `=H179*2`, J180 `=J179*2`, H182 `=H181*2`.

Hyperlinks: C/B cells link to their calculator sheet (`# LINK C38 -> 'ฐานราก_Footing'!A1`, etc.). B18 and B31 link to external Google Sheets (rel rId2/rId3).

### 1.4 Planning block (cols O..U) — the Man-Day logic
There is one block per category header row. The block's values sit in the top-left of the merged range.

**INPUTS**
| Cell | Label | Type | Default (sample) | Notes |
|---|---|---|---|---|
| O{hdr} | 1.ช่าง (skilled workers) | integer, yellow | 1–5 (see table) | |
| P{hdr} | 2.คนงาน (labourers) | integer, yellow | 1–5 | |
| T{hdr} | 6.ประเมิน (วัน), the user's estimated duration | number, yellow | ≈ ROUND(S) | **This value feeds the S-Curve duration.** |

**FORMULAS**
| Cell | Excel | Plain language |
|---|---|---|
| Q{hdr} | `=SUM(O{hdr}:P{end})`, e.g. `=SUM(O18:P30)`. Because O/P are merged, this equals O+P. | crew size = skilled + labourers |
| R{hdr} | `=(800*O)+(500*P)` **or** `=(1000*O)+(600*P)` | daily crew wage. **Wages are hard-coded in the formula.** Rate set A is 800 skilled / 500 labourer. Rate set B is 1000 / 600 (roof, electrical, ceiling, paint, aluminium, misc). |
| S{hdr} | `=K{subtotal}/R{hdr}` (variants below) | calculated days = labour cost of the category ÷ daily crew wage |
| U{hdr} | `=L{subtotal}` (variants below) | category budget (material + labour) |
| T310 | `=SUM(T8:T308)` | sum of estimated days (164). This is a crew-day sum, not the calendar duration. |
| U310 | `=SUM(U8:U308)` (a shared copy of T310) = 1,850,317.34 (= L310) | total budget |

S/U variants:
- Split categories use partial sums. ก่ออิฐ is split into rows 178 (179–183) and 184 (conduit 184–186), so `S178=(SUM(K179:K183))/R178`, `U178=sum(L179:L183)`, `S184=(SUM(K184:K186))/R184`, `U184=sum(L184:L186)`. ฉาบปูน is split into rows 188 (189–191, which includes the wooden door frame row 191) and 193 (cables 193–196), so `S188=(sum(K189:K191))/R188`, `U188=sum(L189:L191)`, `S193=(SUM(K193:K196))/R193`, `U193=sum(L193:L196)`.
- Subcontract-style categories (labour column is 0) use 20% of the total as labour: `S233=(L243*0.2)/R233` (aluminium doors/windows) and `S278=(L280*0.2)/R278` (เบ็ดเตล็ด).
- Piles (row 34): O/P blank, Q=0, R=0, **S blank (no formula)**, T=1 typed, U=`=L36`.
- U31 = `=L32` (an item row, not the subtotal L33; same value). S31 = `=K33/R31`.
- Rows 8 (งานตรวจสอบที่ดิน) and 11 (งานเตรียมพื้นที่: demolition + fill): the planning cells exist but are empty, with no formulas. These categories are **not planned**.

**Planning blocks (sample values) and where they go in the S-Curve**
| MD hdr row | Category (B) | ช่าง O | คนงาน P | Rate set | R ฿/day | S formula basis | S calc | T est. | U budget | → S-Curve task |
|---|---|---|---|---|---|---|---|---|---|---|
| 15 | งานน้ำ-ไฟชั่วคราว | 1 | 1 | A | 1,300 | K17 | 1.15 | 1 | 8,000 | 1.1 (G uses BOQ Home M17 instead) |
| 18 | งานเตรียมพื้นที่หน้างาน | 1 | 5 | A | 3,300 | K30 | 1.97 | 2 | 55,400 | 1.2 |
| 31 | งานวางผัง / ปักหมุด | 1 | 1 | A | 1,300 | K33 | 1.15 | 1 | 5,500 | 1.3 |
| 34 | งานเสาเข็ม | – | – | A | 0 | (none) | – | 1 | 52,500 | 1.4 |
| 37 | งานฐานราก | 1 | 5 | A | 3,300 | K59 | 11.32 | 10 | 104,693.07 | 1.5 |
| 60 | งานเสาตอม่อ | 1 | 5 | A | 3,300 | K66 | 0.71 | 1 | 10,189.15 | 1.6 |
| 67 | งานคานคอดิน | 1 | 5 | A | 3,300 | K81 | 12.00 | 11 | 140,614.30 | 1.7 |
| 82 | งานพื้นหล่อในที่ | 1 | 5 | A | 3,300 | K95 | 4.42 | 4 | 55,173.03 | 2.1 |
| 96 | งานพื้นสำเร็จรูป | 1 | 5 | A | 3,300 | K105 | 2.84 | 3 | 50,751.15 | 2.2 |
| 106 | งานเสาชั้น 1 | 1 | 5 | A | 3,300 | K112 | 4.12 | 4 | 55,131.90 | 2.3 |
| 113 | งานคาน + พื้นดาดฟ้า | 1 | 5 | A | 3,300 | K135 | 6.35 | 6 | 82,961.78 | 2.4 |
| 136 | งานโครงสร้างบันได | 1 | 5 | A | 3,300 | K146 | 1.80 | 2 | 24,073.03 | 2.5 |
| 147 | งานเพลทหัวเสา | 1 | 1 | A | 1,300 | K150 | 1.62 | 2 | 9,450 | 3.1 |
| 151 | งานโครงหลังคา | 4 | 2 | B | 5,200 | K160 | 4.64 | 5 | 118,306.65 | 3.2 |
| 161 | งานมุงหลังคา | 4 | 2 | B | 5,200 | K177 | 5.45 | 5 | 89,702.15 | 3.3 |
| 178 | งานก่ออิฐ (items 1–5) | 5 | 3 | A | 5,500 | ΣK179:183 | 13.71 | 14 | 152,697.89 | 4.1 |
| 184 | ท่อร้อยสายไฟ (item 6) | 3 | 1 | B | 3,600 | ΣK184:186 | 4.14 | 4 | 29,351.57 | 4.2 (D typed 4.0, not linked) |
| 188 | งานฉาบปูน (items 1–3) | 5 | 3 | A | 5,500 | ΣK189:191 | 15.50 | 15 | 118,975.68 | 5.1 |
| 193 | สายไฟ (item 4) | 3 | 1 | B | 3,600 | ΣK193:196 | 3.72 | 4 | 46,451.49 | 5.2 |
| 198 | งานฝ้าเพดาน | 2 | 2 | B | 3,200 | K203 | 7.64 | 8 | 68,721.09 | 6.1 |
| 204 | งานปูกระเบื้องพื้น | 2 | 2 | A | 2,600 | K208 | 11.80 | 12 | 92,205 | 6.2 |
| 209 | งานปูกระเบื้องห้องน้ำ | 2 | 2 | A | 2,600 | K216 | 4.77 | 5 | 40,574.61 | 6.3 |
| 217 | งานตกแต่งผนัง | 1 | 1 | A | 1,300 | K221 | 3.63 | 4 | 15,693 | 6.4 |
| 222 | งานทาสีรองพื้น | 4 | 2 | B | 5,200 | K232 | 8.07 | 8 | 71,215.72 | 6.5 |
| 233 | งานประตู-หน้าต่างอลูมิเนียม | 3 | 1 | B | 3,600 | 0.2×L243 | 5.52 | 6 | 99,277.50 | 7.1 |
| 244 | งานทาสีจริง รอบที่ 1 | 4 | 2 | B | 5,200 | K253 | 4.17 | 4 | 36,583.80 | 7.2 |
| 254 | งานติดตั้งอุปกรณ์ไฟฟ้า | 3 | 1 | B | 3,600 | K271 | 4.47 | 5 | 47,520 | 8.1 |
| 272 | งานระบบสุขาภิบาล | 3 | 2 | A | 3,400 | K277 | 3.79 | 4 | 37,400 | 8.2 |
| 278 | งานเบ็ดเตล็ด | 3 | 1 | B | 3,600 | 0.2×L280 | 1.58 | 2 | 28,400 | 8.3 |
| 281 | งานสุขภัณฑ์ | 1 | 1 | A | 1,300 | K292 | 3.17 | 3 | 31,920 | 8.4 |
| 293 | งานประตู-หน้าต่างไม้ | 1 | 1 | A | 1,300 | K298 | 4.08 | 4 | 34,300 | 8.5 |
| 299 | งานทาสีรอบสุดท้าย | 4 | 2 | B | 5,200 | K308 | 4.17 | 4 | 36,583.80 | 8.6 |

There are 32 planning blocks, and they map 1:1 to the 32 S-Curve tasks. Σ T = 164 and Σ U = 1,850,317.34.

### 1.5 Outputs
- T{hdr} (estimated days) → S-Curve column D.
- U{hdr} (budget) → S-Curve column G.
- The sheet has no productivity rates (units/day). In v5, duration is driven by **labour cost ÷ crew wage**, not by quantity ÷ productivity.

---

## 2. Sheet 03 — S-Curve_Plan_Basic ("📈 โปรแกรม S-Curve _Basic")

### 2.1 Purpose
This is a plan-vs-actual schedule of 32 tasks grouped into 8 payment installments (งวดที่ 1–8). Each task's budget weight is spread over a weekly grid by calendar-day overlap. The sheet produces the weekly and cumulative % (the S-curve), monthly and cumulative cost, and simple progress KPIs.

### 2.2 Layout
| Area | Cells | Content |
|---|---|---|
| Title | B2, K2 | Title; "เพจผู้รับเหมาพันธุ์ใหม่ สงวนลิขสิทธิ์…" |
| Project KPIs (left) | B4:G7 | D4 project name (text input "บ้านพักอาศัย คสล 1 ชั้น"), D5 start, D6 finish, D7 budget. H4 "Back Home" link |
| Status KPIs (right) | J4:W7 | Q4 last update date, Q5 "งบประมาณตามแผน" (actually earned value), Q6 "งบที่ใช้ไป", Q7 "วันล่าช้า" text |
| Date axis | J9:BE10 | row 9 = week-bucket start date, row 10 = bucket end date |
| Header | B11:BF12 | B No. · C รายละเอียดงาน · D ระยะเวลา (วัน) · E วันเริ่ม (วันที่) · F วันเสร็จ (วันที่) · G งบประมาณ (บาท) · H (%) · I แผนงาน/ผลงาน · J..BE month header (row 11, merged per 4 cols) + week label W1..W4 (row 12) · BF "% คืบหน้า" |
| Body | rows 13–84 | 8 installment header rows plus 32 tasks × 2 rows (PLAN row + ACTUAL row) |
| Summary | rows 86–93 | F86 "แผนงาน" (plan) block rows 86–89, F90 "ผลงาน" (actual) block rows 90–93 |

Body structure:
- **Installment header rows** (coloured, B = "1.0"…"8.0", C = "งวดที่ N"): rows 13, 28, 39, 46, 51, 56, 67, 72. Colours are 118AB2, 06D6A0, FF9B54, EF476F, 0B5394, 76A5AF, 0B5394, 6D9EEB. D..I are empty. The weekly formula is present but evaluates to "".
- **Task pair**: PLAN row (white, I = "PLAN") followed by ACTUAL row (grey `FFF3F3F3`/`FFF6F8F9`, I = "ACTUAL"). B (No. "1.1") and C (name) are merged over the pair. BF is merged over the pair.
- The last ACTUAL row is 84.

Task list (PLAN row; sample dates):
| งวด | No. | Row | Task (C) | D source | D | E start (input) | F finish | G source | G |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1.1 | 14 | งานน้ำ-ไฟชั่วคราว | MD!T15 | 1 | 2026‑01‑10 | 01‑10 | **'BOQ (Home)'!M17** | 8,000 |
| 1 | 1.2 | 16 | งานเตรียมพื้นที่หน้างาน | MD!T18 | 2 | 01‑10 | 01‑11 | MD!U18 | 55,400 |
| 1 | 1.3 | 18 | งานวางผัง / ปักหมุด | MD!T31 | 1 | 01‑12 | 01‑12 | MD!U31 | 5,500 |
| 1 | 1.4 | 20 | งานเสาเข็ม | MD!T34 | 1 | 01‑13 | 01‑13 | MD!U34 | 52,500 |
| 1 | 1.5 | 22 | งานฐานราก | MD!T37 | 10 | 01‑22 | 01‑31 | MD!U37 | 104,693.07 |
| 1 | 1.6 | 24 | งานเสาตอม่อ | MD!T60 | 1 | 01‑24 | 01‑24 | MD!U60 | 10,189.15 |
| 1 | 1.7 | 26 | งานคานคอดิน | MD!T67 | 11 | 01‑25 | 02‑04 | MD!U67 | 140,614.30 |
| 2 | 2.1 | 29 | งานพื้นหล่อในที่ | MD!T82 | 4 | 02‑05 | 02‑08 | MD!U82 | 55,173.03 |
| 2 | 2.2 | 31 | งานพื้นสำเร็จรูป␠ (trailing space) | MD!T96 | 3 | 02‑09 | 02‑11 | MD!U96 | 50,751.15 |
| 2 | 2.3 | 33 | งานเสาชั้น 1 | MD!T106 | 4 | 02‑12 | 02‑15 | MD!U106 | 55,131.90 |
| 2 | 2.4 | 35 | งานคาน + พื้นดาดฟ้า | MD!T113 | 6 | 02‑16 | 02‑21 | MD!U113 | 82,961.78 |
| 2 | 2.5 | 37 | งานโครงสร้างบันได | MD!T136 | 2 | 02‑22 | 02‑23 | MD!U136 | 24,073.03 |
| 3 | 3.1 | 40 | งานเพลทหัวเสา | MD!T147 | 2 | 02‑24 | 02‑25 | MD!U147 | 9,450 |
| 3 | 3.2 | 42 | งานโครงหลังคา | MD!T151 | 5 | 02‑25 | 03‑01 | MD!U151 | 118,306.65 |
| 3 | 3.3 | 44 | งานมุงหลังคา | MD!T161 | 5 | 03‑02 | 03‑06 | MD!U161 | 89,702.15 |
| 4 | 4.1 | 47 | งานก่ออิฐ | MD!T178 | 14 | 03‑05 | 03‑18 | MD!U178 | 152,697.89 |
| 4 | 4.2 | 49 | งานติดตั้งท่อระบบไฟฟ้า | **typed 4.0** | 4 | 03‑18 | 03‑21 | MD!U184 | 29,351.57 |
| 5 | 5.1 | 52 | งานฉาบปูน | MD!T188 | 15 | 03‑21 | 04‑04 | MD!U188 | 118,975.68 |
| 5 | 5.2 | 54 | งานร้อยสายไฟฟ้า | MD!T193 | 4 | 04‑04 | 04‑07 | MD!U193 | 46,451.49 |
| 6 | 6.1 | 57 | งานฝ้าเพดาน | MD!T198 | 8 | 04‑05 | 04‑12 | MD!U198 | 68,721.09 |
| 6 | 6.2 | 59 | งานปูกระเบื้อง | MD!T204 | 12 | 04‑13 | 04‑24 | MD!U204 | 92,205 |
| 6 | 6.3 | 61 | งานปูกระเบื้องห้องน้ำ | MD!T209 | 5 | 04‑25 | 04‑29 | MD!U209 | 40,574.61 |
| 6 | 6.4 | 63 | งานตกแต่งผนัง | MD!T217 | 4 | 04‑30 | 05‑03 | MD!U217 | 15,693 |
| 6 | 6.5 | 65 | งานทาสีรองพื้น | MD!T222 | 8 | 05‑04 | 05‑11 | MD!U222 | 71,215.72 |
| 7 | 7.1 | 68 | งานประตู-หน้าต่างอลูมิเนียม | MD!T233 | 6 | 05‑12 | 05‑17 | MD!U233 | 99,277.50 |
| 7 | 7.2 | 70 | งานทาสีจริง รอบที่ 1 | MD!T244 | 4 | 05‑18 | 05‑21 | MD!U244 | 36,583.80 |
| 8 | 8.1 | 73 | งานติดตั้งอุปกรณ์ไฟฟ้า | MD!T254 | 5 | 05‑21 | 05‑25 | MD!U254 | 47,520 |
| 8 | 8.2 | 75 | งานระบบสุขาภิบาล | MD!T272 | 4 | 05‑21 | 05‑24 | MD!U272 | 37,400 |
| 8 | 8.3 | 77 | งานเบ็ดเตล็ด | MD!T278 | 2 | 05‑21 | 05‑22 | MD!U278 | 28,400 |
| 8 | 8.4 | 79 | งานสุขภัณฑ์ | MD!T281 | 3 | 05‑25 | 05‑27 | MD!U281 | 31,920 |
| 8 | 8.5 | 81 | งานประตู-หน้าต่างไม้ | MD!T293 | 4 | 05‑21 | 05‑24 | MD!U293 | 34,300 |
| 8 | 8.6 | 83 | งานทาสีรอบสุดท้าย | MD!T299 | 4 | 05‑28 | 05‑31 | MD!U299 | 36,583.80 |

Start dates are **typed by the user**. There are no predecessors, lags or dependency logic. In the sample, a task's start is either the previous finish + 1, the **same day** as the previous finish (3.2 starts on 3.1's finish, 4.2 on 4.1's, 5.1 on 4.2's, 5.2 on 5.1's), an overlap (4.1 starts before 3.3 ends), parallel (8.1/8.2/8.3/8.5 all on 05‑21), or a gap (1.5 starts 9 days after piles, 01‑13 → 01‑22, an implicit pile-curing wait).

### 2.3 INPUTS
| Cell / column | Label | Type | Default | Validation |
|---|---|---|---|---|
| D4 | ชื่อโครงการ | text | "บ้านพักอาศัย คสล 1 ชั้น" | – |
| E (PLAN rows) | วันเริ่ม | date | see table | custom validation on E14:F27, E29:F38, E40:F45, E47:F50, E52:F55, E57:F66, E68:F71, E73:F84 and E:I on installment header rows: `=OR(NOT(ISERROR(DATEVALUE(E14))), AND(ISNUMBER(E14), LEFT(CELL("format",E14))="D"))`, i.e. must be a date |
| D (ACTUAL rows) | actual duration (days) | number | row 15: 1.0; others blank | – |
| E (ACTUAL rows) | actual start | date | row 15: 2026‑01‑10 | date validation |
| G (ACTUAL rows) | actual cost spent (บาท) | number | row 15: 7,000; others blank | – |
| BF (merged per pair) | % คืบหน้า (task % complete, 0–1) | number | 0.0 | – |
| D49 | duration of 4.2 | number (typed, not linked) | 4.0 | – |

### 2.4 Computed fields
**Header KPIs**
| Cell | Excel | Plain language |
|---|---|---|
| D5 | `=E14` | project start = start of the first task (row 14). **This is not a separate input.** |
| D6 | `=F83` | project finish = finish of the last task row (8.6), not the MAX of all finishes |
| D7 | `=IFERROR(SUMIF(I:I,"PLAN",G:G),0)` | project budget = Σ PLAN budgets = 1,850,317.34 |
| Q4 | GSheets `=MAX(FILTER($F$14:$F$93, $I$14:$I$93="ACTUAL", ISNUMBER($F$14:$F$93)))` | last update date = latest actual finish date (2026‑01‑10) |
| Q5 | `=(LET(done,$BF$14:$BF$84, wt,$H$14:$H$84, SUMPRODUCT(IFERROR(done*1,0), IFERROR(wt*1,0))))*D7` | labelled "งบประมาณตามแผน", but it is the **earned value** Σ(%complete × weight) × budget (0 in the sample) |
| Q6 | `=(IF($Q$4="","", IFERROR(INDEX($J$91:$BE$91, MATCH($Q$4,$J$9:$BE$9,1)),"")))*D7` | "งบที่ใช้ไป" = cumulative ACTUAL % at the week bucket containing Q4 × budget (7,000) |
| Q7 | GSheets LET: `planDate = INDEX(F14:F84, MATCH(MAX(FILTER(ROW(I14:I84), I14:I84="ACTUAL", ISNUMBER(F14:F84))), ROW(F14:F84),0) − 1)`; `diff = planDate − Q4`; `>0 → "เร็วกว่าแผน "&diff&" วัน"`, `<0 → "ช้ากว่าแผน "&−diff&" วัน"`, else `"ตรงตามแผน"` | Take the **last ACTUAL row (by row position)** that has a finish date. Compare its PLAN finish (the row above) with Q4. Positive = ahead, negative = late. |

**Task rows**
| Col | Excel | Plain language |
|---|---|---|
| D (PLAN) | `='Man-Day_Basic'!T{hdr}` | duration = Man-Day estimated days |
| F (PLAN and ACTUAL) | `=IF(OR(E="", D=""), "", E+D-1)` | finish = start + duration − 1, **in calendar days** (no weekends or holidays skipped) |
| G (PLAN) | `='Man-Day_Basic'!U{hdr}` (G14 = `'BOQ (Home)'!M17`) | task budget |
| H (PLAN and ACTUAL) | `=G/$D$7` | weight = budget ÷ project budget. ACTUAL rows give actual cost ÷ budget (shown as 0 when G is blank). |

**Date axis (columns J..BE = 48 buckets = 12 months × 4)**
| Cell | Excel | Plain language |
|---|---|---|
| J11 (every 4th col, merged ×4) | `=TEXT(EDATE(DATE(YEAR($E$14),MONTH($E$14),1), INT((COLUMN()-COLUMN($J$11))/4)), "mmm-yy")` | month label, starting at the month of the first task's start ("ม.ค.-26" … "ธ.ค.-26") |
| J12 | `="W"&MOD(COLUMN()-COLUMN($J$12),4)+1` | W1..W4 |
| J9 | `=EDATE(DATE(YEAR($E$14),MONTH($E$14),1), INT((COLUMN()-COLUMN($J$11))/4)) + CHOOSE(MOD(COLUMN()-COLUMN($J$12),4)+1, 0, 7, 15, 22)` | bucket start = 1st of the month + {0, 7, 15, 22}. **W1 = day 1, W2 = day 8, W3 = day 16, W4 = day 23.** |
| J10 | `=J9 + CHOOSE(MOD(COLUMN()-COLUMN($J$12),4)+1, 7, 8, 7, DAY(EOMONTH(<month>,0)) - 22) - 1` | bucket end: W1 = 1–7, W2 = 8–15, W3 = 16–22, W4 = 23–end of month (6–9 days). Display only; the grid formula uses row 9. |

So a "week" is **a quarter of a calendar month**, not a 7-day week from project start. Buckets have 7, 8, 7 and 6–9 days.

**Weekly grid (J..BE on every task row, PLAN and ACTUAL; same formula, also present but blank on installment header rows)**
```
=IF(OR($E13="",$F13="",$H13="",$D13<=0),"",
  LET(wkStart, J$9,
      wkEnd,   IFERROR(K$9-1, J$9+6),
      tStart,  $E13, tEnd, $F13, dur, $D13,
      pct,     IF($H13>1,$H13/100,$H13),
      ov,      MAX(0, MIN(wkEnd,tEnd) - MAX(wkStart,tStart) + 1),
      share,   pct * ov / dur,
      IF(ov=0, "", MIN(1, MAX(0, share+1E-12)))))
```
In plain language: the cell value is `weight × (calendar days of the task inside this bucket) ÷ duration`. It is blank when there is no overlap. The bucket end is the next bucket's start − 1. In the last column BE the reference to the next column is `#REF!`, so the fallback `BE9+6` is used. If the weight was typed as a percentage (>1) it is divided by 100. The result is clamped to [0,1].

**Summary rows (J..BE)**
| Row | Label (G) | Excel | Plain language |
|---|---|---|---|
| 86 | แผนงาน – ความคืบหน้า/สัปดาห์ (%) | `=SUMIF($I$14:$I$84,"PLAN",J14:J84)` | planned % in the bucket |
| 87 | ความคืบหน้าสะสม/สัปดาห์ (%) | J87 `=J86`; K87 `=J87+K86` … | cumulative planned % (the **S-curve**). Reaches 100% at AC (May W4). |
| 88 | ค่าใช้จ่าย/เดือน (บาท) (merged ×4) | `=(sum(J86:M86))*$D$7` | planned cost per month |
| 89 | ค่าใช้จ่ายสะสม/เดือน (บาท) (merged ×4) | `=M87*$D$7` (W4 col of that month) | cumulative planned cost at month end |
| 90 | ผลงาน – ความคืบหน้า/สัปดาห์ (%) | `=SUMIF($I$14:$I$84,"ACTUAL",J14:J84)` | actual % in the bucket (cost-weighted: actual cost ÷ budget spread over the actual dates) |
| 91 | ความคืบหน้าสะสม | J91 `=J90`; K91 `=J91+K90` | cumulative actual % |
| 92 | ค่าใช้จ่าย/เดือน | `=(sum(J90:M90))*$D$7` | actual cost per month |
| 93 | ค่าใช้จ่ายสะสม/เดือน | `=M91*$D$7` | cumulative actual cost |

Sample planned monthly cost: Jan 325,764 · Feb 423,319 · Mar 382,662 · Apr 283,602 · May 434,971. Cumulative: 325,764 / 749,083 / 1,131,744 / 1,415,347 / 1,850,317.

### 2.5 Outputs
- PLAN weekly shares per task (J..AC used in the sample) → CashFlow rows 21–52.
- Row 11/12 labels → CashFlow headers.
- D5, D6 → CashFlow AA2 (duration). The workbook has no chart objects in the dump. The "S-curve" is rows 87/91; the rebuild should chart them.

---

## 3. Sheet 04 — CashFLOW_Basic ("โปรแกรมวางแผนการเงิน (Project Cash-FLOW) 💰")

### 3.1 Purpose
This is a weekly cash-flow plan for the contractor. Cash-IN is the client's installments, as % of the quotation, placed in chosen weeks. Cash-OUT is construction cost distributed by the S-Curve plan plus 15% operating cost. It shows the cumulative cash position and a small EVM (earned value) dashboard.

### 3.2 Layout
| Area | Cells | Content |
|---|---|---|
| Header | A1, F1, K1 | title, copyright "© 2025", "Back Home" link |
| Prices | C2:N2 | C2 "ต้นทุนก่อสร้าง Construction Cost >>" D2 (merged D2:F2) · J2 "เสนอราคาลูกค้า Quotation >>" K2 (merged K2:M2) |
| Cash-IN header | A4:W5 | A4 งวดที่ · B4 งวด % · C4 รายรับ - Cash IN · D4.. month labels (merged ×4) · D5..W5 W1..W4 |
| Cash-IN rows | 6–14 | deposit + งวดที่ 1–8 |
| Totals | 15–18 | 15 รวมรายรับ, 16 รวมรายจ่าย, 17 รวมรับ-รายจ่าย (ต่อสัปดาห์), 18 cumulative "Cash FLOW" |
| Cash-OUT header | A19:W20 | งวดที่ · งวด % · รายจ่าย - Cash OUT · months · weeks |
| Cash-OUT rows | 21–52 (53 spare) | 32 tasks grouped by งวด (A/B merged per group) |
| Cost totals | 54–59 | 54 % · 55 cost ฿ · 56 15% opex · 57 cost + opex · 59 15% profit |
| Finance Dashboard | X1:AE18 + Y19:Z53 | "💵Finance Dashboard (สำหรับ ADVANCE)", EVM metrics; Y21:Y53 per-task % complete, Z21:Z53 per-task EV |

**Time axis**: columns D..W = **20 buckets = 5 months (Jan–May 2026) × W1..W4**. They map 1:1 to S-Curve J..AC (D↔J, E↔K, …, W↔AC). Labels: D4 `=INDEX('S-Curve_Plan_Basic'!$J$11:$ZZ$11,1,COLUMN(A1))`, H4 …COLUMN(E1) etc. D5 `=INDEX('S-Curve_Plan_Basic'!$J$12:$ZZ$12,1,COLUMN(A1))` … W5 COLUMN(T1). Rows 19/20 are the same. The width is **fixed at 20 columns**. It does not grow with the project.

### 3.3 INPUTS
| Cell | Label | Type | Default | Notes |
|---|---|---|---|---|
| B6 | มัดจำทำสัญญา % | % (yellow) | 0.20 | |
| B7:B14 | งวดที่ 1–8 % | % (yellow) | 0.10 each | Σ B6:B14 = 100% |
| C6:C14 | installment label | text (yellow) | "มัดจำทำสัญญา", "งวดที่ 1 " … "งวดที่ 8" | |
| D6:W14 | placement grid (all yellow) | the user types `=B{r}*$K$2` into the week cell when the installment is billed | sample placement: deposit D6 (Jan W1), งวด1 H7 (Feb W1), งวด2 K8 (Feb W4), งวด3 L9 (Mar W1), งวด4 P10 (Apr W1), งวด5 S11 (Apr W4), งวด6 U12 (May W2), งวด7 V13 (May W3), งวด8 W14 (May W4) | each amount = 240,541.25 (10%) or 481,082.51 (deposit) |
| Y21:Y53 | % complete per task (for EV) | 0–1 (yellow) | 1.0 for rows 21–33, 0.6 for 34 (โครงหลังคา), 0 for the rest | separate from S-Curve BF |
| Z18 | Actual Cost (AC) | ฿ (red fill `FFFF0000`, typed) | 850,000 | manual |

### 3.4 Computed fields
**Prices**
| Cell | Excel | Plain language |
|---|---|---|
| D2 | `='BOQ (Home)'!M310` | construction cost = BOQ grand total (1,850,317.34) |
| K2 | `=D2*1.3` | quotation = cost × 1.3 (30% markup = 15% opex + 15% profit). **No VAT, contingency or retention.** |
| AA4 | `=D2*1.15` | budget incl. operating cost (BAC for EVM) = 2,127,864.95 (no label) |

**Cash-IN**
| Cell | Excel | Plain language |
|---|---|---|
| amount cells | `=B{r}*$K$2` | installment % × quotation, in the chosen week |
| Row 15 | D15 `=SUM(D6:D13)`; E15..W15 `=SUM(E6:E14)` pattern | total cash-in per week (D omits row 14; harmless) |

**Cash-OUT (rows 21–52)**
| Cell | Excel | Plain language |
|---|---|---|
| C21:C52 | typed task names, which must equal S-Curve column C exactly | e.g. "งานพื้นสำเร็จรูป " (trailing space) |
| D..W (each task row) | `=IFERROR(INDEX('S-Curve_Plan_Basic'!$J:$ZZ, MATCH($C21,'S-Curve_Plan_Basic'!$C:$C,0), COLUMN(A1)), "")` | planned weekly share of the task (from its PLAN row, the first MATCH) |
| A/B (merged per งวด group) | A = งวด no.; B `=sum(D21:W27)` (group 1), `=sum(D28:W32)`, `D33:W35`, `D36:W37`, `D38:W39`, `D40:W44`, `D45:W46`, `D47:W52` | the group's share of cost. Sample: 20.4%, 14.5%, 11.8%, 9.8%, 8.9%, 15.6%, 7.3%, 11.7%. Not linked to the income % in B6:B14. |
| B54 | `=SUM(B21:B53)` | 100% check |
| Row 54 | `=SUM(D21:D53)` … | planned % per week (= S-Curve row 86) |
| Row 55 | `=D54*$D$2` | construction cost per week |
| Row 56 | `=D55*15%` | ค่าใช้จ่ายดำเนินงาน 15% (operating cost) |
| Row 57 | `=D55+D56` | cost + operating |
| Row 59 | `=D55*15%` | กำไร 15% (profit) per week |
| Row 16 | `=D55+D56` | รวมรายจ่าย (total cash-out) per week |
| Row 17 | `=D15-D16` | net per week |
| Row 18 | D18 `=D17`; E18 `=D18+E17` | cumulative cash position. Sample min −115,556 at R (Mar W3); ends at +277,547.60 (= 15% of cost). |

**Finance Dashboard (EVM)**
| Cell | Label | Excel | Sample |
|---|---|---|---|
| AA2 | Duration (Plan) (วัน) | `='S-Curve_Plan_Basic'!D6-'S-Curve_Plan_Basic'!D5+1` | 142 |
| AA4 | (budget, unlabelled) | `=D2*1.15` | 2,127,864.95 |
| AA6 | Plan Value (PV) "(end of Week 7)" | `=sum(D57:K57)`, a **hard-coded** status range (Jan W1…Feb W4; project week 7 if counted from Jan W2) | 861,445.14 |
| Z21:Z53 | per-task EV | `=Y21*((sum(D21:W21))*$AA$4)` | % complete × task weight × BAC |
| Z19 | Earned Value (EV) | `=SUM(Z21:Z53)` | 834,234.61 |
| Z18 | Actual Cost (AC) | input | 850,000 |
| AA7 | Schedule Variance EV−PV | `=Z19-AA6` | −27,210.53 |
| AA8 | Cost Variance EV−AC | `=Z19-Z18` | −15,765.39 |
| AA9 | SPI EV/PV | `=Z19/AA6` | 0.968 |
| AA10 | CPI EV/AC | `=Z19/Z18` | 0.981 |
| AA11 | Estimated Time at Completion = Duration/SPI | `=AA2/AA9` | 146.6 days |
| AA12 | Cost Estimate at Completion = Budget/CPI | `=AA4/AA10` | 2,168,077.39 |
| AA13 | (VAC, unlabelled) | `=AA4-AA12` | −40,212.45 |
| AA14 | Net Profit (Plan) | `=SUM(D59:W59)` | 277,547.60 |
| AA15 | Net Profit (Forecasting) | `=SUM(D59:W59)+AA13` | 237,335.15 |
| Y55 | Total Plan Value check | `=sum(D21:W53)` | 1 (100%) |

### 3.5 Outputs
The sheet is terminal; nothing reads it. Its visible outputs are the cash-flow table (rows 15–18), the cost table (54–59) and the dashboard.

---

## 4. Today's app vs Excel

1. **Man-Day method differs.** The app (`ManDayTable`, `schedule-engine.calcAdjustedDays`, `schedule-data.ts` "คู่มือ 4") computes days as `ceil(qty ÷ (productivityRate × crews))`, adds a weather buffer, and computes man-days = crews × (skilled + labourers) × days. v5 Excel has **no productivity rates**. It computes `days = labour cost of the category ÷ (800·ช่าง + 500·คนงาน)` (or 1000/600), then the user types the estimated days (T). The Excel also shows the category budget U; the app's Man-Day has no wage or budget.
2. **Task list differs.** The app has 35 steps (stepId 0–32+), including land survey, earthwork and site camp, from the v2.3 era. Excel v5 plans 32 tasks in 8 งวด. It excludes land survey and demolition/fill, and splits conduit (4.2) and cables (5.2) out of masonry and plaster.
3. **Scheduling logic differs.** The app derives start days from a dependency graph (`dependsOn`, `parallelWith`, `curingDays`, `leadPercent`, critical path). Excel uses **typed start dates per task** and finish = start + D − 1 in calendar days. Excel has no predecessors, lags, critical path or working-day calendar.
4. **Time axis differs.** The app counts "day N" from a start date and makes weeks of 7 days (`ceil(day/7)`). Excel uses absolute dates and **4 buckets per calendar month** (1–7, 8–15, 16–22, 23–EOM), with 12 months on the S-Curve and only 5 months (20 buckets) on the CashFlow.
5. **Weekly distribution differs.** The app spreads each step's cost **evenly per week** between start and end weeks. Excel distributes by **calendar-day overlap** (`weight × overlapDays ÷ duration`), so partial weeks get partial shares.
6. **Plan/actual tracking is missing in the app.** The app has none: no ACTUAL rows, % complete, last-update date, delay text, spent-to-date or cumulative actual curve. Excel has all of these, plus the EVM dashboard (PV, EV, AC, SV, CV, SPI, CPI, EAC time and cost, VAC, forecast profit).
7. **Quotation formula differs.** The app (`cashflow-engine`) uses cost + contingency 5% + overhead 5% + fixed ฿15,000/month + profit 15% + **VAT 7%**. Excel uses **cost × 1.3**, with no VAT, contingency or fixed overhead.
8. **Installments differ.** The app default is a 30% deposit + 6×10% + 2×5% with `triggerWeek`, which are the v2.3 values. Excel v5 has a **20% deposit + 8 × 10%**, each placed in a chosen month-week cell (sample: Jan W1, Feb W1, Feb W4, Mar W1, Apr W1, Apr W4, May W2, May W3, May W4).
9. **Cash-out formula differs.** The app's cash-out = construction cost (shifted by a 15-day credit term) + 5% variable + fixed overhead + contingency/week + VAT remittance. Excel's cash-out = weekly construction cost × 1.15 (a flat 15% operating cost). Excel has no credit-term shift and no VAT. Excel also shows profit = 15% of cost per week.
10. **Cost source differs.** The app takes per-step cost from `buildBOQSections` per stepId. Excel takes per-task budget from Man-Day U (category totals, with the splits in §1.4) and the total cost from BOQ Home M310.

---

## 5. Oddities needing a decision

1. **Man-Day duplicates BOQ instead of linking.** Its unit prices and waste % are separate typed inputs. If the user edits BOQ Home prices, Man-Day budgets (and therefore the S-Curve and its weights) go stale. CashFlow D2 still uses BOQ Home, so the two totals can disagree. *Recommendation:* the app should drive Man-Day from the single BOQ data model.
2. **Hard-coded wages** (800/500 vs 1000/600) are buried in the R formulas, and the choice of set per category is arbitrary. Should the app make them configurable per category, or globally?
3. **Calculated vs estimated days.** S is the calculation and T is a free input; only T flows downstream. Should the app default T to `ROUND(S)` (sample T ≈ round(S), except 1.5: S=11.32→T=10 and 1.7: 12.0→11), or keep T as free input?
4. **Piles (row 34)**: crew 0 and S has no formula; T = 1 is typed. Aluminium (233) and misc (278) use "20% of total as labour". These special cases need an explicit rule.
5. **S-Curve exceptions:** task 1.1's budget comes from `'BOQ (Home)'!M17`, not Man-Day U15 (same value today). Task 4.2's duration is typed (4.0) instead of `='Man-Day_Basic'!T184`. Treat both as bugs and link them consistently?
6. **Project start = first task's start (E14)**, and the axis anchors to E14's month. **Project finish = F83 (the last row)**, not MAX(finish). If a parallel task ends later, D6 and CashFlow AA2 are wrong.
7. **Calendar days only.** There are no Sundays or holidays, although durations come from labour-days. Should the app keep calendar days for parity?
8. **Week buckets are month quarters** (7/8/7/6–9 days), while the CashFlow dashboard says "Week 7". The last S-Curve column BE uses `#REF!` → the fallback BE9+6, so Dec 29–31 is lost. Keep the month-quarter buckets for parity, or move to real weeks?
9. **The CashFlow axis is fixed at 20 buckets (5 months).** Any plan longer than May is silently dropped from the cash-out, and row 54 then sums to under 100%. The app should size the axis to the project.
10. **CashFlow row 26 (งานเสาตอม่อ) formula bug.** K26 uses `COLUMN(#REF!)` (→ ""), and L26 uses `COLUMN(H7)`, so it duplicates week 8 instead of week 9. It has no effect in the sample, but it would double-count if the task spanned those weeks. **Row 29 (งานพื้นสำเร็จรูป ) has the same bug:** R29 uses `COLUMN(P10)` and so reads week 16 instead of 15, and S29 uses `COLUMN(#REF!)` (→ ""). Week 15 is lost and week 16 is read in R. This also has no effect in the sample, because the task sits in Feb W2. Every other D..W cell in rows 21–53 has the correct column offset.
11. **CashFlow links tasks by exact name MATCH** (trailing spaces matter). Renaming a task in the S-Curve breaks the link and returns "". The app should use IDs.
12. **Two separate "% complete" inputs**: S-Curve BF (used by Q5) and CashFlow Y21:Y53 (used by EV). Sample: BF is all 0, while Y has 1.0/0.6. Should there be one progress source?
13. **S-Curve Q5 is labelled "งบประมาณตามแผน" (planned budget) but computes earned value.** The "actual" curve (rows 90–93) is weighted by actual **cost** ÷ budget, not by physical progress. Q7's delay picks the last ACTUAL row by row position, not by date.
14. **EVM inconsistencies:** PV (AA6) is a hard-coded range D57:K57 "(end of Week 7)", not tied to the S-Curve last-update date Q4. AC (Z18) is typed, not taken from the S-Curve actual costs (Q6 = 7,000 vs Z18 = 850,000). Budget bases mix: PV and EV use cost × 1.15, but AC is raw spend.
15. **Installment placement is manual and not tied to งวด completion.** In the sample, งวด 1–3 and 6–8 are billed in the bucket where the group's last task finishes, but งวด 4 (finishes Mar 21 → Mar W3) is billed Apr W1 and งวด 5 (Apr 7 → Apr W1) is billed Apr W4. Should the app auto-place at completion (+ optional lag), or keep manual week selection? Also, the income % per งวด (10%) is independent of the cost share per งวด (B21…: 7–20%).
16. **Land survey ฿7,500 is excluded** from every total (BOQ M310, Man-Day L310, S-Curve, CashFlow). Intentional (client pays separately?) or a bug?
17. **Markups are hard-coded constants**: quotation ×1.3, opex 15%, profit 15%, BAC ×1.15. There is no VAT, retention or advance-payment recovery. Should the app expose these as settings (defaulting to the Excel values) and leave VAT out for parity?
18. **Man-Day T310 = 164 "รวมเวลา"** is a sum of task days, while the S-Curve calendar duration is 142 days (overlaps and parallels). The UI should label it clearly.

---

## 6. Verification (shared formulas)

Re-checked against the regenerated v5 dump, which now prints shared formulas as `=SHARED(si=N, master CELL: …)`, using the fill colours. The number-format inference in the Conventions turned out to be correct for every cell called an input here. No input in sheets 02, 03 or 04 is a shared formula.
- **Sheet 02:** the 640 shared cells are only in G, I, K, L and U310.
- **Sheet 03:** they are only in F, H and the J..BE grid and summary rows.
- **Sheet 04:** they are only in the computed rows 15–18 and 54–59 and in Z22:Z53. The D..W lookups in rows 21–53 are each written out explicitly, which is why individual cells can carry wrong offsets.

**What changed in this spec**
- §1.3 K: "13 rows `=J*G`" became **18 rows**. The 5 shared copies K85, K86, K194, K195 and K214 had been missed. The full row list is now given.
- §1.3 G: the CEILING step is `0.25`, not `1`. The rows for each variant are listed. The `=(G)*0.03` tie-wire variant was added, and the tie-wire G cells are noted as yellow-filled formulas.
- §1.3 consumables H: the rate is not always 15%. Rows 87 and 215 use **50%**. The I rows that use `=H*D` are now named.
- §1.3 subtotal L: it is `=SUM(L…)` (a shared copy of the K subtotal), not `I+K`. The range mismatches on rows 95, 216 and 243 were added. The consequence is that Man-Day S82 and S209 (calculated days) exclude the waste-pipe and water-pipe labour (K84:K86 and K213:K214), while U82 and U209 include their cost.
- §1.3 inputs: the full list of typed D cells is given (D32 and D148–D149 were added).
- §1.4 U310: it is a formula, `=SUM(U8:U308)` (a shared copy of T310), not a value.
- §5 item 10: a second, unreported CashFlow column-offset bug on **row 29** (R29 `COLUMN(P10)`, S29 `COLUMN(#REF!)`) was added. A scan of every D..W cell in rows 21–53 found only rows 26 and 29 wrong.

**Confirmed unchanged**
- Man-Day planning block: O, P and T are yellow typed inputs. Q, R, S and U are explicit formulas on every header row, as tabled. S34 is blank. Rows 8 and 11 are empty.
- S-Curve: E (PLAN) is yellow typed, and D49 is typed `4.0`. ACTUAL D/E/G are typed (grey). F and H on rows 15–84 are shared copies of the F14/F29/… and H14/H29/… masters, one master per งวด. The weekly grid formula is the same on every row 13–84, and BE keeps `#REF!` → fallback. Rows 86–93 match.
- CashFlow: B6:B14, C6:C14, Y21:Y53 and the placement cells (`=B{r}*$K$2`, yellow) are inputs, and Z18 is typed. Rows 15–18 and Z22:Z53 are shared copies of the documented masters.
