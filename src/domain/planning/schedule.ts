// ─── S-Curve_Plan_Basic ───────────────────────────────────────────────────────
// 32 tasks in 8 installments. Per task: duration D = Man-Day T (task 4.2: typed), start E typed,
// finish F = E + D − 1 (calendar days), budget G = Man-Day U, weight H = G ÷ ΣG.
// Weekly grid: 4 buckets per calendar month (1–7, 8–15, 16–22, 23–end); a task's share in a bucket
// = weight × (task days inside the bucket) ÷ duration. Plan and actual rows, summary rows 86–93,
// header KPIs D5–D7 and Q4–Q7. docs/excel-spec/06-manday-scurve-cashflow.md §2.
import {
    bucketIndexOf, buildWeekBuckets, isoToSerial, monthSpan, monthsOf, overlapDays, serialToIso,
    type MonthBucket, type WeekBucket,
} from './calendar';
import type { ManDayResult } from './manday';
import { INSTALLMENTS, PLAN_TASKS } from './tasks';

/** ACTUAL row of a task (grey row under the PLAN row). All optional. */
export interface ScheduleActualInput {
    start?: string;    // E actual start (ISO date)
    days?: number;     // D actual duration
    cost?: number;     // G actual cost spent (บาท)
}

export interface ScheduleTaskInput {
    /** E วันเริ่ม of the PLAN row (ISO 'YYYY-MM-DD'); empty = task not scheduled. */
    start: string;
    /**
     * Typed duration overriding Man-Day T. Excel types it on task 4.2 only (D49 = 4.0).
     * null (or absent) = linked to Man-Day T; use null to clear the default of task 4.2.
     */
    duration?: number | null;
    actual?: ScheduleActualInput;
    /** BF % คืบหน้า (0–1), used for the earned value Q5. */
    progress?: number;
}

export interface ScheduleInput {
    /** D4 ชื่อโครงการ. */
    projectName: string;
    /** Minimum axis length in months (Excel J..BE = 12). The axis grows to cover every task. */
    minMonths: number;
    /** Keyed by task id ("1.1" … "8.6"). */
    tasks: Record<string, ScheduleTaskInput>;
}

export interface ScheduleActualResult {
    duration: number | null;
    start: string | null;
    finish: string | null;
    cost: number | null;
    /** H on the ACTUAL row = actual cost ÷ project budget. */
    weight: number;
    weekly: number[];
}

export interface ScheduleTaskResult {
    id: string;
    installment: number;
    name: string;
    excelRow: number;
    duration: number;          // D
    /** true when D comes from Man-Day T, false when typed on the S-Curve. */
    durationFromManDay: boolean;
    start: string | null;      // E
    finish: string | null;     // F
    budget: number;            // G
    weight: number;            // H
    /** Planned share of the project per week bucket (J..; 0 where Excel shows ""). */
    plan: number[];
    actual: ScheduleActualResult;
    progress: number;          // BF
}

export interface ScheduleInstallmentResult {
    no: number;
    label: string;
    taskIds: string[];
    budget: number;
    weight: number;
    /** Latest planned finish of the installment's tasks. */
    finish: string | null;
}

export interface ScheduleMonthResult extends MonthBucket {
    planCost: number;              // row 88
    planCumulativeCost: number;    // row 89
    actualCost: number;            // row 92
    actualCumulativeCost: number;  // row 93
}

export type DelayStatus = 'ahead' | 'late' | 'onTime';

export interface ScheduleStatus {
    /** Q4 last update = latest actual finish; null when no actual is entered. */
    lastUpdate: string | null;
    /** Q5 (labelled "งบประมาณตามแผน" but it is the earned value) = Σ progress × weight × budget. */
    earnedValue: number;
    /** Q6 งบที่ใช้ไป = cumulative actual % at the bucket containing Q4 × budget. */
    spent: number | null;
    /** Q7: plan finish of the last task (by order) with an actual finish − Q4. > 0 ahead, < 0 late. */
    delayDays: number | null;
    delayStatus: DelayStatus | null;
    /** Q7 text: "เร็วกว่าแผน N วัน" / "ช้ากว่าแผน N วัน" / "ตรงตามแผน". */
    delayText: string | null;
}

export interface ScheduleResult {
    projectName: string;
    /** D5 project start. */
    start: string | null;
    /** D6 project finish. */
    finish: string | null;
    /** D6 − D5 + 1 (CashFlow AA2). */
    durationDays: number;
    /** D7 project budget = Σ task budgets. */
    budget: number;
    buckets: WeekBucket[];
    months: ScheduleMonthResult[];
    tasks: ScheduleTaskResult[];
    installments: ScheduleInstallmentResult[];
    planWeekly: number[];        // row 86
    planCumulative: number[];    // row 87 (the S-curve)
    actualWeekly: number[];      // row 90
    actualCumulative: number[];  // row 91
    status: ScheduleStatus;
}

const finite = (x: number | undefined | null): number => (x !== undefined && x !== null && Number.isFinite(x) ? x : 0);

/** Task finish F = E + D − 1, or null when start or duration is missing. */
function finishOf(start: number | null, duration: number | null): number | null {
    return start === null || duration === null ? null : start + duration - 1;
}

/**
 * Spreads `weight` over the buckets by calendar-day overlap (S-Curve grid formula):
 * share = weight × overlap ÷ duration, clamped to [0, 1]; 0 when there is no overlap or D ≤ 0.
 */
export function spreadOverBuckets(
    buckets: WeekBucket[], start: number | null, finish: number | null, duration: number, weight: number,
): number[] {
    return buckets.map(b => {
        if (start === null || finish === null || duration <= 0 || !Number.isFinite(weight)) return 0;
        const ov = overlapDays(start, finish, b.startSerial, b.endSerial);
        if (ov === 0) return 0;
        return Math.min(1, Math.max(0, (weight * ov) / duration));
    });
}

const cumulative = (xs: number[]): number[] => {
    let acc = 0;
    return xs.map(x => (acc += x));
};

const sumColumns = (rows: number[][], n: number): number[] =>
    Array.from({ length: n }, (_, i) => rows.reduce((s, r) => s + (r[i] ?? 0), 0));

export function computeSchedule(input: ScheduleInput, manday: ManDayResult): ScheduleResult {
    const blocks = new Map(manday.blocks.map(b => [b.id, b]));

    // Pass 1: dates, durations, budgets.
    const base = PLAN_TASKS.map(task => {
        const ti = input.tasks[task.id];
        const block = blocks.get(task.id);
        const typed = ti?.duration;
        const durationFromManDay = typed === undefined || typed === null || !Number.isFinite(typed);
        const duration = durationFromManDay ? finite(block?.days) : typed;
        const start = isoToSerial(ti?.start);
        const finish = finishOf(start, duration);
        const a = ti?.actual;
        const aStart = isoToSerial(a?.start);
        const aDays = a?.days !== undefined && Number.isFinite(a.days) ? a.days : null;
        const aCost = a?.cost !== undefined && Number.isFinite(a.cost) ? a.cost : null;
        return {
            task, duration, durationFromManDay, start, finish,
            budget: finite(block?.budget),
            progress: finite(ti?.progress),
            actual: { start: aStart, days: aDays, finish: finishOf(aStart, aDays), cost: aCost },
        };
    });

    const budget = base.reduce((s, t) => s + t.budget, 0);
    const weightOf = (g: number) => (budget === 0 ? 0 : g / budget);

    // D5 / D6. (D1: Excel takes D5 = E14 (task 1.1) and D6 = F83 (task 8.6, the last row) — here the
    // earliest start and the latest finish, which are the same tasks in the sample.)
    const starts = base.flatMap(t => (t.start === null ? [] : [t.start]));
    const finishes = base.flatMap(t => (t.finish === null ? [] : [t.finish]));
    const projStart = starts.length ? Math.min(...starts) : null;
    const projFinish = finishes.length ? Math.max(...finishes) : null;

    // Axis: from the month of the project start, ≥ minMonths, long enough for every plan/actual date.
    const anchor = projStart ?? Math.min(...base.flatMap(t => (t.actual.start === null ? [] : [t.actual.start])), Infinity);
    const lastDate = Math.max(
        projFinish ?? -Infinity,
        ...base.flatMap(t => (t.actual.finish === null ? [] : [t.actual.finish])),
    );
    const months = Number.isFinite(anchor)
        ? Math.max(Math.max(1, Math.round(finite(input.minMonths))), Number.isFinite(lastDate) ? monthSpan(anchor, lastDate) : 1)
        : Math.max(1, Math.round(finite(input.minMonths)));
    const buckets = Number.isFinite(anchor) ? buildWeekBuckets(anchor, months) : [];

    const tasks: ScheduleTaskResult[] = base.map(t => {
        const weight = weightOf(t.budget);
        const aWeight = weightOf(t.actual.cost ?? 0);
        return {
            id: t.task.id,
            installment: t.task.installment,
            name: t.task.name,
            excelRow: t.task.excelRow,
            duration: t.duration,
            durationFromManDay: t.durationFromManDay,
            start: t.start === null ? null : serialToIso(t.start),
            finish: t.finish === null ? null : serialToIso(t.finish),
            budget: t.budget,
            weight,
            plan: spreadOverBuckets(buckets, t.start, t.finish, t.duration, weight),
            actual: {
                duration: t.actual.days,
                start: t.actual.start === null ? null : serialToIso(t.actual.start),
                finish: t.actual.finish === null ? null : serialToIso(t.actual.finish),
                cost: t.actual.cost,
                weight: aWeight,
                weekly: t.actual.days === null
                    ? buckets.map(() => 0)
                    : spreadOverBuckets(buckets, t.actual.start, t.actual.finish, t.actual.days, aWeight),
            },
            progress: t.progress,
        };
    });

    const n = buckets.length;
    const planWeekly = sumColumns(tasks.map(t => t.plan), n);
    const actualWeekly = sumColumns(tasks.map(t => t.actual.weekly), n);
    const planCumulative = cumulative(planWeekly);
    const actualCumulative = cumulative(actualWeekly);

    const monthResults: ScheduleMonthResult[] = monthsOf(buckets).map(m => {
        const idx = [0, 1, 2, 3].map(k => m.firstBucket + k);
        const last = m.firstBucket + 3;
        return {
            ...m,
            planCost: idx.reduce((s, i) => s + (planWeekly[i] ?? 0), 0) * budget,
            planCumulativeCost: (planCumulative[last] ?? 0) * budget,
            actualCost: idx.reduce((s, i) => s + (actualWeekly[i] ?? 0), 0) * budget,
            actualCumulativeCost: (actualCumulative[last] ?? 0) * budget,
        };
    });

    const installments: ScheduleInstallmentResult[] = INSTALLMENTS.map(inst => {
        const ts = base.filter(t => t.task.installment === inst.no);
        const g = ts.reduce((s, t) => s + t.budget, 0);
        const fin = ts.flatMap(t => (t.finish === null ? [] : [t.finish]));
        return {
            no: inst.no, label: inst.label, taskIds: ts.map(t => t.task.id),
            budget: g, weight: weightOf(g),
            finish: fin.length ? serialToIso(Math.max(...fin)) : null,
        };
    });

    // Q4–Q7.
    const actualFinishes = base.flatMap(t => (t.actual.finish === null ? [] : [t.actual.finish]));
    const q4 = actualFinishes.length ? Math.max(...actualFinishes) : null;
    const earnedValue = tasks.reduce((s, t) => s + t.progress * t.weight, 0) * budget;
    let spent: number | null = null;
    if (q4 !== null) {
        const i = bucketIndexOf(buckets, q4);
        spent = i < 0 ? null : (actualCumulative[i] ?? 0) * budget;
    }
    let delayDays: number | null = null;
    const lastWithActual = [...base].reverse().find(t => t.actual.finish !== null);
    if (q4 !== null && lastWithActual?.finish !== undefined && lastWithActual.finish !== null) {
        delayDays = lastWithActual.finish - q4;
    }
    const delayStatus: DelayStatus | null = delayDays === null ? null : delayDays > 0 ? 'ahead' : delayDays < 0 ? 'late' : 'onTime';
    const delayText = delayDays === null ? null
        : delayDays > 0 ? `เร็วกว่าแผน ${delayDays} วัน`
            : delayDays < 0 ? `ช้ากว่าแผน ${-delayDays} วัน` : 'ตรงตามแผน';

    return {
        projectName: input.projectName,
        start: projStart === null ? null : serialToIso(projStart),
        finish: projFinish === null ? null : serialToIso(projFinish),
        durationDays: projStart === null || projFinish === null ? 0 : projFinish - projStart + 1,
        budget,
        buckets,
        months: monthResults,
        tasks,
        installments,
        planWeekly,
        planCumulative,
        actualWeekly,
        actualCumulative,
        status: { lastUpdate: q4 === null ? null : serialToIso(q4), earnedValue, spent, delayDays, delayStatus, delayText },
    };
}
