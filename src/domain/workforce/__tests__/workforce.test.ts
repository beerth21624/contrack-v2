import { describe, expect, it } from 'vitest';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import { WORKFORCE_TRADE_IDS } from '@/shared/contract/workforce';
import {
    TASK_TRADES, assignmentCoverage, buildTaskCrewMap, crewBusy, crewNamesInRange, crewNamesOnDay, crewNamesText,
    crewsByFit, spanDays, taskTrade, type AssignmentSpan,
} from '..';

let seq = 0;
const a = (crewId: string, start: string, end: string, taskId = '1.5', id?: string): AssignmentSpan =>
    ({ id: id ?? `a${String(++seq)}`, taskId, crewId, start, end });

describe('taskTrade', () => {
    it('maps every one of the 32 plan tasks, and nothing else', () => {
        expect(PLAN_TASKS).toHaveLength(32);
        for (const t of PLAN_TASKS) expect(taskTrade(t.id), t.id).toBeDefined();
        expect(Object.keys(TASK_TRADES).sort()).toEqual(PLAN_TASKS.map(t => t.id).sort());
    });

    it('uses only contract trade ids', () => {
        for (const trade of Object.values(TASK_TRADES)) expect(WORKFORCE_TRADE_IDS).toContain(trade);
    });

    it('follows the agreed grouping', () => {
        const group = (trade: string) => PLAN_TASKS.map(t => t.id).filter(id => taskTrade(id) === trade);
        expect(group('temp-utilities')).toEqual(['1.1']);
        expect(group('site-prep')).toEqual(['1.2', '1.3']);
        expect(group('piling')).toEqual(['1.4']);
        expect(group('structure')).toEqual(['1.5', '1.6', '1.7', '2.1', '2.2', '2.3', '2.4', '2.5']);
        expect(group('roof-structure')).toEqual(['3.1', '3.2']);
        expect(group('roofing')).toEqual(['3.3']);
        expect(group('masonry')).toEqual(['4.1', '5.1']);
        expect(group('electrical')).toEqual(['4.2', '5.2', '8.1']);
        expect(group('ceiling')).toEqual(['6.1']);
        expect(group('tiling')).toEqual(['6.2', '6.3', '6.4']);
        expect(group('painting')).toEqual(['6.5', '7.2', '8.6']);
        expect(group('doors-windows')).toEqual(['7.1', '8.5']);
        expect(group('plumbing')).toEqual(['8.2', '8.4']);
        expect(group('misc')).toEqual(['8.3']);
    });

    it('unknown ids and inherited keys are not tasks', () => {
        expect(taskTrade('9.9')).toBeUndefined();
        expect(taskTrade('')).toBeUndefined();
        expect(taskTrade('toString')).toBeUndefined();
        expect(taskTrade('constructor')).toBeUndefined();
    });
});

describe('crewBusy', () => {
    it('finds overlaps of that crew only, with the shared days', () => {
        const list = [a('c1', '2026-01-10', '2026-01-20'), a('c2', '2026-01-10', '2026-01-20'), a('c1', '2026-02-01', '2026-02-05')];
        const busy = crewBusy(list, 'c1', '2026-01-15', '2026-01-25');
        expect(busy).toHaveLength(1);
        expect(busy[0]).toMatchObject({ from: '2026-01-15', to: '2026-01-20', days: 6 });
        expect(busy[0]?.assignment.crewId).toBe('c1');
        expect(crewBusy(list, 'c3', '2026-01-01', '2026-12-31')).toEqual([]);
    });

    it('both ends are inclusive: touching on one day is busy, the next day is free', () => {
        const list = [a('c1', '2026-01-10', '2026-01-20')];
        expect(crewBusy(list, 'c1', '2026-01-20', '2026-01-25')[0]).toMatchObject({ from: '2026-01-20', to: '2026-01-20', days: 1 });
        expect(crewBusy(list, 'c1', '2026-01-05', '2026-01-10')[0]).toMatchObject({ from: '2026-01-10', to: '2026-01-10', days: 1 });
        expect(crewBusy(list, 'c1', '2026-01-21', '2026-01-25')).toEqual([]);
        expect(crewBusy(list, 'c1', '2026-01-01', '2026-01-09')).toEqual([]);
    });

    it('month ends: 31 January runs into 1 February', () => {
        const list = [a('c1', '2026-01-28', '2026-02-03')];
        expect(crewBusy(list, 'c1', '2026-01-31', '2026-02-01')[0]).toMatchObject({ days: 2 });
        expect(crewBusy(list, 'c1', '2026-02-04', '2026-02-10')).toEqual([]);
        // 30-day month: 30 April is the last day
        expect(crewBusy([a('c1', '2026-04-30', '2026-04-30')], 'c1', '2026-04-29', '2026-05-01')[0]).toMatchObject({ days: 1 });
    });

    it('leap years: February 2028 has a 29th, 2026 does not', () => {
        const leap = [a('c1', '2028-02-27', '2028-03-02')];
        expect(crewBusy(leap, 'c1', '2028-02-01', '2028-02-29')[0]).toMatchObject({ from: '2028-02-27', to: '2028-02-29', days: 3 });
        expect(crewBusy(leap, 'c1', '2028-02-27', '2028-03-02')[0]?.days).toBe(5);
        const plain = [a('c1', '2026-02-27', '2026-03-02')];
        expect(crewBusy(plain, 'c1', '2026-02-27', '2026-03-02')[0]?.days).toBe(4);
    });

    it('year boundary: December into January', () => {
        const list = [a('c1', '2026-12-28', '2027-01-03')];
        expect(crewBusy(list, 'c1', '2026-12-31', '2027-01-01')[0]).toMatchObject({ from: '2026-12-31', to: '2027-01-01', days: 2 });
        expect(crewBusy(list, 'c1', '2027-01-03', '2027-01-03')[0]?.days).toBe(1);
        expect(crewBusy(list, 'c1', '2027-01-04', '2027-01-10')).toEqual([]);
    });

    it('excludes the assignment being edited, and sorts by date', () => {
        const editing = a('c1', '2026-03-01', '2026-03-10', '1.5', 'edit');
        const later = a('c1', '2026-03-08', '2026-03-12', '2.1', 'later');
        const earlier = a('c1', '2026-02-25', '2026-03-02', '1.7', 'earlier');
        const busy = crewBusy([later, editing, earlier], 'c1', '2026-03-01', '2026-03-10', 'edit');
        expect(busy.map(b => b.assignment.id)).toEqual(['earlier', 'later']);
    });

    it('invalid ranges are busy with nothing; invalid assignments are skipped', () => {
        const list = [a('c1', '2026-01-10', '2026-01-20'), a('c1', 'bad', '2026-01-20'), a('c1', '2026-01-20', '2026-01-10')];
        expect(crewBusy(list, 'c1', '2026-01-25', '2026-01-01')).toEqual([]);
        expect(crewBusy(list, 'c1', '', '2026-01-20')).toEqual([]);
        expect(crewBusy(list, 'c1', '2026-01-01', '2026-01-31')).toHaveLength(1);
    });
});

describe('assignmentCoverage', () => {
    const task = { id: '1.5', start: '2026-01-22', finish: '2026-01-31' };

    it('none without a crew on that task', () => {
        expect(assignmentCoverage(task, [])).toEqual({ status: 'none', plannedDays: 10, coveredDays: 0, assignments: 0 });
        expect(assignmentCoverage(task, [a('c1', '2026-01-22', '2026-01-31', '1.6')]).status).toBe('none');
    });

    it('covered by one crew over the whole plan, or several crews that together cover it', () => {
        expect(assignmentCoverage(task, [a('c1', '2026-01-20', '2026-02-02')])).toMatchObject({ status: 'covered', coveredDays: 10 });
        const split = [a('c1', '2026-01-22', '2026-01-26'), a('c2', '2026-01-27', '2026-01-31')];
        expect(assignmentCoverage(task, split)).toMatchObject({ status: 'covered', coveredDays: 10, assignments: 2 });
        // overlapping crews are counted once per day
        const overlap = [a('c1', '2026-01-22', '2026-01-28'), a('c2', '2026-01-25', '2026-01-31')];
        expect(assignmentCoverage(task, overlap)).toMatchObject({ status: 'covered', coveredDays: 10 });
    });

    it('partly when days have no crew, including a crew only outside the plan', () => {
        expect(assignmentCoverage(task, [a('c1', '2026-01-22', '2026-01-26')])).toMatchObject({ status: 'partly', coveredDays: 5 });
        const gap = [a('c1', '2026-01-22', '2026-01-24'), a('c2', '2026-01-28', '2026-01-31')];
        expect(assignmentCoverage(task, gap)).toMatchObject({ status: 'partly', coveredDays: 7 });
        expect(assignmentCoverage(task, [a('c1', '2026-02-05', '2026-02-10')])).toMatchObject({ status: 'partly', coveredDays: 0 });
    });

    it('month and year edges', () => {
        const feb = { id: '2.1', start: '2028-02-26', finish: '2028-03-02' };   // leap year: 6 days
        expect(assignmentCoverage(feb, [a('c1', '2028-02-26', '2028-02-29', '2.1')])).toMatchObject({ status: 'partly', plannedDays: 6, coveredDays: 4 });
        expect(assignmentCoverage(feb, [a('c1', '2028-02-26', '2028-02-29', '2.1'), a('c2', '2028-03-01', '2028-03-02', '2.1')]).status).toBe('covered');
        const ny = { id: '3.1', start: '2026-12-30', finish: '2027-01-02' };
        expect(assignmentCoverage(ny, [a('c1', '2026-12-30', '2026-12-31', '3.1')])).toMatchObject({ status: 'partly', plannedDays: 4, coveredDays: 2 });
        expect(assignmentCoverage(ny, [a('c1', '2026-12-01', '2027-01-31', '3.1')]).status).toBe('covered');
    });

    it('a task without planned dates is covered by any crew; a finish before the start is the start day', () => {
        const undated = { id: '1.5', start: null, finish: null };
        expect(assignmentCoverage(undated, [])).toMatchObject({ status: 'none', plannedDays: 0 });
        expect(assignmentCoverage(undated, [a('c1', '2026-01-01', '2026-01-02')])).toMatchObject({ status: 'covered', plannedDays: 0 });
        const short = { id: '1.5', start: '2026-01-22', finish: '2026-01-21' };
        expect(assignmentCoverage(short, [a('c1', '2026-01-22', '2026-01-22')])).toMatchObject({ status: 'covered', plannedDays: 1 });
    });
});

describe('crewsByFit', () => {
    const crews = [
        { id: '1', name: 'ทีมทาสี ค.', trade: 'painting' },
        { id: '2', name: 'ทีมโครงสร้าง ข.', trade: 'structure' },
        { id: '3', name: 'ทีมก่อฉาบ', trade: 'masonry' },
        { id: '4', name: 'ทีมโครงสร้าง ก.', trade: 'structure' },
    ];

    it("the trade's crews first, each group by name", () => {
        expect(crewsByFit(crews, 'structure').map(c => c.id)).toEqual(['4', '2', '3', '1']);
        expect(crewsByFit(crews, 'painting').map(c => c.id)).toEqual(['1', '3', '4', '2']);
    });

    it('no crew of the trade, or no trade: everything by name; the input is not changed', () => {
        expect(crewsByFit(crews, 'plumbing').map(c => c.id)).toEqual(['3', '4', '2', '1']);
        expect(crewsByFit(crews, undefined).map(c => c.id)).toEqual(['3', '4', '2', '1']);
        expect(crews.map(c => c.id)).toEqual(['1', '2', '3', '4']);
        expect(crewsByFit([], 'structure')).toEqual([]);
    });
});

describe('task crews (calendar)', () => {
    const names = new Map([['c1', 'ทีมช่างสมชาย'], ['c2', 'ทีมไฟฟ้าพงษ์']]);
    const list = [
        a('c2', '2026-01-28', '2026-02-02', '1.5'),
        a('c1', '2026-01-22', '2026-01-27', '1.5'),
        a('c1', '2026-01-25', '2026-01-26', '1.6'),
        a('gone', '2026-01-25', '2026-01-26', '1.7'),
        a('c1', 'bad', '2026-01-26', '1.7'),
    ];
    const map = buildTaskCrewMap(list, id => names.get(id), 'ทีมที่เก็บถาวรแล้ว');

    it('groups by task in date order; unknown crews get the fallback name; invalid dates are dropped', () => {
        expect(map.get('1.5')?.map(c => c.name)).toEqual(['ทีมช่างสมชาย', 'ทีมไฟฟ้าพงษ์']);
        expect(map.get('1.7')?.map(c => c.name)).toEqual(['ทีมที่เก็บถาวรแล้ว']);
        expect(map.has('2.1')).toBe(false);
    });

    it('names on a day: only crews whose own dates include it (month edge)', () => {
        expect(crewNamesOnDay(map, '1.5', '2026-01-27')).toEqual(['ทีมช่างสมชาย']);
        expect(crewNamesOnDay(map, '1.5', '2026-01-28')).toEqual(['ทีมไฟฟ้าพงษ์']);
        expect(crewNamesOnDay(map, '1.5', '2026-02-01')).toEqual(['ทีมไฟฟ้าพงษ์']);
        expect(crewNamesOnDay(map, '1.5', '2026-02-03')).toEqual([]);
        expect(crewNamesOnDay(map, '9.9', '2026-01-27')).toEqual([]);
    });

    it('names in a range (a printed month) and as text', () => {
        expect(crewNamesInRange(map, '1.5', '2026-02-01', '2026-02-28')).toEqual(['ทีมไฟฟ้าพงษ์']);
        expect(crewNamesInRange(map, '1.5', '2026-01-01', '2026-01-31')).toEqual(['ทีมช่างสมชาย', 'ทีมไฟฟ้าพงษ์']);
        expect(crewNamesInRange(map, '1.5')).toEqual(['ทีมช่างสมชาย', 'ทีมไฟฟ้าพงษ์']);
        expect(crewNamesText(['ก', 'ข'])).toBe('ก, ข');
        expect(crewNamesText([])).toBe('');
    });

    it('a crew twice on the same task is named once', () => {
        const twice = buildTaskCrewMap([a('c1', '2026-01-01', '2026-01-03'), a('c1', '2026-01-02', '2026-01-05')], id => names.get(id), '?');
        expect(crewNamesOnDay(twice, '1.5', '2026-01-02')).toEqual(['ทีมช่างสมชาย']);
    });

    it('spanDays counts both ends', () => {
        expect(spanDays('2026-12-31', '2027-01-01')).toBe(2);
        expect(spanDays('2028-02-28', '2028-03-01')).toBe(3);
        expect(spanDays('2026-02-28', '2026-03-01')).toBe(2);
        expect(spanDays('2026-01-02', '2026-01-01')).toBe(0);
        expect(spanDays(null, '2026-01-01')).toBe(0);
    });
});
