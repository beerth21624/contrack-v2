# Guided journey: UX brief for calculator agents

## Product goal (owner, 2026-10-25)
Making a BOQ must feel easy. The user has the house plan in hand, walks through our levels in order, fills
only what each level asks, each passed level unlocks the next, and at the end the BOQ is done. Hide complexity.
The test for every screen: *can a contractor holding only the plan fill this without thinking?*

The Excel-exact engine stays: calculations, defaults, BOQ links and golden tests do not change.

## What exists (do not rebuild)
- `src/domain/journey/levels.ts`: the ordered levels (one calculator each, with `planHint`).
- `/journey` (level map) and `/journey/[level]` (level page): the level page shows title, plan hint,
  the calculator page inside `JourneyModeContext` (`useJourneyMode()` from `@/features/journey/JourneyMode`),
  and a bottom bar (ด่านนี้คิดเป็น … บาท, ผ่านด่านนี้, ไม่มีงานนี้).
- `CalculatorShell` in journey mode drops its header and folds the BOQ preview, so the page body is all
  the user sees.
- `/calc/<id>` stays the full Excel-mirror view (unchanged behaviour outside journey mode).
- Project start: `createProject('blank' | 'sample')`. In a blank project `calculatorInput()` uses
  `def.blank()` when the calculator has one, else `defaults()`.
- `@/components/sheet/AdvancedSection`: a folded "ราคาและค่าตั้งต้น" block.

## Per calculator, do
1. **`blank()`** on the calculator def (domain `index.ts`): what a new real project starts with.
   - Everything read off the plan is empty: dimensions, lengths, counts → 0; variable-length tables → `[]`
     (or a single empty row if the page needs one to show the columns: prefer `[]` plus an "เพิ่มแถว" button).
   - Keep Excel values for prices, waste %, ratios, spec/material choices, wage, standard sizes.
   - `compute(blank())` must give finite numbers (no NaN/Infinity) and every BOQ-linked output 0 (or the
     Excel fixed lump sums if the sheet has those regardless of plan; say which in your report).
   - Add tests: blank compute is finite and linked outputs are 0; `defaults()` tests unchanged.
2. **Journey-mode page** (`src/features/calculators/<id>/…Page.tsx`), only when `useJourneyMode()` is true:
   - Plan inputs first, in plan-reading order, with plain Thai labels + unit (e.g. "ความกว้างฐาน (ม.)").
     Short hints where a value is not obvious from a plan.
   - Prices / waste / ratios / constants → inside `<AdvancedSection>` (folded).
   - Intermediate formula columns: hide or reduce to the 1–3 results that matter (e.g. "คอนกรีต 3.25 ลบ.ม.,
     เหล็กรวม 412 กก."). Keep a compact green result summary at the end.
   - Empty-state: when a table has no rows, show a friendly prompt and one big "เพิ่ม…" button.
   - Outside journey mode keep the current Excel-mirror layout (you may share components between modes).
3. **No Excel jargon in journey mode**: no sheet names, cell refs, "Excel row", or BOQ row numbers.

## Rules
- Only edit your own calculator folders (domain + features). Shared files (`src/components/sheet/*`,
  `CalculatorShell`, `project.ts`, store, registry, pages.ts, `src/features/journey/*`,
  `src/domain/calculators/shared/*`) belong to the coordinator — report what you need, unless your brief
  names a shared file as yours.
- Strict TS + ESLint (no `||` defaults, no `!`, no setState in effects, no dynamic delete).
- Finish with `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint <your folders>` all clean; the project
  golden test must not change.
- **Do not use the browser**: several agents work at once and would overwrite each other's saved project
  (one shared localStorage). The coordinator checks every level in the app afterwards. Verify with tests
  (e.g. render-free logic, blank/sample computes) and careful reading.
- Do not commit.
