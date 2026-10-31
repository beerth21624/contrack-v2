// QA edge tests for the S-Curve schedule: dates, durations, weekly distribution, project finish, actuals.
import { describe, expect, it } from 'vitest';
import type { BoqItemRow, BoqResult, BoqSectionResult } from '../../boq/types';
import {
    computeManDay, computeSchedule, defaultPlanningInput, PLAN_TASKS, spreadOverBuckets, buildWeekBuckets, isoToSerial, MAX_AXIS_MONTHS,
    type ScheduleInput, type ScheduleResult,
} from '../index';

function fakeBoq(total = 10000, lab = 4000): BoqResult {
    const itemRow = (excelRow: number, l: number, t: number): BoqItemRow => ({
        type: 'item', key: `R${excelRow}`, excelRow, labTotal: l, matTotal: t - l, total: t,
    } as BoqItemRow);
    const sections: BoqSectionResult[] = Array.from({ length: 32 }, (_, no) => {
        const rows = no === 17 ? [itemRow(180, lab * 0.7, total * 0.7), itemRow(185, lab * 0.3, total * 0.3)]
            : no === 18 ? [itemRow(190, lab * 0.6, total * 0.6), itemRow(195, lab * 0.4, total * 0.4)] : [];
        return { no, title: `s${no}`, calculators: [], inConstructionTotal: no !== 0, rows, matTotal: total - lab, labTotal: lab, total };
    });
    return { sections, constructionTotal: sections.filter(s => s.no !== 0).reduce((a, s) => a + s.total, 0), preConstructionTotal: total };
}

/** Schedule input from the sample, with edits; every task keeps its sample start unless changed. */
function run(edit: (i: ScheduleInput) => void = () => undefined, boq = fakeBoq()): ScheduleResult {
    const p = defaultPlanningInput();
    edit(p.schedule);
    return computeSchedule(p.schedule, computeManDay(p.manday, boq));
}
/** Only task `id` scheduled (others unscheduled) with explicit start and duration. */
function single(id: string, start: string, days: number, extra: Partial<ScheduleInput> = {}): ScheduleResult {
    return run(s => {
        for (const t of PLAN_TASKS) s.tasks[t.id] = { start: t.id === id ? start : '', progress: 0 };
        const t = s.tasks[id];
        if (t) t.duration = days;
        Object.assign(s, extra);
    });
}
const task = (r: ScheduleResult, id: string) => {
    const t = r.tasks.find(x => x.id === id);
    if (!t) throw new Error(`task ${id}`);
    return t;
};
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function badNumber(v: unknown, path = ''): string | null {
    if (typeof v === 'number') return Number.isFinite(v) ? null : `${path}=${v}`;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const b = badNumber(v[i], `${path}[${i}]`); if (b) return b; } }
    else if (typeof v === 'object' && v !== null) { for (const [k, x] of Object.entries(v)) { const b = badNumber(x, `${path}.${k}`); if (b) return b; } }
    return null;
}

describe('start / finish dates', () => {
    it('finish = start + duration - 1 (calendar days)', () => {
        const r = single('1.1', '2026-01-10', 5);
        expect(task(r, '1.1')).toMatchObject({ start: '2026-01-10', finish: '2026-01-14', duration: 5 });
    });

    it('a 1-day task starts and finishes the same day', () => {
        expect(task(single('1.1', '2026-03-05', 1), '1.1')).toMatchObject({ start: '2026-03-05', finish: '2026-03-05' });
    });

    it.each([
        ['2026-01-31', 2, '2026-02-01'], ['2026-01-31', 29, '2026-02-28'], ['2026-01-31', 30, '2026-03-01'],
        ['2028-02-28', 3, '2028-03-01'], ['2028-02-29', 1, '2028-02-29'], ['2028-02-28', 2, '2028-02-29'],
        ['2027-02-28', 2, '2027-03-01'], ['2026-12-31', 2, '2027-01-01'], ['2026-12-31', 366, '2027-12-31'],
    ])('month ends: start %s + %d days -> finish %s', (start, days, finish) => {
        expect(task(single('1.1', start, days), '1.1').finish).toBe(finish);
    });

    it('project start is the earliest start and finish the latest finish, whatever the order of tasks', () => {
        const r = run(s => {
            const t18 = s.tasks['8.6'];
            if (t18) { t18.start = '2025-12-01'; t18.duration = 1; }
            const t11 = s.tasks['1.1'];
            if (t11) { t11.start = '2026-09-01'; t11.duration = 10; }
        });
        expect(r.start).toBe('2025-12-01');
        expect(r.finish).toBe('2026-09-10');
        expect(r.durationDays).toBe(Math.round((Date.UTC(2026, 8, 10) - Date.UTC(2025, 11, 1)) / 86_400_000) + 1);
    });

    it('sample project: starts 2026-01-10, finishes 2026-05-31, 142 days', () => {
        const r = run();
        expect(r.start).toBe('2026-01-10');
        expect(r.finish).toBe('2026-05-31');
        expect(r.durationDays).toBe(142);
    });

    it('a task without a start date is not scheduled: no dates, no plan, not part of project dates', () => {
        const r = run(s => { const t = s.tasks['1.1']; if (t) t.start = ''; });
        expect(task(r, '1.1')).toMatchObject({ start: null, finish: null });
        expect(sum(task(r, '1.1').plan)).toBe(0);
        expect(r.start).not.toBeNull();
    });

    it('an unparsable start date behaves like a missing one', () => {
        const r = single('1.1', 'not-a-date', 5);
        expect(task(r, '1.1').start).toBeNull();
        expect(r.start).toBeNull();
        expect(r.finish).toBeNull();
    });

    it('no task scheduled at all: no axis, no dates, zero duration, no NaN', () => {
        const r = run(s => { for (const t of PLAN_TASKS) s.tasks[t.id] = { start: '', progress: 0 }; });
        expect(r.start).toBeNull();
        expect(r.finish).toBeNull();
        expect(r.durationDays).toBe(0);
        expect(r.buckets).toEqual([]);
        expect(r.planCumulative).toEqual([]);
        expect(r.months).toEqual([]);
        expect(badNumber(r)).toBeNull();
    });
});

describe('typed duration overrides', () => {
    it('without a typed duration the Man-Day days are used', () => {
        const r = run();
        expect(task(r, '1.5')).toMatchObject({ duration: 10, durationFromManDay: true });
    });

    it('a typed duration overrides Man-Day and is flagged; the sample types 4.0 on task 4.2', () => {
        const r = run(s => { const t = s.tasks['1.5']; if (t) t.duration = 3; });
        expect(task(r, '1.5')).toMatchObject({ duration: 3, durationFromManDay: false });
        expect(task(run(), '4.2')).toMatchObject({ duration: 4, durationFromManDay: false });
    });

    it('null clears the override back to Man-Day (and clears task 4.2 default)', () => {
        const r = run(s => { const t = s.tasks['4.2']; if (t) t.duration = null; });
        expect(task(r, '4.2').durationFromManDay).toBe(true);
        expect(task(r, '4.2').duration).toBe(4);   // Man-Day T of 4.2 in the sample is 4 as well
        const r2 = run(s => { const t = s.tasks['4.2']; if (t) t.duration = null; });
        expect(task(r2, '4.2').durationFromManDay).toBe(true);
    });

    it('NaN / Infinity typed duration is ignored (Man-Day days used)', () => {
        for (const bad of [Number.NaN, Infinity]) {
            const r = run(s => { const t = s.tasks['1.5']; if (t) t.duration = bad; });
            expect(task(r, '1.5')).toMatchObject({ duration: 10, durationFromManDay: true });
        }
    });

    it('typed 0 days is honoured (not treated as "empty")', () => {
        const r = run(s => { const t = s.tasks['1.5']; if (t) t.duration = 0; });
        expect(task(r, '1.5')).toMatchObject({ duration: 0, durationFromManDay: false });
    });

    it('a negative typed duration gives zero plan share and no NaN', () => {
        const r = single('1.1', '2026-01-10', -3);
        expect(sum(task(r, '1.1').plan)).toBe(0);
        expect(badNumber(r)).toBeNull();
    });
});

describe('weekly distribution', () => {
    it('plan weights per task sum to the task weight (sample, uniform budgets)', () => {
        const r = run();
        for (const t of r.tasks) expect(sum(t.plan), t.id).toBeCloseTo(t.weight, 12);
    });

    it('plan weights per task sum to the weight for every kind of duration and start (equivalence classes + boundaries)', () => {
        const durations = [1, 2, 3, 6, 7, 8, 9, 14, 15, 16, 22, 23, 28, 29, 30, 31, 59, 60, 90, 365, 366, 400, 800];
        const starts = ['2026-01-01', '2026-01-07', '2026-01-08', '2026-01-31', '2026-02-28', '2028-02-29', '2026-12-31'];
        for (const start of starts) {
            for (const days of durations) {
                const r = single('2.1', start, days);
                const t = task(r, '2.1');
                expect(sum(t.plan), `${start} +${days}`).toBeCloseTo(t.weight, 12);
                // the whole task fits on the axis (it grows beyond 12 months when needed)
                const lastBucket = r.buckets[r.buckets.length - 1];
                expect(isoToSerial(t.finish) ?? Infinity).toBeLessThanOrEqual(lastBucket?.endSerial ?? -Infinity);
            }
        }
    });

    it('a 7-day task on W1 puts its whole weight in bucket 0; a 14-day one splits 7/7 over W1 and W2', () => {
        const r7 = single('2.1', '2026-01-01', 7);
        expect(task(r7, '2.1').plan[0]).toBeCloseTo(task(r7, '2.1').weight, 12);
        const r14 = single('2.1', '2026-01-01', 14);
        expect(task(r14, '2.1').plan[0]).toBeCloseTo(task(r14, '2.1').weight / 2, 12);
        expect(task(r14, '2.1').plan[1]).toBeCloseTo(task(r14, '2.1').weight / 2, 12);
        expect(sum(task(r14, '2.1').plan.slice(2))).toBe(0);
    });

    it('a task crossing a month end spreads by calendar-day overlap (Jan 30 - Feb 2, 4 days: 2 in W4, 2 in Feb W1)', () => {
        const r = single('2.1', '2026-01-30', 4, { minMonths: 3 });
        const plan = task(r, '2.1').plan;
        const w = task(r, '2.1').weight;
        expect(plan[3]).toBeCloseTo(w / 2, 12);
        expect(plan[4]).toBeCloseTo(w / 2, 12);
    });

    it('Feb 29 2028 falls into the last bucket of February', () => {
        const r = single('2.1', '2028-02-29', 1);
        const idx = r.buckets.findIndex(b => b.start <= '2028-02-29' && '2028-02-29' <= b.end);
        expect(task(r, '2.1').plan[idx]).toBeCloseTo(task(r, '2.1').weight, 12);
        expect(r.buckets[idx]?.weekLabel).toBe('W4');
    });

    it('whole project: weights sum to 1, cumulative curve is monotonic and ends at 100 %', () => {
        const r = run();
        expect(sum(r.tasks.map(t => t.weight))).toBeCloseTo(1, 12);
        expect(r.planCumulative[r.planCumulative.length - 1]).toBeCloseTo(1, 12);
        for (let i = 1; i < r.planCumulative.length; i++) {
            expect(r.planCumulative[i] ?? 0).toBeGreaterThanOrEqual((r.planCumulative[i - 1] ?? 0) - 1e-15);
        }
        expect(sum(r.planWeekly)).toBeCloseTo(1, 12);
    });

    it('installment weights add to 1 and installment finish is the latest task finish of the group', () => {
        const r = run();
        expect(sum(r.installments.map(i => i.weight))).toBeCloseTo(1, 12);
        expect(sum(r.installments.map(i => i.budget))).toBeCloseTo(r.budget, 6);
        for (const inst of r.installments) {
            const fins = inst.taskIds.map(id => task(r, id).finish ?? '').sort();
            expect(inst.finish).toBe(fins[fins.length - 1]);
        }
        expect(r.installments.map(i => i.taskIds.length)).toEqual([7, 5, 3, 2, 2, 5, 2, 6]);
    });

    it('axis is at least minMonths (12 -> 48 buckets) and grows past 12 months for a very long task', () => {
        expect(run().buckets).toHaveLength(48);
        const long = single('2.1', '2026-01-10', 800);
        expect(long.buckets.length).toBeGreaterThan(48);
        expect(long.buckets.length % 4).toBe(0);
        expect(task(long, '2.1').finish).toBe('2028-03-19');
        expect(sum(task(long, '2.1').plan)).toBeCloseTo(task(long, '2.1').weight, 12);
        expect(long.planCumulative[long.planCumulative.length - 1]).toBeCloseTo(task(long, '2.1').weight, 12);
    });

    it('minMonths 0, negative or NaN still gives at least one month', () => {
        for (const m of [0, -5, Number.NaN]) {
            const r = single('2.1', '2026-01-10', 3, { minMonths: m });
            expect(r.buckets.length).toBeGreaterThanOrEqual(4);
            expect(badNumber(r)).toBeNull();
        }
    });

    it('monthly cost rows add up to the budget and the last cumulative equals the budget', () => {
        const r = run();
        expect(sum(r.months.map(m => m.planCost))).toBeCloseTo(r.budget, 6);
        expect(r.months[r.months.length - 1]?.planCumulativeCost).toBeCloseTo(r.budget, 6);
    });

    it('spreadOverBuckets is 0 for null dates, non-positive duration or non-finite weight', () => {
        const b = buildWeekBuckets(isoToSerial('2026-01-01') ?? 0, 2);
        const s = isoToSerial('2026-01-01') ?? 0;
        expect(sum(spreadOverBuckets(b, null, s, 3, 1))).toBe(0);
        expect(sum(spreadOverBuckets(b, s, null, 3, 1))).toBe(0);
        expect(sum(spreadOverBuckets(b, s, s + 2, 0, 1))).toBe(0);
        expect(sum(spreadOverBuckets(b, s, s + 2, 3, Number.NaN))).toBe(0);
        expect(sum(spreadOverBuckets(b, s, s + 2, 3, 1))).toBeCloseTo(1, 12);
    });

    // A task with budget but 0 days puts its whole share on its start day (fixed: it used to drop out of the
    // curve, docs/qa/BUGS.md). A task with no start date cannot be placed and stays off the curve (shown as unscheduled).
    it('tasks of 0 days: finish is the day before the start and the whole share lands in the start week (no NaN)', () => {
        const r = single('2.1', '2026-01-10', 0);
        expect(task(r, '2.1')).toMatchObject({ start: '2026-01-10', finish: '2026-01-09', duration: 0 });
        expect(sum(task(r, '2.1').plan)).toBeGreaterThan(0);
        expect(task(r, '2.1').plan.filter(x => x > 0)).toHaveLength(1);
        expect(badNumber(r)).toBeNull();
    });
    it('inputs: sample plan with task 2.1 (budget 10,000 of 300,000) typed 0 days, the S-curve still reaches 100 %', () => {
        const r = run(s => { const t = s.tasks['2.1']; if (t) t.duration = 0; });
        expect(r.planCumulative[r.planCumulative.length - 1] ?? 0).toBeCloseTo(1, 6);
    });
    it('inputs: sample plan with task 2.1 start date cleared: the unscheduled task stays off the curve (decision, docs/qa/BUGS.md)', () => {
        const r = run(s => { const t = s.tasks['2.1']; if (t) t.start = ''; });
        const last = r.planCumulative[r.planCumulative.length - 1] ?? 0;
        expect(last).toBeLessThan(1);
        expect(last).toBeGreaterThan(0.9);
    });
});

describe('budget zero and weights', () => {
    it('all budgets 0: weights 0, no NaN, dates still work', () => {
        const r = run(undefined, fakeBoq(0, 0));
        expect(r.budget).toBe(0);
        expect(r.tasks.every(t => t.weight === 0)).toBe(true);
        expect(r.planCumulative.every(v => v === 0)).toBe(true);
        expect(r.finish).toBe('2026-05-31');
        expect(badNumber(r)).toBeNull();
    });

    it('weight of a task = its budget / total budget', () => {
        const r = run(undefined, fakeBoq(10000));
        expect(task(r, '1.1').weight).toBeCloseTo(10000 / r.budget, 12);
    });
});

describe('actual rows, status and earned value', () => {
    /** Blank progress tracking, plan for 1.1 starts 2026-01-10 with 3 days (finish 2026-01-12). */
    const withActual = (actual: { start?: string; days?: number; cost?: number } | undefined) => run(s => {
        for (const t of PLAN_TASKS) s.tasks[t.id] = { start: s.tasks[t.id]?.start ?? '', progress: 0, ...(t.id === '4.2' ? { duration: 4 } : {}) };
        const t11 = s.tasks['1.1'];
        if (t11) { t11.start = '2026-01-10'; t11.duration = 3; if (actual) t11.actual = actual; }
    });

    it('no actual entered: no last update, no delay text, spent null', () => {
        const r = withActual(undefined);
        expect(r.status).toMatchObject({ lastUpdate: null, spent: null, delayDays: null, delayStatus: null, delayText: null });
    });

    it('finished later than plan: late, "ช้ากว่าแผน 2 วัน"', () => {
        const r = withActual({ start: '2026-01-10', days: 5, cost: 1000 });
        expect(r.status).toMatchObject({ lastUpdate: '2026-01-14', delayDays: -2, delayStatus: 'late', delayText: 'ช้ากว่าแผน 2 วัน' });
    });

    it('finished earlier than plan: ahead, "เร็วกว่าแผน 1 วัน"', () => {
        const r = withActual({ start: '2026-01-10', days: 2, cost: 1000 });
        expect(r.status).toMatchObject({ delayDays: 1, delayStatus: 'ahead', delayText: 'เร็วกว่าแผน 1 วัน' });
    });

    it('finished exactly on the plan finish: on time', () => {
        const r = withActual({ start: '2026-01-10', days: 3, cost: 1000 });
        expect(r.status).toMatchObject({ delayDays: 0, delayStatus: 'onTime', delayText: 'ตรงตามแผน' });
    });

    it('actual weight = actual cost / project budget; weekly actual sums to it', () => {
        const r = withActual({ start: '2026-01-10', days: 5, cost: 6000 });
        const a = task(r, '1.1').actual;
        expect(a.weight).toBeCloseTo(6000 / r.budget, 12);
        expect(sum(a.weekly)).toBeCloseTo(a.weight, 12);
        expect(r.status.spent).toBeCloseTo(6000, 6);
    });

    it('actual with 0 days spreads nothing; actual cost 0 gives weight 0; missing start gives null dates', () => {
        const zeroDays = withActual({ start: '2026-01-10', days: 0, cost: 500 });
        expect(sum(task(zeroDays, '1.1').actual.weekly)).toBe(0);
        const noStart = withActual({ days: 3, cost: 500 });
        expect(task(noStart, '1.1').actual).toMatchObject({ start: null, finish: null });
        expect(badNumber(noStart)).toBeNull();
        expect(task(withActual({ start: '2026-01-10', days: 3, cost: 0 }), '1.1').actual.weight).toBe(0);
    });

    it('earned value = sum(progress x weight) x budget; 100 % everywhere = budget, half = half', () => {
        const all = (p: number) => run(s => { for (const t of PLAN_TASKS) { const x = s.tasks[t.id]; if (x) x.progress = p; } });
        expect(all(1).status.earnedValue).toBeCloseTo(all(1).budget, 6);
        expect(all(0.5).status.earnedValue).toBeCloseTo(all(1).budget / 2, 6);
        expect(all(0).status.earnedValue).toBe(0);
    });

    it('progress is not clamped: 150 % gives 1.5 x budget, NaN counts as 0', () => {
        const all = (p: number) => run(s => { for (const t of PLAN_TASKS) { const x = s.tasks[t.id]; if (x) x.progress = p; } });
        expect(all(1.5).status.earnedValue).toBeCloseTo(all(1).budget * 1.5, 6);
        expect(all(Number.NaN).status.earnedValue).toBe(0);
    });
});

describe('whole result sanity', () => {
    it('no NaN / Infinity in the sample schedule, in a one-task schedule and with extreme inputs', () => {
        expect(badNumber(run())).toBeNull();
        expect(badNumber(single('1.1', '2026-01-01', 1))).toBeNull();
        expect(badNumber(single('1.1', '2026-01-01', 1e6, { minMonths: 1 }))).toBeNull();
    });
    it('a typo of 1,000,000 days keeps the axis at 20 years and computes in well under a second', () => {
        const t = Date.now();
        const r = single('1.1', '2026-01-01', 1e6, { minMonths: 1 });
        expect(Date.now() - t).toBeLessThan(1000);
        expect(r.buckets.length).toBe(MAX_AXIS_MONTHS * 4);
    });
});
