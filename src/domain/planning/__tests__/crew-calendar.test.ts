// Crew calendar: a day-by-day view of the S-Curve plan dates and the Man-Day crews (expectations by hand).
import { describe, expect, it } from 'vitest';
import { computeBoq } from '../../boq/engine';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import { computeCrewCalendar, computePlanning, defaultPlanningInput, PLAN_TASKS, type PlanningInput } from '..';

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

const day = (cal: ReturnType<typeof computeCrewCalendar>, iso: string) => {
    const d = cal.days.find(x => x.date === iso);
    if (!d) throw new Error(`day ${iso} missing`);
    return d;
};

describe('crew calendar', () => {
    it('a task is active from its start to start + duration − 1, inclusive', () => {
        const r = only({ '1.5': ['2026-02-10', 3, 2, 4] });
        const cal = computeCrewCalendar(r.schedule, r.manday);
        expect(cal.start).toBe('2026-02-10');
        expect(cal.finish).toBe('2026-02-12');
        expect(cal.days.map(d => d.date)).toEqual(['2026-02-10', '2026-02-11', '2026-02-12']);
        expect(cal.days.map(d => [d.skilled, d.labourers, d.total])).toEqual([[2, 4, 6], [2, 4, 6], [2, 4, 6]]);
        const t = day(cal, '2026-02-11').tasks[0];
        expect(t).toMatchObject({ id: '1.5', installment: 1, start: '2026-02-10', finish: '2026-02-12', skilled: 2, labourers: 4 });
    });

    it('same finish as the Gantt table (S-Curve F)', () => {
        const r = only({ '2.1': ['2026-03-30', 5, 1, 1] });
        expect(r.schedule.tasks.find(t => t.id === '2.1')?.finish).toBe('2026-04-03');
        expect(computeCrewCalendar(r.schedule, r.manday).finish).toBe('2026-04-03');
    });

    it('overlapping tasks add up; gap days are kept with no task', () => {
        const r = only({
            '1.1': ['2026-01-10', 2, 1, 2],   // 10–11
            '1.2': ['2026-01-11', 2, 3, 5],   // 11–12
            '1.3': ['2026-01-15', 1, 2, 0],   // 15 (13, 14 empty)
        });
        const cal = computeCrewCalendar(r.schedule, r.manday);
        expect(cal.days.map(d => [d.date, d.tasks.map(t => t.id), d.skilled, d.labourers, d.total])).toEqual([
            ['2026-01-10', ['1.1'], 1, 2, 3],
            ['2026-01-11', ['1.1', '1.2'], 4, 7, 11],
            ['2026-01-12', ['1.2'], 3, 5, 8],
            ['2026-01-13', [], 0, 0, 0],
            ['2026-01-14', [], 0, 0, 0],
            ['2026-01-15', ['1.3'], 2, 0, 2],
        ]);
        expect(cal.peakTotal).toBe(11);
        expect(cal.peakDays).toEqual(['2026-01-11']);
    });

    it('every day reaching the peak is listed, in date order', () => {
        const r = only({ '1.1': ['2026-01-10', 2, 1, 1], '1.2': ['2026-01-20', 3, 2, 0] });
        const cal = computeCrewCalendar(r.schedule, r.manday);
        expect(cal.peakTotal).toBe(2);
        expect(cal.peakDays).toEqual(['2026-01-10', '2026-01-11', '2026-01-20', '2026-01-21', '2026-01-22']);
    });

    it('tasks without a start date or with duration ≤ 0 are left out', () => {
        const r = plan(i => {
            for (const t of PLAN_TASKS) {
                const ti = i.schedule.tasks[t.id];
                if (ti) { ti.start = ''; ti.duration = null; }
            }
            i.schedule.tasks['1.1'] = { start: '2026-01-10', progress: 0, duration: 2 };
            i.schedule.tasks['1.2'] = { start: '2026-01-10', progress: 0, duration: 0 };
            i.schedule.tasks['1.3'] = { start: '2026-01-10', progress: 0, duration: -3 };
            i.schedule.tasks['1.4'] = { start: '', progress: 0, duration: 5 };
        });
        const cal = computeCrewCalendar(r.schedule, r.manday);
        expect(cal.days.map(d => d.tasks.map(t => t.id))).toEqual([['1.1'], ['1.1']]);
    });

    it('nothing scheduled → empty calendar, no peak', () => {
        const r = plan(i => { for (const ti of Object.values(i.schedule.tasks)) ti.start = ''; });
        expect(computeCrewCalendar(r.schedule, r.manday)).toEqual({ start: null, finish: null, days: [], peakTotal: 0, peakDays: [] });
    });

    it('no crew anywhere → days are kept but there is no peak day', () => {
        const r = only({ '1.1': ['2026-01-10', 2, 0, 0] });
        const cal = computeCrewCalendar(r.schedule, r.manday);
        expect(cal.days).toHaveLength(2);
        expect(cal.peakTotal).toBe(0);
        expect(cal.peakDays).toEqual([]);
    });

    it('Excel sample: spans the project start..finish and counts each task on every day of its span', () => {
        const r = plan();
        const cal = computeCrewCalendar(r.schedule, r.manday);
        expect(cal.start).toBe(r.schedule.start);
        expect(cal.finish).toBe(r.schedule.finish);
        expect(cal.days).toHaveLength(r.schedule.durationDays);
        const scheduled = r.schedule.tasks.filter(t => t.start !== null && t.duration > 0);
        const taskDays = cal.days.reduce((s, d) => s + d.tasks.length, 0);
        expect(taskDays).toBe(scheduled.reduce((s, t) => s + t.duration, 0));
        for (const d of cal.days) {
            expect(d.total).toBe(d.skilled + d.labourers);
            expect(d.total).toBeLessThanOrEqual(cal.peakTotal);
        }
        expect(cal.peakDays.length).toBeGreaterThan(0);
    });

    it('is a view: the planning result is not changed', () => {
        const r = plan();
        const before = JSON.stringify(r);
        computeCrewCalendar(r.schedule, r.manday);
        expect(JSON.stringify(r)).toBe(before);
    });
});
