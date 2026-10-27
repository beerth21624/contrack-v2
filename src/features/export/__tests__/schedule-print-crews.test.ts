import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeBoq } from '@/domain/boq/engine';
import { BOQ_TEMPLATE_V5 } from '@/domain/boq/template.v5';
import { PLAN_TASKS, computePlanning, defaultPlanningInput, type PlanningInput } from '@/domain/planning';
import { computeProject, createProject } from '@/domain/project';
import { NO_TASK_CREWS, buildTaskCrewMap, type AssignmentSpan } from '@/domain/workforce';
import { buildCalendarPrintModel, chipCapacity } from '../schedule-print-model';
import { CalendarPrintDocument } from '../SchedulePrintDocument';

const boq = computeBoq({ sections: BOQ_TEMPLATE_V5 });
const plan = (edit?: (i: PlanningInput) => void) => {
    const input = defaultPlanningInput();
    edit?.(input);
    return computePlanning(input, boq);
};
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
const names = new Map([['c1', 'ทีมช่างสมชาย'], ['c2', 'ทีมไฟฟ้าพงษ์']]);
let seq = 0;
const asg = (taskId: string, crewId: string, start: string, end: string): AssignmentSpan =>
    ({ id: `a${String(++seq)}`, taskId, crewId, start, end });
const crewMap = (list: AssignmentSpan[]) => buildTaskCrewMap(list, id => names.get(id), 'ทีมที่เก็บถาวรแล้ว');
type Month = ReturnType<typeof buildCalendarPrintModel>['months'][number];
const cellOf = (m: Month | undefined, iso: string) => {
    const c = m?.weeks.flat().find(x => x.iso === iso && x.inMonth);
    if (!c) throw new Error(`no cell ${iso}`);
    return c;
};

describe('calendar print: crew names', () => {
    it('without crews the model is the plain calendar (no names, same chips)', () => {
        const plain = buildCalendarPrintModel(sample.schedule, sample.manday);
        const none = buildCalendarPrintModel(sample.schedule, sample.manday, undefined, '', NO_TASK_CREWS);
        expect(plain.hasCrews).toBe(false);
        expect(none.hasCrews).toBe(false);
        for (const [i, m] of plain.months.entries()) {
            const other = none.months[i];
            expect(other?.chipLimit).toBe(m.chipLimit);
            expect(other?.scale).toBe(m.scale);
            expect(m.overflowCrews).toEqual({});
            for (const c of m.weeks.flat()) expect(c.crews).toEqual({});
        }
        const html = renderToStaticMarkup(createElement(CalendarPrintDocument, { model: plain }));
        expect(html).not.toContain('class="schp-ccrew"');
        expect(html).not.toContain('class="schp-ocrew"');
        expect(html).not.toContain('ชื่อทีมมาจากหน้าทีมงาน');
    });

    it('a chip names the crews on that task that day only', () => {
        const r = only({ '1.5': ['2026-01-26', 10, 1, 5] });   // 26/01 – 04/02
        const crews = crewMap([asg('1.5', 'c1', '2026-01-26', '2026-01-31'), asg('1.5', 'c2', '2026-02-01', '2026-02-04')]);
        const model = buildCalendarPrintModel(r.schedule, r.manday, undefined, '', crews);
        expect(model.hasCrews).toBe(true);
        const [jan, feb] = model.months;
        expect(cellOf(jan, '2026-01-31').crews).toEqual({ '1.5': 'ทีมช่างสมชาย' });
        expect(cellOf(feb, '2026-02-01').crews).toEqual({ '1.5': 'ทีมไฟฟ้าพงษ์' });
        const html = renderToStaticMarkup(createElement(CalendarPrintDocument, { model }));
        expect(html).toMatch(/<span class="schp-ccrew"> · (<!-- -->)?ทีมช่างสมชาย<\/span>/);
        expect(html).toContain('ทีมไฟฟ้าพงษ์');
        expect(html).toContain('ชื่อทีมมาจากหน้าทีมงาน');
    });

    it('the overflow table names the crews of the month under the task', () => {
        const ids = PLAN_TASKS.map(t => t.id).slice(0, 9);
        const r = only(Object.fromEntries(ids.map((id, i) => [id, ['2026-03-09', 3 + i, 1, 1] as [string, number, number, number]])));
        const crews = crewMap(ids.map(id => asg(id, 'c1', '2026-03-09', '2026-03-31')));
        const [m] = buildCalendarPrintModel(r.schedule, r.manday, undefined, '', crews).months;
        if (!m) throw new Error('no month');
        expect(m.overflow.length).toBeGreaterThan(0);
        for (const t of m.overflow) expect(m.overflowCrews[t.id]).toBe('ทีมช่างสมชาย');
        // one page: the grid still holds chipLimit chips next to the taller overflow rows
        expect(chipCapacity(m.weeks.length, m.overflow.length, m.scale, true)).toBeGreaterThanOrEqual(m.chipLimit);
        const html = renderToStaticMarkup(createElement(CalendarPrintDocument, { model: { ...buildCalendarPrintModel(r.schedule, r.manday, undefined, '', crews) } }));
        expect(html).toContain('<span class="schp-ocrew">ทีมช่างสมชาย</span>');
    });

    it('every task on one day with a crew: still one page per month', () => {
        const ids = PLAN_TASKS.map(t => t.id);
        const r = only(Object.fromEntries(ids.map(id => [id, ['2026-03-02', 20, 2, 3] as [string, number, number, number]])));
        const crews = crewMap(ids.map(id => asg(id, 'c2', '2026-03-02', '2026-03-21')));
        const model = buildCalendarPrintModel(r.schedule, r.manday, undefined, '', crews);
        expect(model.months).toHaveLength(1);
        const [m] = model.months;
        if (!m) throw new Error('no month');
        expect(m.chipLimit).toBeGreaterThanOrEqual(1);
        expect(chipCapacity(m.weeks.length, m.overflow.length, m.scale, true)).toBeGreaterThanOrEqual(m.chipLimit);
        // crew lines make the overflow rows taller, so never more chips than without names
        const [plain] = buildCalendarPrintModel(r.schedule, r.manday).months;
        expect(m.chipLimit).toBeLessThanOrEqual(plain?.chipLimit ?? 0);
    });

    it('the sample project with a crew on every task fits every month on one page', () => {
        const crews = crewMap(sample.schedule.tasks.flatMap(t => (t.start === null || t.finish === null ? [] : [asg(t.id, 'c1', t.start, t.finish)])));
        const model = buildCalendarPrintModel(sample.schedule, sample.manday, undefined, '', crews);
        for (const m of model.months) {
            expect(chipCapacity(m.weeks.length, m.overflow.length, m.scale, m.overflow.length > 0)).toBeGreaterThanOrEqual(m.chipLimit);
            for (const c of m.weeks.flat()) {
                expect(c.tasks.length).toBeLessThanOrEqual(m.chipLimit);
                for (const t of c.tasks) expect(c.crews[t.id]).toBe('ทีมช่างสมชาย');
            }
        }
    });

    it('year boundary: December and January pages each name their own crews', () => {
        const r = only({ '3.1': ['2026-12-28', 8, 1, 1] });   // 28/12/2026 – 04/01/2027
        const crews = crewMap([asg('3.1', 'c1', '2026-12-28', '2026-12-31'), asg('3.1', 'c2', '2027-01-01', '2027-01-04')]);
        const [dec, jan] = buildCalendarPrintModel(r.schedule, r.manday, undefined, '', crews).months;
        expect(cellOf(dec, '2026-12-31').crews).toEqual({ '3.1': 'ทีมช่างสมชาย' });
        expect(cellOf(jan, '2027-01-01').crews).toEqual({ '3.1': 'ทีมไฟฟ้าพงษ์' });
    });
});
