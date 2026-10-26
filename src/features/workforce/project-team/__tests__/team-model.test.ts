import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computeProject, createProject } from '@/domain/project';
import { crewBusy } from '@/domain/workforce';
import type { PersonDto } from '@/shared/contract';
import {
    assignProblems, assignmentPatch, availabilityHint, buildTeamRows, busyOf, dayMonthRange, needText, overlapLines,
    taskLabel, teamSummary, teamSummaryText, type BusyContext, type TeamAssignment,
} from '../team-model';
import { TeamTable } from '../TeamTable';
import { supervisorOptions } from '../SupervisorsCard';

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
    const render = (canAssign: boolean) => renderToStaticMarkup(createElement(TeamTable<TeamAssignment>, {
        groups, crewName, canAssign, onAdd: () => undefined, onEdit: () => undefined,
    }));

    it('all 32 tasks under their งวด, columns in order, the crew chip with its dates', () => {
        const html = render(true);
        expect(html.match(/data-task="/g)).toHaveLength(32);
        for (const g of groups) expect(html).toContain(g.label);
        const heads = [...html.matchAll(/<th\s[^>]*>(.*?)<\/th>/g)].map(m => m[1]);
        expect(heads.slice(0, 6)).toEqual(['ลำดับ', 'งาน', 'ช่วงวันตามแผน', 'คนที่ต้องใช้', 'สายงาน', 'ทีมที่จัด']);
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
        expect(html.startsWith('<div class="overflow-x-auto">')).toBe(true);
        expect(html).toContain('min-width:980px');
    });
});
