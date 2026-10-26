// Differential test: Man-Day_Basic, S-Curve_Plan_Basic and CashFLOW_Basic (computeProject → computePlanning) vs the
// real Excel v5 formulas, evaluated by the oracle on the whole workbook, on 30 seeded random plans + named edge cases.
// How to write one: docs/rebuild/ORACLE_TESTS.md. Spec: docs/excel-spec/06-manday-scurve-cashflow.md.
//
// Slow (~4 s per Excel recalculation: S-Curve holds 3,456 formulas that all depend on the inputs), hence `.slow`.
//
// Inputs Excel hard-codes inside formulas (Man-Day wages `=(800*O15)+(500*P15)`, the 20 % share `=(L243*0.2)/R233`,
// CashFlow `=D2*1.3`, `=D2*1.15`, `=D55*15%`, PV `=sum(D57:K57)`) are typed into those formulas with the case's
// constants, as an Excel user would edit them (decisions D16/D18 make them settings). The structure test asserts the
// original formula texts first, so the rewrite only ever replaces the constant. The CashFlow installment placement is
// typed as Excel's own `=B{r}*$K$2`.
//
// Documented deviations from Excel, each asserted as an exact delta (never skipped):
// - D1 Man-Day S82 / S209: Excel's K95 / K216 skip the waste-pipe (K84:K86) and water-pipe (K213:K214) labour; the
//   app includes it → app S − Excel S = Σ those K ÷ R.
// - D1 the last week bucket (BE, Dec 23–31 for a January axis) runs to month end in the app. In the xlsx, BE14:BE84
//   are shared copies of J14, so wkEnd = IFERROR(BF$9 − 1, …) = −1 (BF9 is blank) and Excel drops the WHOLE bucket
//   (only BE13 carries the literal #REF! that falls back to BE9+6). Asserted: Excel BE is "" on every task row and
//   the app's BE share is exactly what Excel loses.
// - D1 D5 / D6: the earliest start / latest finish instead of E14 / F83 → AA2 (and AA11 = AA2 ÷ SPI) shift by it.
// - D1 CashFlow D15 = SUM(D6:D13) leaves out row 14 (งวดที่ 8) in the first week; the app sums every row.
// - D1 CashFlow tasks are linked by id: rows 26 / 29 read the wrong S-Curve column (K26/S29 #REF! → "", L26 reads
//   week 8 instead of 9, R29 week 16 instead of 15). The raw cells are asserted against the S-Curve, then the four
//   formulas are typed with the right column (as their neighbours) and everything downstream is compared exactly.
// - D1/D18 the CashFlow axis grows beyond the 20 Excel columns: Excel's sums (B groups, AA14, AA15, ΣD16:W16) miss
//   exactly the app's later columns. Narrowing: the random plans give 0 % complete to tasks that run past column W,
//   so EV and the EVM ratios stay exact.
// - Excel adds 1E-12 to every non-empty weekly share (`MAX(0, share+1E-12)`). The comparison adds exactly that to the
//   app's shares: S-Curve sums are corrected by count × 1E-12, and the CashFlow is recomputed with the app's own
//   computeCashFlow() on the shares as Excel holds them; the app's real CashFlow is within ฿0.001 of that.
import { beforeAll, describe, expect, it } from 'vitest';
import {
    colToIndex, indexToCol, isOracleError, loadV5Oracle, type ExcelOracle, type OracleCellInput, type OracleValue,
} from '../../../test-utils/excel-oracle';
import { expectBoqRow, expectClose, seededRandom } from '../../../test-utils/oracle-helpers';
import { computeBoq } from '../../boq/engine';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import type { BoqResult } from '../../boq/types';
import {
    blankPlanningInput, bucketIndexOf, buildWeekBuckets, computeCashFlow, computePlanning, defaultPlanningInput, isoToSerial,
    overlapDays, PLAN_TASKS, resolvePlanningInput, serialToIso,
    type CashFlowResult, type PlanningInput, type PlanningResult, type PlanTaskDef, type ScheduleActualInput, type ScheduleResult,
    type ScheduleTaskInput, type ScheduleTaskResult, type WageRate, type WageSetId, type WeekBucket,
} from '..';

const MD = 'Man-Day_Basic';
const SC = 'S-Curve_Plan_Basic';
const CF = 'CashFLOW_Basic';
const BOQ = 'BOQ (Home)';

/** Excel's `+1E-12` on every non-empty weekly share. */
const EPS = 1e-12;
/** S-Curve J..BE = 12 months × 4; CashFlow D..W = 20. */
const SC_BUCKETS = 48;
const CF_BUCKETS = 20;
const LAST = SC_BUCKETS - 1;
const scCol = (k: number) => indexToCol(colToIndex('J') + k);
const cfCol = (k: number) => indexToCol(colToIndex('D') + k);

/** Constants hard-coded in the Excel formulas. */
const EXCEL_WAGES: Record<WageSetId, WageRate> = { A: { skilled: 800, labourer: 500 }, B: { skilled: 1000, labourer: 600 } };
const EXCEL_SHARE = 0.2;
const EXCEL_QUOTATION = 1.3;
const EXCEL_OPEX = 0.15;
const EXCEL_PROFIT = 0.15;
const EXCEL_PV = 8;
/** Man-Day S233 = (L243·0.2)/R233, S278 = (L280·0.2)/R278. */
const SHARE_TOTAL_ROW: Record<string, number> = { '7.1': 243, '8.3': 280 };
/** D1: Man-Day K95 / K216 leave out these labour rows; the app's S82 / S209 include them. */
const D1_PIPE_ROWS: Record<string, number[]> = { '2.1': [84, 85, 86], '6.3': [213, 214] };
/** CashFlow B21, B28, … (one merged cell per งวด). */
const GROUP_ROWS = [21, 28, 33, 36, 38, 40, 45, 47];
/** BOQ rows whose labour unit price is typed in both BOQ (Home) K and Man-Day J (Man-Day duplicates the BOQ). */
const LABOUR_ROWS = [16, 38, 39, 84, 85, 86, 179, 185, 213, 214];
const SAMPLE_BUCKETS = defaultPlanningInput().cashflow.installments.map(i => i.bucket);
const DAY0 = isoToSerial('2026-01-01') ?? 0;

function must<T>(v: T | undefined | null, what: string): T {
    if (v === undefined || v === null) throw new Error(`missing ${what}`);
    return v;
}
const taskDef = (id: string): PlanTaskDef => must(PLAN_TASKS.find(t => t.id === id), `task ${id}`);
const firstOfMonth = (serial: number) => must(isoToSerial(`${serialToIso(serial).slice(0, 8)}01`), 'month');
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const norm = (f: string | undefined) => (f ?? '').replace(/\s+/g, '').toUpperCase();

// ─── Cases ──────────────────────────────────────────────────────────────────
interface PlanCase {
    planning: PlanningInput;
    /** BOQ row → labour unit price (BOQ (Home) K and Man-Day J). */
    labour: Record<number, number>;
}

/** Every task carries `actual` (possibly undefined) so resolvePlanningInput cannot merge the sample's actual back. */
function normalized(planning: PlanningInput): PlanningInput {
    const tasks = Object.fromEntries(PLAN_TASKS.map(t => {
        const ti = must(planning.schedule.tasks[t.id], `schedule ${t.id}`);
        return [t.id, { ...ti, actual: ti.actual }];
    }));
    return { ...planning, schedule: { ...planning.schedule, tasks } };
}

function sampleWith(edit: (p: PlanningInput) => void, labour: Record<number, number> = {}): PlanCase {
    const planning = defaultPlanningInput();
    edit(planning);
    return { planning: normalized(planning), labour };
}

function setTask(p: PlanningInput, id: string, start: string, days?: number): void {
    must(p.schedule.tasks[id], id).start = start;
    if (days !== undefined) must(p.manday.blocks[id], id).days = days;
}

function randomCase(seed: number): PlanCase {
    const rng = seededRandom(seed);
    const planning = defaultPlanningInput();
    const { manday, schedule, cashflow } = planning;

    // Man-Day: crews, wage sets, typed days, 20 % share.
    if (rng.chance(0.5)) {
        manday.wageSets = {
            A: { skilled: rng.step(600, 1200, 50), labourer: rng.step(350, 700, 25) },
            B: { skilled: rng.step(800, 1500, 50), labourer: rng.step(450, 800, 25) },
        };
    }
    manday.subcontractLabourShare = rng.chance(0.5) ? EXCEL_SHARE : rng.step(0.1, 0.4, 0.05);
    for (const t of PLAN_TASKS) {
        const none = rng.chance(0.05);
        const skilled = none ? 0 : rng.int(0, 5);
        manday.blocks[t.id] = {
            skilled,
            labourers: none ? 0 : rng.int(skilled === 0 ? 1 : 0, 6),
            wageSet: rng.chance(0.75) ? t.sample.wageSet : t.sample.wageSet === 'A' ? 'B' : 'A',
            days: rng.chance(0.03) ? 0 : rng.int(1, 12),
        };
    }

    // S-Curve: typed starts (sequential with overlaps), D49, actuals, % complete.
    const typed42 = rng.chance(0.5) ? rng.int(1, 8) : null;
    const dur = (id: string) => (id === '4.2' && typed42 !== null ? typed42 : must(manday.blocks[id], id).days);
    const e14 = DAY0 + rng.int(0, 900);
    const monthStart = firstOfMonth(e14);
    const starts = new Map<string, number | null>();
    let cursor = e14;
    PLAN_TASKS.forEach((t, i) => {
        if (i === 0) {
            starts.set(t.id, e14);
            cursor = e14 + rng.int(0, Math.max(0, dur(t.id) - 1));
            return;
        }
        if (t.id !== '8.6' && rng.chance(0.03)) { starts.set(t.id, null); return; }
        let s = Math.max(e14, cursor + rng.int(-1, 2));
        // D1 branch: an early task starts before task 1.1 (same month, so both axes start in the same month).
        if (i <= 2 && rng.chance(0.2)) s = Math.max(monthStart, e14 - rng.int(1, 6));
        if (t.id === '8.6' && rng.chance(0.7)) {
            const lastOther = Math.max(...[...starts.entries()].flatMap(([id, st]) => (st === null ? [] : [st + dur(id) - 1])));
            s = Math.max(s, lastOther - dur(t.id) + 1);
        }
        starts.set(t.id, s);
        cursor = Math.max(cursor, s + rng.int(0, Math.max(0, dur(t.id) - 1)));
    });

    const nAct = rng.pick([0, 1, 1, 2, 3, 5, 8, 12]);
    const extraActual = rng.chance(0.3) ? rng.int(nAct, PLAN_TASKS.length - 1) : -1;
    const limit = must(buildWeekBuckets(e14, 12)[LAST], 'last bucket').startSerial;
    const cfWindowEnd = must(buildWeekBuckets(e14, 5)[CF_BUCKETS - 1], 'CashFlow W').endSerial;
    let lastDate = -Infinity;
    PLAN_TASKS.forEach((t, i) => {
        const s = starts.get(t.id) ?? null;
        const d = dur(t.id);
        const ti: ScheduleTaskInput = { start: s === null ? '' : serialToIso(s), progress: 0 };
        if (t.id === '4.2') ti.duration = typed42;
        if (s !== null) lastDate = Math.max(lastDate, s + d - 1);
        if (s !== null && (i < nAct || i === extraActual)) {
            const aStart = Math.max(monthStart, s + rng.int(-2, 3));
            const a: ScheduleActualInput = { start: serialToIso(aStart) };
            if (!rng.chance(0.1)) {
                a.days = Math.max(1, d + rng.int(-1, 3));
                lastDate = Math.max(lastDate, aStart + a.days - 1);
            }
            if (!rng.chance(0.1)) a.cost = rng.step(1000, 150000, 500);
            ti.actual = a;
        }
        ti.progress = i < nAct ? rng.pick([1, 1, 0.8, 0.5]) : rng.chance(0.15) ? rng.step(0, 1, 0.05) : 0;
        schedule.tasks[t.id] = ti;
        // CashFlow % complete: 0 on tasks that run past column W (narrows the D18 axis delta to the sums).
        const late = s !== null && d > 0 && s + d - 1 > cfWindowEnd;
        cashflow.progress[t.id] = late ? 0 : rng.chance(0.5) ? rng.pick([1, 1, 0.6, 0.5, 0.25]) : 0;
    });
    // The random plans stay out of the last S-Curve bucket (its D1 delta has a named case).
    if (lastDate >= limit) throw new Error(`seed ${seed}: the plan reaches the last S-Curve bucket`);

    // CashFlow: rates, installments and their weeks, AC, PV weeks.
    cashflow.quotationFactor = rng.chance(0.5) ? EXCEL_QUOTATION : rng.step(1.1, 1.5, 0.05);
    cashflow.operatingCostRate = rng.chance(0.5) ? EXCEL_OPEX : rng.step(0.05, 0.25, 0.01);
    cashflow.profitRate = rng.chance(0.5) ? EXCEL_PROFIT : rng.step(0.05, 0.25, 0.01);
    cashflow.actualCost = rng.chance(0.1) ? 0 : rng.step(0, 1_500_000, 1000);
    cashflow.pvBuckets = rng.chance(0.5) ? EXCEL_PV : rng.int(1, CF_BUCKETS);
    const samplePlacement = rng.chance(0.4);
    let b = rng.int(0, 2);
    cashflow.installments = cashflow.installments.map((inst, i) => {
        if (i > 0) b = Math.min(CF_BUCKETS - 1, b + rng.int(0, 4));
        const bucket = samplePlacement ? inst.bucket : rng.chance(0.05) ? null : i === 8 && rng.chance(0.1) ? 0 : b;
        const pct = rng.chance(0.5) ? inst.pct : i === 0 ? rng.step(0.1, 0.3, 0.05) : rng.step(0.05, 0.15, 0.01);
        return { label: inst.label, pct, bucket };
    });

    // BOQ (Home): a few labour unit prices (Man-Day J follows, as it duplicates the BOQ).
    const labour: Record<number, number> = {};
    if (rng.chance(0.5)) for (let k = 0; k < 3; k++) labour[rng.pick(LABOUR_ROWS)] = rng.step(20, 400, 5);
    return { planning: normalized(planning), labour };
}

const RANDOM_BASE = 20261027;
const CASES: [string, PlanCase][] = [
    ['Excel sample', sampleWith(() => undefined)],
    ['blank tracking: no ACTUAL (Q4 #N/A), no % complete, AC 0 (CPI #DIV/0!)', (() => {
        const p = blankPlanningInput();
        return { planning: normalized(p), labour: {} };
    })()],
    ['D1 D5/D6: 1.2 starts before 1.1, 8.4 finishes after 8.6', sampleWith(p => {
        setTask(p, '1.2', '2026-01-07');
        setTask(p, '8.6', '2026-05-20');
    })],
    ['D1 CashFlow rows 26/29: 1.6 over Feb W4 + Mar W1, 2.2 over Apr W3 + W4', sampleWith(p => {
        setTask(p, '1.6', '2026-02-26', 5);
        setTask(p, '2.2', '2026-04-20', 6);
    })],
    ['D1 last S-Curve bucket (8.6 on Dec 27–31) + D18 CashFlow axis of 12 months', sampleWith(p => {
        setTask(p, '8.6', '2026-12-27', 5);
    })],
    ['D1 CashFlow D15: งวดที่ 8 billed in the first week', sampleWith(p => {
        must(p.cashflow.installments[8], 'งวด 8').bucket = 0;
    })],
    ['no crew on 1.1 (R = 0, S #DIV/0!), piles with a crew, typed wages and a 30 % share', sampleWith(p => {
        p.manday.blocks['1.1'] = { skilled: 0, labourers: 0, wageSet: 'A', days: 1 };
        p.manday.blocks['1.4'] = { skilled: 2, labourers: 2, wageSet: 'B', days: 2 };
        p.manday.wageSets = { A: { skilled: 900, labourer: 550 }, B: { skilled: 1100, labourer: 650 } };
        p.manday.subcontractLabourShare = 0.3;
    })],
    ['D1 S82/S209 with changed pipe labour (BOQ + Man-Day)', sampleWith(() => undefined, { 84: 150, 85: 80, 213: 60, 214: 55, 16: 1800 })],
    ['PV of week 1 only = 0 (SPI #DIV/0!), typed rates', sampleWith(p => {
        p.cashflow.pvBuckets = 1;
        p.cashflow.quotationFactor = 1.45;
        p.cashflow.operatingCostRate = 0.1;
        p.cashflow.profitRate = 0.2;
    })],
    ...range(30).map((k): [string, PlanCase] => [`random #${k} (seed ${RANDOM_BASE + k})`, randomCase(RANDOM_BASE + k)]),
];

// ─── Input mapping ──────────────────────────────────────────────────────────
interface OffsetFixes { K26: string; L26: string; R29: string; S29: string }

/** The cells a user would type in Excel for this case. `fixes`: rows 26/29 typed with the right column. */
function excelInputs(c: PlanCase, fixes?: OffsetFixes): Record<string, OracleCellInput> {
    const out: Record<string, OracleCellInput> = {};
    const { manday, schedule, cashflow } = c.planning;
    for (const t of PLAN_TASKS) {
        const md = t.manday.excelRow;
        const blk = must(manday.blocks[t.id], `block ${t.id}`);
        out[`${MD}!O${md}`] = blk.skilled;
        out[`${MD}!P${md}`] = blk.labourers;
        out[`${MD}!T${md}`] = blk.days;
        const w = manday.wageSets[blk.wageSet];
        const x = EXCEL_WAGES[t.sample.wageSet];
        if (w.skilled !== x.skilled || w.labourer !== x.labourer) {
            out[`${MD}!R${md}`] = { formula: `=(${w.skilled}*O${md})+(${w.labourer}*P${md})` };
        }
        const shareRow = SHARE_TOTAL_ROW[t.id];
        if (shareRow !== undefined && manday.subcontractLabourShare !== EXCEL_SHARE) {
            out[`${MD}!S${md}`] = { formula: `=(L${shareRow}*${manday.subcontractLabourShare})/R${md}` };
        }

        const sc = t.excelRow;
        const ti = must(schedule.tasks[t.id], `schedule ${t.id}`);
        if (t.id !== '4.2' && ti.duration !== undefined && ti.duration !== null) throw new Error(`Excel links D${sc} to Man-Day T`);
        out[`${SC}!E${sc}`] = isoToSerial(ti.start);
        out[`${SC}!BF${sc}`] = ti.progress ?? 0;
        out[`${SC}!D${sc + 1}`] = ti.actual?.days ?? null;
        out[`${SC}!E${sc + 1}`] = isoToSerial(ti.actual?.start);
        out[`${SC}!G${sc + 1}`] = ti.actual?.cost ?? null;
        out[`${CF}!Y${t.cashflowRow}`] = cashflow.progress[t.id] ?? 0;
    }
    // S-Curve D49 is typed in Excel; "linked to Man-Day T184" (null) is typed as the same number.
    out[`${SC}!D49`] = schedule.tasks['4.2']?.duration ?? must(manday.blocks['4.2'], '4.2').days;

    for (const [row, price] of Object.entries(c.labour)) {
        out[`${BOQ}!K${row}`] = price;
        out[`${MD}!J${row}`] = price;
    }

    if (cashflow.installments.length !== 9) throw new Error('Excel has 9 installment rows (6–14)');
    cashflow.installments.forEach((inst, i) => {
        const r = 6 + i;
        out[`${CF}!B${r}`] = inst.pct;
        out[`${CF}!C${r}`] = inst.label;
        const sampleBucket = SAMPLE_BUCKETS[i] ?? null;
        if (sampleBucket !== null && sampleBucket !== inst.bucket) out[`${CF}!${cfCol(sampleBucket)}${r}`] = { formula: null };
        if (inst.bucket !== null && inst.bucket !== sampleBucket) {
            if (!Number.isInteger(inst.bucket) || inst.bucket < 0 || inst.bucket >= CF_BUCKETS) throw new Error(`no Excel column for bucket ${inst.bucket}`);
            out[`${CF}!${cfCol(inst.bucket)}${r}`] = { formula: `=B${r}*$K$2` };
        }
    });
    out[`${CF}!Z18`] = cashflow.actualCost;
    if (cashflow.minMonths !== 5) throw new Error('Excel CashFlow has 5 months');
    if (cashflow.quotationFactor !== EXCEL_QUOTATION) out[`${CF}!K2`] = { formula: `=D2*${cashflow.quotationFactor}` };
    if (cashflow.operatingCostRate !== EXCEL_OPEX) {
        out[`${CF}!AA4`] = { formula: `=D2*(1+${cashflow.operatingCostRate})` };
        for (const k of range(CF_BUCKETS)) out[`${CF}!${cfCol(k)}56`] = { formula: `=${cfCol(k)}55*${cashflow.operatingCostRate}` };
    }
    if (cashflow.profitRate !== EXCEL_PROFIT) {
        for (const k of range(CF_BUCKETS)) out[`${CF}!${cfCol(k)}59`] = { formula: `=${cfCol(k)}55*${cashflow.profitRate}` };
    }
    if (cashflow.pvBuckets !== EXCEL_PV) {
        if (!Number.isInteger(cashflow.pvBuckets) || cashflow.pvBuckets < 1 || cashflow.pvBuckets > CF_BUCKETS) throw new Error('PV range must fit D57:W57');
        out[`${CF}!AA6`] = { formula: `=SUM(D57:${cfCol(cashflow.pvBuckets - 1)}57)` };
    }
    if (fixes) {
        out[`${CF}!K26`] = { formula: `=${fixes.K26}` };
        out[`${CF}!L26`] = { formula: `=${fixes.L26}` };
        out[`${CF}!R29`] = { formula: `=${fixes.R29}` };
        out[`${CF}!S29`] = { formula: `=${fixes.S29}` };
    }
    return out;
}

interface AppResult { boq: BoqResult; planning: PlanningResult }

/**
 * The app side: computePlanning (what computeProject runs) on the stored input as the app resolves it, over the
 * BOQ (Home) template at the Excel sample + the case's labour prices. (computeProject's BOQ also carries the
 * calculator-level decisions, e.g. D3 R16 = 6,469 instead of the typed 6,500 — asserted in boq-home.oracle.test.ts;
 * here both sides must start from the same BOQ.)
 */
function appResult(c: PlanCase): AppResult {
    const boq = computeBoq({
        sections: BOQ_TEMPLATE_V5,
        overrides: Object.fromEntries(Object.entries(c.labour).map(([row, lab]) => [`R${row}`, { lab }])),
    });
    const input = resolvePlanningInput(c.planning);
    // What the app computes is exactly the case (resolvePlanningInput merges nothing back from the sample).
    expect(JSON.parse(JSON.stringify(input))).toEqual(JSON.parse(JSON.stringify(c.planning)));
    return { boq, planning: computePlanning(input, boq) };
}

// ─── Reading Excel ──────────────────────────────────────────────────────────
type Cell = number | null | { error: string };

/** A cell as number, blank (null / "") or error. Other text throws (a mapping bug). */
function cell(o: ExcelOracle, ref: string): Cell {
    const v: OracleValue = o.get(ref);
    if (v === null || v === '') return null;
    if (typeof v === 'number') return v;
    if (isOracleError(v)) return { error: v.error };
    throw new Error(`${ref} is not a number: ${JSON.stringify(v)}`);
}
/** Blank → 0; an error fails the comparison. */
const num0 = (o: ExcelOracle, ref: string): number => {
    const v = cell(o, ref);
    return v === null ? 0 : typeof v === 'number' ? v : NaN;
};
const text = (o: ExcelOracle, ref: string): string => {
    const v = o.get(ref);
    return typeof v === 'string' ? v.trim() : v === null ? '' : JSON.stringify(v);
};

/** app null ⇔ Excel error (#DIV/0!, #N/A) or blank; else equal. */
function expectNullable(app: number | null, o: ExcelOracle, ref: string, label: string): void {
    const v = cell(o, ref);
    if (app === null) {
        expect(v === null || (typeof v === 'object' && v.error.length > 0), `${label}: app null, Excel ${JSON.stringify(v)}`).toBe(true);
        return;
    }
    expect(typeof v, `${label}: Excel ${JSON.stringify(v)}, app ${app}`).toBe('number');
    expectClose(app, typeof v === 'number' ? v : NaN, label);
}

/** A date cell (Excel serial or blank) vs an ISO date. */
function expectDate(app: string | null, o: ExcelOracle, ref: string, label: string): void {
    const v = cell(o, ref);
    expect(v, label).toBe(isoToSerial(app));
}

// ─── Excel's view of the app's shares (1E-12, lost BE bucket) ───────────────
/** Excel's value of a weekly grid cell for this share: null = "" (no overlap), else MIN(1, share + 1E-12). */
function excelShare(share: number, start: string | null, finish: string | null, duration: number | null, b: WeekBucket): number | null {
    const s = isoToSerial(start);
    const f = isoToSerial(finish);
    if (s === null || f === null || duration === null || duration <= 0) return null;
    if (overlapDays(s, f, b.startSerial, b.endSerial) === 0) return null;
    return Math.min(1, Math.max(0, share + EPS));
}

interface ScView { plan: (number | null)[]; actual: (number | null)[] }

/** S-Curve grid as Excel holds it: +1E-12 per non-empty cell; D1: the last bucket BE is "" on every task row. */
function scurveView(t: ScheduleTaskResult, buckets: WeekBucket[]): ScView {
    return {
        plan: buckets.map((b, k) => (k === LAST ? null : excelShare(t.plan[k] ?? 0, t.start, t.finish, t.duration, b))),
        actual: buckets.map((b, k) => (k === LAST ? null : excelShare(t.actual.weekly[k] ?? 0, t.actual.start, t.actual.finish, t.actual.duration, b))),
    };
}

/** The S-Curve result with the PLAN shares as the CashFlow reads them from Excel (columns D..W = buckets 0–19). */
function scheduleAsExcel(s: ScheduleResult): ScheduleResult {
    return {
        ...s,
        tasks: s.tasks.map(t => ({
            ...t,
            plan: t.plan.map((v, k) => {
                const b = s.buckets[k];
                if (k >= CF_BUCKETS || !b) return v;
                return excelShare(v, t.start, t.finish, t.duration, b) ?? 0;
            }),
        })),
    };
}

// ─── Man-Day ────────────────────────────────────────────────────────────────
const MD_BLOCK_KEYS = ['boqLabour', 'budget', 'calcDays', 'crew', 'dailyWage', 'days', 'excelRow', 'id', 'labourBasis',
    'labourCost', 'labourers', 'section', 'skilled', 'suggestedDays', 'title', 'wageSet'].sort();

function checkManDay(o: ExcelOracle, c: PlanCase, res: AppResult): void {
    const md = res.planning.manday;
    expect(Object.keys(md).sort()).toEqual(['blocks', 'totalBudget', 'totalDays']);
    expect(md.blocks).toHaveLength(32);
    for (const b of md.blocks) {
        expect(Object.keys(b).sort(), 'Man-Day output keys (map new ones)').toEqual(MD_BLOCK_KEYS);
        const r = b.excelRow;
        const at = (col: string) => `${MD}!${col}${r}`;
        const label = `Man-Day ${b.id} row ${r}`;
        expect(b.excelRow).toBe(taskDef(b.id).manday.excelRow);   // static structure (title/section/basis: golden test)
        expect(b.wageSet).toBe(c.planning.manday.blocks[b.id]?.wageSet);
        expectClose(b.skilled, o.num(at('O')), `${label} O`);
        expectClose(b.labourers, o.num(at('P')), `${label} P`);
        expectClose(b.crew, o.num(at('Q')), `${label} Q`);
        expectClose(b.dailyWage, o.num(at('R')), `${label} R`);
        expectClose(b.days, o.num(at('T')), `${label} T`);
        expectClose(b.budget, o.num(at('U')), `${label} U`);

        // Labour the block reads: Excel U's rows in column K (U82 = L95 → K95). D1: + the pipe rows K95/K216 skip.
        const pipe = sum((D1_PIPE_ROWS[b.id] ?? []).map(row => o.num(`${MD}!K${row}`)));
        if (D1_PIPE_ROWS[b.id]) expect(pipe, `${label}: D1 pipe labour`).toBeGreaterThan(0);
        const kFormula = must(o.formula(at('U')), `${label} U formula`).replace(/L(\d+)/g, 'K$1');
        const labourK = Number(o.evaluate(`=${kFormula}`, MD)) + pipe;
        expectClose(b.boqLabour, labourK, `${label} labour (Excel ${kFormula} + D1 pipe rows)`);
        const share = c.planning.manday.subcontractLabourShare;
        expectClose(b.labourCost, b.labourBasis === 'labour' ? labourK : b.labourBasis === 'shareOfTotal' ? o.num(at('U')) * share : 0, `${label} labour cost`);

        const s = cell(o, at('S'));
        if (b.labourBasis === 'none') {
            expect(s, `${label}: S34 has no formula`).toBeNull();
            expect(b.calcDays).toBeNull();
        } else if (b.dailyWage === 0) {
            expect(s, label).toEqual({ error: '#DIV/0!' });
            expect(b.calcDays).toBeNull();
        } else {
            // D1 (S82 / S209): app S − Excel S = pipe labour ÷ R exactly; 0 for every other block.
            expect(typeof s, label).toBe('number');
            expectClose(b.calcDays, (typeof s === 'number' ? s : NaN) + pipe / b.dailyWage, `${label} S`);
        }
        expect(b.suggestedDays).toBe(b.calcDays === null ? null : Math.round(b.calcDays));   // no Excel cell
    }
    expectClose(md.totalDays, o.num(`${MD}!T310`), 'Man-Day T310');
    expectClose(md.totalBudget, o.num(`${MD}!U310`), 'Man-Day U310');
}

// ─── S-Curve ────────────────────────────────────────────────────────────────
const SC_KEYS = ['actualCumulative', 'actualWeekly', 'budget', 'buckets', 'durationDays', 'finish', 'installments', 'months',
    'planCumulative', 'planWeekly', 'projectName', 'start', 'status', 'tasks'].sort();
const SC_TASK_KEYS = ['actual', 'budget', 'duration', 'durationFromManDay', 'excelRow', 'finish', 'id', 'installment', 'name',
    'plan', 'progress', 'start', 'weight'].sort();

/** Checks the S-Curve; returns the D1 shift of the project duration (app − Excel AA2). */
function checkSchedule(o: ExcelOracle, c: PlanCase, res: AppResult): number {
    const s = res.planning.schedule;
    expect(Object.keys(s).sort(), 'S-Curve output keys').toEqual(SC_KEYS);
    expect(s.buckets, 'the plans stay within the 12 Excel months').toHaveLength(SC_BUCKETS);
    const views = new Map(s.tasks.map(t => [t.id, scurveView(t, s.buckets)]));

    // Axis rows 9–12 (BE10 = end of month: Excel's row-10 formula is right, only the grid loses BE).
    s.buckets.forEach((b, k) => {
        expect(cell(o, `${SC}!${scCol(k)}9`), `row 9 ${scCol(k)}`).toBe(b.startSerial);
        expect(cell(o, `${SC}!${scCol(k)}10`), `row 10 ${scCol(k)}`).toBe(b.endSerial);
        expect(text(o, `${SC}!${scCol(k)}12`)).toBe(b.weekLabel);
        if (b.week === 1) expect(text(o, `${SC}!${scCol(k)}11`)).toBe(b.monthLabel);
    });

    // Tasks: PLAN row D–H + grid, ACTUAL row D–H + grid, BF.
    for (const t of s.tasks) {
        expect(Object.keys(t).sort(), 'S-Curve task keys').toEqual(SC_TASK_KEYS);
        const r = t.excelRow;
        const label = `S-Curve ${t.id} row ${r}`;
        const v = must(views.get(t.id), t.id);
        expect(text(o, `${SC}!C${r}`)).toBe(t.name);
        expect(t.durationFromManDay).toBe(t.id !== '4.2' || c.planning.schedule.tasks['4.2']?.duration === null);
        expectClose(t.duration, o.num(`${SC}!D${r}`), `${label} D`);
        expectDate(t.start, o, `${SC}!E${r}`, `${label} E`);
        expectDate(t.finish, o, `${SC}!F${r}`, `${label} F`);
        expectClose(t.budget, o.num(`${SC}!G${r}`), `${label} G`);
        expectClose(t.weight, o.num(`${SC}!H${r}`), `${label} H`);
        expectClose(t.progress, num0(o, `${SC}!BF${r}`), `${label} BF`);
        expectNullable(t.actual.duration, o, `${SC}!D${r + 1}`, `${label} actual D`);
        expectDate(t.actual.start, o, `${SC}!E${r + 1}`, `${label} actual E`);
        expectDate(t.actual.finish, o, `${SC}!F${r + 1}`, `${label} actual F`);
        expectNullable(t.actual.cost, o, `${SC}!G${r + 1}`, `${label} actual G`);
        expectClose(t.actual.weight, o.num(`${SC}!H${r + 1}`), `${label} actual H`);
        for (const k of range(SC_BUCKETS)) {
            for (const [kind, row, share] of [['plan', r, v.plan[k] ?? null], ['actual', r + 1, v.actual[k] ?? null]] as const) {
                const ref = `${SC}!${scCol(k)}${row}`;
                const x = cell(o, ref);
                if (share === null) expect(x, `${label} ${kind} ${ref}: Excel "" (no overlap / D1 BE)`).toBeNull();
                else expectClose(share, typeof x === 'number' ? x : NaN, `${label} ${kind} ${ref} (+1E-12)`);
            }
        }
    }

    // Rows 86–93: app + Excel's 1E-12 per non-empty share − the D1 BE bucket.
    const sumViews = (kind: 'plan' | 'actual', k: number) => sum(s.tasks.map(t => must(views.get(t.id), t.id)[kind][k] ?? 0));
    const e86 = range(SC_BUCKETS).map(k => sumViews('plan', k));
    const e90 = range(SC_BUCKETS).map(k => sumViews('actual', k));
    const cum = (xs: number[]) => { let a = 0; return xs.map(x => (a += x)); };
    const e87 = cum(e86);
    const e91 = cum(e90);
    for (const k of range(SC_BUCKETS)) {
        const col = scCol(k);
        expectClose(e86[k], o.num(`${SC}!${col}86`), `row 86 ${col}`);
        expectClose(e87[k], o.num(`${SC}!${col}87`), `row 87 ${col}`);
        expectClose(e90[k], o.num(`${SC}!${col}90`), `row 90 ${col}`);
        expectClose(e91[k], o.num(`${SC}!${col}91`), `row 91 ${col}`);
        // Narrow: before BE, Excel's view differs from the app only by the 1E-12s (≤ one per task).
        if (k !== LAST) {
            expect(Math.abs((e86[k] ?? NaN) - (s.planWeekly[k] ?? NaN)), `row 86 ${col} − app`).toBeLessThanOrEqual(s.tasks.length * EPS * 1.01);
            expect(Math.abs((e90[k] ?? NaN) - (s.actualWeekly[k] ?? NaN)), `row 90 ${col} − app`).toBeLessThanOrEqual(s.tasks.length * EPS * 1.01);
        }
    }
    // D1 BE: Excel loses exactly the app's last-bucket shares.
    expect(e86[LAST]).toBe(0);
    expect(e90[LAST]).toBe(0);
    expectClose((s.planWeekly[LAST] ?? NaN) - (e86[LAST] ?? NaN), sum(s.tasks.map(t => t.plan[LAST] ?? 0)), 'BE86 delta');
    expect(s.months).toHaveLength(12);
    for (const m of s.months) {
        const col = scCol(m.firstBucket);
        const ks = [0, 1, 2, 3].map(i => m.firstBucket + i);
        expect(text(o, `${SC}!${col}11`)).toBe(m.label);
        expectClose(m.planCost + sum(ks.map(k => (e86[k] ?? 0) - (s.planWeekly[k] ?? 0))) * s.budget, o.num(`${SC}!${col}88`), `row 88 ${m.label}`);
        expectClose(m.planCumulativeCost + ((e87[m.firstBucket + 3] ?? 0) - (s.planCumulative[m.firstBucket + 3] ?? 0)) * s.budget, o.num(`${SC}!${col}89`), `row 89 ${m.label}`);
        expectClose(m.actualCost + sum(ks.map(k => (e90[k] ?? 0) - (s.actualWeekly[k] ?? 0))) * s.budget, o.num(`${SC}!${col}92`), `row 92 ${m.label}`);
        expectClose(m.actualCumulativeCost + ((e91[m.firstBucket + 3] ?? 0) - (s.actualCumulative[m.firstBucket + 3] ?? 0)) * s.budget, o.num(`${SC}!${col}93`), `row 93 ${m.label}`);
    }

    // Header D4–D7. D1: D5 = earliest start / D6 = latest finish; Excel D5 = E14, D6 = F83.
    expect(text(o, `${SC}!D4`)).toBe(s.projectName);
    const e14 = o.num(`${SC}!E14`);
    const f83 = o.num(`${SC}!F83`);
    expect(o.num(`${SC}!D5`)).toBe(e14);
    expect(o.num(`${SC}!D6`)).toBe(f83);
    const planStarts = PLAN_TASKS.flatMap(t => { const v = cell(o, `${SC}!E${t.excelRow}`); return typeof v === 'number' ? [v] : []; });
    const planFinishes = PLAN_TASKS.flatMap(t => { const v = cell(o, `${SC}!F${t.excelRow}`); return typeof v === 'number' ? [v] : []; });
    const dStart = Math.min(...planStarts) - e14;      // ≤ 0
    const dFinish = Math.max(...planFinishes) - f83;   // ≥ 0
    expect(isoToSerial(s.start)).toBe(e14 + dStart);
    expect(isoToSerial(s.finish)).toBe(f83 + dFinish);
    expect(s.durationDays).toBe(f83 + dFinish - (e14 + dStart) + 1);
    expectClose(s.budget, o.num(`${SC}!D7`), 'D7');

    // Installment groups: no Excel cell (header rows D..I are empty) — sums of their tasks.
    for (const g of s.installments) {
        const ts = s.tasks.filter(t => t.installment === g.no);
        expect(g.taskIds).toEqual(ts.map(t => t.id));
        expectClose(g.budget, sum(ts.map(t => o.num(`${SC}!G${t.excelRow}`))), `installment ${g.no} budget`);
        expectClose(g.weight, sum(ts.map(t => o.num(`${SC}!H${t.excelRow}`))), `installment ${g.no} weight`);
        const fins = ts.flatMap(t => { const v = cell(o, `${SC}!F${t.excelRow}`); return typeof v === 'number' ? [v] : []; });
        expect(isoToSerial(g.finish)).toBe(fins.length ? Math.max(...fins) : null);
    }

    // Q4–Q7.
    const st = s.status;
    expect(Object.keys(st).sort()).toEqual(['delayDays', 'delayStatus', 'delayText', 'earnedValue', 'lastUpdate', 'spent']);
    const q4 = cell(o, `${SC}!Q4`);
    if (st.lastUpdate === null) expect(q4, 'Q4 with no ACTUAL').toEqual({ error: '#N/A' });
    else expect(q4, 'Q4').toBe(isoToSerial(st.lastUpdate));
    expectClose(st.earnedValue, o.num(`${SC}!Q5`), 'Q5');
    if (st.spent === null) expectNullable(null, o, `${SC}!Q6`, 'Q6');
    else {
        const i = bucketIndexOf(s.buckets, must(isoToSerial(st.lastUpdate), 'Q4'));
        expectClose(st.spent, (s.actualCumulative[i] ?? NaN) * s.budget, 'Q6 app');
        expectClose((e91[i] ?? NaN) * s.budget, o.num(`${SC}!Q6`), 'Q6 (+1E-12s)');
    }
    const q7 = text(o, `${SC}!Q7`);
    expect(st.delayText ?? '', 'Q7').toBe(q7);
    const ahead = /^เร็วกว่าแผน (\d+) วัน$/.exec(q7);
    const late = /^ช้ากว่าแผน (\d+) วัน$/.exec(q7);
    expect(st.delayDays).toBe(ahead ? Number(ahead[1]) : late ? -Number(late[1]) : q7 === 'ตรงตามแผน' ? 0 : null);
    expect(st.delayStatus).toBe(ahead ? 'ahead' : late ? 'late' : q7 === 'ตรงตามแผน' ? 'onTime' : null);

    return dFinish - dStart;
}

function caseTouchesLastBucket(res: AppResult): boolean {
    return res.planning.schedule.tasks.some(t => (t.plan[LAST] ?? 0) > 0 || (t.actual.weekly[LAST] ?? 0) > 0);
}

// ─── CashFlow ───────────────────────────────────────────────────────────────
const CF_KEYS = ['buckets', 'cost', 'cumulative', 'costWeekly', 'evm', 'groups', 'incomeWeekly', 'installmentPctTotal', 'installments',
    'minCumulative', 'months', 'netWeekly', 'opexWeekly', 'outflowWeekly', 'planPctWeekly', 'profitWeekly', 'quotation', 'tasks',
    'totalIncome', 'totalOutflow'].sort();
const EVM_KEYS = ['ac', 'bac', 'cpi', 'cv', 'duration', 'eacCost', 'eacDays', 'ev', 'profitForecast', 'profitPlan', 'pv', 'spi', 'sv', 'vac'].sort();

/** D1 rows 26/29: what Excel's four misaligned cells read, from the S-Curve PLAN rows of tasks 1.6 (24) and 2.2 (31). */
interface OffsetDelta { byBucket: Map<number, number>; effect: boolean }

function checkOffsetCells(o: ExcelOracle, cfX: CashFlowResult): OffsetDelta {
    const sc = (k: number, row: number) => cell(o, `${SC}!${scCol(k)}${row}`);
    const t16 = must(cfX.tasks.find(t => t.id === '1.6'), '1.6');
    const t22 = must(cfX.tasks.find(t => t.id === '2.2'), '2.2');
    // Excel: K26 COLUMN(#REF!) → "", L26 COLUMN(H7) → week 8 (bucket 7), R29 COLUMN(P10) → bucket 15, S29 → "".
    expect(cell(o, `${CF}!K26`), 'K26 (#REF!)').toBeNull();
    expect(cell(o, `${CF}!L26`), 'L26 reads bucket 7').toEqual(sc(7, 24));
    expect(cell(o, `${CF}!R29`), 'R29 reads bucket 15').toEqual(sc(15, 31));
    expect(cell(o, `${CF}!S29`), 'S29 (#REF!)').toBeNull();
    // The app reads the right bucket.
    const n = (x: Cell) => (typeof x === 'number' ? x : 0);
    expectClose(t16.weekly[7], n(sc(7, 24)), 'app 1.6 bucket 7');
    expectClose(t16.weekly[8], n(sc(8, 24)), 'app 1.6 bucket 8');
    expectClose(t22.weekly[14], n(sc(14, 31)), 'app 2.2 bucket 14');
    expectClose(t22.weekly[15], n(sc(15, 31)), 'app 2.2 bucket 15');
    // app − Excel per bucket
    const byBucket = new Map([
        [7, n(sc(7, 24))], [8, n(sc(8, 24)) - n(sc(7, 24))],
        [14, n(sc(14, 31)) - n(sc(15, 31))], [15, n(sc(15, 31))],
    ]);
    return { byBucket, effect: [...byBucket.values()].some(d => d !== 0) };
}

/** Rows 21–52 of every task, except (raw pass) the four misaligned cells checked by checkOffsetCells. */
function checkTaskRows(o: ExcelOracle, cfX: CashFlowResult, skipOffsetCells: boolean): void {
    for (const t of cfX.tasks) {
        expect(text(o, `${CF}!C${t.excelRow}`)).toBe(t.name);
        for (const k of range(CF_BUCKETS)) {
            if (skipOffsetCells && ((t.excelRow === 26 && (k === 7 || k === 8)) || (t.excelRow === 29 && (k === 14 || k === 15)))) continue;
            expectClose(t.weekly[k], num0(o, `${CF}!${cfCol(k)}${t.excelRow}`), `CashFlow ${t.id} ${cfCol(k)}${t.excelRow}`);
        }
    }
}

function checkCashFlow(o: ExcelOracle, c: PlanCase, res: AppResult, cfX: CashFlowResult, durDelta: number): void {
    const input = c.planning.cashflow;
    expect(Object.keys(cfX).sort(), 'CashFlow output keys').toEqual(CF_KEYS);
    expect(Object.keys(cfX.evm).sort(), 'EVM keys').toEqual(EVM_KEYS);
    const n = cfX.buckets.length;
    const extra = range(n).filter(k => k >= CF_BUCKETS);   // D18: app columns beyond W
    const ks = range(CF_BUCKETS);
    expect(n).toBeGreaterThanOrEqual(CF_BUCKETS);

    expectClose(cfX.cost, o.num(`${CF}!D2`), 'D2');
    expectClose(cfX.cost, o.num(`${BOQ}!M310`), 'D2 = BOQ M310');
    expectClose(cfX.quotation, o.num(`${CF}!K2`), 'K2');
    for (const m of range(5)) expect(text(o, `${CF}!${cfCol(4 * m)}4`)).toBe(cfX.months[m]?.label);
    for (const k of ks) expect(text(o, `${CF}!${cfCol(k)}5`)).toBe(cfX.buckets[k]?.weekLabel);

    // Rows 6–14.
    cfX.installments.forEach((inst, i) => {
        const r = 6 + i;
        expect(inst.no).toBe(i);
        expect(inst.label).toBe(text(o, `${CF}!C${r}`));
        expectClose(inst.pct, o.num(`${CF}!B${r}`), `B${r}`);
        for (const k of ks) expectClose(inst.weekly[k], num0(o, `${CF}!${cfCol(k)}${r}`), `${cfCol(k)}${r}`);
        for (const k of extra) expect(inst.weekly[k]).toBe(0);
        if (inst.bucket !== null) expectClose(inst.amount, o.num(`${CF}!${cfCol(inst.bucket)}${r}`), `amount ${r}`);
        else expectClose(inst.amount, inst.pct * o.num(`${CF}!K2`), `amount ${r} (not placed)`);
    });
    expectClose(cfX.installmentPctTotal, Number(o.evaluate(`=SUM(B6:B14)`, CF)), 'Σ B6:B14');
    // D1 row 15: Excel D15 = SUM(D6:D13) leaves out งวดที่ 8 (row 14) in the first week.
    const lostD15 = cfX.installments[8]?.weekly[0] ?? 0;
    const atD = (k: number) => (k === 0 ? lostD15 : 0);

    // Rows 21–52 (the four misaligned cells are fixed in this pass) and the group shares B.
    checkTaskRows(o, cfX, false);
    const extraShare = (t: CashFlowResult['tasks'][number]) => sum(extra.map(k => t.weekly[k] ?? 0));
    for (const t of cfX.tasks) {
        expectClose(t.share - extraShare(t), Number(o.evaluate(`=SUM(D${t.excelRow}:W${t.excelRow})`, CF)), `Σ D:W ${t.excelRow}`);
        expectClose(t.progress, num0(o, `${CF}!Y${t.excelRow}`), `Y${t.excelRow}`);
        if (extraShare(t) > 0) expect(t.progress, `${t.id} runs past W: 0 % complete (narrowing)`).toBe(0);
        expectClose(t.earnedValue, num0(o, `${CF}!Z${t.excelRow}`), `Z${t.excelRow}`);
    }
    cfX.groups.forEach((g, i) => {
        const gt = cfX.tasks.filter(t => t.installment === g.no);
        expectClose(g.share - sum(gt.map(extraShare)), o.num(`${CF}!B${GROUP_ROWS[i] ?? 0}`), `B${GROUP_ROWS[i] ?? 0}`);
    });
    const extraTotal = sum(cfX.tasks.map(extraShare));
    expectClose(sum(cfX.groups.map(g => g.share)) - extraTotal, o.num(`${CF}!B54`), 'B54');
    expectClose(sum(cfX.tasks.map(t => t.share)) - extraTotal, o.num(`${CF}!Y55`), 'Y55');

    // Rows 15–18 and 54–59.
    for (const k of ks) {
        const col = cfCol(k);
        expectClose(cfX.incomeWeekly[k] - atD(k), o.num(`${CF}!${col}15`), `${col}15`);
        expectClose(cfX.outflowWeekly[k], o.num(`${CF}!${col}16`), `${col}16`);
        expectClose((cfX.netWeekly[k] ?? NaN) - atD(k), o.num(`${CF}!${col}17`), `${col}17`);
        expectClose((cfX.cumulative[k] ?? NaN) - lostD15, o.num(`${CF}!${col}18`), `${col}18`);
        expectClose(cfX.planPctWeekly[k], o.num(`${CF}!${col}54`), `${col}54`);
        expectClose(cfX.costWeekly[k], o.num(`${CF}!${col}55`), `${col}55`);
        expectClose(cfX.opexWeekly[k], o.num(`${CF}!${col}56`), `${col}56`);
        expectClose(cfX.outflowWeekly[k], o.num(`${CF}!${col}57`), `${col}57`);
        expectClose(cfX.profitWeekly[k], o.num(`${CF}!${col}59`), `${col}59`);
    }
    const extraOutflow = sum(extra.map(k => cfX.outflowWeekly[k] ?? 0));
    const extraProfit = sum(extra.map(k => cfX.profitWeekly[k] ?? 0));
    expectClose(cfX.totalIncome - lostD15, Number(o.evaluate('=SUM(D15:W15)', CF)), 'Σ row 15');
    expectClose(cfX.totalOutflow - extraOutflow, Number(o.evaluate('=SUM(D16:W16)', CF)), 'Σ row 16');
    // minCumulative: no Excel cell — the minimum of row 18 (+ the D15 shift), or of the app's later columns.
    const excelMin = Number(o.evaluate('=MIN(D18:W18)', CF)) + lostD15;
    const excelArg = Number(o.evaluate('=MATCH(MIN(D18:W18),D18:W18,0)', CF)) - 1;
    const later = extra.map(k => cfX.cumulative[k] ?? NaN);
    const laterMin = later.length ? Math.min(...later) : Infinity;
    const m = must(cfX.minCumulative, 'minCumulative');
    if (laterMin < excelMin - 1e-6) {
        expectClose(m.value, laterMin, 'min cumulative (later column)');
        expect(m.bucket).toBe(CF_BUCKETS + later.indexOf(laterMin));
    } else {
        expectClose(m.value, excelMin, 'min cumulative');
        expect(m.bucket).toBe(excelArg);
    }

    // EVM dashboard.
    const e = cfX.evm;
    expect(e.duration, 'AA2 (D1 D5/D6 delta)').toBe(o.num(`${CF}!AA2`) + durDelta);
    expect(e.duration).toBe(res.planning.schedule.durationDays);
    expectClose(e.bac, o.num(`${CF}!AA4`), 'AA4');
    expectClose(e.pv, o.num(`${CF}!AA6`), 'AA6');
    expectClose(e.ev, o.num(`${CF}!Z19`), 'Z19');
    expectClose(e.ac, o.num(`${CF}!Z18`), 'Z18');
    expectClose(e.sv, o.num(`${CF}!AA7`), 'AA7');
    expectClose(e.cv, o.num(`${CF}!AA8`), 'AA8');
    expectNullable(e.spi, o, `${CF}!AA9`, 'AA9');
    expectNullable(e.cpi, o, `${CF}!AA10`, 'AA10');
    if (e.eacDays === null || durDelta === 0) expectNullable(e.eacDays, o, `${CF}!AA11`, 'AA11');
    else expectClose(e.eacDays, o.num(`${CF}!AA11`) + durDelta / o.num(`${CF}!AA9`), 'AA11 + D1 duration delta ÷ SPI');
    expectNullable(e.eacCost, o, `${CF}!AA12`, 'AA12');
    expectNullable(e.vac, o, `${CF}!AA13`, 'AA13');
    expectClose(e.profitPlan - extraProfit, o.num(`${CF}!AA14`), 'AA14 (− D18 later columns)');
    expectNullable(e.profitForecast === null ? null : e.profitForecast - extraProfit, o, `${CF}!AA15`, 'AA15 (− D18 later columns)');
    expect(input.pvBuckets).toBeLessThanOrEqual(CF_BUCKETS);
}

/** The app's real CashFlow vs the one recomputed on Excel's +1E-12 shares: within the documented ฿0.001. */
function checkAppVsExcelShares(app: CashFlowResult, cfX: CashFlowResult): void {
    app.tasks.forEach((t, i) => t.weekly.forEach((v, k) => {
        expect(Math.abs((cfX.tasks[i]?.weekly[k] ?? NaN) - v), `1E-12 on ${t.id}[${k}]`).toBeLessThanOrEqual(EPS * 1.001);
    }));
    const money = (a: number, b: number, label: string) => expect(Math.abs(a - b), label).toBeLessThanOrEqual(1e-3);
    for (const key of ['costWeekly', 'opexWeekly', 'outflowWeekly', 'profitWeekly', 'netWeekly', 'cumulative'] as const) {
        app[key].forEach((v, k) => { money(v, cfX[key][k] ?? NaN, `${key}[${k}]`); });
    }
    money(app.evm.pv, cfX.evm.pv, 'PV');
    money(app.evm.ev, cfX.evm.ev, 'EV');
    money(app.evm.profitPlan, cfX.evm.profitPlan, 'profit');
}

// ─── Branch coverage ────────────────────────────────────────────────────────
function branchesOf(c: PlanCase, res: AppResult): string[] {
    const out: string[] = [];
    const { manday, schedule, cashflow } = c.planning;
    const s = res.planning.schedule;
    const md = res.planning.manday;
    out.push(PLAN_TASKS.some(t => {
        const w = manday.wageSets[must(manday.blocks[t.id], t.id).wageSet];
        const x = EXCEL_WAGES[t.sample.wageSet];
        return w.skilled !== x.skilled || w.labourer !== x.labourer;
    }) ? 'MD wages typed into R' : 'MD Excel wage constants');
    out.push(manday.subcontractLabourShare === EXCEL_SHARE ? 'MD Excel 20 % share' : 'MD share typed into S233/S278');
    if (md.blocks.some(b => b.labourBasis !== 'none' && b.dailyWage === 0)) out.push('MD R = 0 (S #DIV/0!)');
    if (md.blocks.some(b => b.labourBasis === 'none' && b.crew > 0)) out.push('MD piles with a crew (S34 blank)');
    if (md.blocks.some(b => b.days === 0)) out.push('MD T = 0');
    if (Object.keys(c.labour).length) out.push('BOQ labour changed');
    out.push(schedule.tasks['4.2']?.duration === null ? 'SC D49 = Man-Day T184' : 'SC D49 typed');
    if (s.tasks.some(t => t.start === null)) out.push('SC unscheduled task');
    out.push(s.start === s.tasks[0]?.start ? 'SC D5 = E14' : 'SC D1 earlier start than E14');
    out.push(s.finish === s.tasks[31]?.finish ? 'SC D6 = F83' : 'SC D1 later finish than F83');
    out.push(s.status.lastUpdate === null ? 'SC no ACTUAL (Q4 #N/A)' : `SC Q7 ${s.status.delayStatus ?? 'blank'}`);
    if (Object.values(schedule.tasks).some(t => t.actual !== undefined && t.actual.cost === undefined)) out.push('SC actual without cost');
    if (Object.values(schedule.tasks).some(t => t.actual !== undefined && t.actual.days === undefined)) out.push('SC actual without days');
    if (s.status.earnedValue > 0) out.push('SC Q5 > 0');
    if (caseTouchesLastBucket(res)) out.push('SC D1 last bucket BE');
    const cf = res.planning.cashflow;
    out.push(cf.buckets.length > CF_BUCKETS ? 'CF D18 axis grows' : 'CF 20 columns');
    const t16 = cf.tasks.find(t => t.id === '1.6');
    const t22 = cf.tasks.find(t => t.id === '2.2');
    if ((t16?.weekly[7] ?? 0) + (t16?.weekly[8] ?? 0) + (t22?.weekly[14] ?? 0) + (t22?.weekly[15] ?? 0) > 0) out.push('CF D1 rows 26/29');
    if (cashflow.installments[8]?.bucket === 0) out.push('CF D1 D15 without row 14');
    if (cashflow.installments.some(i => i.bucket === null)) out.push('CF installment not placed');
    if (cashflow.installments.some((i, k) => i.bucket !== SAMPLE_BUCKETS[k])) out.push('CF installments moved');
    out.push(cashflow.quotationFactor === EXCEL_QUOTATION ? 'CF ×1.3' : 'CF quotation typed');
    if (cashflow.operatingCostRate !== EXCEL_OPEX) out.push('CF opex typed');
    if (cashflow.profitRate !== EXCEL_PROFIT) out.push('CF profit typed');
    out.push(cashflow.pvBuckets === EXCEL_PV ? 'CF PV D57:K57' : 'CF PV range typed');
    if (cf.evm.spi === null) out.push('CF SPI #DIV/0!');
    if (cf.evm.cpi === null) out.push('CF CPI #DIV/0!');
    return out;
}

const ALL_BRANCHES = [
    'BOQ labour changed', 'CF ×1.3', 'CF 20 columns', 'CF CPI #DIV/0!', 'CF D1 D15 without row 14', 'CF D1 rows 26/29',
    'CF D18 axis grows', 'CF PV D57:K57', 'CF PV range typed', 'CF SPI #DIV/0!', 'CF installment not placed', 'CF installments moved',
    'CF opex typed', 'CF profit typed', 'CF quotation typed', 'MD Excel 20 % share', 'MD Excel wage constants', 'MD R = 0 (S #DIV/0!)',
    'MD T = 0', 'MD piles with a crew (S34 blank)', 'MD share typed into S233/S278', 'MD wages typed into R', 'SC D1 earlier start than E14',
    'SC D1 last bucket BE', 'SC D1 later finish than F83', 'SC D49 = Man-Day T184', 'SC D49 typed', 'SC D5 = E14', 'SC D6 = F83',
    'SC Q5 > 0', 'SC Q7 ahead', 'SC Q7 late', 'SC Q7 onTime', 'SC actual without cost', 'SC actual without days',
    'SC no ACTUAL (Q4 #N/A)', 'SC unscheduled task',
].sort();

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('Man-Day / S-Curve / CashFlow vs Excel formulas (oracle, whole workbook)', () => {
    let oracle: ExcelOracle;
    let fixes: OffsetFixes;
    beforeAll(async () => {
        oracle = await loadV5Oracle('all');
        const f = (ref: string) => must(oracle.formula(`${CF}!${ref}`), ref);
        fixes = {
            K26: f('K26').replace('COLUMN(#REF!)', 'COLUMN(H7)'),
            L26: f('L26').replace('COLUMN(H7)', 'COLUMN(I7)'),
            R29: f('R29').replace('COLUMN(P10)', 'COLUMN(O10)'),
            S29: f('S29').replace('COLUMN(#REF!)', 'COLUMN(P10)'),
        };
    }, 180_000);

    it('the formulas whose constants the cases type are the documented ones; everything compared is live', () => {
        oracle.reset();
        expect(oracle.fallbacks).toEqual([]);
        for (const ref of [`${MD}!S82`, `${MD}!U310`, `${SC}!Q6`, `${SC}!Q7`, `${SC}!AC87`, `${CF}!W18`, `${CF}!AA15`]) {
            expect(oracle.frozenPrecedents(ref), ref).toEqual([]);
        }
        for (const t of PLAN_TASKS) {
            const r = t.manday.excelRow;
            const w = EXCEL_WAGES[t.sample.wageSet];
            expect(norm(oracle.formula(`${MD}!R${r}`)), `R${r}`).toBe(norm(`(${w.skilled}*O${r})+(${w.labourer}*P${r})`));
            for (const col of ['O', 'P', 'T']) expect(oracle.formula(`${MD}!${col}${r}`), `${col}${r} is typed`).toBeUndefined();
            expect(oracle.formula(`${SC}!E${t.excelRow}`), `E${t.excelRow} is typed`).toBeUndefined();
            expect(norm(oracle.formula(`${SC}!D${t.excelRow}`))).toBe(t.id === '4.2' ? '' : norm(`'Man-Day_Basic'!T${r}`));
        }
        expect(norm(oracle.formula(`${MD}!S233`))).toBe('(L243*0.2)/R233');
        expect(norm(oracle.formula(`${MD}!S278`))).toBe('(L280*0.2)/R278');
        for (const row of LABOUR_ROWS) {
            expect(oracle.formula(`${BOQ}!K${row}`), `BOQ K${row} is typed`).toBeUndefined();
            expect(oracle.formula(`${MD}!J${row}`), `Man-Day J${row} is typed`).toBeUndefined();
        }
        expect(norm(oracle.formula(`${CF}!K2`))).toBe('D2*1.3');
        expect(norm(oracle.formula(`${CF}!AA4`))).toBe('D2*1.15');
        expect(norm(oracle.formula(`${CF}!AA6`))).toBe('SUM(D57:K57)');
        for (const k of range(CF_BUCKETS)) {
            expect(norm(oracle.formula(`${CF}!${cfCol(k)}56`))).toBe(`${cfCol(k)}55*15%`);
            expect(norm(oracle.formula(`${CF}!${cfCol(k)}59`))).toBe(`${cfCol(k)}55*15%`);
        }
        SAMPLE_BUCKETS.forEach((b, i) => { expect(norm(oracle.formula(`${CF}!${cfCol(b ?? 0)}${6 + i}`))).toBe(`B${6 + i}*$K$2`); });
        // The documented Excel bugs the D1 deltas rest on.
        expect(norm(oracle.formula(`${CF}!D15`))).toBe('SUM(D6:D13)');
        expect(norm(oracle.formula(`${SC}!D5`))).toBe('E14');
        expect(norm(oracle.formula(`${SC}!D6`))).toBe('F83');
        expect(norm(oracle.formula(`${CF}!K26`))).toContain('COLUMN(#REF!)');
        expect(norm(oracle.formula(`${CF}!L26`))).toContain('COLUMN(H7)');
        expect(norm(oracle.formula(`${CF}!R29`))).toContain('COLUMN(P10)');
        expect(norm(oracle.formula(`${CF}!S29`))).toContain('COLUMN(#REF!)');
        expect(norm(oracle.formula(`${CF}!M26`))).toContain('COLUMN(J7)');   // the neighbours are right
        expect(norm(oracle.formula(`${CF}!T29`))).toContain('COLUMN(Q10)');
        expect(norm(oracle.formula(`${SC}!BE14`))).toContain('IFERROR(BF$9-1,BE$9+6)');   // BF9 blank → wkEnd −1
        expect(oracle.get(`${SC}!BF9`)).toBeNull();
        expect(norm(oracle.formula(`${SC}!BE13`))).toContain('IFERROR(#REF!-1,BE$9+6)');
    });

    it.each(CASES)('%s', (_name, c) => {
        const res = appResult(c);
        const schedule = res.planning.schedule;
        const cost = res.boq.constructionTotal;
        // The app's CashFlow is computeCashFlow() on the S-Curve; cfX is the same function on Excel's shares.
        expect(computeCashFlow(c.planning.cashflow, schedule, cost)).toEqual(res.planning.cashflow);
        const cfX = computeCashFlow(c.planning.cashflow, scheduleAsExcel(schedule), cost);
        checkAppVsExcelShares(res.planning.cashflow, cfX);

        oracle.replaceInputs(excelInputs(c));
        expect(oracle.spillOverflows).toEqual([]);
        for (const row of Object.keys(c.labour)) expectBoqRow(oracle, res.boq, `R${row}`, Number(row));
        expectClose(res.boq.sections[2]?.total, oracle.num(`${BOQ}!M17`), 'BOQ M17 (S-Curve G14)');
        checkManDay(oracle, c, res);
        const durDelta = checkSchedule(oracle, c, res);

        // D1 rows 26/29: the raw cells read the documented wrong columns; row 54 differs by exactly that.
        const offsets = checkOffsetCells(oracle, cfX);
        checkTaskRows(oracle, cfX, true);
        for (const k of range(CF_BUCKETS)) {
            expectClose(cfX.planPctWeekly[k] - (offsets.byBucket.get(k) ?? 0), oracle.num(`${CF}!${cfCol(k)}54`), `${cfCol(k)}54 raw`);
        }
        if (offsets.effect) oracle.replaceInputs(excelInputs(c, fixes));   // the four cells typed with the right column
        checkCashFlow(oracle, c, res, cfX, durDelta);
    }, 120_000);

    it('the cases exercise every branch (Excel constants and typed ones, every D1 / D18 delta, every #DIV/0! / #N/A)', () => {
        const seen = new Set(CASES.flatMap(([, c]) => branchesOf(c, appResult(c))));
        expect([...seen].sort()).toEqual(ALL_BRANCHES);
        // Each named D1 case really triggers its delta.
        const named = (prefix: string) => must(CASES.find(([n]) => n.startsWith(prefix)), prefix)[1];
        expect(branchesOf(named('D1 D5/D6'), appResult(named('D1 D5/D6')))).toEqual(expect.arrayContaining(['SC D1 earlier start than E14', 'SC D1 later finish than F83']));
        expect(branchesOf(named('D1 CashFlow rows'), appResult(named('D1 CashFlow rows')))).toContain('CF D1 rows 26/29');
        expect(branchesOf(named('D1 last'), appResult(named('D1 last')))).toEqual(expect.arrayContaining(['SC D1 last bucket BE', 'CF D18 axis grows']));
        expect(branchesOf(named('D1 CashFlow D15'), appResult(named('D1 CashFlow D15')))).toContain('CF D1 D15 without row 14');
        expect(CASES.filter(([n]) => n.startsWith('random'))).toHaveLength(30);
    });
});
