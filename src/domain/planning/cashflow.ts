// ─── CashFLOW_Basic ───────────────────────────────────────────────────────────
// Cash-IN = installments (% of the quotation) placed in chosen week buckets.
// Cash-OUT = construction cost × the S-Curve plan share of each week, plus operating cost.
// Cumulative cash position and a small EVM dashboard. No VAT, retention or contingency (as Excel).
// docs/excel-spec/06-manday-scurve-cashflow.md §3.
import { buildWeekBuckets, monthSpan, monthsOf, isoToSerial, type MonthBucket, type WeekBucket } from './calendar';
import type { ScheduleResult } from './schedule';
import { INSTALLMENTS } from './tasks';

export interface CashInstallmentInput {
    /** C column label ("มัดจำทำสัญญา", "งวดที่ 1" …). */
    label: string;
    /** B column งวด % of the quotation (0.2 = 20 %). */
    pct: number;
    /** Week bucket (0 = W1 of the first month, CashFlow column D) where the amount is billed; null = not placed. */
    bucket: number | null;
}

export interface CashFlowInput {
    /** K2 = D2 × 1.3 (decision D18: configurable, default Excel). */
    quotationFactor: number;
    /** Row 56 ค่าใช้จ่ายดำเนินงาน 15 % of the weekly cost; also BAC = cost × (1 + rate) (AA4). */
    operatingCostRate: number;
    /** Row 59 กำไร 15 % of the weekly cost. */
    profitRate: number;
    /** Minimum axis length in months (Excel D..W = 20 buckets = 5 months). Grows to cover the plan. */
    minMonths: number;
    /** Rows 6–14: deposit + งวดที่ 1–8. */
    installments: CashInstallmentInput[];
    /** Y21:Y53 % complete per task id for the earned value (separate from the S-Curve BF, as Excel). */
    progress: Record<string, number>;
    /** Z18 Actual Cost (AC), typed. */
    actualCost: number;
    /** AA6 PV = Σ cost+opex of the first N buckets (Excel SUM(D57:K57) "(end of Week 7)" → 8). */
    pvBuckets: number;
}

export interface CashInstallmentResult extends CashInstallmentInput {
    no: number;               // A: 0 = deposit, 1–8
    amount: number;           // B × K2
    weekly: number[];
}

export interface CashOutTaskResult {
    id: string;
    installment: number;
    name: string;
    excelRow: number;
    /** Planned share per bucket (from the S-Curve PLAN row). */
    weekly: number[];
    /** Σ weekly. */
    share: number;
    /** Z column: progress × share × BAC. */
    earnedValue: number;
    progress: number;
}

export interface CashOutGroupResult {
    no: number;
    label: string;
    /** B21 … (merged per งวด): Σ shares of the group's tasks. */
    share: number;
}

export interface EvmResult {
    /** AA2 Duration (Plan) วัน. */
    duration: number;
    /** AA4 budget incl. operating cost (BAC). */
    bac: number;
    pv: number;           // AA6
    ev: number;           // Z19
    ac: number;           // Z18
    sv: number;           // AA7 EV − PV
    cv: number;           // AA8 EV − AC
    spi: number | null;   // AA9 EV / PV
    cpi: number | null;   // AA10 EV / AC
    /** AA11 Estimated Time at Completion = Duration ÷ SPI. */
    eacDays: number | null;
    /** AA12 Cost Estimate at Completion = BAC ÷ CPI. */
    eacCost: number | null;
    /** AA13 (unlabelled) BAC − EAC. */
    vac: number | null;
    /** AA14 Net Profit (Plan) = Σ row 59. */
    profitPlan: number;
    /** AA15 Net Profit (Forecasting) = AA14 + AA13. */
    profitForecast: number | null;
}

export interface CashFlowResult {
    /** D2 construction cost = BOQ construction total (M310). */
    cost: number;
    /** K2 quotation. */
    quotation: number;
    buckets: WeekBucket[];
    months: MonthBucket[];
    installments: CashInstallmentResult[];
    /** Σ B6:B14 (should be 100 %). */
    installmentPctTotal: number;
    incomeWeekly: number[];       // row 15
    tasks: CashOutTaskResult[];   // rows 21–52
    groups: CashOutGroupResult[]; // B21, B28, …
    planPctWeekly: number[];      // row 54
    costWeekly: number[];         // row 55
    opexWeekly: number[];         // row 56
    outflowWeekly: number[];      // row 57 = row 16
    profitWeekly: number[];       // row 59
    netWeekly: number[];          // row 17
    cumulative: number[];         // row 18 Cash FLOW
    /** Lowest cumulative cash position and its bucket (the peak funding need). */
    minCumulative: { value: number; bucket: number } | null;
    totalIncome: number;
    totalOutflow: number;
    evm: EvmResult;
}

const finite = (x: number | undefined | null): number => (x !== undefined && x !== null && Number.isFinite(x) ? x : 0);
const div = (a: number, b: number): number | null => (b === 0 || !Number.isFinite(b) ? null : a / b);

export function computeCashFlow(input: CashFlowInput, schedule: ScheduleResult, constructionCost: number): CashFlowResult {
    const cost = finite(constructionCost);
    const quotation = cost * finite(input.quotationFactor);
    const opexRate = finite(input.operatingCostRate);
    const bac = cost * (1 + opexRate);

    // Axis = the S-Curve axis (same first month), ≥ minMonths, long enough for the plan and the
    // installments. (D1/D18: Excel stops at 20 columns and silently drops later cost.)
    const first = schedule.buckets[0];
    const placed = input.installments.flatMap(i => (i.bucket === null || !Number.isFinite(i.bucket) ? [] : [i.bucket]));
    const planMonths = first && schedule.finish ? monthSpan(first.startSerial, isoToSerial(schedule.finish) ?? first.startSerial) : 0;
    const months = Math.max(
        Math.max(1, Math.round(finite(input.minMonths))),
        planMonths,
        placed.length ? Math.floor(Math.max(...placed) / 4) + 1 : 0,
    );
    const buckets = first ? buildWeekBuckets(first.startSerial, months) : [];
    const n = buckets.length;
    const zeros = () => Array.from({ length: n }, () => 0);

    // Cash-IN.
    const installments: CashInstallmentResult[] = input.installments.map((inst, i) => {
        const amount = finite(inst.pct) * quotation;
        const weekly = zeros();
        const b = inst.bucket;
        if (b !== null && Number.isInteger(b) && b >= 0 && b < n) weekly[b] = amount;
        return { ...inst, no: i, amount, weekly };
    });
    // D1: Excel D15 = SUM(D6:D13) leaves out row 14; every row is summed here.
    const incomeWeekly = buckets.map((_, k) => installments.reduce((s, r) => s + (r.weekly[k] ?? 0), 0));

    // Cash-OUT. Tasks are linked by id (Excel MATCHes the name; rows 26 and 29 also read the wrong
    // S-Curve column — K26/S29 #REF!, L26/R29 shifted — fixed here per D1).
    const progressOf = (id: string) => finite(input.progress[id]);
    const tasks: CashOutTaskResult[] = schedule.tasks.map((t, i) => {
        const weekly = buckets.map((_, k) => t.plan[k] ?? 0);
        const share = weekly.reduce((s, x) => s + x, 0);
        const progress = progressOf(t.id);
        return {
            id: t.id, installment: t.installment, name: t.name, excelRow: 21 + i,
            weekly, share, progress, earnedValue: progress * share * bac,
        };
    });
    const groups: CashOutGroupResult[] = INSTALLMENTS.map(g => ({
        no: g.no, label: g.label,
        share: tasks.filter(t => t.installment === g.no).reduce((s, t) => s + t.share, 0),
    }));
    const planPctWeekly = buckets.map((_, k) => tasks.reduce((s, t) => s + (t.weekly[k] ?? 0), 0));
    const costWeekly = planPctWeekly.map(p => p * cost);
    const opexWeekly = costWeekly.map(c => c * opexRate);
    const outflowWeekly = costWeekly.map((c, k) => c + (opexWeekly[k] ?? 0));
    const profitWeekly = costWeekly.map(c => c * finite(input.profitRate));
    const netWeekly = incomeWeekly.map((x, k) => x - (outflowWeekly[k] ?? 0));
    let acc = 0;
    const cumulative = netWeekly.map(x => (acc += x));
    let minCumulative: CashFlowResult['minCumulative'] = null;
    cumulative.forEach((v, k) => { if (!minCumulative || v < minCumulative.value) minCumulative = { value: v, bucket: k }; });

    // EVM dashboard.
    const pvN = Math.max(0, Math.round(finite(input.pvBuckets)));
    const pv = outflowWeekly.slice(0, pvN).reduce((s, x) => s + x, 0);
    const ev = tasks.reduce((s, t) => s + t.earnedValue, 0);
    const ac = finite(input.actualCost);
    const spi = div(ev, pv);
    const cpi = div(ev, ac);
    const eacCost = cpi === null ? null : div(bac, cpi);
    const vac = eacCost === null ? null : bac - eacCost;
    const profitPlan = profitWeekly.reduce((s, x) => s + x, 0);
    const duration = schedule.durationDays;

    return {
        cost,
        quotation,
        buckets,
        months: monthsOf(buckets),
        installments,
        installmentPctTotal: input.installments.reduce((s, i) => s + finite(i.pct), 0),
        incomeWeekly,
        tasks,
        groups,
        planPctWeekly,
        costWeekly,
        opexWeekly,
        outflowWeekly,
        profitWeekly,
        netWeekly,
        cumulative,
        minCumulative,
        totalIncome: incomeWeekly.reduce((s, x) => s + x, 0),
        totalOutflow: outflowWeekly.reduce((s, x) => s + x, 0),
        evm: {
            duration,
            bac,
            pv,
            ev,
            ac,
            sv: ev - pv,
            cv: ev - ac,
            spi,
            cpi,
            eacDays: spi === null ? null : div(duration, spi),
            eacCost,
            vac,
            profitPlan,
            profitForecast: vac === null ? null : profitPlan + vac,
        },
    };
}
