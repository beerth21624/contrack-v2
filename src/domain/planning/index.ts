// ─── Planning = Man-Day → S-Curve → CashFlow (Excel v5 sheets 02–04) ─────────
// computePlanning(input, boq) is pure: BOQ result + the user's planning inputs → every number of
// the three sheets. Defaults are the Excel v5 sample inputs.
import type { BoqResult } from '../boq/types';
import { computeCashFlow, type CashFlowInput, type CashFlowResult, type CashInstallmentInput } from './cashflow';
import { computeManDay, type ManDayBlockInput, type ManDayInput, type ManDayResult } from './manday';
import { computeSchedule, type ScheduleInput, type ScheduleResult, type ScheduleTaskInput } from './schedule';
import { PLAN_TASKS } from './tasks';

export * from './calendar';
export * from './cashflow';
export * from './manday';
export * from './schedule';
export * from './tasks';

export interface PlanningInput {
    manday: ManDayInput;
    schedule: ScheduleInput;
    cashflow: CashFlowInput;
}

export interface PlanningResult {
    manday: ManDayResult;
    schedule: ScheduleResult;
    cashflow: CashFlowResult;
}

/** Excel CashFlow B6:B14 / C6:C14 and the week each amount is typed in (D6, H7, K8, L9, P10, S11, U12, V13, W14). */
const SAMPLE_INSTALLMENTS: CashInstallmentInput[] = [
    { label: 'มัดจำทำสัญญา', pct: 0.2, bucket: 0 },
    { label: 'งวดที่ 1', pct: 0.1, bucket: 4 },
    { label: 'งวดที่ 2', pct: 0.1, bucket: 7 },
    { label: 'งวดที่ 3', pct: 0.1, bucket: 8 },
    { label: 'งวดที่ 4', pct: 0.1, bucket: 12 },
    { label: 'งวดที่ 5', pct: 0.1, bucket: 15 },
    { label: 'งวดที่ 6', pct: 0.1, bucket: 17 },
    { label: 'งวดที่ 7', pct: 0.1, bucket: 18 },
    { label: 'งวดที่ 8', pct: 0.1, bucket: 19 },
];

/** Excel CashFlow Y21:Y53: 1.0 for tasks 1.1–3.1, 0.6 for 3.2 โครงหลังคา, 0 for the rest. */
function sampleEvProgress(): Record<string, number> {
    const done = new Set(['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '2.1', '2.2', '2.3', '2.4', '2.5', '3.1']);
    return Object.fromEntries(PLAN_TASKS.map(t => [t.id, done.has(t.id) ? 1 : t.id === '3.2' ? 0.6 : 0]));
}

export function defaultManDayInput(): ManDayInput {
    return {
        wageSets: { A: { skilled: 800, labourer: 500 }, B: { skilled: 1000, labourer: 600 } },
        subcontractLabourShare: 0.2,
        blocks: Object.fromEntries(PLAN_TASKS.map(t => [t.id, {
            skilled: t.sample.skilled, labourers: t.sample.labourers, wageSet: t.sample.wageSet, days: t.sample.days,
        } satisfies ManDayBlockInput])),
    };
}

export function defaultScheduleInput(): ScheduleInput {
    return {
        projectName: 'บ้านพักอาศัย คสล 1 ชั้น',
        minMonths: 12,
        tasks: Object.fromEntries(PLAN_TASKS.map(t => {
            const task: ScheduleTaskInput = { start: t.sample.start, progress: 0 };
            // S-Curve D49 is typed 4.0 instead of linking Man-Day T184.
            if (t.id === '4.2') task.duration = 4;
            // ACTUAL row 15: D15 = 1, E15 = 2026-01-10, G15 = 7,000.
            if (t.id === '1.1') task.actual = { start: '2026-01-10', days: 1, cost: 7000 };
            return [t.id, task];
        })),
    };
}

export function defaultCashFlowInput(): CashFlowInput {
    return {
        quotationFactor: 1.3,
        operatingCostRate: 0.15,
        profitRate: 0.15,
        minMonths: 5,
        installments: SAMPLE_INSTALLMENTS.map(i => ({ ...i })),
        progress: sampleEvProgress(),
        actualCost: 850000,
        pvBuckets: 8,
    };
}

/** The Excel v5 sample planning input. */
export function defaultPlanningInput(): PlanningInput {
    return { manday: defaultManDayInput(), schedule: defaultScheduleInput(), cashflow: defaultCashFlowInput() };
}

/**
 * What a blank (real) project starts from: the Excel sample plan (crews, wages, estimated days, start
 * dates, installments, rates) without the sample's progress tracking — no ACTUAL rows (the sample's
 * task 1.1 actual of 7,000 บาท), no % complete (S-Curve BF, CashFlow Y21:Y53) and no Actual Cost (Z18).
 */
export function blankPlanningInput(): PlanningInput {
    const d = defaultPlanningInput();
    return {
        manday: d.manday,
        schedule: {
            ...d.schedule,
            tasks: Object.fromEntries(Object.entries(d.schedule.tasks).map(([id, t]) => {
                const task: ScheduleTaskInput = { start: t.start, progress: 0 };
                if (t.duration !== undefined) task.duration = t.duration;
                return [id, task];
            })),
        },
        cashflow: {
            ...d.cashflow,
            progress: Object.fromEntries(PLAN_TASKS.map(t => [t.id, 0])),
            actualCost: 0,
        },
    };
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Per-key merge of a record of objects (each stored entry over its default, so new fields get defaults). */
function mergeRecord<T extends object>(defaults: Record<string, T>, stored: unknown): Record<string, T> {
    if (!isObject(stored)) return defaults;
    const out: Record<string, T> = { ...defaults };
    for (const [k, v] of Object.entries(stored)) {
        if (!isObject(v)) continue;
        out[k] = { ...(defaults[k] ?? {}), ...v } as T;
    }
    return out;
}

/**
 * Stored (possibly partial / older) planning input → a complete PlanningInput: every level falls
 * back to `base` (default: the Excel sample; `blankPlanningInput()` for a blank project), so fields
 * added later get a default.
 */
export function resolvePlanningInput(stored?: Partial<PlanningInput>, base?: PlanningInput): PlanningInput {
    const d = base ?? defaultPlanningInput();
    if (!stored) return d;
    const md = isObject(stored.manday) ? stored.manday as Partial<ManDayInput> : {};
    const sc = isObject(stored.schedule) ? stored.schedule as Partial<ScheduleInput> : {};
    const cf = isObject(stored.cashflow) ? stored.cashflow as Partial<CashFlowInput> : {};
    return {
        manday: {
            ...d.manday,
            ...md,
            wageSets: mergeRecord(d.manday.wageSets, md.wageSets) as ManDayInput['wageSets'],
            blocks: mergeRecord(d.manday.blocks, md.blocks),
        },
        schedule: {
            ...d.schedule,
            ...sc,
            tasks: mergeRecord(d.schedule.tasks, sc.tasks),
        },
        cashflow: {
            ...d.cashflow,
            ...cf,
            installments: Array.isArray(cf.installments) ? cf.installments : d.cashflow.installments,
            progress: isObject(cf.progress) ? { ...d.cashflow.progress, ...cf.progress } : d.cashflow.progress,
        },
    };
}

/** Man-Day ← BOQ, S-Curve ← Man-Day, CashFlow ← BOQ total + S-Curve. */
export function computePlanning(input: PlanningInput, boq: BoqResult): PlanningResult {
    const manday = computeManDay(input.manday, boq);
    const schedule = computeSchedule(input.schedule, manday);
    const cashflow = computeCashFlow(input.cashflow, schedule, boq.constructionTotal);
    return { manday, schedule, cashflow };
}
