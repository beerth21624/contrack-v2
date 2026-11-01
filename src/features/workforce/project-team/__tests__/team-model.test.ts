import { describe, expect, it } from 'vitest';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup as renderBare } from 'react-dom/server';
import { computeProject, createProject } from '@/domain/project';
import { crewBusy, effectiveTaskLag } from '@/domain/workforce';
import type { PersonDto } from '@/shared/contract';
import {
    assignProblems, assignmentPatch, availabilityHint, buildTeamRows, busyOf, chipConflicts, compactDayMonthRange,
    conflictLines, conflictSummaryText, dayMonthRange, defaultWaitText, needText, nextLagOverrides, otherProjectConflictCount,
    overlapLines, sameLagOverrides, taskLabel, teamSummary, teamSummaryText, waitCellText, waitDaysProblem,
    type BusyContext, type TeamAssignment,
} from '../team-model';
import { TeamTable } from '../TeamTable';
import { supervisorOptions } from '../SupervisorsCard';
import { withIntl } from '../../test-intl';

/** Renders under the Thai messages (the components read their texts with next-intl). */
const renderToStaticMarkup = (el: ReactElement): string => renderBare(withIntl(el));

const { schedule, manday } = computeProject(createProject('sample')).planning;
const blank = computeProject(createProject('blank')).planning;

const HERE = 'p-here';
let seq = 0;
const asg = (taskId: string, crewId: string, start: string, end: string, projectId = HERE, note: string | null = null): TeamAssignment =>
    ({ id: `a${String(++seq)}`, projectId, taskId, crewId, start, end, note });
const ctx: BusyContext = { projectId: HERE, projectName: id => (id === 'p-wichai' ? 'บ้านคุณวิชัย' : undefined) };

describe('team rows', () => {
    it('every planned task once, grouped by งวด in plan order, with plan dates, Man-Day crew and trade', () => {
        const groups = buildTeamRows(schedule, manday, []);
        expect(groups.map(g => g.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        const rows = groups.flatMap(g => g.tasks);
        expect(rows).toHaveLength(32);
        expect(rows.map(r => r.id)).toEqual(schedule.tasks.map(t => t.id));
        const footing = rows.find(r => r.id === '1.5');
        const t = schedule.tasks.find(x => x.id === '1.5');
        const b = manday.blocks.find(x => x.id === '1.5');
        expect(footing).toMatchObject({ start: t?.start, finish: t?.finish, skilled: b?.skilled, labourers: b?.labourers, trade: 'structure' });
        for (const r of rows) {
            expect(r.trade).toBeDefined();
            expect(r.coverage.status).toBe('none');
        }
    });

    it("each task gets only its own crews, in date order, with coverage against the plan", () => {
        const t = schedule.tasks.find(x => x.id === '1.5');
        if (!t?.start || !t.finish) throw new Error('sample 1.5 has dates');
        const late = asg('1.5', 'c2', t.finish, t.finish);
        const early = asg('1.5', 'c1', t.start, t.start);
        const groups = buildTeamRows(schedule, manday, [late, asg('2.1', 'c1', '2026-02-05', '2026-02-08'), early]);
        const row = groups.flatMap(g => g.tasks).find(r => r.id === '1.5');
        expect(row?.assignments.map(a => a.id)).toEqual([early.id, late.id]);
        expect(row?.coverage.status).toBe('partly');
        const s = teamSummary(groups);
        expect(s).toEqual({ total: 32, assigned: 2, unassigned: 30, partly: 1 });
        expect(teamSummaryText(s)).toBe('จัดทีมแล้ว 2 / 32 งาน · ยังไม่มีทีม 30 งาน · ทีมไม่ครบช่วงแผน 1 งาน');
    });

    it('a blank project lists the 32 tasks without dates', () => {
        const rows = buildTeamRows(blank.schedule, blank.manday, []).flatMap(g => g.tasks);
        expect(rows).toHaveLength(32);
        for (const r of rows) expect(r.start === null || typeof r.start === 'string').toBe(true);
    });

    it('summary when every task has a crew', () => {
        expect(teamSummaryText({ total: 32, assigned: 32, unassigned: 0, partly: 0 })).toBe('จัดทีมแล้ว 32 / 32 งาน · ครบทุกงาน');
    });
});

describe('texts', () => {
    it('ranges, needs and task labels', () => {
        expect(dayMonthRange('2026-01-22', '2026-01-31')).toBe('22/01–31/01');
        expect(dayMonthRange('2026-12-30', '2027-01-02')).toBe('30/12–02/01');
        expect(dayMonthRange('2026-02-01', '2026-02-01')).toBe('01/02');
        expect(needText(1, 5)).toBe('ช่าง 1 · คนงาน 5');
        expect(taskLabel('1.5')).toBe('1.5 งานฐานราก');
        expect(taskLabel('9.9')).toBe('9.9');
    });

    it('availability: ว่าง, or where the crew is busy (this project / another / unknown)', () => {
        const all = [
            asg('1.5', 'c1', '2026-01-22', '2026-01-31', 'p-wichai'),
            asg('2.1', 'c1', '2026-02-05', '2026-02-08'),
            asg('6.5', 'c1', '2026-03-01', '2026-03-05', 'p-gone'),
        ];
        expect(availabilityHint(crewBusy(all, 'c1', '2026-02-10', '2026-02-20'), ctx)).toBe('ว่าง');
        expect(availabilityHint(crewBusy(all, 'c1', '2026-01-30', '2026-02-02'), ctx)).toBe('ติดงาน บ้านคุณวิชัย 1.5 งานฐานราก 22/01–31/01');
        expect(availabilityHint(crewBusy(all, 'c1', '2026-02-08', '2026-02-08'), ctx)).toBe('ติดงาน โครงการนี้ 2.1 งานพื้นหล่อในที่ 05/02–08/02');
        expect(availabilityHint(crewBusy(all, 'c1', '2026-01-01', '2026-03-31'), ctx))
            .toBe('ติดงาน บ้านคุณวิชัย 1.5 งานฐานราก 22/01–31/01 และอีก 2 งาน');
        expect(overlapLines(crewBusy(all, 'c1', '2026-03-04', '2026-03-10'), ctx)).toEqual(['โครงการอื่น 6.5 งานทาสีรองพื้น 01/03–05/03 (ซ้อน 2 วัน)']);
    });

    it('busyOf: no range, no overlap; the edited assignment does not count against itself', () => {
        const own = asg('1.5', 'c1', '2026-01-22', '2026-01-31');
        expect(busyOf([own], 'c1', null, '2026-01-31')).toEqual([]);
        expect(busyOf([own], 'c1', '2026-01-22', '2026-01-31', own.id)).toEqual([]);
        expect(busyOf([own], 'c1', '2026-01-31', '2026-02-02')).toHaveLength(1);
    });
});

describe('form rules', () => {
    it('crew and dates are needed; the end may not come before the start', () => {
        expect(assignProblems({ crewId: undefined, start: null, end: null })).toEqual(['crew', 'dates']);
        expect(assignProblems({ crewId: 'c1', start: '2026-01-02', end: '2026-01-01' })).toEqual(['order']);
        expect(assignProblems({ crewId: 'c1', start: '2026-01-01', end: '2026-01-01' })).toEqual([]);
    });

    it('edit sends only what changed; an emptied note is null; nothing changed is undefined', () => {
        const before = { crewId: 'c1', start: '2026-01-01', end: '2026-01-05', note: 'เดิม' };
        expect(assignmentPatch(before, { ...before, note: 'เดิม' })).toBeUndefined();
        expect(assignmentPatch(before, { ...before, note: '  เดิม ' })).toBeUndefined();
        expect(assignmentPatch(before, { ...before, crewId: 'c2', note: 'เดิม' })).toEqual({ crewId: 'c2' });
        expect(assignmentPatch(before, { ...before, end: '2026-01-07', note: '' })).toEqual({ end: '2026-01-07', note: null });
        expect(assignmentPatch({ ...before, note: null }, { ...before, note: 'ใหม่' })).toEqual({ note: 'ใหม่' });
    });
});

describe('supervisor options', () => {
    const person = (id: string, name: string, role: PersonDto['role'], archived = false): PersonDto => ({
        id, workspaceId: 'w', name, nickname: null, phone: null, role, employment: 'permanent', trades: [],
        dailyWage: null, wagesHidden: true, note: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
        archivedAt: archived ? '2026-02-01T00:00:00.000Z' : null,
    });
    it('supervisors first, then foremen, engineers, others; archived only when already chosen', () => {
        const people = [person('1', 'ช่างเอ', 'skilled'), person('2', 'คุณบี', 'supervisor'), person('3', 'คุณซี', 'foreman'),
            person('4', 'คุณดี', 'supervisor', true)];
        expect(supervisorOptions(people, []).map(o => o.value)).toEqual(['2', '3', '1']);
        expect(supervisorOptions(people, ['4']).map(o => o.value)).toEqual(['4', '2', '3', '1']);
    });
});

describe('TeamTable (rendered)', () => {
    const t = schedule.tasks.find(x => x.id === '1.5');
    const start = t?.start ?? '2026-01-22';
    const groups = buildTeamRows(schedule, manday, [asg('1.5', 'c1', start, start, HERE, 'เข้าเช้า')]);
    const crewName = (id: string) => (id === 'c1' ? 'ทีมช่างสมชาย' : '?');
    const render = (canAssign: boolean, extra: Partial<Parameters<typeof TeamTable<TeamAssignment>>[0]> = {}) =>
        renderToStaticMarkup(createElement(TeamTable<TeamAssignment>, {
            groups, crewName, canAssign, onAdd: () => undefined, onEdit: () => undefined,
            waitOf: id => effectiveTaskLag(id, []), onEditWait: canAssign ? () => undefined : undefined,
            conflictsOf: () => [], ...extra,
        }));

    it('all 32 tasks under their งวด, columns in order, the crew chip with its dates', () => {
        const html = render(true);
        expect(html.match(/data-task="/g)).toHaveLength(32);
        for (const g of groups) expect(html).toContain(g.label);
        const heads = [...html.matchAll(/<th\s[^>]*>(.*?)<\/th>/g)].map(m => m[1]);
        expect(heads.slice(0, 7)).toEqual(['ลำดับ', 'งาน', 'ช่วงวันตามแผน', 'รอหลังงาน', 'คนที่ต้องใช้', 'สายงาน', 'ทีมที่จัด']);
        expect(html).toContain('ทีมช่างสมชาย');
        expect(html).toContain(dayMonthRange(start, start));
        expect(html).toContain('โครงสร้าง ค.ส.ล.');
        expect(html).toContain('ช่าง 1 · คนงาน 5');
        expect(html.match(/aria-label="จัดทีมงาน /g)?.length).toBe(32);
        expect(html).toContain('title="เข้าเช้า"');
        expect(html).not.toContain('undefined');
        expect(html).not.toContain('NaN');
    });

    it('read-only: no action column and the chips are not buttons', () => {
        const html = render(false);
        expect(html).not.toContain('จัดทีมงาน');
        expect(html).not.toContain('aria-label="แก้ไขทีม');
        expect(html).toContain('ยังไม่มีทีม');
        expect(html).toContain('ทีมช่างสมชาย');
    });

    it('scrolls sideways inside its card (wide table, never the page)', () => {
        const html = render(true);
        expect(html.startsWith('<div class="relative overflow-x-auto">')).toBe(true);
        expect(html).toContain('min-width:1160px');
    });

    it('waits: the defaults, an override tagged "แก้แล้ว", editable only with the editor; empty while loading', () => {
        const overrides = [{ taskId: '5.1', days: 21, note: 'ฝนตก' }];
        const html = render(true, { waitOf: id => effectiveTaskLag(id, overrides) });
        expect(html).toContain('7 วัน · บ่มคอนกรีตฐานราก');
        expect(html).toContain('21 วัน · ฝนตก');
        expect(html.match(/แก้แล้ว/g)).toHaveLength(1);
        expect(html.match(/aria-label="แก้ช่วงรอหลังงาน /g)).toHaveLength(32);
        const readOnly = render(false);
        expect(readOnly).toContain('7 วัน · บ่มคอนกรีตฐานราก');
        expect(readOnly).not.toContain('แก้ช่วงรอหลังงาน');
        expect(render(true, { waitOf: undefined })).not.toContain('บ่มคอนกรีต');
    });

    it('a clashing chip carries the red mark and says why', () => {
        const plain = render(true);
        expect(plain).not.toContain('data-conflict');
        const html = render(true, { conflictsOf: () => ['ชนกับ บ้านคุณสมศรี 4.1 งานก่ออิฐ 28–30/10 (3 วัน)'] });
        expect(html.match(/data-conflict/g)).toHaveLength(1);
        expect(html).toContain('ชนกับ บ้านคุณสมศรี 4.1 งานก่ออิฐ 28–30/10 (3 วัน)');
    });
});

describe('crew clashes', () => {
    const OTHER = 'p-somsri';
    const cx: BusyContext = { projectId: HERE, projectName: id => (id === OTHER ? 'บ้านคุณสมศรี' : undefined) };

    it('compact ranges: one month "28–30/10", across months like dayMonthRange, one day "28/10"', () => {
        expect(compactDayMonthRange('2026-10-28', '2026-10-30')).toBe('28–30/10');
        expect(compactDayMonthRange('2026-10-30', '2026-11-02')).toBe('30/10–02/11');
        expect(compactDayMonthRange('2026-12-30', '2027-12-31')).toBe('30/12–31/12');
        expect(compactDayMonthRange('2026-10-28', '2026-10-28')).toBe('28/10');
    });

    it('a chip clashes with the same crew in another project, not with itself or its own site; the line names the shared days', () => {
        const mine = asg('5.1', 'red', '2026-10-20', '2026-10-30');
        const there = asg('4.1', 'red', '2026-10-28', '2026-11-05', OTHER);
        const third = asg('6.5', 'red', '2026-10-30', '2026-11-02', 'p-gone');
        const sameHere = asg('4.1', 'red', '2026-10-15', '2026-10-20');
        const otherCrew = asg('4.1', 'blue', '2026-10-20', '2026-10-30', OTHER);
        const all = [mine, there, third, sameHere, otherCrew];
        const busy = chipConflicts(mine, all);
        expect(busy.map(b => b.assignment.id)).toEqual([there.id, third.id]);
        expect(conflictLines(busy, cx)).toEqual([
            'ชนกับ บ้านคุณสมศรี 4.1 งานก่ออิฐ 28–30/10 (3 วัน)',
            'ชนกับ โครงการอื่น 6.5 งานทาสีรองพื้น 30/10 (1 วัน)',
        ]);
        expect(chipConflicts(sameHere, all)).toEqual([]);
        expect(chipConflicts(otherCrew, all)).toEqual([]);
        // Seen from the other project, the same clash points back here.
        expect(conflictLines(chipConflicts(there, all), cx)).toEqual([
            'ชนกับ โครงการนี้ 5.1 งานฉาบปูน 28–30/10 (3 วัน)',
            'ชนกับ โครงการอื่น 6.5 งานทาสีรองพื้น 30/10–02/11 (4 วัน)',
        ]);
    });

    it('the summary counts the chips of this project that clash with another project', () => {
        const mine = asg('5.1', 'red', '2026-10-20', '2026-10-30');
        const twin = asg('4.1', 'red', '2026-10-25', '2026-10-26');
        const there = asg('4.1', 'red', '2026-10-28', '2026-11-05', OTHER);
        const all = [mine, twin, there];
        const map = new Map([mine, twin].map(a => [a.id, chipConflicts(a, all)]));
        expect(otherProjectConflictCount(map, HERE)).toBe(1);
        expect(conflictSummaryText(1)).toBe('ทีมชนกับโครงการอื่น 1 จุด');
        expect(conflictSummaryText(0)).toBe('');
    });
});

describe('waits after tasks', () => {
    it('cell text: days · reason, nothing for no wait, "ไม่รอ" when a default was removed', () => {
        expect(waitCellText(effectiveTaskLag('1.5', []))).toBe('7 วัน · บ่มคอนกรีตฐานราก');
        expect(waitCellText(effectiveTaskLag('1.1', []))).toBe('');
        expect(waitCellText(effectiveTaskLag('5.1', [{ taskId: '5.1', days: 0 }]))).toBe('ไม่รอ');
        expect(waitCellText(effectiveTaskLag('1.1', [{ taskId: '1.1', days: 2, note: 'รอดินยุบตัว' }]))).toBe('2 วัน · รอดินยุบตัว');
        expect(waitCellText({ taskId: 'x', days: 3, reason: '', overridden: false })).toBe('3 วัน');
        expect(defaultWaitText('1.5')).toBe('ค่าตั้งต้น 7 วัน · บ่มคอนกรีตฐานราก');
        expect(defaultWaitText('1.1')).toBe('ค่าตั้งต้น ไม่รอ');
    });

    it('days must be whole, 0–90', () => {
        expect(waitDaysProblem(0)).toBeUndefined();
        expect(waitDaysProblem(90)).toBeUndefined();
        expect(waitDaysProblem(null)).toBe('ใส่จำนวนวัน 0–90');
        expect(waitDaysProblem(91)).toBe('ใส่จำนวนวัน 0–90');
        expect(waitDaysProblem(-1)).toBe('ใส่จำนวนวัน 0–90');
        expect(waitDaysProblem(1.5)).toBe('ใส่จำนวนวัน 0–90');
    });

    it('the full list to PUT: other overrides kept, this task set or reset, defaults dropped, task order', () => {
        const current = [{ taskId: '5.1', days: 21, note: 'ฝนตก' }, { taskId: '1.10', days: 2, note: null }];
        expect(nextLagOverrides(current, '1.5', { days: 10, note: ' ดินอ่อน ' })).toEqual([
            { taskId: '1.5', days: 10, note: 'ดินอ่อน' },
            { taskId: '1.10', days: 2, note: null },
            { taskId: '5.1', days: 21, note: 'ฝนตก' },
        ]);
        expect(nextLagOverrides(current, '5.1', null)).toEqual([{ taskId: '1.10', days: 2, note: null }]);
        // Typing the default back (days and reason) is the default: no override stored.
        expect(nextLagOverrides([], '1.5', { days: 7, note: 'บ่มคอนกรีตฐานราก' })).toEqual([]);
        expect(nextLagOverrides([], '1.5', { days: 7, note: '' })).toEqual([]);
        // Removing a default wait is an override of 0 days.
        expect(nextLagOverrides([], '5.1', { days: 0, note: '' })).toEqual([{ taskId: '5.1', days: 0, note: null }]);
        // A note alone keeps the override.
        expect(nextLagOverrides([], '1.5', { days: 7, note: 'ใช้ปูนเร็ว' })).toEqual([{ taskId: '1.5', days: 7, note: 'ใช้ปูนเร็ว' }]);
    });

    it('unchanged edits are recognised so nothing is written', () => {
        const current = [{ taskId: '5.1', days: 21, note: 'ฝนตก' }];
        expect(sameLagOverrides(nextLagOverrides(current, '5.1', { days: 21, note: 'ฝนตก ' }), current)).toBe(true);
        expect(sameLagOverrides(nextLagOverrides(current, '1.5', { days: 7, note: '' }), current)).toBe(true);
        expect(sameLagOverrides(nextLagOverrides(current, '5.1', { days: 20, note: 'ฝนตก' }), current)).toBe(false);
    });
});
