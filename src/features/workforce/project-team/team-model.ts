// ─── The "ทีมงาน" page as data (pure): the 32 planned tasks by งวด with their crews, the summary, Thai texts ───
// Rows read the computed plan (S-Curve start / finish, Man-Day ช่าง / คนงาน) and the project's crew assignments;
// nothing here changes a planning number.
import type { ManDayResult, ScheduleResult } from '@/domain/planning';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import {
    assignmentCoverage, byDates, crewBusy, taskTrade,
    type AssignmentCoverage, type AssignmentSpan, type CrewBusySpan,
} from '@/domain/workforce';
import { isoToSerial, serialToIso } from '@/domain/planning/calendar';
import { formatDayMonth } from '@/features/planning/shared/planning-format';
import type { WorkforceTradeId } from '@/shared/contract/workforce';

/** An assignment as the page reads it (CrewAssignmentDto has these fields). */
export interface TeamAssignment extends AssignmentSpan {
    projectId: string;
    note: string | null;
}

export interface TeamTaskRow<A extends TeamAssignment = TeamAssignment> {
    id: string;
    installment: number;
    name: string;
    /** Planned first / last day (S-Curve; a finish before the start counts as the start day). null when undated. */
    start: string | null;
    finish: string | null;
    /** Man-Day ช่าง / คนงาน of the task's block. */
    skilled: number;
    labourers: number;
    trade: WorkforceTradeId | undefined;
    /** The task's crews in date order. */
    assignments: A[];
    coverage: AssignmentCoverage;
}

export interface TeamInstallment<A extends TeamAssignment = TeamAssignment> {
    no: number;
    label: string;
    tasks: TeamTaskRow<A>[];
}

const finite = (x: number | undefined) => (x !== undefined && Number.isFinite(x) ? x : 0);

/** The planned range of a computed task, as the crew calendar shows it. */
function plannedRange(start: string | null, finish: string | null): { start: string | null; finish: string | null } {
    const s = isoToSerial(start);
    if (s === null) return { start: null, finish: null };
    const f = isoToSerial(finish);
    return { start: serialToIso(s), finish: serialToIso(Math.max(s, f ?? s)) };
}

/** Every planned task, grouped by งวด like the Gantt table, with the crews assigned in this project. */
export function buildTeamRows<A extends TeamAssignment>(
    schedule: ScheduleResult, manday: ManDayResult, assignments: readonly A[],
): TeamInstallment<A>[] {
    const blocks = new Map(manday.blocks.map(b => [b.id, b]));
    const byTask = new Map<string, A[]>();
    for (const a of [...assignments].sort(byDates)) {
        const list = byTask.get(a.taskId) ?? [];
        list.push(a);
        byTask.set(a.taskId, list);
    }
    const tasks = new Map(schedule.tasks.map(t => [t.id, t]));
    return schedule.installments.map(inst => ({
        no: inst.no,
        label: inst.label,
        tasks: inst.taskIds.flatMap((id): TeamTaskRow<A>[] => {
            const t = tasks.get(id);
            if (t === undefined) return [];
            const range = plannedRange(t.start, t.finish);
            const own = byTask.get(id) ?? [];
            const block = blocks.get(id);
            return [{
                id, installment: t.installment, name: t.name, ...range,
                skilled: finite(block?.skilled), labourers: finite(block?.labourers),
                trade: taskTrade(id),
                assignments: own,
                coverage: assignmentCoverage({ id, ...range }, own),
            }];
        }),
    }));
}

export interface TeamSummary {
    total: number;
    /** Tasks with at least one crew. */
    assigned: number;
    /** Tasks with no crew. */
    unassigned: number;
    /** Tasks with a crew on only part of their planned days. */
    partly: number;
}

export function teamSummary(groups: readonly TeamInstallment[]): TeamSummary {
    const rows = groups.flatMap(g => g.tasks);
    const assigned = rows.filter(r => r.coverage.status !== 'none').length;
    return {
        total: rows.length,
        assigned,
        unassigned: rows.length - assigned,
        partly: rows.filter(r => r.coverage.status === 'partly').length,
    };
}

/** "จัดทีมแล้ว 12 / 32 งาน · ยังไม่มีทีม 20 งาน · ทีมไม่ครบช่วงแผน 2 งาน". */
export function teamSummaryText(s: TeamSummary): string {
    const parts = [`จัดทีมแล้ว ${String(s.assigned)} / ${String(s.total)} งาน`];
    parts.push(s.unassigned === 0 ? 'ครบทุกงาน' : `ยังไม่มีทีม ${String(s.unassigned)} งาน`);
    if (s.partly > 0) parts.push(`ทีมไม่ครบช่วงแผน ${String(s.partly)} งาน`);
    return parts.join(' · ');
}

/** "22/01–31/01" (one day: "22/01"). */
export function dayMonthRange(start: string, end: string): string {
    return start === end ? formatDayMonth(start) : `${formatDayMonth(start)}–${formatDayMonth(end)}`;
}

/** "ช่าง 1 · คนงาน 5". */
export const needText = (skilled: number, labourers: number) => `ช่าง ${String(skilled)} · คนงาน ${String(labourers)}`;

const TASK_NAMES = new Map(PLAN_TASKS.map(t => [t.id, t.name]));

/** "1.5 งานฐานราก" (any project: the 32 tasks are the same plan). */
export const taskLabel = (taskId: string) => {
    const name = TASK_NAMES.get(taskId);
    return name === undefined ? taskId : `${taskId} ${name}`;
};

export interface BusyContext {
    /** The project open on the page ("โครงการนี้"). */
    projectId: string;
    /** Name of another project of the workspace (undefined when unknown). */
    projectName: (projectId: string) => string | undefined;
}

export const THIS_PROJECT = 'โครงการนี้';
const OTHER_PROJECT = 'โครงการอื่น';

/** "โครงการนี้" / the project's name / "โครงการอื่น". */
export function projectLabel(projectId: string, ctx: BusyContext): string {
    if (projectId === ctx.projectId) return THIS_PROJECT;
    return ctx.projectName(projectId) ?? OTHER_PROJECT;
}

/** "บ้านคุณวิชัย 1.5 งานฐานราก 22/01–31/01" — where the crew is and when (that assignment's own dates). */
export function busyPlace(b: CrewBusySpan<TeamAssignment>, ctx: BusyContext): string {
    const a = b.assignment;
    return `${projectLabel(a.projectId, ctx)} ${taskLabel(a.taskId)} ${dayMonthRange(a.start, a.end)}`;
}

/** The hint beside a crew in the picker: "ว่าง", or "ติดงาน <project> <task> dd/mm–dd/mm" (+ "และอีก n งาน"). */
export function availabilityHint(busy: readonly CrewBusySpan<TeamAssignment>[], ctx: BusyContext): string {
    const [first] = busy;
    if (first === undefined) return 'ว่าง';
    const more = busy.length - 1;
    return `ติดงาน ${busyPlace(first, ctx)}${more > 0 ? ` และอีก ${String(more)} งาน` : ''}`;
}

/** The crew's assignments in the workspace that share a day with [start, end] (none for an invalid range). */
export function busyOf<A extends TeamAssignment>(
    all: readonly A[], crewId: string, start: string | null, end: string | null, excludeId?: string,
): CrewBusySpan<A>[] {
    if (start === null || end === null) return [];
    return crewBusy(all, crewId, start, end, excludeId);
}

/** Lines of the warning shown before saving an overlapping assignment ("บ้านคุณวิชัย 1.5 งานฐานราก 22/01–31/01 (ซ้อน 3 วัน)"). */
export function overlapLines(busy: readonly CrewBusySpan<TeamAssignment>[], ctx: BusyContext): string[] {
    return busy.map(b => `${busyPlace(b, ctx)} (ซ้อน ${String(b.days)} วัน)`);
}

export interface AssignDraft {
    crewId: string | undefined;
    start: string | null;
    end: string | null;
}

export type AssignProblem = 'crew' | 'dates' | 'order';

export const ASSIGN_PROBLEM_TEXT: Record<AssignProblem, string> = {
    crew: 'เลือกทีม',
    dates: 'เลือกช่วงวันที่',
    order: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่ม',
};

/** What stops the form from saving (empty = can save). */
export function assignProblems(d: AssignDraft): AssignProblem[] {
    const out: AssignProblem[] = [];
    if (d.crewId === undefined) out.push('crew');
    if (d.start === null || d.end === null) out.push('dates');
    else if (d.end < d.start) out.push('order');
    return out;
}

/**
 * The PATCH body of an edit: only what changed (the contract refuses an empty body); undefined when nothing changed.
 * An emptied note is sent as null.
 */
export function assignmentPatch(
    before: { crewId: string; start: string; end: string; note: string | null },
    after: { crewId: string; start: string; end: string; note: string },
): { crewId?: string; start?: string; end?: string; note?: string | null } | undefined {
    const patch: { crewId?: string; start?: string; end?: string; note?: string | null } = {};
    if (after.crewId !== before.crewId) patch.crewId = after.crewId;
    if (after.start !== before.start) patch.start = after.start;
    if (after.end !== before.end) patch.end = after.end;
    const note = after.note.trim() === '' ? null : after.note.trim();
    if (note !== before.note) patch.note = note;
    return Object.keys(patch).length === 0 ? undefined : patch;
}
