# Dev mode — "โหมดตรวจสอบการคำนวณ" (Calculation check mode)

Testers and customers see where every number comes from: the values used (and who set them), every calculation
step (formula in words and with numbers), and which BOQ line each result fills. This document is the contract for
everyone who instruments a calculator or builds a dev-mode screen. **Read it all before touching code.**
The reference implementation is the footing step: `src/domain/calculators/footing/index.ts` +
`src/domain/calculators/footing/trace.labels.ts`.

## 1. Rules (apply to every change)

1. **No behaviour change.** With dev mode off (or not allowed) nothing on screen changes and every result is
   identical, to the last digit. The tracer only *observes* values the calculator already computed.
   Never reorder, regroup or rewrite arithmetic "to make tracing easier": keep the original expressions exactly
   (floating-point order matters) and pass the resulting variables to `tr.step`.
2. **Never mention Excel in user-facing text** — no sheet names, column letters or row numbers. Built-in values
   are "hard-coded" (TH "ฮาร์ดโค้ด"). BOQ lines are named by item number (`itemNo`) + description as on the BOQ page,
   never by `excelRow` or line keys like `R38`. Excel references may stay in code comments.
3. **Constants vs defaults.**
   - 🔒 *constant* = a number written in the formula that the user cannot edit on screen (excavation margin 0.40 m,
     sand factor 1.25, kg per metre of a bar size, a fixed ratio). Record it with `tr.constant(...)`.
   - ⚠ *hard-coded default* = an input field the user *can* edit but has not changed (value equals the calculator's
     `defaults()` value). This is detected automatically from the input — do **not** record inputs yourself.
   - ✎ *user-entered* = any other input value (automatic).
   - ← *from another step* = a value read via `ctx.outputs(id)` (automatic, see §3).
4. **Per-row steps.** Row-based calculators record every intermediate value of every row inside `tr.row(i, label, …)`,
   then the totals outside any row.
5. **One calculator = its own files.** Labels live in the calculator's folder (`trace.labels.ts`). Do not edit shared
   files (`src/domain/trace/*`, `src/i18n/messages/*/devMode.json`, registry) when instrumenting a calculator; if the
   foundation lacks something, note it in your handoff.
6. **Import the tracer from `../../trace/tracer`** (not `../../trace` — the index imports `project.ts`, which imports
   the registry, which imports your calculator: a cycle).
7. **Tests to run** after instrumenting calculator `X`: `npx vitest run src/domain/calculators/X` (unit + edge +
   oracle tests must pass unchanged), plus `npx vitest run src/domain/boq src/domain/__tests__` when the calculator
   feeds the BOQ. Typecheck `npx tsc --noEmit -p tsconfig.json`, eslint only your files. No new test suites needed.
8. UI text goes in `src/i18n/messages/{th,en}/devMode.json` (namespace `devMode`), never hard-coded Thai in TSX.
   Check parity with `node scripts/i18n/check-parity.mjs`.

## 2. Tracer API — `src/domain/trace/tracer.ts`

```ts
interface Tracer {
    readonly enabled: boolean;      // false for NO_TRACE
    step(id: string, value: number, operands: Record<string, number | readonly number[]>, opts?: { params?: Record<string, string | number> }): void;
    constant(id: string, value: number, opts?: { params?: Record<string, string | number> }): void;
    row<T>(index: number, label: string, fn: () => T): T;
}
const NO_TRACE: Tracer;            // records nothing (dev mode off; the default everywhere)
class RecordingTracer implements Tracer { steps: TraceStep[]; constants: RecordedConstant[] }
```

- `step(id, value, operands, { params })`
  - `id` — key into the label file's `steps` (label, formula, unit).
  - `value` — the variable the calculator already computed. Never recompute it.
  - `operands` — one entry per `{placeholder}` of the formula. Name operands after the **term** they are
    (input field names like `width`, constant ids like `margin`, or other step ids of the same row like `pit`), so
    the formula in words picks the right on-screen name. An array value (a Σ over rows) renders as `(a + b + c)`.
  - `params` — literal text for `{placeholders}` in the label/formula (e.g. `{ size: 'DB12' }`). Params are also
    appended to the step key, so the same `id` can be recorded once per size.
  - Step key = `row.<i>.<id>[.<param values>]` inside a row, `<id>[.<param values>]` outside. The first record of a
    key wins (a row evaluated twice is not duplicated).
- `constant(id, value, { params })` — a hard-coded constant (🔒). Recorded once per id + params; shows in the
  inputs list as `const:<id>[.<params>]` with `term = id`.
- `row(i, label, fn)` — runs `fn` with steps attributed to row `i` (0-based) shown as `label` (the row's name on
  screen, else `#n`).
- `enabled` — guard trace-only work: `if (tr.enabled) { … }`. With NO_TRACE the whole block is skipped (zero cost).

### `CalculatorDef` (src/domain/calculators/types.ts)

```ts
compute(input: I, ctx: CalcContext, tr?: Tracer): Record<string, number>;   // new optional 3rd argument
traceLabels?: CalcTraceLabels;                                                // the calculator's label file
```

Existing callers (`computeProject`, journey, variations, tests) pass two arguments and are unaffected.

## 3. What is generic (you get it without instrumenting)

`runTrace(calc, input, ctx, opts?)` — `src/domain/trace/run.ts` — runs `compute(input, recordingCtx, recordingTracer)`
and returns a `CalcTrace`:

| field | content |
|---|---|
| `instrumented` | `def.traceLabels !== undefined` |
| `inputs` | every leaf of the input (`classifyInputs(input, def.defaults())`): `path` (`rows.0.width`), `term` (`width`), `value`, `source` `user`/`default`, `row`, `rowsField`, `defaultValue`; then 🔒 constants; then ← dependency values (`path: dep:<calc>:<key>`, `from`) |
| `steps` | what the calculator recorded (empty when not instrumented) |
| `outputs` | every output: `key`, `value`, `links` (BOQ cells from `boqLinks`: `itemNo`, `desc`, `unit`, `field`, `overridden`, `applied`), `usedBy` (steps that read it) |
| `slotRows` | BOQ rows the calculator supplies via `boqSlots` (line key, itemNo, desc, unit, qty) |
| `deps` | per dependency: `available`, output keys `read` |
| `dependents` | steps listing this one in `deps` |
| `warnings` | `defaultsInUse`, `dependencyMissing`, `invalidInput` (NaN/Infinity → 0), `invalidOutput` (BOQ keeps the template value), `boqOverride` (a BOQ page edit replaces an output), `skipped` ("not in this project") |

Defaults rule: a value is ⚠ `default` when it equals `defaults()` at the same path; a row beyond the sample's rows
is compared with the sample's **last** row (so a newly added row's pre-filled choices — e.g. 0.05 m sand bed, DB12
bars — count as hard-coded defaults). Booleans/strings compare by `===`.

Dependency reads are recorded by wrapping `ctx.outputs(id)` in a Proxy: just read `ctx.outputs('footing')?.[key]`
as you do today.

Project-level helpers (`src/domain/trace/project.ts`):

- `traceProjectCalculator(project, calcId, base?)` — the trace with the project's real input, dep outputs, BOQ
  edits, skipped state and `usedBy`.
- `explainProjectBoq(project, base?)` — every BOQ cell (§4).
- `projectTraceBase(project)` — compute once, share between both (`{ prepared, boq }`).
- `projectBoqInput(project)` in `src/domain/project.ts` is what `computeProject` itself now runs (pure extraction,
  same results); it also returns `origins` (which step output filled which cell), `zeroed`, `skippedCalcs`.

React hooks (`src/features/dev-mode/useTrace.ts`): `useCalcTrace(def)` → `{ trace, labels }` and
`useBoqExplanation()` → `BoqExplanation`; both return `undefined` (and compute nothing) unless dev mode is active.

## 4. BOQ explanations — `explainBoq(input, result?)` (`src/domain/trace/explain-boq.ts`)

Walks the same template rules as `computeBoq` and takes **every number from computeBoq's result**, so it can never
disagree with the BOQ page. `computeBoq` is untouched. If `engine.ts` ever changes its precedence, mirror it here.

Per item line (`BoqLineExplanation`): `itemNo`, `desc`, `unit`, `section` and

- `net.source`: `override` (BOQ page edit) · `calc` {calc, output} · `skipped` · `slot` {calc, slot} (row created by a
  step) · `template` (hard-coded template value) · `line` {ref, factor, refValue} · `sumLines` {refs} · `none`;
  `net.cleaned` when a non-finite value was counted as 0.
- `waste.source`: `override` | `template`.
- `gross.rule`: `none` · `std` (net × (1+waste)) · `ceilInt` (round up to a whole number) · `concrete` (round up to
  0.25, at least 1; 0 when no quantity) · `tieWire` {refs, ratio}; `unrounded` given for the rounding rules.
- `mat` / `lab`: `unit`, `source` (`override` · `calc` · `slot` · `template` = hard-coded unit price in the BOQ
  template · `linePrice` {ref, factor, refValue} · `consumables` {refs, pct}), `basis` net|gross actually used,
  `basisValue`, `total`.
- `total`.

`explainCell(expl, key, field)` → `{ line, field, value }` for `field` ∈ `qty | waste | gross | matUnit | matTotal |
labUnit | labTotal | total`. Referenced lines (`ref`, `refs`) are line keys: look them up in `expl.lines` to show
their `itemNo` + `desc` (never show the key).

## 5. Labels — `trace.labels.ts` in the calculator's folder

```ts
import type { CalcTraceLabels } from '../../trace/types';
export const X_TRACE_LABELS: CalcTraceLabels = {
    th: { terms: {...}, units: {...}, steps: {...} },
    en: { terms: {...}, units: {...}, steps: {...} },   // same keys as th
};
```

- `terms` — on-screen name of every input field (row fields without index: `width`), every constant id, every
  intermediate value used as an operand, every output key. A key may use `*` for one dynamic path segment:
  `'rebar.*': 'เหล็กเสริม {0} รวม'`, `'row.*.width': 'ฐานรากแถว {0} · กว้าง'` — `{0}`, `{1}` are the matched
  segments (numeric ones shown 1-based). Use the same wording as the step page's column titles.
- `units` — units of terms (same key rules). Optional per term.
- `steps` — `{ label, formula, unit }` per step id. `formula` uses `{term}` placeholders and plain operators
  (`×`, `+`, `−`, `÷`, `Σ`, parentheses); a placeholder not in `operands` must be a `params` key.
  Rendered by `renderStep(set, step, fmt)` → `{ label, words, numbers, unit }`, e.g.
  words `จำนวน ฐานราก × พื้นที่หลุมขุด × ดินขุด · ลึก`, numbers `21 × 1.96 × 1.3`.
- Helpers (`src/domain/trace/labels.ts`): `traceLabelSet(labels, locale)`, `termLabel(set, key, params)`,
  `termUnit(set, key)`, `renderStep`, `fillParams`, `plainNumber`.
- Thai text in label files is allowed (domain data like `*.en.ts` overlays); TH and EN must have the same keys.

## 6. Instrumentation recipe (one calculator)

1. Read the calculator's `index.ts` and tests. List every intermediate value and every literal number in formulas.
2. Add `import { NO_TRACE, type Tracer } from '../../trace/tracer';`.
3. Change `compute: (input, ctx) =>` to `compute: (input, ctx, tr = NO_TRACE) =>` (unused ctx → `_ctx`).
4. Thread `tr` into helper functions as a **last optional parameter defaulting to `NO_TRACE`**
   (`footingRow(r, tr = NO_TRACE)`), so every other caller (pages, tests, other calculators) is unchanged.
5. Keep all arithmetic exactly as it was. After it, add one `if (tr.enabled) { … }` block that records:
   `tr.constant` for each hard-coded literal, then `tr.step` for each intermediate value with its operands.
6. Rows: `const c = tr.enabled ? tr.row(i, label, () => rowFn(r, tr)) : rowFn(r);` — the disabled path must call
   exactly what it called before. If compute evaluates a row again for another output, call it without `tr`.
7. Totals: record after the loop, outside any row, with array operands of the per-row values (`Σ {excavation}`).
   Per-size / per-kind totals use `params` (`{ params: { size: s } }`); record only kinds some row uses.
8. Write `trace.labels.ts` (th + en) covering every step id, constant id, operand term and output key; add
   `traceLabels: X_TRACE_LABELS` to `defineCalculator({...})`.
9. Run the tests of §1.7 and typecheck. Results must not change by one digit.

Footing (abridged):

```ts
export function footingRow(r: FootingRow, tr: Tracer = NO_TRACE): FootingRowResult {
    const n = num(r.count), w = num(r.width), l = num(r.length), t = num(r.depth);
    const pit = (w + 2 * EXCAVATION_MARGIN) * (l + 2 * EXCAVATION_MARGIN);   // unchanged arithmetic
    const excavation = n * pit * num(r.excavationDepth);
    ...
    if (tr.enabled) {
        tr.constant('margin', EXCAVATION_MARGIN);
        tr.constant('kgPerM', kgPerMetre(r.shortBarSize), { params: { size: r.shortBarSize || '-' } });
        tr.step('pit', pit, { width: w, length: l, margin: EXCAVATION_MARGIN });
        tr.step('excavation', excavation, { count: n, pit, excavationDepth: num(r.excavationDepth) });
        tr.step('shortKg', shortKg, { shortTotal, kgPerM: kS }, { params: { size: r.shortBarSize || '-' } });
        ...
    }
    return { ... };
}
// totals
rows.forEach((r, i) => {
    const c = tr.enabled ? tr.row(i, footingRowLabel(r, i), () => footingRow(r, tr)) : footingRow(r);
    ...
});
if (tr.enabled) tr.step('totalExcavation', t.excavation, { excavation: per.map(c => c.excavation) });
```

Labels: `steps.pit = { label: 'พื้นที่หลุมขุด', formula: '({width} + 2 × {margin}) × ({length} + 2 × {margin})', unit: 'ตร.ม.' }`.

## 7. Dev-mode switch

- Server: env `DEV_MODE=true` on the **web** container → `GET /app-config` returns `{ realtimeUrl, devMode: true }`
  (read at request time, so one image serves both). Anything else → `devMode: false`.
- Client: `loadDevModeAllowed()` (`src/features/dev-mode/config.ts`, one fetch per page load, false on error);
  `useDevMode()` → `{ allowed, enabled, active, setEnabled }` (`src/features/dev-mode/useDevMode.ts`). The per-user
  toggle is in localStorage `contrack-dev-mode` (try/catch, default off). **UI shows dev-mode things only when
  `active`.**
- Header switch: `<DevModeToggle />` (`src/features/dev-mode/DevModeToggle.tsx`), wired into
  `src/components/AppLayoutUI.tsx`; renders nothing when not allowed.
- Messages: namespace `devMode` — `toggle.*`, `source.*` (labels + hints, incl. `templatePrice`), `trace.*` (panel),
  `warning.*` (one per TraceWarning kind), `explain.*` (BOQ cell panel: cells, basis, gross rules, net/price/waste
  sources), `report.*` (PDF report), `flag.*` (phase 3 "wrong" flags), `export.*` (spreadsheet export).

## 8. Files

```
src/domain/trace/types.ts        CalcTrace, TraceInput/Step/Output/BoqLink/SlotRow/Dependency/Warning, labels, BOQ explanation types
src/domain/trace/tracer.ts       Tracer, NO_TRACE, RecordingTracer
src/domain/trace/sources.ts      classifyInputs, invalidInputPaths, recordingContext
src/domain/trace/labels.ts       traceLabelSet, termLabel, termUnit, renderStep, fillParams, plainNumber
src/domain/trace/run.ts          runTrace
src/domain/trace/explain-boq.ts  explainBoq, explainCell
src/domain/trace/project.ts      projectTraceBase, traceProjectCalculator, explainProjectBoq
src/domain/trace/index.ts        public API (UI imports '@/domain/trace'; calculators import '../../trace/tracer')
src/features/dev-mode/           config.ts, useDevMode.ts, DevModeToggle.tsx, useTrace.ts
src/i18n/messages/{th,en}/devMode.json
```

## 9. Decisions

- D1 — `tr.step(id, value, operands, { params })`: one `id` keys label, formula and unit together (instead of
  separate labelKey/formulaKey) so a step can never get a formula from another step. Formula templates are rendered
  twice (names / numbers) from one string, so words and numbers cannot drift apart.
- D2 — Inputs are classified generically against `defaults()` (not recorded by calculators). Rows beyond the
  sample's rows compare with the sample's last row. Consequence: a user who types the same value as the hard-coded
  default sees ⚠ — acceptable (it *is* the hard-coded value).
- D3 — Dependency values are found with a Proxy over `ctx.outputs(id)`, so no calculator change is needed for ←.
  `usedBy` is found by running each dependent step once with a recording context (dev mode only).
- D4 — `explainBoq` reads every number from `computeBoq`'s result and only re-walks the rules for *sources*;
  numbers are equal by construction. `computeProject` was split into `projectBoqInput` + `computeBoq` (pure
  extraction; golden/oracle tests unchanged) so dev mode reuses the exact same input and also learns which step
  output filled each cell (`origins`).
- D5 — `instrumented` = the calculator has `traceLabels`. Uninstrumented calculators still get inputs, outputs,
  links, slot rows, dependencies and warnings.
- D6 — The DEV_MODE flag is fetched by its own cached `/app-config` request (`loadDevModeAllowed`) instead of
  sharing the realtime loader in `src/features/cloud/realtime/connection.ts`, to keep the cloud code untouched.
  Toggle default off; stored per browser in localStorage `contrack-dev-mode`.
- D7 — Footing: the per-bar-size kg/m table value is a 🔒 constant (`kgPerM`, param `size`); a blank bar size is
  shown as `-` (weight 0). Per-size totals are recorded only for sizes some row uses.
- D8 — Phase 3 storage of "wrong" flags (for the agent that builds it): keep them in the project
  (`Project.reviewFlags?`, optional, missing = none) so guest projects keep them locally with the project and cloud
  projects share them with the team through the existing document sync; this needs a new document key
  (e.g. `review`) added to `DOC_KEY_PATTERN` (`src/shared/contract/projects.ts`) and to
  `src/domain/sync/project-docs.ts` — shared files, change them in one dedicated step.
- D9 — Step trace panel (`src/features/dev-mode/CalcTracePanel.tsx`) is mounted by the two places that render a step,
  not by each calculator page: the calculator route `src/app/(app)/calc/[id]/page.tsx` and the journey step
  (`src/features/journey/LevelPage.tsx`, calc levels only, also when the step is skipped so the ⚠ "not in this project"
  shows). So every calculator gets it — including the few pages that do not use `CalculatorShell` — and no
  calculator folder is edited. It renders `null` unless dev mode is active (no DOM, no trace computed).
  Order: ⚠ things to check first (what a tester should look at), then ① ② ③ in a collapse (② and ③ open).
- D10 — Step links use `/calc/<id>` (works in both the classic and the journey UI); BOQ line links use
  `/boq?line=<lineKey>`. The key only travels in the URL, never on screen. The BOQ page reads `line` once after
  hydration (from `window.location`, no `useSearchParams` so the page stays statically renderable), scrolls to the
  row and keeps it outlined until another line is picked.
- D11 — "Explain this cell" on the BOQ page: in dev mode a click on a *computed* number cell (non-editable qty, gross,
  material total, labour total, total) opens the drawer at that cell. Editable cells (qty, waste, unit prices) keep
  their click-to-edit, so each line also gets a small `?` button after its description that opens the drawer on the
  same line (all eight cells are shown, the picked one highlighted). Lines a value derives from open in the same
  drawer and are scrolled to on the BOQ page. Text for all three screens comes from one hook
  (`src/features/dev-mode/useTraceText.ts`) so panel, drawer and report always say the same thing.
- D12 — PDF report at `/print/boq-trace` (route group `(print)`, `PrintFrame`, A4 landscape). It reads the open
  project from the project store, so the BOQ page opens it with a same-tab link (a cloud project lives in memory and
  would be missing in a new tab); the toolbar's close goes back. It shows only when the server allows dev mode and
  the browser's toggle is on (else a short notice). Engine version is shown without the internal `excel-` prefix
  of `ENGINE_VERSION` (product rule: never mention the spreadsheet).
- D13 — Report appendix lists every calculator in dependency order (`calculatorsInOrder()`), skipped ones included
  (their ⚠ says "not in this project"), with the same ①②③ tables as the step panel.
