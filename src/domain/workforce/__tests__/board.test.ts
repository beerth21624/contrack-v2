import { describe, expect, it } from 'vitest';
import type { TaskLag } from '../../../shared/contract/workforce';
import {
    addDays, boardDays, boardQueryRange, boardTotals, buildCrewBoard, crewHasProblem, dayOfWeek, monthHeaders, presetWindow,
    stepWindow, thaiDay, thaiDayRange, weekHeaders, windowDays,
    type BoardAssignment, type BoardSegment, type WaitSegment, type WorkSegment,
} from '../board';

const NO_LAGS = new Map<string, readonly TaskLag[]>();
const crew = (id: string) => ({ id, name: id });

let seq = 0;
function asg(crewId: string, projectId: string, taskId: string, start: string, end: string, id?: string): BoardAssignment {
    seq += 1;
    return { id: id ?? `a${String(seq).padStart(3, '0')}`, crewId, projectId, taskId, start, end };
}

const kinds = (segs: readonly BoardSegment[]) => segs.map(s => `${s.kind}:${s.from}..${s.to}`);
const works = (segs: readonly BoardSegment[]) => segs.filter((s): s is WorkSegment => s.kind === 'work');
const waitsOf = (segs: readonly BoardSegment[]) => segs.filter((s): s is WaitSegment => s.kind === 'wait');

describe('day arithmetic', () => {
    it('adds days across month, year and leap-day edges', () => {
        expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
        expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
        expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
        expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
        expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
        expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
        expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
        expect(addDays('bad', 3)).toBe('bad');
    });

    it('counts window days inclusively', () => {
        expect(windowDays({ from: '2026-10-01', to: '2026-10-01' })).toBe(1);
        expect(windowDays({ from: '2026-10-01', to: '2026-10-31' })).toBe(31);
        expect(windowDays({ from: '2028-02-01', to: '2028-02-29' })).toBe(29);
        expect(windowDays({ from: '2026-12-30', to: '2027-01-02' })).toBe(4);
        expect(windowDays({ from: '2026-10-02', to: '2026-10-01' })).toBe(0);
        expect(windowDays({ from: '2026-10-01', to: 'x' })).toBe(0);
    });

    it('knows the weekday (0 = Sunday)', () => {
        expect(dayOfWeek('2026-10-26')).toBe(1); // Monday
        expect(dayOfWeek('2026-11-01')).toBe(0); // Sunday
        expect(dayOfWeek('2028-02-29')).toBe(2); // Tuesday
        expect(dayOfWeek('1899-12-30')).toBe(6); // Saturday (serial 0)
        for (const iso of ['2026-01-01', '2026-10-30', '2030-07-15']) {
            expect(dayOfWeek(iso)).toBe(new Date(`${iso}T00:00:00Z`).getUTCDay());
        }
    });
});

describe('windows', () => {
    it('2 weeks start on the Monday of the anchor week and end on a Sunday', () => {
        expect(presetWindow('2w', '2026-10-26')).toEqual({ from: '2026-10-26', to: '2026-11-08' });
        expect(presetWindow('2w', '2026-11-01')).toEqual({ from: '2026-10-26', to: '2026-11-08' });
        expect(presetWindow('2w', '2027-01-01')).toEqual({ from: '2026-12-28', to: '2027-01-10' });
        expect(dayOfWeek(presetWindow('2w', '2028-03-01').to)).toBe(0);
    });

    it('1 month is the calendar month, 3 months the month and the next two', () => {
        expect(presetWindow('1m', '2026-10-26')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
        expect(presetWindow('1m', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
        expect(presetWindow('1m', '2027-02-10')).toEqual({ from: '2027-02-01', to: '2027-02-28' });
        expect(presetWindow('3m', '2026-11-15')).toEqual({ from: '2026-11-01', to: '2027-01-31' });
        expect(windowDays(presetWindow('3m', '2027-12-01'))).toBe(31 + 31 + 29);
    });

    it('steps by the preset span', () => {
        expect(stepWindow('2w', presetWindow('2w', '2026-10-26'), 1)).toEqual({ from: '2026-11-09', to: '2026-11-22' });
        expect(stepWindow('2w', presetWindow('2w', '2026-10-26'), -1)).toEqual({ from: '2026-10-12', to: '2026-10-25' });
        expect(stepWindow('1m', presetWindow('1m', '2026-12-05'), 1)).toEqual({ from: '2027-01-01', to: '2027-01-31' });
        expect(stepWindow('1m', presetWindow('1m', '2027-01-05'), -1)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
        expect(stepWindow('1m', presetWindow('1m', '2028-01-31'), 1)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
        expect(stepWindow('3m', presetWindow('3m', '2026-11-01'), 1)).toEqual({ from: '2027-02-01', to: '2027-04-30' });
        expect(stepWindow('3m', presetWindow('3m', '2026-11-01'), -1)).toEqual({ from: '2026-08-01', to: '2026-10-31' });
    });

    it('query range widens to today and back for waits', () => {
        expect(boardQueryRange({ from: '2026-12-01', to: '2026-12-31' }, '2026-10-26', 90))
            .toEqual({ from: addDays('2026-10-26', -90), to: '2026-12-31' });
        expect(boardQueryRange({ from: '2026-08-01', to: '2026-08-31' }, '2026-10-26', 0))
            .toEqual({ from: '2026-08-01', to: '2026-10-26' });
    });
});

describe('Thai labels', () => {
    it('formats days and ranges', () => {
        expect(thaiDay('2026-10-28')).toBe('28 ต.ค.');
        expect(thaiDay('2026-10-28', true)).toBe('28 ต.ค. 26');
        expect(thaiDayRange('2026-10-28', '2026-10-30')).toBe('28–30 ต.ค.');
        expect(thaiDayRange('2026-10-30', '2026-11-02')).toBe('30 ต.ค.–2 พ.ย.');
        expect(thaiDayRange('2026-12-30', '2027-01-02')).toBe('30 ธ.ค. 26–2 ม.ค. 27');
        expect(thaiDayRange('2026-10-28', '2026-10-28')).toBe('28 ต.ค.');
    });

    it('month and week headers cover every day of the window', () => {
        const w = { from: '2026-10-26', to: '2026-11-08' };
        expect(monthHeaders(w)).toEqual([
            { label: 'ตุลาคม 2026', offset: 0, days: 6 },
            { label: 'พฤศจิกายน 2026', offset: 6, days: 8 },
        ]);
        expect(weekHeaders(w)).toEqual([
            { label: '26 ต.ค.–1 พ.ย.', offset: 0, days: 7 },
            { label: '2–8 พ.ย.', offset: 7, days: 7 },
        ]);
        // A month window cut mid-week at both ends.
        const oct = weekHeaders({ from: '2026-10-01', to: '2026-10-31' });
        expect(oct[0]).toEqual({ label: '1–4 ต.ค.', offset: 0, days: 4 });
        expect(oct.reduce((n, h) => n + h.days, 0)).toBe(31);
        expect(oct[oct.length - 1]).toEqual({ label: '26–31 ต.ค.', offset: 25, days: 6 });
        const leap = monthHeaders({ from: '2028-02-01', to: '2028-03-02' });
        expect(leap).toEqual([{ label: 'กุมภาพันธ์ 2028', offset: 0, days: 29 }, { label: 'มีนาคม 2028', offset: 29, days: 2 }]);
        expect(boardDays({ from: '2028-02-28', to: '2028-03-01' }).map(d => d.day)).toEqual([28, 29, 1]);
    });
});

describe('buildCrewBoard: segments', () => {
    const window = { from: '2026-10-01', to: '2026-10-31' };

    it('an empty crew is one idle stretch over the whole window', () => {
        const b = buildCrewBoard([crew('c1')], [], NO_LAGS, window, '2026-10-26');
        const [row] = b.rows;
        expect(b.days).toBe(31);
        expect(kinds(row?.segments ?? [])).toEqual(['idle:2026-10-01..2026-10-31']);
        expect(row?.metrics).toEqual({
            busyDays: 0, idleDays: 31, waitDays: 0, conflictDays: 0, utilisation: 0, nextFreeDay: '2026-10-26', freeToday: true,
        });
        expect(row?.gaps).toEqual([{
            crewId: 'c1', from: '2026-10-01', to: '2026-10-31', days: 31, waitDays: 0, idleDays: 31, kind: 'idle', waits: [], open: true,
        }]);
        expect(row?.lanes).toBe(1);
    });

    it('work, then the wait after the task (from end + 1 for N days), then idle', () => {
        // 1.5 งานฐานราก waits 7 days by default.
        const a = asg('c1', 'p1', '1.5', '2026-10-05', '2026-10-10');
        const b = buildCrewBoard([crew('c1')], [a], NO_LAGS, window, '2026-10-26');
        const row = b.rows[0];
        expect(kinds(row?.segments ?? [])).toEqual([
            'idle:2026-10-01..2026-10-04', 'work:2026-10-05..2026-10-10', 'wait:2026-10-11..2026-10-17', 'idle:2026-10-18..2026-10-31',
        ]);
        const [wait] = waitsOf(row?.segments ?? []);
        expect(wait).toMatchObject({
            assignmentId: a.id, projectId: 'p1', taskId: '1.5', reason: 'บ่มคอนกรีตฐานราก', lagDays: 7, overridden: false,
            waitStart: '2026-10-11', waitEnd: '2026-10-17', offset: 10, days: 7,
        });
        const [work] = works(row?.segments ?? []);
        expect(work).toMatchObject({ offset: 4, days: 6, lane: 0, conflictWith: [], start: '2026-10-05', end: '2026-10-10' });
        expect(row?.metrics).toMatchObject({ busyDays: 6, idleDays: 25, waitDays: 7, utilisation: 6 / 31 });
        // The free stretch after the work holds the wait: labelled รอ, still free time.
        expect(row?.gaps.map(g => [g.from, g.to, g.kind, g.waitDays, g.idleDays])).toEqual([
            ['2026-10-01', '2026-10-04', 'idle', 0, 4],
            ['2026-10-11', '2026-10-31', 'wait', 7, 14],
        ]);
        expect(row?.gaps[1]?.waits).toEqual([{ assignmentId: a.id, projectId: 'p1', taskId: '1.5', reason: 'บ่มคอนกรีตฐานราก' }]);
    });

    it('uses the project override (and its note) for the wait; other projects keep the default', () => {
        const lags = new Map<string, readonly TaskLag[]>([['p1', [{ taskId: '5.1', days: 3, note: 'อากาศร้อน แห้งเร็ว' }]]]);
        const b = buildCrewBoard([crew('c1'), crew('c2')], [
            asg('c1', 'p1', '5.1', '2026-10-01', '2026-10-05'),
            asg('c2', 'p2', '5.1', '2026-10-01', '2026-10-05'),
        ], lags, window, '2026-10-01');
        expect(waitsOf(b.rows[0]?.segments ?? [])[0]).toMatchObject({ lagDays: 3, reason: 'อากาศร้อน แห้งเร็ว', overridden: true, to: '2026-10-08' });
        expect(waitsOf(b.rows[1]?.segments ?? [])[0]).toMatchObject({ lagDays: 14, reason: 'ปูนฉาบแห้งก่อนทาสีรองพื้น', to: '2026-10-19' });
        // An override of 0 removes the wait.
        const none = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.5', '2026-10-01', '2026-10-05')],
            new Map([['p1', [{ taskId: '1.5', days: 0 }]]]), window, '2026-10-01');
        expect(waitsOf(none.rows[0]?.segments ?? [])).toEqual([]);
    });

    it('a task with no wait has none; work during a wait fills those days (the crew moved elsewhere)', () => {
        const b = buildCrewBoard([crew('c1')], [
            asg('c1', 'p1', '1.5', '2026-10-01', '2026-10-05'), // waits 6–12
            asg('c1', 'p2', '1.1', '2026-10-08', '2026-10-09'), // no wait after 1.1
        ], NO_LAGS, window, '2026-10-01');
        expect(kinds(b.rows[0]?.segments ?? [])).toEqual([
            'work:2026-10-01..2026-10-05', 'wait:2026-10-06..2026-10-07', 'work:2026-10-08..2026-10-09',
            'wait:2026-10-10..2026-10-12', 'idle:2026-10-13..2026-10-31',
        ]);
        // Both wait pieces belong to the same assignment and keep the full wait.
        expect(waitsOf(b.rows[0]?.segments ?? []).map(w => [w.lagDays, w.waitStart, w.waitEnd]))
            .toEqual([[7, '2026-10-06', '2026-10-12'], [7, '2026-10-06', '2026-10-12']]);
        expect(b.rows[0]?.metrics.waitDays).toBe(5);
    });

    it('a task split into pieces waits once, after its last piece', () => {
        const b = buildCrewBoard([crew('c1')], [
            asg('c1', 'p1', '1.5', '2026-10-01', '2026-10-03'),
            asg('c1', 'p1', '1.5', '2026-10-06', '2026-10-08'),
        ], NO_LAGS, window, '2026-10-01');
        expect(kinds(b.rows[0]?.segments ?? [])).toEqual([
            'work:2026-10-01..2026-10-03', 'idle:2026-10-04..2026-10-05', 'work:2026-10-06..2026-10-08',
            'wait:2026-10-09..2026-10-15', 'idle:2026-10-16..2026-10-31',
        ]);
    });

    it('two waits on the same day: the earlier one shows, the later one takes over after', () => {
        const b = buildCrewBoard([crew('c1')], [
            asg('c1', 'p1', '1.6', '2026-10-01', '2026-10-02', 'x1'), // waits 3–5 (3 days)
            asg('c1', 'p2', '1.6', '2026-10-01', '2026-10-03', 'x2'), // waits 4–6
        ], NO_LAGS, window, '2026-10-01');
        // 3 Oct is work (x2); on 4–5 x1's wait started first; on 6 Oct only x2 still waits.
        const w = waitsOf(b.rows[0]?.segments ?? []);
        expect(w.map(s => [s.assignmentId, s.from, s.to])).toEqual([['x1', '2026-10-04', '2026-10-05'], ['x2', '2026-10-06', '2026-10-06']]);
        expect(b.rows[0]?.gaps).toHaveLength(1);
        expect(b.rows[0]?.gaps[0]?.waits.map(x => x.assignmentId)).toEqual(['x1', 'x2']);
    });

    it('clips work and waits to the window and picks up waits of work that ended before it', () => {
        const b = buildCrewBoard([crew('c1')], [
            asg('c1', 'p1', '5.1', '2026-09-10', '2026-09-25'), // waits 26 Sep – 9 Oct
            asg('c1', 'p1', '6.1', '2026-10-25', '2026-11-15'),
        ], NO_LAGS, window, '2026-10-01');
        const segs = b.rows[0]?.segments ?? [];
        expect(kinds(segs)).toEqual(['wait:2026-10-01..2026-10-09', 'idle:2026-10-10..2026-10-24', 'work:2026-10-25..2026-10-31']);
        expect(segs[0]).toMatchObject({ offset: 0, days: 9, waitStart: '2026-09-26', waitEnd: '2026-10-09' });
        expect(segs[2]).toMatchObject({ offset: 24, days: 7, start: '2026-10-25', end: '2026-11-15' });
        expect(b.rows[0]?.metrics.busyDays).toBe(7);
        // Work entirely outside the window is not shown.
        const out = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.1', '2026-11-02', '2026-11-03')], NO_LAGS, window, '2026-10-01');
        expect(works(out.rows[0]?.segments ?? [])).toEqual([]);
    });

    it('a free stretch at the window end is open unless work starts the next day', () => {
        const open = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.1', '2026-10-01', '2026-10-20')], NO_LAGS, window, '2026-10-01');
        expect(open.rows[0]?.gaps[0]).toMatchObject({ from: '2026-10-21', to: '2026-10-31', open: true });
        const closed = buildCrewBoard([crew('c1')], [
            asg('c1', 'p1', '1.1', '2026-10-01', '2026-10-20'), asg('c1', 'p1', '1.2', '2026-11-01', '2026-11-05'),
        ], NO_LAGS, window, '2026-10-01');
        expect(closed.rows[0]?.gaps[0]).toMatchObject({ from: '2026-10-21', to: '2026-10-31', open: false });
    });

    it('lists only free stretches of 2 days or more', () => {
        const b = buildCrewBoard([crew('c1')], [
            asg('c1', 'p1', '1.1', '2026-10-01', '2026-10-10'),
            asg('c1', 'p1', '1.2', '2026-10-12', '2026-10-20'), // 11 Oct alone: 1 day
            asg('c1', 'p1', '1.3', '2026-10-23', '2026-10-31'), // 21–22: 2 days
        ], NO_LAGS, window, '2026-10-01');
        expect(b.rows[0]?.gaps.map(g => [g.from, g.to, g.days])).toEqual([['2026-10-21', '2026-10-22', 2]]);
        expect(kinds(b.rows[0]?.segments ?? [])).toContain('idle:2026-10-11..2026-10-11');
    });

    it('handles a window over a leap day and the year end', () => {
        const leap = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.1', '2028-02-27', '2028-03-02')], NO_LAGS,
            { from: '2028-02-01', to: '2028-02-29' }, '2028-02-15');
        expect(works(leap.rows[0]?.segments ?? [])[0]).toMatchObject({ from: '2028-02-27', to: '2028-02-29', offset: 26, days: 3 });
        expect(leap.rows[0]?.metrics).toMatchObject({ busyDays: 3, idleDays: 26 });
        const yearEnd = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.5', '2026-12-28', '2026-12-31')], NO_LAGS,
            { from: '2026-12-21', to: '2027-01-10' }, '2026-12-21');
        expect(kinds(yearEnd.rows[0]?.segments ?? [])).toEqual([
            'idle:2026-12-21..2026-12-27', 'work:2026-12-28..2026-12-31', 'wait:2027-01-01..2027-01-07', 'idle:2027-01-08..2027-01-10',
        ]);
    });

    it('an invalid window gives empty rows; invalid assignments are skipped', () => {
        const b = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.1', '2026-10-05', '2026-10-01'), asg('c1', 'p1', '1.1', '', '2026-10-01')],
            NO_LAGS, { from: '2026-10-31', to: '2026-10-01' }, '2026-10-01');
        expect(b.days).toBe(0);
        expect(b.rows[0]?.segments).toEqual([]);
        expect(b.rows[0]?.metrics.utilisation).toBe(0);
        const ok = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.1', '2026-10-05', '2026-10-01')], NO_LAGS, window, '2026-10-01');
        expect(kinds(ok.rows[0]?.segments ?? [])).toEqual(['idle:2026-10-01..2026-10-31']);
    });

    it('ignores assignments of crews not on the board and keeps the crew order', () => {
        const b = buildCrewBoard([crew('z'), crew('a')], [asg('ghost', 'p1', '1.1', '2026-10-01', '2026-10-31')], NO_LAGS, window, '2026-10-01');
        expect(b.rows.map(r => r.crew.id)).toEqual(['z', 'a']);
        expect(b.totals.idleCrewDays).toBe(62);
    });
});

describe('buildCrewBoard: conflicts', () => {
    const window = { from: '2026-10-01', to: '2026-11-30' };

    it('the demo case: plastering until 30 Oct and brickwork from 28 Oct clash 3 days', () => {
        const plaster = asg('red', 'wichai', '5.1', '2026-10-12', '2026-10-30', 'plaster');
        const brick = asg('red', 'somsri', '4.1', '2026-10-28', '2026-11-15', 'brick');
        const b = buildCrewBoard([crew('red')], [brick, plaster], NO_LAGS, window, '2026-10-26');
        expect(b.conflicts).toEqual([{
            crewId: 'red', a: plaster, b: brick, from: '2026-10-28', to: '2026-10-30', days: 3, sameProject: false,
        }]);
        const ws = works(b.rows[0]?.segments ?? []);
        expect(ws.map(w => [w.assignment.id, w.lane, w.conflictWith])).toEqual([['plaster', 0, ['brick']], ['brick', 1, ['plaster']]]);
        expect(b.rows[0]?.lanes).toBe(2);
        expect(b.rows[0]?.metrics).toMatchObject({ conflictDays: 3, busyDays: 19 + 19 - 3 });
        expect(b.totals.conflicts).toBe(1);
        expect(crewHasProblem(b.rows[0] ?? { conflicts: [], segments: [] }, '2026-10-26')).toBe(true);
    });

    it('touching ranges (one ends the day before the other starts) do not clash; same-day ends do', () => {
        const b = buildCrewBoard([crew('c')], [
            asg('c', 'p1', '1.1', '2026-10-01', '2026-10-10'),
            asg('c', 'p2', '1.1', '2026-10-11', '2026-10-20'),
            asg('c', 'p3', '1.1', '2026-10-20', '2026-10-20'),
        ], NO_LAGS, window, '2026-10-01');
        expect(b.conflicts.map(c => [c.from, c.to, c.days])).toEqual([['2026-10-20', '2026-10-20', 1]]);
        expect(b.rows[0]?.lanes).toBe(2);
        expect(works(b.rows[0]?.segments ?? []).map(w => w.lane)).toEqual([0, 0, 1]);
    });

    it('three overlapping assignments give three pairs and three lanes; lanes are reused', () => {
        const b = buildCrewBoard([crew('c')], [
            asg('c', 'p1', '1.1', '2026-10-01', '2026-10-10', 'k1'),
            asg('c', 'p2', '1.2', '2026-10-05', '2026-10-12', 'k2'),
            asg('c', 'p3', '1.3', '2026-10-08', '2026-10-09', 'k3'),
            asg('c', 'p1', '1.4', '2026-10-11', '2026-10-11', 'k4'),
        ], NO_LAGS, window, '2026-10-01');
        expect(b.conflicts.map(c => `${c.a.id}-${c.b.id}:${String(c.days)}`)).toEqual(['k1-k2:6', 'k1-k3:2', 'k2-k3:2', 'k2-k4:1']);
        expect(works(b.rows[0]?.segments ?? []).map(w => [w.assignment.id, w.lane])).toEqual([['k1', 0], ['k2', 1], ['k3', 2], ['k4', 0]]);
        expect(b.rows[0]?.lanes).toBe(3);
        expect(b.rows[0]?.metrics.conflictDays).toBe(7); // 5–11 Oct
    });

    it('two tasks of one project at once are flagged sameProject', () => {
        const b = buildCrewBoard([crew('c')], [
            asg('c', 'p1', '4.1', '2026-10-01', '2026-10-10'), asg('c', 'p1', '5.1', '2026-10-09', '2026-10-15'),
        ], NO_LAGS, window, '2026-10-01');
        expect(b.conflicts[0]?.sameProject).toBe(true);
    });

    it('lists only conflicts that touch the window (the bars still know about the others)', () => {
        const b = buildCrewBoard([crew('c')], [
            asg('c', 'p1', '1.1', '2026-09-01', '2026-10-02', 'm1'),
            asg('c', 'p2', '1.1', '2026-09-10', '2026-09-20', 'm2'),
        ], NO_LAGS, window, '2026-10-01');
        expect(b.conflicts).toEqual([]);
        expect(works(b.rows[0]?.segments ?? [])[0]?.conflictWith).toEqual(['m2']);
        expect(b.rows[0]?.metrics.conflictDays).toBe(0);
    });

    it('sorts the board conflicts by first shared day across crews', () => {
        const b = buildCrewBoard([crew('c1'), crew('c2')], [
            asg('c1', 'p1', '1.1', '2026-10-20', '2026-10-25'), asg('c1', 'p2', '1.1', '2026-10-22', '2026-10-23'),
            asg('c2', 'p1', '1.1', '2026-10-02', '2026-10-05'), asg('c2', 'p2', '1.1', '2026-10-05', '2026-10-06'),
        ], NO_LAGS, window, '2026-10-01');
        expect(b.conflicts.map(c => [c.crewId, c.from])).toEqual([['c2', '2026-10-05'], ['c1', '2026-10-22']]);
    });
});

describe('buildCrewBoard: metrics and totals', () => {
    const window = { from: '2026-10-26', to: '2026-11-08' };

    it('next free day follows back-to-back work past the window; busy today is not free', () => {
        const b = buildCrewBoard([crew('c1'), crew('c2')], [
            asg('c1', 'p1', '1.1', '2026-10-20', '2026-10-31'),
            asg('c1', 'p2', '1.2', '2026-11-01', '2026-11-20'),
            asg('c1', 'p3', '1.3', '2026-11-15', '2026-11-25'),
            asg('c2', 'p1', '1.1', '2026-10-27', '2026-10-28'),
        ], NO_LAGS, window, '2026-10-26');
        expect(b.rows[0]?.metrics).toMatchObject({ nextFreeDay: '2026-11-26', freeToday: false, busyDays: 14, utilisation: 1, idleDays: 0 });
        expect(b.rows[1]?.metrics).toMatchObject({ nextFreeDay: '2026-10-26', freeToday: true, busyDays: 2 });
        expect(b.totals).toEqual({
            crews: 2, conflicts: 0, idleCrewDays: 12, waitCrewDays: 0, averageUtilisation: (1 + 2 / 14) / 2, crewsIdleToday: 1,
        });
    });

    it('a crew on a wait today is free today (waits are free time)', () => {
        const b = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.5', '2026-10-20', '2026-10-25')], NO_LAGS, window, '2026-10-26');
        expect(b.rows[0]?.segments[0]).toMatchObject({ kind: 'wait', from: '2026-10-26', to: '2026-11-01' });
        expect(b.rows[0]?.metrics).toMatchObject({ freeToday: true, nextFreeDay: '2026-10-26', waitDays: 7, idleDays: 14 });
        expect(b.totals).toMatchObject({ crewsIdleToday: 1, idleCrewDays: 14, waitCrewDays: 7, averageUtilisation: 0 });
    });

    it('totals of no rows are zero', () => {
        expect(boardTotals([])).toEqual({ crews: 0, conflicts: 0, idleCrewDays: 0, waitCrewDays: 0, averageUtilisation: 0, crewsIdleToday: 0 });
    });

    it('a problem: a conflict, or 7+ idle days (not waits) that are not over yet', () => {
        const long = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.1', '2026-10-26', '2026-11-02')], NO_LAGS, window, '2026-10-26');
        expect(crewHasProblem(long.rows[0] ?? { conflicts: [], segments: [] }, '2026-10-26')).toBe(false); // 6 idle days
        const longer = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '1.1', '2026-10-26', '2026-10-30')], NO_LAGS, window, '2026-10-26');
        expect(crewHasProblem(longer.rows[0] ?? { conflicts: [], segments: [] }, '2026-10-26')).toBe(true); // 31 Oct – 8 Nov
        expect(crewHasProblem(longer.rows[0] ?? { conflicts: [], segments: [] }, '2026-11-09')).toBe(false); // already past
        const waiting = buildCrewBoard([crew('c1')], [asg('c1', 'p1', '2.4', '2026-10-20', '2026-10-25')], NO_LAGS, window, '2026-10-26');
        expect(crewHasProblem(waiting.rows[0] ?? { conflicts: [], segments: [] }, '2026-10-26')).toBe(false); // a 14-day wait
    });
});

