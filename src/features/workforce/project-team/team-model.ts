// ─── The "ทีมงาน" page as data (pure): the 32 planned tasks by งวด with their crews, the summary, Thai texts ───
// Rows read the computed plan (S-Curve start / finish, Man-Day ช่าง / คนงาน) and the project's crew assignments;
// nothing here changes a planning number.
import type { ManDayResult, ScheduleResult } from '@/domain/planning';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import { taskNameIn } from '@/domain/planning/labels.en';
import {
    DEFAULT_TASK_LAGS, assignmentCoverage, byDates, crewBusy, lagOverrides, lagReasonIn, taskTrade,
    type AssignmentCoverage, type AssignmentSpan, type CrewBusySpan, type EffectiveTaskLag,
} from '@/domain/workforce';
import { isoToSerial, serialToIso } from '@/domain/planning/calendar';
import { formatDayMonth } from '@/features/planning/shared/planning-format';
import { MAX_TASK_LAG_DAYS, type TaskLag, type WorkforceTradeId } from '@/shared/contract/workforce';
import { workforceLocale, workforceText } from '../text';

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
    const t = workforceText();
    const parts = [t('team.summaryAssigned', { assigned: String(s.assigned), total: String(s.total) })];
    parts.push(s.unassigned === 0 ? t('team.summaryAll') : t('team.summaryUnassigned', { count: s.unassigned }));
    if (s.partly > 0) parts.push(t('team.summaryPartly', { count: s.partly }));
    return parts.join(' · ');
}

/** "22/01–31/01" (one day: "22/01"). */
export function dayMonthRange(start: string, end: string): string {
    return start === end ? formatDayMonth(start) : `${formatDayMonth(start)}–${formatDayMonth(end)}`;
}

/** "ช่าง 1 · คนงาน 5". */
export const needText = (skilled: number, labourers: number) =>
    workforceText()('shared.headcount', { skilled: String(skilled), labourers: String(labourers) });

const TASK_NAMES = new Map(PLAN_TASKS.map(t => [t.id, t.name]));

/** "1.5 งานฐานราก" (any project: the 32 tasks are the same plan). */
export const taskLabel = (taskId: string) => {
    const name = TASK_NAMES.get(taskId);
    return name === undefined ? taskId : workforceText()('shared.taskLabel', { id: taskId, name: taskNameIn(taskId, name, workforceLocale()) });
};

export interface BusyContext {
    /** The project open on the page ("โครงการนี้"). */
    projectId: string;
    /** Name of another project of the workspace (undefined when unknown). */
    projectName: (projectId: string) => string | undefined;
}

/** "โครงการนี้" / the project's name / "โครงการอื่น". */
export function projectLabel(projectId: string, ctx: BusyContext): string {
    const t = workforceText();
    if (projectId === ctx.projectId) return t('shared.thisProject');
    return ctx.projectName(projectId) ?? t('shared.anotherProject');
}

/** "บ้านคุณวิชัย 1.5 งานฐานราก 22/01–31/01" — where the crew is and when (that assignment's own dates). */
export function busyPlace(b: CrewBusySpan<TeamAssignment>, ctx: BusyContext): string {
    const a = b.assignment;
    return `${projectLabel(a.projectId, ctx)} ${taskLabel(a.taskId)} ${dayMonthRange(a.start, a.end)}`;
}

/** The hint beside a crew in the picker: "ว่าง", or "ติดงาน <project> <task> dd/mm–dd/mm" (+ "และอีก n งาน"). */
export function availabilityHint(busy: readonly CrewBusySpan<TeamAssignment>[], ctx: BusyContext): string {
    const t = workforceText();
    const [first] = busy;
    if (first === undefined) return t('shared.free');
    const more = busy.length - 1;
    const place = busyPlace(first, ctx);
    return more > 0 ? t('shared.busyHintMore', { place, more: String(more) }) : t('shared.busyHint', { place });
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
    const t = workforceText();
    return busy.map(b => t('shared.overlapLine', { place: busyPlace(b, ctx), days: b.days }));
}

export interface AssignDraft {
    crewId: string | undefined;
    start: string | null;
    end: string | null;
}

export type AssignProblem = 'crew' | 'dates' | 'order';

/** The sentence that names a problem of the assign form. */
export const assignProblemText = (p: AssignProblem): string => workforceText()(`assign.problem.${p}`);

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

// ─── Conflicts: a crew booked on two assignments at once (any project of the workspace) ───

/** "28–30/10" within one month, else like dayMonthRange ("30/12–02/01"); one day: "28/10". */
export function compactDayMonthRange(start: string, end: string): string {
    if (start !== end && start.slice(0, 7) === end.slice(0, 7)) return `${start.slice(8, 10)}–${formatDayMonth(end)}`;
    return dayMonthRange(start, end);
}

/**
 * The assignments of the same crew in other projects of the workspace that share a day with `a`. Overlaps inside one
 * project are left out: on one site a crew moving between overlapping planned tasks is normal, not a double booking.
 */
export function chipConflicts<A extends TeamAssignment>(a: A, all: readonly A[]): CrewBusySpan<A>[] {
    return crewBusy(all, a.crewId, a.start, a.end, a.id).filter(b => b.assignment.projectId !== a.projectId);
}

/** Tooltip lines of a crew chip: "ชนกับ บ้านคุณสมศรี 4.1 งานก่ออิฐ 28–30/10 (3 วัน)", the shared days of each clash. */
export function conflictLines(busy: readonly CrewBusySpan<TeamAssignment>[], ctx: BusyContext): string[] {
    const t = workforceText();
    return busy.map(b => t('shared.clashLine', {
        project: projectLabel(b.assignment.projectId, ctx), task: taskLabel(b.assignment.taskId),
        range: compactDayMonthRange(b.from, b.to), days: b.days,
    }));
}

/** Chips of this project whose crew is also booked on another project on a shared day (from chipConflicts per chip). */
export function otherProjectConflictCount(
    conflicts: ReadonlyMap<string, readonly CrewBusySpan<TeamAssignment>[]>, projectId: string,
): number {
    let n = 0;
    for (const busy of conflicts.values()) if (busy.some(b => b.assignment.projectId !== projectId)) n += 1;
    return n;
}

/** "ทีมชนกับโครงการอื่น 2 จุด"; '' when there is none. */
export const conflictSummaryText = (n: number) => (n > 0 ? workforceText()('team.conflictSummary', { count: n }) : '');

// ─── Waits after tasks (ช่วงรอหลังงาน): the cell and the editor ───

/** "7 วัน · บ่มคอนกรีตฐานราก"; '' for no wait; "ไม่รอ" when the project removed a default wait. */
export function waitCellText(lag: EffectiveTaskLag): string {
    const t = workforceText();
    if (lag.days === 0) return lag.overridden ? t('wait.none') : '';
    return lag.reason === ''
        ? t('wait.cell', { days: lag.days })
        : t('wait.cellReason', { days: lag.days, reason: lagReasonIn(lag.taskId, lag.reason, workforceLocale()) });
}

/** "ค่าตั้งต้น 7 วัน · บ่มคอนกรีตฐานราก" / "ค่าตั้งต้น ไม่รอ". */
export function defaultWaitText(taskId: string): string {
    const t = workforceText();
    const def = DEFAULT_TASK_LAGS[taskId];
    return def === undefined
        ? t('wait.defaultNone')
        : t('wait.defaultText', { days: String(def.days), reason: lagReasonIn(taskId, def.reason, workforceLocale()) });
}

/** What stops a wait from saving (undefined = can save): whole days from 0 to 90. */
export function waitDaysProblem(days: number | null): string | undefined {
    if (days === null || !Number.isInteger(days) || days < 0 || days > MAX_TASK_LAG_DAYS) {
        return workforceText()('wait.problem', { max: String(MAX_TASK_LAG_DAYS) });
    }
    return undefined;
}

/**
 * The full override list to PUT after editing one task's wait (`edit` null = back to the default). Keeps the other
 * overrides; a note equal to the default reason counts as no note, so typing the default back drops the override.
 */
export function nextLagOverrides(
    current: readonly TaskLag[], taskId: string, edit: { days: number; note: string } | null,
): TaskLag[] {
    const typed: Record<string, { days: number; note?: string | null }> = Object.fromEntries(
        current.filter(l => l.taskId !== taskId).map(l => [l.taskId, { days: l.days, note: l.note }]),
    );
    if (edit !== null) {
        const note = edit.note.trim();
        typed[taskId] = { days: edit.days, note: note === DEFAULT_TASK_LAGS[taskId]?.reason ? null : note };
    }
    return lagOverrides(typed);
}

/** Same overrides once normalised (order, trimmed notes, defaults dropped), so an unchanged editor does not write. */
export function sameLagOverrides(a: readonly TaskLag[], b: readonly TaskLag[]): boolean {
    const key = (ls: readonly TaskLag[]) => JSON.stringify(lagOverrides(Object.fromEntries(ls.map(l => [l.taskId, l]))));
    return key(a) === key(b);
}
