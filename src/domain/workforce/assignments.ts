// ─── Crew assignments over calendar days (pure) ───
// An assignment puts a crew on a planned task of a project from `start` to `end`, both days included ('YYYY-MM-DD',
// calendar days, no holidays skipped — the same day rule as the S-Curve). These helpers answer the questions of the
// "ทีมงาน" page: is the crew free in a range, how much of a task's planned range has a crew, which crews to offer
// first. Nothing here changes a BOQ, Man-Day or S-Curve number.
import { isoToSerial, serialToIso } from '@/domain/planning/calendar';

/** What the helpers read of an assignment (CrewAssignmentDto has these fields). */
export interface AssignmentSpan {
    id: string;
    taskId: string;
    crewId: string;
    start: string;
    end: string;
}

/** An assignment of the crew that overlaps the asked range, with the shared days. */
export interface CrewBusySpan<A extends AssignmentSpan = AssignmentSpan> {
    assignment: A;
    /** First and last shared day (inclusive). */
    from: string;
    to: string;
    days: number;
}

/** [start, end] as serials; null when a date is missing or invalid, or the range runs backwards. */
export function daySpan(start: string | null | undefined, end: string | null | undefined): { s: number; e: number } | null {
    const s = isoToSerial(start);
    const e = isoToSerial(end);
    if (s === null || e === null || e < s) return null;
    return { s, e };
}

/** Days from `start` to `end` inclusive (0 when the range is invalid). */
export function spanDays(start: string | null | undefined, end: string | null | undefined): number {
    const r = daySpan(start, end);
    return r === null ? 0 : r.e - r.s + 1;
}

/**
 * The assignments of `crewId` that share at least one day with [start, end], in date order, each with the shared
 * days. `excludeId` leaves out the assignment being edited. An invalid range (missing date, end before start) is
 * busy with nothing; assignments with invalid dates are skipped.
 */
export function crewBusy<A extends AssignmentSpan>(
    assignments: readonly A[], crewId: string, start: string, end: string, excludeId?: string,
): CrewBusySpan<A>[] {
    const range = daySpan(start, end);
    if (range === null) return [];
    const out: CrewBusySpan<A>[] = [];
    for (const a of assignments) {
        if (a.crewId !== crewId || a.id === excludeId) continue;
        const r = daySpan(a.start, a.end);
        if (r === null) continue;
        const from = Math.max(r.s, range.s);
        const to = Math.min(r.e, range.e);
        if (to < from) continue;
        out.push({ assignment: a, from: serialToIso(from), to: serialToIso(to), days: to - from + 1 });
    }
    return out.sort((x, y) => byDates(x.assignment, y.assignment));
}

/** Date order: start, then end, then id (stable for equal ranges). */
export function byDates(a: AssignmentSpan, b: AssignmentSpan): number {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    if (a.end !== b.end) return a.end < b.end ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
}

export type CoverageStatus = 'covered' | 'partly' | 'none';

export interface AssignmentCoverage {
    /**
     * none    — no crew on the task;
     * covered — every planned day has a crew (or the task has no planned dates and has a crew);
     * partly  — a crew is assigned but some planned days have none (including a crew only outside the plan).
     */
    status: CoverageStatus;
    /** Planned days of the task (0 when it has no planned dates). */
    plannedDays: number;
    /** Planned days with at least one crew. */
    coveredDays: number;
    /** Assignments of the task (valid dates only). */
    assignments: number;
}

/**
 * How much of the task's planned range (start … finish, inclusive; a finish before the start counts as the start day,
 * like the crew calendar) has a crew, from the assignments of that task (others are ignored).
 */
export function assignmentCoverage(
    task: { id: string; start: string | null; finish: string | null },
    assignments: readonly AssignmentSpan[],
): AssignmentCoverage {
    const spans = assignments.filter(a => a.taskId === task.id).flatMap(a => {
        const r = daySpan(a.start, a.end);
        return r === null ? [] : [r];
    });
    const ps = isoToSerial(task.start);
    const pf = isoToSerial(task.finish);
    if (ps === null) {
        return { status: spans.length > 0 ? 'covered' : 'none', plannedDays: 0, coveredDays: 0, assignments: spans.length };
    }
    const pe = Math.max(ps, pf ?? ps);
    const plannedDays = pe - ps + 1;
    if (spans.length === 0) return { status: 'none', plannedDays, coveredDays: 0, assignments: 0 };

    // Union of the spans clipped to the plan.
    const clipped = spans
        .map(r => ({ s: Math.max(r.s, ps), e: Math.min(r.e, pe) }))
        .filter(r => r.e >= r.s)
        .sort((a, b) => a.s - b.s);
    let coveredDays = 0;
    let reach = ps - 1;
    for (const r of clipped) {
        const from = Math.max(r.s, reach + 1);
        if (r.e >= from) coveredDays += r.e - from + 1;
        reach = Math.max(reach, r.e);
    }
    return {
        status: coveredDays >= plannedDays ? 'covered' : 'partly',
        plannedDays, coveredDays, assignments: spans.length,
    };
}

/**
 * The crews of `trade` first, then the others; each group by name (Thai order), so the list a user picks from is the
 * same every time. `trade` undefined: everything by name.
 */
export function crewsByFit<C extends { trade: string; name: string }>(crews: readonly C[], trade: string | undefined): C[] {
    const byName = (a: C, b: C) => a.name.localeCompare(b.name, 'th');
    const fit = crews.filter(c => trade !== undefined && c.trade === trade).sort(byName);
    const other = crews.filter(c => trade === undefined || c.trade !== trade).sort(byName);
    return [...fit, ...other];
}
