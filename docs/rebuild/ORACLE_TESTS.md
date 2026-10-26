# Oracle tests: differential testing against the real Excel formulas

The golden tests (`<id>.test.ts`) check `compute(defaults())` against the values cached in the Excel sample:
**one** input set. An oracle test evaluates the workbook's real formulas on **many** inputs (~50 seeded random
sets + named edge cases) and compares them with `computeProject`. The owner's rule is that formulas must never be
wrong, and this is how we check it.

Worked examples (copy them):
- `src/domain/calculators/footing/footing.oracle.test.ts`: a table with 11 Excel rows, per-row and per-size outputs, a BOQ slot (rebar rows), and the D1/D5 deltas.
- `src/domain/calculators/brick/brick.oracle.test.ts`: rows whose formula depends on their position, a dependency on another calculator (door-window openings), the D1 delta, and outputs that feed another sheet (plaster).

## The pieces

| File | What |
|---|---|
| `scripts/excel/fixtures/v5.xlsx` | Read-only copy of the owner's Training Edition v5 workbook |
| `src/test-utils/excel-oracle.ts` | The oracle: exceljs loads every sheet, and HyperFormula evaluates them |
| `src/test-utils/oracle-helpers.ts` | `seededRandom`, `expectClose`, `expectBoqRow`, `boqItem`, `expectCleanSelfTest` |
| `src/test-utils/excel-oracle.test.ts` | Rewrite unit tests, the calculator-scope self-test, and a guard that no app module imports the oracle |
| `src/test-utils/excel-oracle.slow.test.ts` | The whole-workbook self-test: 9,449 of 9,449 formula cells match the cached values |

The test-utils are **test-only**. App code must never import them or `hyperformula`; the guard test fails if it does.
HyperFormula is GPLv3/commercial. We use it only as a devDependency in tests, never shipped, with `licenseKey: 'gpl-v3'`.

### Oracle API

```ts
const oracle = await loadV5Oracle();          // once per file, in beforeAll(…, 120_000); cached per file
oracle.replaceInputs({ 'ฐานราก_Footing!C8': 21, 'ฐานราก_Footing!O8': 'DB12', 'ฐานราก_Footing!C9': null });
oracle.num("BOQ (Home)!E38");                 // number (empty → 0; throws on text/error → mapping bugs surface)
oracle.get("BOQ (Home)!D43");                 // number | string | boolean | null | { error: '#SPILL!' }
oracle.evaluate("=SUMIFS('ประตู-หน้าต่าง_Door&Window'!K:K, …)");   // ad-hoc Excel expression
oracle.frozenPrecedents(ref);                 // [] = fully live (assert it for the cells you compare)
oracle.reset();                               // back to the workbook
```

- `setInputs` adds to the current inputs. `replaceInputs` resets and sets in one recalculation, so use it per case.
- Refs are `Sheet!A1`. Sheet names are verbatim, including trailing or leading spaces (`'ทาสี_Paint '`).
- `setInputs` refuses a cell whose formula reads other cells, because that means your mapping is wrong. A typed constant formula such as `=9.5+7+…` (brick E5) may be overwritten.
- `null` empties a cell. Text is stored trimmed (see "Semantics" below).
- Scope: `loadV5Oracle()` loads BOQ (Home) and every calculator sheet, but not Man-Day, S-Curve or CashFlow. Those sheets only read the BOQ, and leaving them out makes a recalculation take about 5 ms instead of 2.5 s. Use `loadV5Oracle('all')` only if you test the planning sheets. Loading takes about 3 s (calculators) or about 10 s (all).

## Writing an oracle test for calculator `<id>`

File: `src/domain/calculators/<id>/<id>.oracle.test.ts`. Use the raw dump `%TEMP%\ctrv2\v5\sheetNN.txt` to find the cells.

1. **Input mapping (`excelInputs(input)`)**: map every input field to its yellow cell (`FFFFF2CC`).
   - Tables: map field to column, and row `i` to Excel row `first + i`. **Clear every unused table row** (set it to `null`) so the previous case cannot leak into the next one.
   - Respect Excel's limits. If your input has more rows than the Excel table, the generator must not produce it, and `excelInputs` throws.
   - Watch for position-dependent formulas. In the brick sheet, rows 5–7 compute `E*F` and rows 8–20 compute `0.5*E*F`, so a wall's shape decides its row. Map the input to the row whose formula matches it.
   - Dropdown values must be the exact Excel option text, and percentages are fractions (10 % is `0.1`).
   - Another calculator's outputs, such as the brick sheet's openings from door-window, stay at the sample on both sides. Vary them in that calculator's own oracle test.
2. **Output mapping (`excelValueOf(key)`)**: give **every** key that `compute()` returns an Excel cell or expression. Loop over `Object.keys(outputs)` and fail on unmapped keys, so a new output cannot go unchecked. List keys with no Excel cell in `NOT_IN_EXCEL` with a reason, and check them another way (for example, `rows` equals `input.rows.length`).
   - Per-row results: compare the helper (`footingRow(r)`) with the Excel columns of that row. Also check that unused rows stay 0.
   - Derived cells are fine. For example, the app's `backfillGross` is `AI + pedestal!V`.
3. **BOQ rows**: for every BOQ (Home) row your sheet feeds, call `expectBoqRow(oracle, res.boq, 'R38', 38)`. It compares E, H, J, L and M. Include the rows derived from yours (ไม้คร่าว/ตะปู = 0.6 / 0.25 × ไม้แบบ) and the section subtotal (J/L/M of the `รวม >>` row).
4. **App side**: run the real project with the full registry, so deps and links are real:
   ```ts
   const p = createProject(); p.calculators['<id>'] = input; const res = computeProject(p);
   res.calcOutputs['<id>'];   res.boq;
   ```
5. **Inputs**: create `seededRandom(seed)` with fixed seeds (`[\`random #${k} (seed ${base + k})\`, randomInput(base + k)]`) and make about 50 cases. Use plausible ranges with plan dimensions on a 0.05 m grid (`rng.step`), and bias the choices so every branch runs: dropdown options, empty and zero values, shared keys, and full tables. Also add named cases: the Excel sample, an empty input, and one case per D1/D5 branch. Then add a **coverage test** that asserts the case set really hits every branch (see both examples).
6. **Liveness**: assert `oracle.frozenPrecedents(ref)` is `[]` for the cells you compare, so a frozen fallback cannot fake a pass.

## Tolerance policy

- Use `expectClose` / `closeTo`: |app − Excel| ≤ max(1e-6, 1e-9·|Excel|). The relative part exists because the cached xlsx values have about 10 significant digits. Never loosen it in a test.
- Rounding boundaries (ROUNDUP, CEILING, MAX(1,…)) are where real differences hide. If a case differs by exactly one rounding step, find out which side is right before doing anything else. Example: `(0.75+0.6)/0.15` is 9.000000000000002 in IEEE arithmetic. Excel rounds the argument of ROUND/ROUNDUP/ROUNDDOWN to 15 significant digits and gets 9, as the app's `roundUp` does. Raw HyperFormula gave 10, so the oracle now wraps the argument in `PRECISE15()`.
- Text compares trimmed. Blank equals `""`. Errors compare by code.

## D1 / D5 handling: assert the delta, never skip

Decision D1 fixes clear Excel bugs on purpose, and D5 gives tables and BOQ slots unlimited rows. When the app differs from Excel for one of these reasons:

- **Keep the comparison and make it narrow.** Use the exact comparison whenever the decision does not apply. Branch only on the condition that triggers the fix, such as a shared opening group, Excel's fixed rebar rows, or zero concrete.
- **Assert the documented delta, computed from first principles**: `app − Excel == delta`, never a "close enough". Name the decision in a comment and point to where it is documented (code comment, `KNOWN_DELTAS` in `project-golden.test.ts`, or the spec file).
- Examples:
  - Brick D1: Excel subtracts an opening group from **every** row that shares part, brick and thickness, while the app subtracts it once. The test asserts that Excel H equals the whole group, that the app's shares add up to one group, and that `app E179 − Excel E179 = Σ (rows in group − 1) × group`.
  - Footing D1: with no concrete, Excel still orders `MAX(1, CEILING(0, 0.25))` = 1 m³. The app gives 0, so the asserted delta is −1 × I58.
  - Footing D5: Excel's two rebar rows hold the first two sizes with the waste typed for the sample (9 %, 12 %), while the app uses one row per size with that size's waste. The test asserts `ΔJ = E × (app waste − Excel waste) × 25`. With three or more sizes, Excel's FILTER spill fails (`#SPILL!`, shown as #REF! in Google Sheets) and the footing rebar drops out of the Excel BOQ. The test asserts that, and that section 6 differs by exactly the rebar-block delta.

## When you find a real mismatch

If the difference is not a documented D1/D5 decision, **do not change the domain code and do not weaken the test**. Add the case as
```ts
it.fails('row 3 stirrups: Excel 10, app 9 — inputs {…}; see report', () => { … the exact comparison … });
```
(or `it.todo` with the same note). Put the inputs, the Excel value and the app value in the name or comment. Then report it to the coordinator. If you believe the **oracle** is wrong (an Excel or Google Sheets semantic HyperFormula lacks), prove it with the self-test or a cached value, fix it in `excel-oracle.ts` with a rewrite unit test, and say so in your report.

## Semantics of the oracle (read before you trust it)

The workbook was built in **Google Sheets** and exported. The cached values are Google Sheets results, and the oracle reproduces them:

- `IFERROR(__xludf.DUMMYFUNCTION("…"), cached)` cells are evaluated with their Google Sheets formula (FILTER, TRANSPOSE, REGEXEXTRACT, LET), not frozen. Array results are written into the anchor and its `COMPUTED_VALUE` cells. If a result is longer than the Excel rows reserved for it, the anchor becomes `#SPILL!`, and `oracle.spillOverflows` lists it.
- Rewrites applied to every formula: shared formulas are re-expanded (exceljs shifts text inside strings: `"RB6"` became `"RB7"`); LET is substituted; `INDEX(r, k, 0)` and `INDEX(oneRow, n)`; an empty criterion cell counts as 0; ROW/COLUMN of a range becomes an array; `1E-12`; and the 15-digit rounding described above.
- Google Sheets behaviour the cached values rely on, which **real Excel does not have**:
  - Text matching ignores trailing spaces. `"บานอลูมิเนียม "` matches `"บานอลูมิเนียม"` in FILTER and SUMIF, so the oracle trims text.
  - `PRODUCT(IF(x=" ",1,x), …)` skips a blank x (ปูกระเบื้องห้องน้ำ I5:I8). In Excel desktop these cells give 0.
  - `TEXT(date,"mmm-yy")` gives Thai month names (`ม.ค.-26`).
- Nothing is frozen today (`oracle.fallbacks` is empty). If a future workbook uses a function HyperFormula lacks, the cell keeps its cached value and appears in `fallbacks`, and `frozenPrecedents` reveals it.
