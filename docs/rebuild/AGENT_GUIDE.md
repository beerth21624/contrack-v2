# Rebuild agent guide — building one calculator sheet

Read first: `docs/excel-spec/00-rebuild-design.md` (design + decisions D1–D20) and the spec file for your area
(`docs/excel-spec/01…06`). The Excel v5 workbook is the source of truth; the review deck (`%TEMP%\ctrv2\review\pageNN.png`)
explains what the customer wants. Raw workbook dump: `%TEMP%\ctrv2\v5\sheetNN.txt`
(`CELL<TAB>value<TAB>=formula<TAB>fill`; yellow `FFFFF2CC` = input, green `FFE2F0D9` = formula,
`=SHARED(si, master X: f)` = master formula shifted to this cell). `%TEMP%` = `C:\Users\Beerdosan\AppData\Local\Temp`.

## Reference implementation
Copy the pattern of **land inspection**:
- domain: `src/domain/calculators/land-inspection/index.ts` (+ `land-inspection.test.ts`)
- page: `src/features/calculators/land-inspection/LandInspectionPage.tsx`

## What a calculator is
`src/domain/calculators/types.ts` → `defineCalculator<Input>({ id, sheetName, title, titleEn, sections, deps, defaults, compute, boqLinks, boqText? })`
- `defaults()` = the **Excel v5 sample input**, exactly (values in yellow cells, row by row).
- `compute(input, ctx)` = pure function returning `Record<string, number>`. Port the Excel formulas literally
  (use `roundUp`/`ceilingTo` from `src/domain/boq/engine.ts` for ROUNDUP/CEILING). `ctx.outputs('other-id')`
  reads another calculator (list it in `deps`).
- `boqLinks` = which BOQ (Home) cell each output fills: `{ line: 'R13', field: 'qty' | 'mat' | 'lab', output }`.
  Line keys are `R<excel row>` of sheet "BOQ (Home)" — see `src/domain/boq/template.v5.ts` / `docs/excel-spec/01…` §A.4.
  Excel row formulas inside the BOQ (waste, rounding, ×2 prices, consumables %, ไม้คร่าว/ตะปู, tie wire) are already
  handled by the BOQ template — only supply the quantity / price the BOQ row reads from your sheet.
- `boqText(input)` (optional) = desc/note text for BOQ rows.
- Tables: use arrays with no row limit (D5). Keep the Excel's fixed rows as the default rows.

## Tests (required) — `src/domain/calculators/<id>/<id>.test.ts`
1. `compute(defaults())` reproduces every cached value of the Excel sheet (each computed cell, totals).
2. The outputs you link equal the BOQ (Home) cells they feed (`src/domain/boq/__tests__/golden.v5.json` → `lines.R<row>.E`
   for qty; the template's `mat`/`lab` for prices), or the difference is a documented decision.
3. A couple of behaviour checks (adding a row, changing an input) with hand-computed expectations.

## Page — `src/features/calculators/<id>/<Name>Page.tsx` (default export)
- `const { input, update, reset, outputs, result, isDefault } = useCalculator(def)` and wrap in `<CalculatorShell …>`.
- Building blocks in `src/components/sheet/`: `EditableTable` (typed columns: text/number/select/calc/label),
  `InputNumberField`, `InputTextField`, `CalcField`, `SheetCard`, `NumberCell`, `TextCell`.
- Lay the page out like the Excel sheet: same labels (Thai, verbatim minus stray symbols), same order, yellow inputs,
  green results, the sheet's notes/hints. Show dropdowns with the Excel option lists.

## Files you may touch
Only your own folders: `src/domain/calculators/<id>/` and `src/features/calculators/<id>/`.
**Do not edit shared files** (`registry.ts`, `pages.ts`, `project-golden.test.ts`, BOQ template/engine, store,
other calculators). Instead report, in your final message:
- the registry import + entry line for `src/domain/calculators/registry.ts`,
- the lazy page line for `src/features/calculators/pages.ts`,
- any expected difference vs Excel per BOQ section (`KNOWN_DELTAS` in `src/domain/__tests__/project-golden.test.ts`)
  with the exact amount and the decision it comes from,
- anything you think must change in a shared file (the coordinator applies it).

## Checks before you report
`npx vitest run src/domain/calculators/<id>`, `npx tsc --noEmit -p .`, `npx eslint src/domain/calculators/<id> src/features/calculators/<id>`
(Node: `$env:Path = "C:\Program Files\nodejs;" + $env:Path` in PowerShell). The repo's ESLint is strict
(no `||` for defaults → `??`, no dynamic `delete`, no non-null `!`, `interface` over `type` for objects,
no setState in effects). Do not commit; the coordinator commits after review.

## Decisions to apply (from 00-rebuild-design.md §8)
D1 fix clear Excel bugs (short SUM ranges, swapped labels) and note them; keep tradesmen's rules of thumb.
D3 link calculator totals into the BOQ cells Excel retyped by hand. D4 v5 values. D5 unlimited rows.
D10/D11 keep Excel's double allowances and labour-on-gross where Excel has them. D15 no extras Excel doesn't have.
When something is ambiguous, follow Excel v5 and list it as an open question in your report.
