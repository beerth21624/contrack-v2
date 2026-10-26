import { describe, expect, it } from 'vitest';
import { computeBoq } from '@/domain/boq/engine';
import { BOQ_TEMPLATE_V5 } from '@/domain/boq/template.v5';
import {
    PLAN_TASKS, computeCrewCalendar, computePlanning, defaultPlanningInput, type PlanningInput,
} from '@/domain/planning';
import { computeProject, createProject } from '@/domain/project';
import {
    CAL_LAYOUT, TIMELINE_MAX_LABELS, buildCalendarPrintModel, buildGanttPrintModel, calendarMonthOptions, chipCapacity,
    monthSummaryText, scheduleFileBaseName, timelineBar,
} from '../schedule-print-model';

const boq = computeBoq({ sections: BOQ_TEMPLATE_V5 });
const plan = (edit?: (i: PlanningInput) => void) => {
    const input = defaultPlanningInput();
    edit?.(input);
    return computePlanning(input, boq);
};

/** Only the listed tasks are scheduled: { id: [start, days, skilled, labourers] }. */
const only = (tasks: Record<string, [string, number, number, number]>) => plan(i => {
    for (const t of PLAN_TASKS) {
        const ti = i.schedule.tasks[t.id];
        if (ti) { ti.start = ''; ti.duration = null; }
    }
    for (const [id, [start, days, skilled, labourers]] of Object.entries(tasks)) {
        i.schedule.tasks[id] = { start, progress: 0 };
        i.manday.blocks[id] = { skilled, labourers, wageSet: 'A', days };
    }
});

const sample = computeProject(createProject('sample')).planning;
const cellOf = (m: ReturnType<typeof buildCalendarPrintModel>['months'][number], iso: string) => {
    const c = m.weeks.flat().find(x => x.iso === iso && x.inMonth);
    if (!c) throw new Error(`no cell ${iso}`);
    return c;
};

describe('calendar print model: months', () => {
    it('by default prints every month from the first start to the last finish', () => {
        const cal = computeCrewCalendar(sample.schedule, sample.manday);
        const model = buildCalendarPrintModel(sample.schedule, sample.manday);
        expect(cal.start).not.toBeNull();
        const opts = calendarMonthOptions(cal);
        expect(model.months.map(m => m.value)).toEqual(opts.map(o => o.value));
        expect(model.months[0]?.value).toBe(cal.start?.slice(0, 7));
        expect(model.months.at(-1)?.value).toBe(cal.finish?.slice(0, 7));
        expect(model.months.map(m => m.title)).toEqual(opts.map(o => o.label));
        expect(opts[0]?.label).toMatch(/^(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม) 20\d\d$/);
        // consecutive months, nothing skipped
        const keys = model.months.map(m => Number(m.value.slice(0, 4)) * 12 + Number(m.value.slice(5)));
        keys.forEach((k, i) => { if (i > 0) expect(k - (keys[i - 1] ?? 0)).toBe(1); });
        expect(model.months.length).toBeGreaterThan(2);
    });

    it('prints only the chosen months, in date order, once each; months outside the plan are ignored', () => {
        const r = only({ '1.1': ['2026-01-20', 70, 1, 2] });   // 20 Jan – 30 Mar 2026
        const all = buildCalendarPrintModel(r.schedule, r.manday);
        expect(all.months.map(m => m.value)).toEqual(['2026-01', '2026-02', '2026-03']);
        const some = buildCalendarPrintModel(r.schedule, r.manday, ['2026-03', '2026-01', '2026-03', '2025-12', '2026-04', 'x']);
        expect(some.months.map(m => m.value)).toEqual(['2026-01', '2026-03']);
        expect(buildCalendarPrintModel(r.schedule, r.manday, []).months).toEqual([]);
    });

    it('nothing to print without start dates', () => {
        const r = only({});
        const model = buildCalendarPrintModel(r.schedule, r.manday);
        expect(model.months).toEqual([]);
        expect(model.start).toBeNull();
        expect(calendarMonthOptions(computeCrewCalendar(r.schedule, r.manday))).toEqual([]);
    });
});

describe('calendar print model: month grid', () => {
    it('Monday-first grid padded to whole weeks; days outside the plan are marked', () => {
        const r = only({ '1.1': ['2026-03-10', 5, 2, 3] });   // March 2026 starts on a Sunday: 6 weeks
        const [m] = buildCalendarPrintModel(r.schedule, r.manday).months;
        if (!m) throw new Error('no month');
        expect(m.weeks).toHaveLength(6);
        for (const w of m.weeks) expect(w).toHaveLength(7);
        expect(m.weeks[0]?.[0]?.iso).toBe('2026-02-23');   // the Monday before
        expect(m.weeks[0]?.[6]).toMatchObject({ iso: '2026-03-01', inMonth: true, inPlan: false });
        expect(m.weeks.flat().filter(c => c.inMonth)).toHaveLength(31);
        expect(cellOf(m, '2026-03-09').inPlan).toBe(false);
        expect(cellOf(m, '2026-03-10')).toMatchObject({ inPlan: true, skilled: 2, labourers: 3, total: 5 });
        expect(cellOf(m, '2026-03-14').inPlan).toBe(true);
        expect(cellOf(m, '2026-03-15')).toMatchObject({ inPlan: false, tasks: [], total: 0 });
        expect(m.weeks[0]?.[0]).toMatchObject({ inMonth: false, tasks: [], total: 0 });
    });

    it('leap years: February 2028 has 29 days and a task crosses into March', () => {
        const r = only({ '2.1': ['2028-02-27', 4, 1, 1] });   // 27 Feb – 1 Mar 2028
        const model = buildCalendarPrintModel(r.schedule, r.manday);
        expect(model.months.map(m => m.title)).toEqual(['กุมภาพันธ์ 2028', 'มีนาคม 2028']);
        const [feb, mar] = model.months;
        if (!feb || !mar) throw new Error('missing months');
        expect(feb.weeks.flat().filter(c => c.inMonth)).toHaveLength(29);
        expect(cellOf(feb, '2028-02-29').tasks.map(t => t.id)).toEqual(['2.1']);
        expect(cellOf(mar, '2028-03-01').tasks.map(t => t.id)).toEqual(['2.1']);
        expect(cellOf(mar, '2028-03-02').inPlan).toBe(false);
        expect(feb.taskCount).toBe(1);
        expect(mar.taskCount).toBe(1);
    });

    it('a non-leap February that starts on a Monday is exactly four weeks', () => {
        const r = only({ '1.1': ['2027-02-01', 28, 1, 0] });
        const [feb] = buildCalendarPrintModel(r.schedule, r.manday).months;
        expect(feb?.weeks).toHaveLength(4);
        expect(feb?.weeks.flat().every(c => c.inMonth && c.inPlan)).toBe(true);
    });

    it('year boundary: December and January get their own pages and years', () => {
        const r = only({ '1.1': ['2026-12-30', 5, 1, 1] });
        const model = buildCalendarPrintModel(r.schedule, r.manday);
        expect(model.months.map(m => [m.value, m.title])).toEqual([['2026-12', 'ธันวาคม 2026'], ['2027-01', 'มกราคม 2027']]);
    });

    it('month summary: distinct tasks in the month and its own peak day', () => {
        const r = only({
            '1.1': ['2026-01-28', 6, 1, 2],   // 28 Jan – 2 Feb
            '1.2': ['2026-02-02', 3, 4, 4],   // 2 – 4 Feb
            '1.3': ['2026-02-10', 1, 3, 5],   // 10 Feb
        });
        const [jan, feb] = buildCalendarPrintModel(r.schedule, r.manday).months;
        expect(jan).toMatchObject({ taskCount: 1, peak: { date: '2026-01-28', total: 3, moreDays: 3 } });
        expect(feb).toMatchObject({ taskCount: 3, peak: { date: '2026-02-02', total: 11, skilled: 5, labourers: 6, moreDays: 0 } });
        if (!feb || !jan) throw new Error('missing months');
        expect(monthSummaryText(feb)).toBe('งานในเดือนนี้ 3 งาน · ใช้คนมากที่สุด 11 คน (ช่าง 5 · คนงาน 6) วันที่ 02/02/2026');
        expect(monthSummaryText(jan)).toContain('และอีก 3 วัน');
    });
});

describe('calendar print model: overflow', () => {
    const ids = PLAN_TASKS.map(t => t.id);

    it('few tasks a day: every task is a chip, nothing listed under the grid', () => {
        const r = only({ '1.1': ['2026-03-10', 3, 1, 1], '1.2': ['2026-03-10', 3, 1, 1] });
        const [m] = buildCalendarPrintModel(r.schedule, r.manday).months;
        expect(m).toMatchObject({ chipLimit: 2, scale: 1, overflow: [] });
        expect(m?.weeks.flat().every(c => c.hidden === 0)).toBe(true);
    });

    it('more tasks than fit: "+N งาน" in the cell and the hidden tasks listed once, in plan order', () => {
        const busy = Object.fromEntries(ids.slice(0, 9).map((id, i) => [id, ['2026-03-09', 3 + i, 1, 1] as [string, number, number, number]]));
        const r = only(busy);
        const [m] = buildCalendarPrintModel(r.schedule, r.manday).months;
        if (!m) throw new Error('no month');
        expect(m.weeks).toHaveLength(6);
        expect(m.chipLimit).toBeGreaterThan(0);
        expect(m.chipLimit).toBeLessThan(9);
        const first = cellOf(m, '2026-03-09');
        expect(first.tasks.map(t => t.id)).toEqual(ids.slice(0, m.chipLimit));
        expect(first.hidden).toBe(9 - m.chipLimit);
        expect(m.overflow.map(t => t.id)).toEqual(ids.slice(m.chipLimit, 9));
        // a later day with fewer tasks hides fewer
        const later = cellOf(m, '2026-03-16');   // tasks with 3 + i ≥ 8 days: i ≥ 5
        expect(later.tasks.length + later.hidden).toBe(4);
        // the page fits: the grid rows still hold chipLimit chips next to the overflow table
        expect(chipCapacity(m.weeks.length, m.overflow.length, m.scale)).toBeGreaterThanOrEqual(m.chipLimit);
    });

    it('every task on the same day: still one page per month, type shrinks only if needed', () => {
        const all = Object.fromEntries(ids.map(id => [id, ['2026-03-02', 20, 2, 3] as [string, number, number, number]]));
        const r = only(all);
        const [m] = buildCalendarPrintModel(r.schedule, r.manday).months;
        if (!m) throw new Error('no month');
        expect(m.chipLimit).toBeGreaterThanOrEqual(1);
        expect(m.overflow).toHaveLength(ids.length - m.chipLimit);
        expect(m.overflowColumns).toBe(3);
        expect(chipCapacity(m.weeks.length, m.overflow.length, m.scale)).toBeGreaterThanOrEqual(m.chipLimit);
        expect(cellOf(m, '2026-03-02')).toMatchObject({ hidden: ids.length - m.chipLimit, skilled: 64, labourers: 96 });
    });

    it('a four-week month holds more chips than a six-week month', () => {
        expect(chipCapacity(4, 0, 1)).toBeGreaterThan(chipCapacity(6, 0, 1));
        expect(chipCapacity(6, 0, 1)).toBeGreaterThanOrEqual(3);
        expect(chipCapacity(6, 30, 1)).toBeLessThan(chipCapacity(6, 0, 1));
        expect(CAL_LAYOUT.maxChips).toBeGreaterThanOrEqual(chipCapacity(5, 0, 1) - 1);
    });

    it('the sample project fits every month on one page', () => {
        const model = buildCalendarPrintModel(sample.schedule, sample.manday);
        for (const m of model.months) {
            expect(chipCapacity(m.weeks.length, m.overflow.length, m.scale)).toBeGreaterThanOrEqual(m.chipLimit);
            for (const c of m.weeks.flat()) expect(c.tasks.length).toBeLessThanOrEqual(m.chipLimit);
        }
    });
});

describe('gantt print model', () => {
    const model = buildGanttPrintModel(sample.schedule, '2026-10-26', 'บ้านตัวอย่าง');

    it('header: project, start, finish, duration, budget, print date — values from the schedule', () => {
        const s = sample.schedule;
        const f = Object.fromEntries(model.fields.map(x => [x.label, x.value]));
        expect(f['วันที่พิมพ์']).toBe('26/10/2026');
        expect(f['วันเริ่มโครงการ']).toBe(`${s.start?.slice(8, 10)}/${s.start?.slice(5, 7)}/${s.start?.slice(0, 4)}`);
        expect(f['ระยะเวลา']).toBe(`${s.durationDays.toLocaleString('th-TH')} วัน`);
        expect(f['งบประมาณโครงการ']).toContain('บาท');
        expect(model.projectName).not.toBe('');
    });

    it('every task, grouped by งวด, with bars inside the timeline', () => {
        const tasks = model.installments.flatMap(i => i.tasks);
        expect(tasks).toHaveLength(sample.schedule.tasks.length);
        for (const t of tasks) {
            if (t.start === '') { expect(t.plan).toBeNull(); continue; }
            expect(t.plan).not.toBeNull();
            if (!t.plan) continue;
            expect(t.plan.left).toBeGreaterThanOrEqual(0);
            expect(t.plan.width).toBeGreaterThan(0);
            expect(t.plan.left + t.plan.width).toBeLessThanOrEqual(1 + 1e-9);
        }
        expect(model.totalWeight).toBe('100.00%');
        const m = model.timeline.months;
        expect(m[0]?.left).toBe(0);
        expect((m.at(-1)?.left ?? 0) + (m.at(-1)?.width ?? 0)).toBeCloseTo(1, 9);
    });

    it('S-curve is the on-screen series', () => {
        expect(model.scurve.plan.length).toBe(model.scurve.buckets.length);
        expect(model.scurve.plan).toEqual(sample.schedule.planCumulative.slice(0, model.scurve.buckets.length));
    });

    it('long plans: bars stay proportional and only every n-th month is labelled', () => {
        const r = only({ '1.1': ['2026-01-01', 10, 1, 1], '8.6': ['2027-11-20', 30, 1, 1] });
        const g = buildGanttPrintModel(r.schedule, '2026-10-26');
        expect(g.timeline.months.length).toBeGreaterThanOrEqual(24);
        const labelled = g.timeline.months.filter(x => x.showLabel);
        expect(labelled.length).toBeLessThanOrEqual(TIMELINE_MAX_LABELS);
        // a label takes the width of the months it stands for: together they cover the axis once
        expect(labelled.reduce((w, x) => w + x.labelWidth, 0)).toBeCloseTo(1, 9);
        expect(labelled[0]?.labelWidth).toBeGreaterThan(labelled[0]?.width ?? 1);
        const last = g.installments.flatMap(i => i.tasks).find(t => t.id === '8.6');
        expect(last?.plan?.left).toBeGreaterThan(0.9);
    });

    it('timelineBar clamps to the axis', () => {
        // serial of 2026-01-01 is 46023
        expect(timelineBar('2026-01-01', '2026-01-10', 46023, 46032)).toEqual({ left: 0, width: 1 });
        expect(timelineBar('2025-12-25', '2026-01-05', 46023, 46032)).toEqual({ left: 0, width: 0.5 });
        expect(timelineBar('2026-02-01', '2026-02-05', 46023, 46032)).toBeNull();
        expect(timelineBar(null, null, 46023, 46032)).toBeNull();
    });

    it('file names', () => {
        expect(scheduleFileBaseName('gantt', 'บ้าน/คุณ:สมชาย')).toBe('แผนงาน_บ้าน คุณ สมชาย');
        expect(scheduleFileBaseName('calendar', '')).toBe('ปฏิทินงาน');
    });
});
