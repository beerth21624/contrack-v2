import { describe, expect, it } from 'vitest';
import type { TaskLag } from '../../../shared/contract/workforce';
import { PLAN_TASKS } from '../../planning/tasks';
import type { BoardAssignment } from '../board';
import type { ChangedAssignment } from '../scenario';
import { describeChange, suggestMoves, SUGGESTION_LIMIT, type SuggestCrew, type SuggestInput, type Suggestion } from '../suggest';

const asg = (id: string, crewId: string, projectId: string, taskId: string, start: string, end: string): BoardAssignment =>
    ({ id, crewId, projectId, taskId, start, end });

const CREWS: SuggestCrew[] = [
    { id: 'R', name: 'ทีมก่อฉาบช่างแดง', trade: 'masonry', dailyCost: 1000 },
    { id: 'B', name: 'ทีมก่อฉาบช่างดำ', trade: 'masonry', dailyCost: 1200 },
    { id: 'P', name: 'ทีมทาสีช่างเอก', trade: 'painting', dailyCost: 900 },
    { id: 'P2', name: 'ทีมทาสีช่างโอ', trade: 'painting', dailyCost: 900 },
];
const PROJECTS: Record<string, string> = { W: 'บ้านคุณวิชัย', S: 'บ้านคุณสมศรี' };
const NAMES = {
    crewName: (id: string) => CREWS.find(c => c.id === id)?.name ?? id,
    projectName: (id: string) => PROJECTS[id] ?? id,
    taskName: (id: string) => PLAN_TASKS.find(t => t.id === id)?.name ?? id,
};
const TODAY = '2026-10-27';

function input(
    assignments: readonly BoardAssignment[], over: Partial<SuggestInput> = {}, lags: [string, TaskLag[]][] = [],
): SuggestInput {
    return {
        crews: CREWS, assignments, lagsByProject: new Map(lags), window: { from: '2026-10-01', to: '2026-11-30' }, today: TODAY,
        projectName: NAMES.projectName, taskName: NAMES.taskName, makeAssignment: a => a, ...over,
    };
}

/** Cross-project conflicts sharing a day from today on, over every assignment. */
function liveCross(list: readonly BoardAssignment[]): number {
    let n = 0;
    list.forEach((x, i) => {
        for (const y of list.slice(i + 1)) {
            if (x.crewId !== y.crewId || x.projectId === y.projectId) continue;
            const to = x.end < y.end ? x.end : y.end;
            const from = x.start > y.start ? x.start : y.start;
            if (from <= to && to >= TODAY) n++;
        }
    });
    return n;
}

function expectSafe(list: readonly BoardAssignment[], out: readonly Suggestion[]) {
    for (const s of out) {
        expect(liveCross(s.whatIf.result.assignments)).toBeLessThanOrEqual(liveCross(list));
        expect(s.whatIf.delta.crossProjectConflicts).toBeLessThanOrEqual(0);
        for (const c of s.whatIf.result.changed) {
            if (c.before?.start !== c.after.start) expect(c.after.start >= TODAY).toBe(true);
            if (c.before !== null && c.before.start < TODAY) expect(c.after.start).toBe(c.before.start);
        }
    }
}

// แดง is booked on W 5.1 (started) and S 4.1 28–30 Oct.
const W51 = asg('w51', 'R', 'W', '5.1', '2026-10-20', '2026-10-30');
const S41 = asg('s41', 'R', 'S', '4.1', '2026-10-28', '2026-11-05');

describe('suggestMoves: resolve-conflict', () => {
    it('hands the not-started assignment to a free crew of the trade (no delay)', () => {
        const list = [W51, S41];
        const out = suggestMoves(input(list));
        const top = out[0];
        expect(top).toBeDefined();
        if (top === undefined) return;
        expect(top.kind).toBe('resolve-conflict');
        expect(top.id).toBe('resolve-conflict:s41:B');
        expect(top.crewId).toBe('B');
        expect(top.projectId).toBe('S');
        expect(top.moves).toEqual([{ assignmentId: 's41', crewId: 'B' }]);
        expect(top.pullSuccessors).toBe(false);
        expect(top.title).toBe('ย้ายงานก่ออิฐ บ้านคุณสมศรี ไปให้ทีมก่อฉาบช่างดำ');
        expect(top.reasons[0]).toBe('ไม่ชนกับงานบ้านคุณวิชัยอีก');
        expect(top.reasons).toContain('ค่าแรงเพิ่ม ฿1,800'); // 9 days × (1,200 − 1,000)
        expect(top.reasons.some(r => r.startsWith('ทีมก่อฉาบช่างดำว่างอยู่ช่วงนั้น'))).toBe(true);
        expect(top.whatIf.delta.crossProjectConflicts).toBe(-1);
        expect(top.whatIf.delta.daysLost).toBe(0);
        expect(top.labourCostChange).toBe(1800);
        expectSafe(list, out);
        // The started W 5.1 is never handed over nor made to wait.
        expect(out.some(s => s.moves.some(m => m.assignmentId === 'w51' && (m.crewId !== undefined || m.start !== undefined)))).toBe(false);
    });

    it('without a free crew, the later one waits until its crew is free; knock-ons counted', () => {
        // S 5.1 (14–20 Nov, 4.1 waits 7 days → ready 13 Nov) is pushed 1 day by the wait.
        const list = [W51, S41, asg('s51', 'R', 'S', '5.1', '2026-11-15', '2026-11-20')];
        const crews = CREWS.filter(c => c.id !== 'B');
        const out = suggestMoves(input(list, { crews }));
        const s = out.find(x => x.kind === 'resolve-conflict');
        expect(s).toBeDefined();
        if (s === undefined) return;
        expect(s.id).toBe('resolve-conflict:s41:R');
        expect(s.moves).toEqual([{ assignmentId: 's41', start: '2026-10-31' }]);
        expect(s.title).toBe('เลื่อนงานก่ออิฐ บ้านคุณสมศรี ไปเริ่ม 31 ต.ค.');
        expect(s.reasons).toEqual(expect.arrayContaining([
            'ไม่ชนกับงานบ้านคุณวิชัยอีก',
            'บ้านคุณสมศรีเสร็จช้าลง 1 วัน (20 → 21 พ.ย.)',
            'มีงานที่ต้องเลื่อนตาม 1 งาน',
            'ทีมก่อฉาบช่างแดงว่างตั้งแต่ 31 ต.ค.',
        ]));
        expect(s.reasons.some(r => r.includes('ค่าแรง'))).toBe(false); // same crew, same days
        expect(s.whatIf.delta.daysLost).toBe(1);
        expect(s.whatIf.result.changed.map(c => [c.after.id, c.cause])).toEqual([['s41', 'move'], ['s51', 'knock-on']]);
        expectSafe(list, out);
    });

    it('when both could wait, the one with the better result is offered (one per crew)', () => {
        const today = '2026-10-15';
        const w = asg('w51', 'R', 'W', '5.1', '2026-10-20', '2026-10-30'); // not started yet
        const list = [w, S41, asg('s51', 'R', 'S', '5.1', '2026-11-15', '2026-11-20')];
        const crews = CREWS.filter(c => c.id !== 'B');
        const out = suggestMoves(input(list, { crews, today }));
        const resolves = out.filter(x => x.kind === 'resolve-conflict');
        expect(resolves).toHaveLength(1);
        expect(resolves[0]?.moves).toEqual([{ assignmentId: 's41', start: '2026-10-31' }]);
    });
});

describe('suggestMoves: help', () => {
    // แดง started S 4.1 on 25 Oct (14 days, to 7 Nov); S 5.1 starts when 4.1 + 7 days is over (15 Nov).
    const list = [asg('s41', 'R', 'S', '4.1', '2026-10-25', '2026-11-07'), asg('s51', 'R', 'S', '5.1', '2026-11-15', '2026-11-20')];

    it('sends a free crew of the trade to split the remaining days; the started one is only shortened', () => {
        const out = suggestMoves(input(list, { makeAssignment: a => ({ ...a, id: `x-${a.id}` }) }));
        expect(out).toHaveLength(1);
        const s = out[0];
        if (s === undefined) return;
        expect(s.kind).toBe('help');
        expect(s.id).toBe('help:s41:B');
        expect(s.crewId).toBe('B');
        expect(s.pullSuccessors).toBe(true);
        // 12 days left from today (27 Oct – 7 Nov): each crew takes 6, both end 1 Nov.
        expect(s.moves).toEqual([{ assignmentId: 's41', end: '2026-11-01' }]);
        expect(s.adds).toEqual([{ id: 'x-new-1', crewId: 'B', projectId: 'S', taskId: '4.1', start: '2026-10-27', end: '2026-11-01' }]);
        expect(s.title).toBe('ให้ทีมก่อฉาบช่างดำ ไปช่วยงานก่ออิฐ บ้านคุณสมศรี 6 วัน');
        expect(s.reasons).toEqual(expect.arrayContaining([
            'บ้านคุณสมศรีเสร็จเร็วขึ้น 6 วัน (20 → 14 พ.ย.)',
            'งานถัดไปเริ่มเร็วขึ้นตาม 1 งาน',
            'ทีมก่อฉาบช่างดำว่างอยู่ช่วงนั้น 35 วัน',
            'คิดว่าสองทีมทำงานได้เร็วพอกัน',
            'ค่าแรงเพิ่ม ฿1,200', // 6 × 1,200 − 6 × 1,000
        ]));
        expect(s.whatIf.delta).toMatchObject({ daysSaved: 6, daysLost: 0 });
        const s51 = s.whatIf.result.assignments.find(a => a.id === 's51');
        expect(s51 && `${s51.start}..${s51.end}`).toBe('2026-11-09..2026-11-14');
        expectSafe(list, out);
    });

    it('is not offered when too few days are left or the helper is busy', () => {
        const short = [asg('s41', 'R', 'S', '4.1', '2026-10-25', '2026-10-29'), asg('s51', 'R', 'S', '5.1', '2026-11-06', '2026-11-08')];
        expect(suggestMoves(input(short)).filter(s => s.kind === 'help')).toEqual([]);
        const busy = [...list, asg('bx', 'B', 'W', '4.1', '2026-10-20', '2026-11-30')];
        expect(suggestMoves(input(busy)).filter(s => s.kind === 'help' && s.crewId === 'B')).toEqual([]);
    });
});

describe('suggestMoves: fill-gap', () => {
    // W: plaster ended 10 Oct, waits 3 days → primer ready 14 Oct, but planned 2 Nov; final paint after it.
    const lags: [string, TaskLag[]][] = [['W', [{ taskId: '5.1', days: 3 }]]];
    const list = [
        asg('w51', 'R', 'W', '5.1', '2026-10-01', '2026-10-10'),
        asg('w65', 'P', 'W', '6.5', '2026-11-02', '2026-11-06'),
        asg('w72', 'P', 'W', '7.2', '2026-11-09', '2026-11-12'),
    ];

    it('starts a ready task earlier with its own crew and brings the next ones along', () => {
        const out = suggestMoves(input(list, {}, lags));
        const s = out[0];
        expect(s).toBeDefined();
        if (s === undefined) return;
        expect(s.kind).toBe('fill-gap');
        expect(s.id).toBe('fill-gap:w65:P');
        expect(s.moves).toEqual([{ assignmentId: 'w65', start: '2026-10-27' }]);
        expect(s.pullSuccessors).toBe(true);
        expect(s.title).toBe('เริ่มงานทาสีรองพื้น บ้านคุณวิชัย เร็วขึ้น 6 วัน');
        expect(s.reasons).toEqual(expect.arrayContaining([
            'บ้านคุณวิชัยเสร็จเร็วขึ้น 6 วัน (12 → 6 พ.ย.)',
            'งานถัดไปเริ่มเร็วขึ้นตาม 1 งาน',
            'งานก่อนหน้าเสร็จและครบช่วงรอแล้วตั้งแต่ 14 ต.ค.',
        ]));
        expect(s.whatIf.delta).toMatchObject({ daysSaved: 6, daysLost: 0 });
        expect(out.filter(x => x.crewId === 'P')).toHaveLength(1);
        expectSafe(list, out);
    });

    it('uses another free crew of the trade when its own is busy', () => {
        const busy = [...list, asg('sx', 'P', 'S', '6.5', '2026-10-25', '2026-11-01')];
        const out = suggestMoves(input(busy, {}, lags));
        const s = out.find(x => x.kind === 'fill-gap' && x.moves[0]?.assignmentId === 'w65');
        expect(s).toBeDefined();
        if (s === undefined) return;
        expect(s.id).toBe('fill-gap:w65:P2');
        expect(s.moves).toEqual([{ assignmentId: 'w65', start: '2026-10-27', crewId: 'P2' }]);
        expect(s.title).toBe('ให้ทีมทาสีช่างโอ ทำงานทาสีรองพื้น บ้านคุณวิชัย เริ่มเร็วขึ้น 6 วัน');
        expect(s.reasons.some(r => r.startsWith('ทีมทาสีช่างโอว่างอยู่ช่วงนั้น'))).toBe(true);
        expectSafe(busy, out);
    });

    it('only moves into the shown window, and not when the project would not finish earlier', () => {
        expect(suggestMoves(input(list, { window: { from: '2026-10-01', to: '2026-10-26' } }, lags))).toEqual([]);
        // Another branch ends later (5.2 wiring to 30 Nov, not after the primer): an earlier primer saves nothing.
        const other = [...list, asg('w52', 'E', 'W', '5.2', '2026-11-25', '2026-11-30')];
        expect(suggestMoves(input(other, {}, lags)).filter(s => s.kind === 'fill-gap')).toEqual([]);
    });
});

describe('suggestMoves: selection', () => {
    const lags: [string, TaskLag[]][] = [['W', [{ taskId: '5.1', days: 3 }]]];
    const list = [
        asg('s41', 'R', 'S', '4.1', '2026-10-25', '2026-11-07'), asg('s51', 'R', 'S', '5.1', '2026-11-15', '2026-11-20'),
        asg('w51', 'R', 'W', '5.1', '2026-10-01', '2026-10-10'),
        asg('w65', 'P', 'W', '6.5', '2026-11-02', '2026-11-06'), asg('w72', 'P', 'W', '7.2', '2026-11-09', '2026-11-12'),
    ];

    it('orders by score, respects the limit and the dismissed ids', () => {
        const all = suggestMoves(input(list, {}, lags));
        // fill-gap saves 6 days (60); help of ดำ saves 6 days for ฿1,200 more (58.8); โอ helping the final paint saves 2.
        expect(all.map(s => s.id)).toEqual(['fill-gap:w65:P', 'help:s41:B', 'help:w72:P2']);
        expect(all.map(s => s.score)).toEqual([...all.map(s => s.score)].sort((x, y) => y - x));
        expect(new Set(all.map(s => s.crewId)).size).toBe(all.length);
        expect(suggestMoves(input(list, { limit: 1 }, lags)).map(s => s.id)).toEqual(['fill-gap:w65:P']);
        const rest = suggestMoves(input(list, { dismissed: new Set(['fill-gap:w65:P']) }, lags)).map(s => s.id);
        expect(rest[0]).toBe('help:s41:B');
        expect(rest).not.toContain('fill-gap:w65:P');
        expect(suggestMoves(input(list, { limit: 0 }, lags))).toEqual([]);
        expect(SUGGESTION_LIMIT).toBe(3);
    });

    it('gives the same ids whatever the input order', () => {
        const a = suggestMoves(input(list, {}, lags)).map(s => s.id);
        const b = suggestMoves(input([...list].reverse(), {}, lags)).map(s => s.id);
        expect(b).toEqual(a);
    });

    it('offers nothing on a board without problems, or with a bad window or today', () => {
        expect(suggestMoves(input([asg('a', 'R', 'S', '4.1', '2026-10-27', '2026-10-29')]))).toEqual([]);
        expect(suggestMoves(input(list, { today: 'x' }, lags))).toEqual([]);
        expect(suggestMoves(input(list, { window: { from: '2026-11-30', to: '2026-10-01' } }, lags))).toEqual([]);
    });
});

describe('describeChange', () => {
    const before = asg('a', 'R', 'W', '5.1', '2026-11-02', '2026-11-09');
    const change = (after: BoardAssignment, cause: ChangedAssignment['cause'] = 'move', b: BoardAssignment | null = before): ChangedAssignment => ({
        before: b, after, cause, shiftDays: 0,
    });

    it('describes a crew change, a shift, a shortening and an add in Thai', () => {
        expect(describeChange(change({ ...before, crewId: 'B' }), NAMES)).toBe('งานฉาบปูน บ้านคุณวิชัย: ทีมก่อฉาบช่างแดง → ทีมก่อฉาบช่างดำ');
        expect(describeChange(change({ ...before, taskId: '6.5', start: '2026-11-05', end: '2026-11-12' }, 'knock-on',
            { ...before, taskId: '6.5' }), NAMES)).toBe('งานทาสีรองพื้น บ้านคุณวิชัย: เลื่อนไป 3 วัน (5–12 พ.ย.)');
        expect(describeChange(change({ ...before, start: '2026-10-30', end: '2026-11-06' }), NAMES))
            .toBe('งานฉาบปูน บ้านคุณวิชัย: เร็วขึ้น 3 วัน (30 ต.ค.–6 พ.ย.)');
        expect(describeChange(change({ ...before, end: '2026-11-05' }), NAMES)).toBe('งานฉาบปูน บ้านคุณวิชัย: เหลือ 2–5 พ.ย. (เดิมถึง 9 พ.ย.)');
        expect(describeChange(change(asg('new-1', 'B', 'S', '4.1', '2026-10-28', '2026-10-31'), 'add', null), NAMES))
            .toBe('เพิ่ม ทีมก่อฉาบช่างดำ ช่วยงานก่ออิฐ บ้านคุณสมศรี 28–31 ต.ค.');
        expect(describeChange(change({ ...before, crewId: 'B', start: '2026-11-04', end: '2026-11-11' }), NAMES))
            .toBe('งานฉาบปูน บ้านคุณวิชัย: ทีมก่อฉาบช่างแดง → ทีมก่อฉาบช่างดำ, เลื่อนไป 2 วัน (4–11 พ.ย.)');
    });

    it('adds ทีม / งาน to bare names', () => {
        const bare = { crewName: () => 'ช่างดำ', projectName: () => 'บ้าน A', taskName: () => 'ก่ออิฐ' };
        expect(describeChange(change({ ...before, crewId: 'B' }), bare)).toBe('งานก่ออิฐ บ้าน A: ทีมช่างดำ → ทีมช่างดำ');
    });
});
