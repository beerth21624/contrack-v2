import { describe, expect, it } from 'vitest';
import type { TaskLag } from '../../../shared/contract/workforce';
import type { BoardAssignment } from '../board';
import { applyMoves, compareScenarios, readyDay, scenarioMetrics, whatIf, type ScenarioMetrics } from '../scenario';

const asg = (id: string, crewId: string, projectId: string, taskId: string, start: string, end: string): BoardAssignment =>
    ({ id, crewId, projectId, taskId, start, end });
/** Project P: 4.1 waits 2 days, 5.1 waits 3 (overrides keep the arithmetic short). */
const LAGS = new Map<string, readonly TaskLag[]>([['P', [{ taskId: '4.1', days: 2 }, { taskId: '5.1', days: 3 }]]]);
const span = (a: BoardAssignment | undefined) => (a === undefined ? undefined : `${a.crewId} ${a.start}..${a.end}`);
const find = (list: readonly BoardAssignment[], id: string) => list.find(a => a.id === id);

describe('applyMoves', () => {
    it('changes the crew and keeps the days', () => {
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-05'), asg('b', 'R', 'P', '5.1', '2026-11-08', '2026-11-12')];
        const r = applyMoves(list, [{ assignmentId: 'a', crewId: 'B' }], LAGS);
        expect(span(find(r.assignments, 'a'))).toBe('B 2026-11-01..2026-11-05');
        expect(r.changed).toHaveLength(1);
        expect(r.changed[0]).toMatchObject({ cause: 'move', shiftDays: 0, before: { crewId: 'R' }, after: { crewId: 'B' } });
        expect(r.assignments.map(a => a.id)).toEqual(['a', 'b']);
    });

    it('a start alone keeps the length; an end alone keeps the start; unknown ids ignored; the last move wins', () => {
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-05')];
        expect(span(find(applyMoves(list, [{ assignmentId: 'a', start: '2026-11-03' }], LAGS).assignments, 'a')))
            .toBe('R 2026-11-03..2026-11-07');
        expect(span(find(applyMoves(list, [{ assignmentId: 'a', end: '2026-11-03' }], LAGS).assignments, 'a')))
            .toBe('R 2026-11-01..2026-11-03');
        const r = applyMoves(list, [{ assignmentId: 'x', start: '2026-12-01' }, { assignmentId: 'a', start: '2026-11-02' },
            { assignmentId: 'a', start: '2026-11-04' }], LAGS);
        expect(span(find(r.assignments, 'a'))).toBe('R 2026-11-04..2026-11-08');
        expect(r.changed.map(c => [c.after.id, c.cause, c.shiftDays])).toEqual([['a', 'move', 3]]);
        expect(applyMoves(list, [{ assignmentId: 'a', start: '2026-11-01' }], LAGS).changed).toEqual([]);
    });

    it('pushes later tasks of the project by the days needed, waits included (knock-on)', () => {
        const list = [
            asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-05'), // ready of 5.1: 5 + 2 + 1 = 8 Nov
            asg('b', 'R', 'P', '5.1', '2026-11-08', '2026-11-12'), // ready of 6.5: 12 + 3 + 1 = 16 Nov
            asg('c', 'T', 'P', '6.5', '2026-11-16', '2026-11-18'),
            asg('o', 'R', 'Q', '4.1', '2026-11-01', '2026-11-05'), // another project: untouched
        ];
        const r = applyMoves(list, [{ assignmentId: 'a', start: '2026-11-03' }], LAGS);
        expect(span(find(r.assignments, 'b'))).toBe('R 2026-11-10..2026-11-14');
        expect(span(find(r.assignments, 'c'))).toBe('T 2026-11-18..2026-11-20');
        expect(span(find(r.assignments, 'o'))).toBe('R 2026-11-01..2026-11-05');
        expect(r.changed.map(c => [c.after.id, c.cause, c.shiftDays])).toEqual([['a', 'move', 2], ['b', 'knock-on', 2], ['c', 'knock-on', 2]]);
    });

    it('does not push a later task with enough slack', () => {
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-05'), asg('b', 'R', 'P', '5.1', '2026-11-12', '2026-11-14')];
        const r = applyMoves(list, [{ assignmentId: 'a', start: '2026-11-03' }], LAGS); // ready 8 → 10 Nov, b starts 12
        expect(span(find(r.assignments, 'b'))).toBe('R 2026-11-12..2026-11-14');
        expect(r.changed).toHaveLength(1);
    });

    it('a task already started early is not made worse, but not "fixed" either', () => {
        // 5.1 starts 6 Nov, 2 days before its ready day (8 Nov). 4.1 two days later → ready 10 Nov: 5.1 moves by 2 only.
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-05'), asg('b', 'S', 'P', '5.1', '2026-11-06', '2026-11-10')];
        const r = applyMoves(list, [{ assignmentId: 'a', start: '2026-11-03' }], LAGS);
        expect(span(find(r.assignments, 'b'))).toBe('S 2026-11-08..2026-11-12');
        expect(r.changed[1]).toMatchObject({ cause: 'knock-on', shiftDays: 2 });
    });

    it('pullSuccessors brings later tasks earlier by the ready-day change, never onto other work of their crew', () => {
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-10'), asg('b', 'S', 'P', '5.1', '2026-11-13', '2026-11-17')];
        const shorten = [{ assignmentId: 'a', end: '2026-11-06' }]; // ready 13 → 9 Nov
        expect(span(find(applyMoves(list, shorten, LAGS).assignments, 'b'))).toBe('S 2026-11-13..2026-11-17');
        const r = applyMoves(list, shorten, LAGS, { pullSuccessors: true });
        expect(span(find(r.assignments, 'b'))).toBe('S 2026-11-09..2026-11-13');
        expect(r.changed[1]).toMatchObject({ cause: 'pull', shiftDays: -4 });

        // S works elsewhere 8–10 Nov: the pull stops at 11 Nov.
        const busy = [...list, asg('q', 'S', 'Q', '4.1', '2026-11-08', '2026-11-10')];
        expect(span(find(applyMoves(busy, shorten, LAGS, { pullSuccessors: true }).assignments, 'b'))).toBe('S 2026-11-11..2026-11-15');
        // Busy every day before: no pull.
        const full = [...list, asg('q', 'S', 'Q', '4.1', '2026-11-01', '2026-11-12')];
        expect(applyMoves(full, shorten, LAGS, { pullSuccessors: true }).changed).toHaveLength(1);
    });

    it('a pull never goes before the new ready day of a task that started early', () => {
        // b starts 11 Nov, 2 days before ready (13). Ready → 9 Nov: b may come to 9 Nov at most (2 days), not 4.
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-10'), asg('b', 'S', 'P', '5.1', '2026-11-11', '2026-11-15')];
        const r = applyMoves(list, [{ assignmentId: 'a', end: '2026-11-06' }], LAGS, { pullSuccessors: true });
        expect(span(find(r.assignments, 'b'))).toBe('S 2026-11-09..2026-11-13');
    });

    it('adds join the task: appended, listed as adds, and their end counts for the tasks after', () => {
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-10'), asg('b', 'S', 'P', '5.1', '2026-11-13', '2026-11-17')];
        const help = asg('new-1', 'B', 'P', '4.1', '2026-11-01', '2026-11-06');
        const r = applyMoves(list, [{ assignmentId: 'a', end: '2026-11-06' }], LAGS, { adds: [help], pullSuccessors: true });
        expect(r.assignments.map(a => a.id)).toEqual(['a', 'b', 'new-1']);
        expect(r.changed.map(c => [c.after.id, c.cause, c.before === null])).toEqual([['a', 'move', false], ['new-1', 'add', true], ['b', 'pull', false]]);
        expect(span(find(r.assignments, 'b'))).toBe('S 2026-11-09..2026-11-13');

        // An add that ends later than the task did pushes the next task.
        const late = asg('new-1', 'B', 'P', '4.1', '2026-11-05', '2026-11-12');
        const r2 = applyMoves(list, [], LAGS, { adds: [late] });
        expect(span(find(r2.assignments, 'b'))).toBe('S 2026-11-15..2026-11-19');
        expect(r2.changed.map(c => c.cause)).toEqual(['add', 'knock-on']);
    });

    it('an add on a task the project had no crew on takes its place in the order', () => {
        // P had 3.3 and 5.1 only; a 4.1 crew is added 1–6 Nov: 5.1 now waits for it (6 + 2 + 1 = 9 Nov).
        const list = [asg('r', 'H', 'P', '3.3', '2026-10-20', '2026-10-25'), asg('b', 'S', 'P', '5.1', '2026-10-26', '2026-10-30')];
        const add = asg('new-1', 'R', 'P', '4.1', '2026-11-01', '2026-11-06');
        const r = applyMoves(list, [], LAGS, { adds: [add] });
        expect(span(find(r.assignments, 'b'))).toBe('S 2026-11-09..2026-11-13');
        expect(r.changed.map(c => [c.after.id, c.cause])).toEqual([['new-1', 'add'], ['b', 'knock-on']]);
    });
});

describe('readyDay', () => {
    it('is the day after the latest task before + its wait; null for a first task', () => {
        const list = [
            asg('r', 'H', 'P', '3.3', '2026-10-20', '2026-10-30'),
            asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-05'),
            asg('b', 'R', 'P', '5.1', '2026-11-08', '2026-11-12'),
        ];
        expect(readyDay(list, '5.1', LAGS.get('P') ?? [])).toBe('2026-11-08'); // max(30 Oct + 0 + 1, 5 Nov + 2 + 1)
        expect(readyDay(list, '5.1', [])).toBe('2026-11-13'); // default wait after 4.1: 7 days
        expect(readyDay(list, '6.5', LAGS.get('P') ?? [])).toBe('2026-11-16'); // through absent 6.1–6.4
        expect(readyDay(list, '3.3', [])).toBeNull();
        expect(readyDay(list, '1.1', [])).toBeNull();
    });

    it('waits for the last piece of a task split between crews', () => {
        const list = [asg('a', 'R', 'P', '4.1', '2026-11-01', '2026-11-05'), asg('h', 'B', 'P', '4.1', '2026-11-02', '2026-11-07')];
        expect(readyDay(list, '5.1', LAGS.get('P') ?? [])).toBe('2026-11-10');
    });
});

describe('scenarioMetrics and compareScenarios', () => {
    const crews = [{ id: 'R', dailyCost: 1000 }, { id: 'B', dailyCost: null }];
    const W = { from: '2026-11-01', to: '2026-11-10' };

    it('reads finish, crew-days, labour cost (null when a cost is unknown), idle value (partial) and utilisation', () => {
        const list = [asg('a', 'R', 'P', '1.1', '2026-11-01', '2026-11-05'), asg('b', 'B', 'Q', '1.1', '2026-11-03', '2026-11-04')];
        const m = scenarioMetrics(crews, list, new Map(), W, '2026-11-01');
        expect(m.projects).toEqual([
            { projectId: 'P', finish: '2026-11-05', crewDays: 5, labourCost: 5000 },
            { projectId: 'Q', finish: '2026-11-04', crewDays: 2, labourCost: null },
        ]);
        expect(m.conflicts).toBe(0);
        expect(m.crossProjectConflicts).toBe(0);
        expect(m.idleCrewDays).toBe(5 + 8);
        expect(m.idleValue).toBe(5 * 1000);
        expect(m.idleValuePartial).toBe(true);
        expect(m.averageUtilisation).toBeCloseTo((0.5 + 0.2) / 2);

        const known = scenarioMetrics([{ id: 'R', dailyCost: 1000 }], list.slice(0, 1), new Map(), W, '2026-11-01');
        expect(known.idleValuePartial).toBe(false);
    });

    it('counts conflicts and those between two projects', () => {
        const list = [
            asg('a', 'R', 'P', '1.1', '2026-11-01', '2026-11-05'),
            asg('b', 'R', 'Q', '1.1', '2026-11-04', '2026-11-06'),
            asg('c', 'R', 'P', '1.2', '2026-11-05', '2026-11-05'),
        ];
        const m = scenarioMetrics(crews, list, new Map(), W, '2026-11-01');
        expect(m.conflicts).toBe(3);
        expect(m.crossProjectConflicts).toBe(2);
    });

    it('compares finishes (days saved / lost) and labour cost, listing only projects that changed', () => {
        const base = (p: ScenarioMetrics['projects']): ScenarioMetrics => ({
            projects: p, conflicts: 2, crossProjectConflicts: 1, idleCrewDays: 10, waitCrewDays: 0, idleValue: 5000,
            idleValuePartial: false, averageUtilisation: 0.5,
        });
        const before = base([
            { projectId: 'P', finish: '2026-11-05', crewDays: 5, labourCost: 5000 },
            { projectId: 'Q', finish: '2026-11-04', crewDays: 2, labourCost: 2000 },
            { projectId: 'Z', finish: '2026-11-09', crewDays: 1, labourCost: 100 },
        ]);
        const after = {
            ...base([
                { projectId: 'P', finish: '2026-11-03', crewDays: 5, labourCost: 5000 },
                { projectId: 'Q', finish: '2026-11-07', crewDays: 3, labourCost: 3200 },
                { projectId: 'Z', finish: '2026-11-09', crewDays: 1, labourCost: 100 },
            ]),
            conflicts: 1, crossProjectConflicts: 0, idleCrewDays: 7, idleValue: 4000,
        };
        const d = compareScenarios(before, after);
        expect(d.daysSaved).toBe(2);
        expect(d.daysLost).toBe(3);
        expect(d.projects).toEqual([
            { projectId: 'P', finishBefore: '2026-11-05', finishAfter: '2026-11-03', days: -2, labourCost: 0 },
            { projectId: 'Q', finishBefore: '2026-11-04', finishAfter: '2026-11-07', days: 3, labourCost: 1200 },
        ]);
        expect(d).toMatchObject({ conflicts: -1, crossProjectConflicts: -1, idleCrewDays: -3, idleValue: -1000, labourCost: 1200 });

        const unknown = compareScenarios(before, base([{ projectId: 'P', finish: '2026-11-05', crewDays: 5, labourCost: null }]));
        expect(unknown.labourCost).toBeNull();
    });

    it('whatIf applies the moves and compares the two boards', () => {
        const list = [asg('a', 'R', 'P', '1.1', '2026-11-01', '2026-11-05'), asg('b', 'R', 'Q', '1.1', '2026-11-04', '2026-11-06')];
        const w = whatIf(crews, list, new Map(), [{ assignmentId: 'b', crewId: 'B' }], W, '2026-11-01');
        expect(w.before.crossProjectConflicts).toBe(1);
        expect(w.after.crossProjectConflicts).toBe(0);
        expect(w.delta.crossProjectConflicts).toBe(-1);
        expect(w.delta.daysSaved + w.delta.daysLost).toBe(0);
        expect(w.result.changed).toHaveLength(1);
    });
});
