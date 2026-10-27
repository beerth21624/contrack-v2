import { describe, expect, it } from 'vitest';
import type { CrewAssignmentDto, CrewDto } from '@/shared/contract';
import { whatIf, type ChangedAssignment, type ScenarioMetrics, type WhatIf } from '@/domain/workforce/scenario';
import type { Suggestion } from '@/domain/workforce/suggest';
import {
    DISMISSED_KEY, DISMISSED_MAX, SUGGESTION_NOTE, assignmentFactory, changeLine, finishShift, followOns, idleValueCell,
    impactLines, loadDismissed, money, parseDismissed, pickSuggestions, planTaskName, runSaveSteps, saveDismissed,
    changeNamesOf, saveFailureLines, saveSteps, signedMoney, touchedProjects, withDismissed, withoutDismissed,
} from '../suggest-view';

const T = '2026-10-01T00:00:00.000Z';
const U = '00000000-0000-4000-8000-000000000000';
const W = { from: '2026-10-01', to: '2026-11-30' };
const TODAY = '2026-10-01';

function crew(id: string, name: string, dailyCost: number | null, archived = false): CrewDto {
    return {
        id, workspaceId: U, name, trade: 'masonry', leaderId: null, memberIds: [], skilledCount: 1, labourerCount: 0, rateCardId: null,
        dailyCostOverride: null, dailyCost, wagesHidden: dailyCost === null, note: null, createdAt: T, updatedAt: T,
        archivedAt: archived ? T : null,
    };
}

function asg(id: string, crewId: string, projectId: string, taskId: string, start: string, end: string): CrewAssignmentDto {
    return { id, workspaceId: U, projectId, taskId, crewId, start, end, note: null, createdBy: U, createdAt: T, updatedAt: T };
}

const NAMES: Record<string, string> = {
    somsri: 'บ้านคุณสมศรี', wichai: 'บ้านคุณวิชัย', red: 'ทีมก่อฉาบช่างแดง', black: 'ทีมก่อฉาบช่างดำ',
};

const change = (
    before: CrewAssignmentDto | null, after: CrewAssignmentDto, cause: ChangedAssignment['cause'], shiftDays = 0,
): ChangedAssignment<CrewAssignmentDto> => ({ before, after, cause, shiftDays });

describe('money and day wording', () => {
    it('writes baht and shifts', () => {
        expect(money(12500)).toBe('฿12,500');
        expect(signedMoney(3200)).toBe('+฿3,200');
        expect(signedMoney(-3200)).toBe('−฿3,200');
        expect(signedMoney(0)).toBe('฿0');
        expect(finishShift(-6)).toBe('เร็วขึ้น 6 วัน');
        expect(finishShift(2)).toBe('ช้าลง 2 วัน');
        expect(finishShift(0)).toBe('เท่าเดิม');
    });
});

describe('change lines', () => {
    const brick = asg('a1', 'red', 'somsri', '4.1', '2026-10-28', '2026-11-03');
    it('uses the domain wording with the board names', () => {
        expect(planTaskName('4.1')).toBe('งานก่ออิฐ');
        expect(planTaskName('9.9')).toBe('งาน 9.9');
        const names = changeNamesOf({ project: id => NAMES[id] ?? id, crew: id => NAMES[id] ?? id });
        expect(changeLine(change(null, asg('new-1', 'black', 'somsri', '4.1', '2026-11-03', '2026-11-09'), 'add'), names))
            .toBe('เพิ่ม ทีมก่อฉาบช่างดำ ช่วยงานก่ออิฐ บ้านคุณสมศรี 3–9 พ.ย.');
        expect(changeLine(change(brick, { ...brick, crewId: 'black' }, 'move'), names))
            .toBe('งานก่ออิฐ บ้านคุณสมศรี: ทีมก่อฉาบช่างแดง → ทีมก่อฉาบช่างดำ');
    });
});

describe('before → after lines from a what-if', () => {
    const crews = [crew('red', 'ทีมก่อฉาบช่างแดง', 1500), crew('black', 'ทีมก่อฉาบช่างดำ', 1200)];
    const list = [
        asg('b', 'red', 'somsri', '4.1', '2026-10-05', '2026-10-14'),
        asg('p', 'red', 'somsri', '5.1', '2026-10-20', '2026-10-29'),
    ];
    const w = whatIf(crews, list, new Map(), [{ assignmentId: 'b', end: '2026-10-24' }], W, TODAY);

    it('lists the knock-on and the later finish', () => {
        expect(followOns(w.result.changed).map(c => c.after.id)).toEqual(['p']);
        expect(touchedProjects(w)).toEqual(['somsri']);
        const lines = impactLines(w, { projectName: id => NAMES[id] ?? id, moneyVisible: false, today: TODAY });
        const project = lines.find(l => l.key === 'project:somsri');
        expect(project?.label).toBe('บ้านคุณสมศรี เสร็จ');
        expect(project?.before).toBe('29 ต.ค.');
        expect(project?.tone).toBe('bad');
        expect(project?.change).toMatch(/^ช้าลง \d+ วัน$/);
        // No money without visible wages.
        expect(lines.some(l => l.key === 'idleValue' || l.key === 'labour')).toBe(false);
    });

    it('adds money lines only with visible wages and a known change', () => {
        const helped = whatIf(crews, list, new Map(), [{ assignmentId: 'b', crewId: 'black' }], W, TODAY);
        const lines = impactLines(helped, { projectName: id => NAMES[id] ?? id, moneyVisible: true, today: TODAY });
        const labour = lines.find(l => l.key === 'labour');
        expect(labour?.change).toBe(signedMoney(-300 * 10));
        expect(labour?.tone).toBe('good');
        const hidden = whatIf([crew('red', 'x', null), crew('black', 'y', null)], list, new Map(), [{ assignmentId: 'b', crewId: 'black' }], W, TODAY);
        expect(impactLines(hidden, { projectName: id => id, moneyVisible: true, today: TODAY }).some(l => l.key === 'labour')).toBe(false);
    });

    it('shows conflicts before and after when there are any', () => {
        const clash = [...list, asg('o', 'red', 'wichai', '4.1', '2026-10-10', '2026-10-12')];
        const fixed = whatIf(crews, clash, new Map(), [{ assignmentId: 'o', crewId: 'black' }], W, TODAY);
        const c = impactLines(fixed, { projectName: id => id, moneyVisible: false, today: TODAY }).find(l => l.key === 'conflicts');
        expect(c).toMatchObject({ before: '1', after: '0', change: 'ลดลง 1 จุด', tone: 'good' });
    });

    it('writes the year when it is not this year', () => {
        const late = [asg('x', 'red', 'somsri', '4.1', '2027-01-05', '2027-01-10')];
        const moved = whatIf(crews, late, new Map(), [{ assignmentId: 'x', start: '2027-01-06' }], { from: '2027-01-01', to: '2027-01-31' }, TODAY);
        const line = impactLines(moved, { projectName: id => id, moneyVisible: false, today: TODAY })[0];
        expect(line?.before).toBe('10 ม.ค. 27');
        expect(line?.after).toBe('11 ม.ค. 27');
    });
});

describe('save steps', () => {
    const b = asg('b', 'red', 'somsri', '4.1', '2026-10-05', '2026-10-14');
    const p = asg('p', 'red', 'somsri', '5.1', '2026-10-20', '2026-10-29');
    const add = asg('new-1', 'black', 'somsri', '4.1', '2026-10-08', '2026-10-14');

    it('creates adds with the note and updates only what differs, moves first then adds then follow-ons', () => {
        const steps = saveSteps([
            change(p, { ...p, start: '2026-10-22', end: '2026-10-31' }, 'knock-on', 2),
            change(null, add, 'add'),
            change(b, { ...b, crewId: 'black' }, 'move'),
            change(b, b, 'move'),
        ]);
        expect(steps.map(s => s.kind)).toEqual(['update', 'create', 'update']);
        expect(steps[0]).toMatchObject({ kind: 'update', assignmentId: 'b', body: { crewId: 'black' } });
        expect(steps[1]).toMatchObject({
            kind: 'create',
            body: { projectId: 'somsri', taskId: '4.1', crewId: 'black', start: '2026-10-08', end: '2026-10-14', note: SUGGESTION_NOTE },
        });
        expect(steps[2]).toMatchObject({ kind: 'update', assignmentId: 'p', body: { start: '2026-10-22', end: '2026-10-31' } });
        expect(steps[2]?.kind === 'update' ? Object.keys(steps[2].body) : []).toEqual(['start', 'end']);
    });

    it('runs them one by one and stops at the first error', async () => {
        const steps = saveSteps([
            change(b, { ...b, crewId: 'black' }, 'move'),
            change(p, { ...p, start: '2026-10-22', end: '2026-10-31' }, 'knock-on', 2),
            change(null, add, 'add'),
        ]);
        const seen: string[] = [];
        const run = await runSaveSteps(steps, async s => {
            seen.push(s.change.after.id);
            if (s.change.after.id === 'new-1') throw new Error('boom');
            return Promise.resolve();
        });
        expect(seen).toEqual(['b', 'new-1']);
        expect(run.saved).toBe(1);
        expect(run.failed?.index).toBe(1);
        expect(saveFailureLines(run, steps.length)).toEqual({
            title: 'บันทึกรายการที่ 2 จาก 3 ไม่สำเร็จ',
            saved: '1 รายการก่อนหน้าบันทึกแล้ว รายการที่เหลือยังไม่ได้บันทึก',
        });
        const ok = await runSaveSteps(steps, () => Promise.resolve());
        expect(ok).toEqual({ saved: 3 });
        const first = await runSaveSteps(steps, () => Promise.reject(new Error('x')));
        expect(saveFailureLines(first, 3).saved).toBe('ยังไม่มีรายการใดถูกบันทึก');
    });
});

describe('suggestions shown', () => {
    const base = asg('b', 'red', 'somsri', '4.1', '2026-10-05', '2026-10-14');
    const suggestion = (id: string, changed: ChangedAssignment<CrewAssignmentDto>[]): Suggestion<CrewAssignmentDto> => ({
        id, kind: 'help', crewId: 'black', projectId: 'somsri', title: id, reasons: [], moves: [], adds: [], pullSuccessors: false,
        whatIf: { result: { assignments: [], changed } } as unknown as WhatIf<CrewAssignmentDto>, score: 1,
    });

    it('drops suggestions that put work on an archived or unknown crew, keeps the limit', () => {
        const crews = [crew('red', 'a', null), crew('black', 'b', null), crew('old', 'c', null, true)];
        const list = [
            suggestion('to-old', [change(base, { ...base, crewId: 'old' }, 'move')]),
            suggestion('to-black', [change(base, { ...base, crewId: 'black' }, 'move')]),
            suggestion('shift-old', [change({ ...base, crewId: 'old' }, { ...base, crewId: 'old', start: '2026-10-06' }, 'move', 1)]),
            suggestion('add-ghost', [change(null, { ...base, id: 'new-1', crewId: 'ghost' }, 'add')]),
            suggestion('add-black', [change(null, { ...base, id: 'new-1', crewId: 'black' }, 'add')]),
        ];
        expect(pickSuggestions(list, crews, 3).map(s => s.id)).toEqual(['to-black', 'shift-old', 'add-black']);
        expect(pickSuggestions(list, crews, 1).map(s => s.id)).toEqual(['to-black']);
    });

    it('makes new assignments with new-<n> ids', () => {
        const make = assignmentFactory('ws');
        const a = make({ id: '', crewId: 'black', projectId: 'somsri', taskId: '4.1', start: '2026-10-08', end: '2026-10-14' });
        const b = make({ id: 'x', crewId: 'black', projectId: 'somsri', taskId: '4.2', start: '2026-10-08', end: '2026-10-14' });
        const c = make({ id: 'new-9', crewId: 'black', projectId: 'somsri', taskId: '4.2', start: '2026-10-08', end: '2026-10-14' });
        expect([a.id, b.id, c.id]).toEqual(['new-1', 'new-2', 'new-9']);
        expect(a).toMatchObject({ workspaceId: 'ws', taskId: '4.1', note: SUGGESTION_NOTE });
        expect(assignmentFactory('ws')(a).id).toBe('new-1');
    });
});

describe('dismissed suggestions', () => {
    it('parses only a JSON array of strings', () => {
        expect(parseDismissed(null)).toEqual([]);
        expect(parseDismissed('')).toEqual([]);
        expect(parseDismissed('{')).toEqual([]);
        expect(parseDismissed('{"a":1}')).toEqual([]);
        expect(parseDismissed('["a",1,"b","a",""]')).toEqual(['a', 'b']);
    });

    it('adds newest last, dedupes, caps and removes', () => {
        expect(withDismissed(['a', 'b'], 'a')).toEqual(['b', 'a']);
        const many = Array.from({ length: DISMISSED_MAX }, (_, i) => `s${String(i)}`);
        const next = withDismissed(many, 'new');
        expect(next).toHaveLength(DISMISSED_MAX);
        expect(next[0]).toBe('s1');
        expect(next.at(-1)).toBe('new');
        expect(withoutDismissed(['a', 'b', 'c'], ['b', 'x'])).toEqual(['a', 'c']);
    });

    it('reads and writes storage, and survives blocked storage', () => {
        const mem = new Map<string, string>();
        const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
        saveDismissed(['a', 'b'], store);
        expect(mem.get(DISMISSED_KEY)).toBe('["a","b"]');
        expect(loadDismissed(store)).toEqual(['a', 'b']);
        const blocked = { getItem: (): string | null => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
        expect(loadDismissed(blocked)).toEqual([]);
        expect(() => { saveDismissed(['a'], blocked); }).not.toThrow();
        expect(loadDismissed(undefined)).toEqual([]);
    });
});

describe('idle value in the summary', () => {
    const m = (idleValue: number, idleValuePartial: boolean): Pick<ScenarioMetrics, 'idleValue' | 'idleValuePartial'> => ({ idleValue, idleValuePartial });
    it('says nothing when no wage is visible, marks partial', () => {
        expect(idleValueCell(m(0, true), [{ dailyCost: null }])).toBeNull();
        expect(idleValueCell(m(0, false), [])).toBeNull();
        expect(idleValueCell(m(13500, false), [{ dailyCost: 1500 }])).toEqual({ value: '฿13,500', partial: false });
        expect(idleValueCell(m(13500, true), [{ dailyCost: 1500 }, { dailyCost: null }])).toEqual({ value: '฿13,500', partial: true });
    });
});
