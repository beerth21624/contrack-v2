// ─── The "ทีมงาน" page's W3 numbers (pure): finish and labour as crewed vs the plan, and starts before a wait is over ───
// docs/workforce/00-crew-management-design.md §4. Reads the rows of buildTeamRows (S-Curve dates), the Man-Day result
// (ค่าแรงของงาน from the BOQ), the project's crew assignments, the crews' ฿/day and the waits after tasks. Advice only:
// nothing here changes a BOQ, Man-Day or S-Curve number, nor an assignment. Days are calendar days (the S-Curve rule).
import type { ManDayResult } from '@/domain/planning';
import { isoToSerial, serialToIso } from '@/domain/planning/calendar';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import { TASK_AFTER, lagAfter, presentPredecessors } from '@/domain/workforce/task-order';
import { thaiDay } from '@/domain/workforce/board';
import { readyDay } from '@/domain/workforce/scenario';
import type { TaskLag } from '@/shared/contract/workforce';
import { taskNameIn } from '@/domain/planning/labels.en';
import { workforceLocale, workforceText } from '../text';
import type { TeamAssignment, TeamInstallment } from './team-model';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const serial = (iso: string | null): number | null => (iso !== null && DAY_RE.test(iso) ? isoToSerial(iso) : null);

/** Assignments with a valid range (start ≤ end), as [start, end] serials. */
function span(a: TeamAssignment): { s: number; e: number } | null {
    const s = serial(a.start);
    const e = serial(a.end);
    return s === null || e === null || e < s ? null : { s, e };
}

// ─── วันเสร็จตามทีมที่จัด ───

export interface FinishMetric {
    /** Last day of the project's last assignment; null without (valid) assignments. */
    crewedFinish: string | null;
    /**
     * The latest S-Curve finish of the tasks that have a crew: the plan's finish of the same work. With every task
     * crewed it is the project's planned finish (the last task's finish).
     */
    planFinish: string | null;
    /** crewedFinish − planFinish in days: < 0 earlier than the plan, > 0 later; null when either is missing. */
    days: number | null;
    /** Some planned task has no crew yet: both dates cover the crewed tasks only. */
    partial: boolean;
}

export function finishMetric(groups: readonly TeamInstallment[]): FinishMetric {
    const rows = groups.flatMap(g => g.tasks);
    let crewed: number | null = null;
    let plan: number | null = null;
    for (const r of rows) {
        if (r.assignments.length === 0) continue;
        for (const a of r.assignments) {
            const x = span(a);
            if (x !== null) crewed = crewed === null ? x.e : Math.max(crewed, x.e);
        }
        const f = serial(r.finish);
        if (f !== null) plan = plan === null ? f : Math.max(plan, f);
    }
    return {
        crewedFinish: crewed === null ? null : serialToIso(crewed),
        planFinish: plan === null ? null : serialToIso(plan),
        days: crewed === null || plan === null ? null : crewed - plan,
        partial: rows.some(r => r.assignments.length === 0),
    };
}

/** "เร็วกว่าแผน 3 วัน" / "ช้ากว่าแผน 5 วัน" / "ตรงแผน". */
export function finishDeltaText(days: number): string {
    const t = workforceText();
    if (days < 0) return t('team.metrics.ahead', { days: -days });
    if (days > 0) return t('team.metrics.behind', { days });
    return t('team.metrics.onPlan');
}

// ─── ค่าแรงตามทีมที่จัด เทียบ ค่าแรงตาม BOQ (Man-Day) ───

export interface LabourMetric {
    /** Tasks compared: they have a crew and Man-Day counts labour for them. */
    taskIds: string[];
    /** Crewed tasks left out because Man-Day has no labour for them (piles, labour basis "none"). */
    excludedTaskIds: string[];
    /** Σ assignment days × the crew's ฿/day over the compared tasks; null when a crew on them has no known cost. */
    crewCost: number | null;
    /** Σ Man-Day ค่าแรงของงาน (from the BOQ) of the compared tasks. */
    boqLabour: number;
    /** crewCost − boqLabour (+ more than the BOQ); null when crewCost is. */
    diff: number | null;
    /** diff ÷ boqLabour × 100; null when crewCost is unknown or the BOQ labour is 0. */
    percent: number | null;
    /** Crews of the compared assignments without a known ฿/day: none, some or all of them. */
    missingCost: 'none' | 'some' | 'all';
}

/**
 * Labour as crewed against the Man-Day labour of the same tasks. `crewCost` gives a crew's ฿/day (null or undefined
 * when unknown, hidden from the viewer, or the crew is not listed). A crew on a task for two pieces counts both.
 */
export function labourMetric(
    groups: readonly TeamInstallment[], manday: ManDayResult, crewCost: (crewId: string) => number | null | undefined,
): LabourMetric {
    const blocks = new Map(manday.blocks.map(b => [b.id, b]));
    const taskIds: string[] = [];
    const excludedTaskIds: string[] = [];
    let cost = 0;
    let boqLabour = 0;
    let known = 0;
    let unknown = 0;
    for (const r of groups.flatMap(g => g.tasks)) {
        if (r.assignments.length === 0) continue;
        const block = blocks.get(r.id);
        if (block === undefined || block.labourBasis === 'none') { excludedTaskIds.push(r.id); continue; }
        taskIds.push(r.id);
        boqLabour += Number.isFinite(block.labourCost) ? block.labourCost : 0;
        for (const a of r.assignments) {
            const x = span(a);
            if (x === null) continue;
            const c = crewCost(a.crewId);
            if (c === null || c === undefined || !Number.isFinite(c)) { unknown += 1; continue; }
            known += 1;
            cost += (x.e - x.s + 1) * c;
        }
    }
    const crewTotal = unknown > 0 ? null : cost;
    const diff = crewTotal === null ? null : crewTotal - boqLabour;
    return {
        taskIds, excludedTaskIds,
        crewCost: crewTotal,
        boqLabour,
        diff,
        percent: diff === null || boqLabour === 0 ? null : (diff / boqLabour) * 100,
        missingCost: unknown === 0 ? 'none' : known === 0 ? 'all' : 'some',
    };
}

const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
/** "12,300 บาท". */
export const bahtText = (n: number) => workforceText()('shared.bahtAmount', { amount: BAHT.format(Math.round(n)) });

/** "สูงกว่า BOQ 12,300 บาท (+8.5%)" / "ต่ำกว่า BOQ 4,000 บาท (−3.1%)" / "เท่ากับ BOQ". */
export function labourDeltaText(diff: number, percent: number | null): string {
    const t = workforceText();
    const rounded = Math.round(diff);
    if (rounded === 0) return t('team.metrics.equal');
    const pct = percent === null ? '' : ` (${rounded > 0 ? '+' : '−'}${Math.abs(percent).toFixed(1)}%)`;
    return t(rounded > 0 ? 'team.metrics.above' : 'team.metrics.below', { amount: bahtText(Math.abs(rounded)), pct });
}

// ─── เริ่มก่อนครบช่วงรอ: a crewed start before the tasks before it have ended and their waits have passed ───

export interface EarlyStartCause {
    /** The task before it that sets the ready day. */
    taskId: string;
    /** Its last crewed day. */
    end: string;
    /** Its wait (days). */
    wait: number;
}

export interface EarlyStart {
    taskId: string;
    /** First crewed day of the task. */
    crewStart: string;
    /** First day it may start (readyDay: the latest task before it + its wait, the day after). */
    ready: string;
    /** ready − crewStart (> 0). */
    days: number;
    /** The tasks before it that set `ready` (usually one). */
    causes: EarlyStartCause[];
}

/**
 * Tasks of the project whose first crewed day comes before the day they may start (task-order.ts + the waits), in
 * site order. Only crewed tasks count on both sides: a task with no crew passes its own predecessors on. Only tasks not
 * started yet (first crewed day after `today`) are listed: a start already past cannot be changed any more.
 */
export function earlyStarts(assignments: readonly TeamAssignment[], lags: readonly TaskLag[], today: string): EarlyStart[] {
    const t = serial(today);
    const valid = assignments.filter(a => span(a) !== null);
    const present = new Set(valid.map(a => a.taskId));
    const starts = new Map<string, number>();
    const ends = new Map<string, number>();
    for (const a of valid) {
        const x = span(a);
        if (x === null) continue;
        starts.set(a.taskId, Math.min(starts.get(a.taskId) ?? x.s, x.s));
        ends.set(a.taskId, Math.max(ends.get(a.taskId) ?? x.e, x.e));
    }
    const out: EarlyStart[] = [];
    for (const taskId of Object.keys(TASK_AFTER)) {
        const s = starts.get(taskId);
        if (s === undefined || t === null || s <= t) continue;
        const ready = readyDay(valid, taskId, lags);
        const r = serial(ready);
        if (ready === null || r === null || s >= r) continue;
        const causes = presentPredecessors(taskId, present).flatMap((p): EarlyStartCause[] => {
            const e = ends.get(p);
            const wait = lagAfter(p, lags);
            return e !== undefined && e + wait + 1 === r ? [{ taskId: p, end: serialToIso(e), wait }] : [];
        });
        out.push({ taskId, crewStart: serialToIso(s), ready, days: r - s, causes });
    }
    return out;
}

const TASK_NAMES = new Map(PLAN_TASKS.map(t => [t.id, t.name]));
const taskName = (id: string) => {
    const name = TASK_NAMES.get(id);
    return name === undefined ? id : taskNameIn(id, name, workforceLocale());
};

/** "24 ต.ค." (with the year when the two days of a line fall in different years). */
const day = (iso: string, other: string) => thaiDay(iso, iso.slice(0, 4) !== other.slice(0, 4), workforceLocale());

/**
 * Tooltip lines: "งานก่อนหน้า (งานฐานราก) จบ 24 ต.ค. + รอ 7 วัน → เริ่มได้ 1 พ.ย." per task that sets the day, then
 * "ทีมที่จัดเริ่ม 28 ต.ค. ก่อนเริ่มได้ 4 วัน".
 */
export function earlyStartLines(e: EarlyStart): string[] {
    const t = workforceText();
    const lines = e.causes.map(c => t(c.wait > 0 ? 'team.early.causeWait' : 'team.early.cause', {
        task: taskName(c.taskId), end: day(c.end, e.ready), wait: c.wait, ready: day(e.ready, c.end),
    }));
    if (lines.length === 0) lines.push(t('team.early.readyOnly', { ready: thaiDay(e.ready, false, workforceLocale()) }));
    lines.push(t('team.early.crewStart', { start: day(e.crewStart, e.ready), days: e.days }));
    return lines;
}

/** "เริ่มก่อนครบช่วงรอ 2 งาน"; '' when there is none. */
export const earlyStartSummaryText = (n: number) => (n > 0 ? workforceText()('team.earlySummary', { count: n }) : '');
