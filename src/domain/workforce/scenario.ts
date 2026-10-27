// ─── What-if of crew moves on the board (W3): apply moves, then compare before and after (pure) ───
// docs/workforce/00-crew-management-design.md §4. A move changes one assignment's crew and/or days. Tasks later in
// the same project (task-order.ts) that would now start before the moved task has ended and its wait has passed are
// pushed later by the days needed, task by task (a knock-on, งานที่เลื่อนตาม); nothing is ever pulled earlier unless a
// move says so. A project that already started a task early (before the wait was over) keeps that, but is not made
// worse. The comparison reads the crew board (board.ts) of both versions over the same window.
// Days are calendar days (the S-Curve rule). Nothing here changes a BOQ, Man-Day or S-Curve number, nor the
// assignments themselves: accepting a suggestion is the caller's (it saves `changed` one by one).
import { isoToSerial, serialToIso } from '../planning/calendar';
import type { TaskLag } from '../../shared/contract/workforce';
import { buildCrewBoard, type BoardAssignment, type BoardWindow } from './board';
import { TASK_AFTER, lagAfter, presentPredecessors } from './task-order';

/** One change: another crew and/or other days. `start` alone keeps the length; `end` alone keeps the start. */
export interface Move {
    assignmentId: string;
    crewId?: string;
    start?: string;
    end?: string;
}

export interface ChangedAssignment<A extends BoardAssignment = BoardAssignment> {
    /** null for an added assignment (a crew sent to help, to be created). */
    before: A | null;
    after: A;
    /**
     * 'move' — asked for; 'add' — a new assignment asked for; 'knock-on' — pushed later because a task before it
     * moved later; 'pull' — brought earlier because a task before it now ends earlier (only with `pullSuccessors`).
     */
    cause: 'move' | 'add' | 'knock-on' | 'pull';
    /** after.start − before.start in days (+ later, − earlier); 0 for an add. */
    shiftDays: number;
}

export interface MovesOptions<A extends BoardAssignment = BoardAssignment> {
    /** New assignments (ids the caller makes up, e.g. "new-1"): a crew sent to help on a task. */
    adds?: readonly A[];
    /**
     * Also bring later tasks of the project earlier when a task before them now ends earlier: by as many days as their
     * ready day moved, never before the new ready day, and never onto other work of their crew. Off: pushes only.
     */
    pullSuccessors?: boolean;
}

export interface MovesResult<A extends BoardAssignment = BoardAssignment> {
    /** Every assignment, changed ones replaced and adds appended, in the input order. */
    assignments: A[];
    /** The changed assignments: moves (in the order asked), adds, then knock-ons and pulls in task order. */
    changed: ChangedAssignment<A>[];
}

/** What the comparison reads of a crew (CrewDto has these fields). */
export interface ScenarioCrew {
    id: string;
    /** ฿/day; null when unknown or hidden from the viewer. */
    dailyCost: number | null;
}

export interface ProjectOutcome {
    projectId: string;
    /** Last day of the project's last assignment (the finish as crewed); null without assignments. */
    finish: string | null;
    /** Σ assignment days (crew-days, a day with two crews counts twice). */
    crewDays: number;
    /** Σ assignment days × the crew's ฿/day; null when any crew on it has no known cost. */
    labourCost: number | null;
}

export interface ScenarioMetrics {
    /** By project id, in id order. */
    projects: ProjectOutcome[];
    /** Conflicts in the window (same count as the board's summary). */
    conflicts: number;
    /** Conflicts between two projects (the ones the board marks in red on the team page). */
    crossProjectConflicts: number;
    /** Σ idle crew-days in the window (waits included) and the part inside waits. */
    idleCrewDays: number;
    waitCrewDays: number;
    /** Σ idle days × ฿/day over crews with a known cost (what a crew paid every day costs while free). */
    idleValue: number;
    /** Some crews have no known cost: `idleValue` leaves them out. */
    idleValuePartial: boolean;
    /** Mean crew utilisation in the window, 0 … 1. */
    averageUtilisation: number;
}

export interface ProjectDelta {
    projectId: string;
    finishBefore: string | null;
    finishAfter: string | null;
    /** finishAfter − finishBefore in days: negative = finishes earlier (days saved), positive = later. 0 when either is null. */
    days: number;
    /** labourCost after − before; null when either is unknown. */
    labourCost: number | null;
}

export interface ScenarioDelta {
    /** Projects whose finish or labour cost changed, by id. */
    projects: ProjectDelta[];
    /** Σ of the negative project day deltas, as a positive number (days saved), and Σ of the positive ones. */
    daysSaved: number;
    daysLost: number;
    conflicts: number;
    crossProjectConflicts: number;
    idleCrewDays: number;
    idleValue: number;
    labourCost: number | null;
}

export interface WhatIf<A extends BoardAssignment = BoardAssignment> {
    result: MovesResult<A>;
    before: ScenarioMetrics;
    after: ScenarioMetrics;
    delta: ScenarioDelta;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function serial(iso: string): number | null {
    return DAY_RE.test(iso) ? isoToSerial(iso) : null;
}

/** The task-level end of a project's work: last end over the pieces of each task (invalid dates skipped). */
function taskEnds(list: readonly BoardAssignment[]): Map<string, number> {
    const out = new Map<string, number>();
    for (const a of list) {
        const e = serial(a.end);
        if (e === null || serial(a.start) === null) continue;
        out.set(a.taskId, Math.max(out.get(a.taskId) ?? e, e));
    }
    return out;
}

/** First day `taskId` may start in a project: the day after the latest predecessor end + its wait; null when none. */
function readySerial(
    taskId: string, present: ReadonlySet<string>, ends: ReadonlyMap<string, number>, lags: readonly TaskLag[],
): number | null {
    let ready: number | null = null;
    for (const p of presentPredecessors(taskId, present)) {
        const e = ends.get(p);
        if (e === undefined) continue;
        const day = e + lagAfter(p, lags) + 1;
        ready = ready === null ? day : Math.max(ready, day);
    }
    return ready;
}

/**
 * The first day `taskId` may start in the project, by its tasks before it and their waits ('YYYY-MM-DD'); null for a
 * first task or one with no crewed task before it.
 */
export function readyDay(
    projectAssignments: readonly BoardAssignment[], taskId: string, lags: readonly TaskLag[],
): string | null {
    const present = new Set(projectAssignments.map(a => a.taskId));
    const r = readySerial(taskId, present, taskEnds(projectAssignments), lags);
    return r === null ? null : serialToIso(r);
}

function withMove<A extends BoardAssignment>(a: A, m: Move): A {
    const s = serial(a.start);
    const e = serial(a.end);
    let start = a.start;
    let end = a.end;
    if (m.start !== undefined && serial(m.start) !== null) {
        start = m.start;
        if (m.end === undefined && s !== null && e !== null) end = serialToIso((serial(m.start) ?? 0) + (e - s));
    }
    if (m.end !== undefined && serial(m.end) !== null) end = m.end;
    return { ...a, crewId: m.crewId ?? a.crewId, start, end };
}

function shifted<A extends BoardAssignment>(a: A, days: number): A {
    const s = serial(a.start);
    const e = serial(a.end);
    if (s === null || e === null) return a;
    return { ...a, start: serialToIso(s + days), end: serialToIso(e + days) };
}

/** Days `a` may come earlier (≤ `limit`) without sharing a day with work of its crew it did not share before. */
function freePull(a: BoardAssignment, limit: number, all: Iterable<BoardAssignment>): number {
    const s = serial(a.start);
    const e = serial(a.end);
    if (s === null || e === null || limit <= 0) return 0;
    const others: { s: number; e: number }[] = [];
    for (const o of all) {
        if (o.id === a.id || o.crewId !== a.crewId) continue;
        const os = serial(o.start);
        const oe = serial(o.end);
        if (os === null || oe === null) continue;
        if (os <= e && oe >= s) continue; // already shared a day: not made worse by moving earlier
        others.push({ s: os, e: oe });
    }
    for (let p = limit; p > 0; p--) {
        if (!others.some(o => o.s <= e - p && o.e >= s - p)) return p;
    }
    return 0;
}

/**
 * `assignments` with `moves` and `adds` applied, and what they cause in each project: later tasks pushed later when a
 * task before them now ends later (knock-on), and with `pullSuccessors` brought earlier when it ends earlier. A move of
 * an unknown assignment is ignored; the last move of an assignment wins. `lagsByProject` holds the projects' wait
 * overrides (absent: defaults).
 */
export function applyMoves<A extends BoardAssignment>(
    assignments: readonly A[], moves: readonly Move[], lagsByProject: ReadonlyMap<string, readonly TaskLag[]>,
    options: MovesOptions<A> = {},
): MovesResult<A> {
    const adds = options.adds ?? [];
    const byId = new Map(assignments.map(a => [a.id, a]));
    const moved = new Map<string, A>();
    const order: string[] = [];
    for (const m of moves) {
        const base = byId.get(m.assignmentId);
        if (base === undefined) continue;
        if (!moved.has(m.assignmentId)) order.push(m.assignmentId);
        moved.set(m.assignmentId, withMove(moved.get(m.assignmentId) ?? base, m));
    }

    const current = new Map<string, A>(assignments.map(a => [a.id, moved.get(a.id) ?? a]));
    for (const a of adds) current.set(a.id, a);
    const fixed = new Set([...moved.keys(), ...adds.map(a => a.id)]);
    const follow: { id: string; cause: 'knock-on' | 'pull' }[] = [];
    const projects = new Set([...moved.values(), ...adds].map(a => a.projectId));
    for (const projectId of projects) {
        const lags = lagsByProject.get(projectId) ?? [];
        const own = assignments.filter(a => a.projectId === projectId);
        const ownIds = [...own.map(a => a.id), ...adds.filter(a => a.projectId === projectId).map(a => a.id)];
        const present = new Set(own.map(a => a.taskId));
        // An add may crew a task the project had no crew on: it counts in the order from now on.
        const presentNow = new Set([...present, ...adds.filter(a => a.projectId === projectId).map(a => a.taskId)]);
        const beforeEnds = taskEnds(own);
        // Task by task in site order (TASK_AFTER lists every task after the ones it waits for).
        for (const taskId of Object.keys(TASK_AFTER)) {
            if (!present.has(taskId)) continue;
            const nowEnds = taskEnds(ownIds.flatMap(id => { const a = current.get(id); return a === undefined ? [] : [a]; }));
            const oldReady = readySerial(taskId, present, beforeEnds, lags);
            const newReady = readySerial(taskId, presentNow, nowEnds, lags);
            if (newReady === null) continue;
            for (const a of own) {
                if (a.taskId !== taskId || fixed.has(a.id)) continue;
                const s = serial(a.start);
                if (s === null) continue;
                const push = newReady - Math.max(s, oldReady ?? s);
                if (push > 0) {
                    current.set(a.id, shifted(a, push));
                    follow.push({ id: a.id, cause: 'knock-on' });
                    continue;
                }
                if (options.pullSuccessors !== true || oldReady === null || newReady >= oldReady) continue;
                const pull = freePull(a, Math.min(oldReady - newReady, s - newReady), current.values());
                if (pull <= 0) continue;
                current.set(a.id, shifted(a, -pull));
                follow.push({ id: a.id, cause: 'pull' });
            }
        }
    }

    const change = (id: string, cause: ChangedAssignment['cause']): ChangedAssignment<A> | null => {
        const before = byId.get(id);
        const after = current.get(id);
        if (before === undefined || after === undefined) return null;
        const bs = serial(before.start);
        const as = serial(after.start);
        return { before, after, cause, shiftDays: bs === null || as === null ? 0 : as - bs };
    };
    const changed: ChangedAssignment<A>[] = [
        ...order.map(id => change(id, 'move'))
            .filter((c): c is ChangedAssignment<A> => c !== null)
            .filter(c => c.before?.crewId !== c.after.crewId || c.before.start !== c.after.start || c.before.end !== c.after.end),
        ...adds.map((a): ChangedAssignment<A> => ({ before: null, after: a, cause: 'add', shiftDays: 0 })),
        ...follow.map(f => change(f.id, f.cause)).filter((c): c is ChangedAssignment<A> => c !== null),
    ];
    return { assignments: [...assignments.map(a => current.get(a.id) ?? a), ...adds], changed };
}

/** The numbers the comparison shows, for one version of the assignments over `window`. */
export function scenarioMetrics(
    crews: readonly ScenarioCrew[], assignments: readonly BoardAssignment[],
    lagsByProject: ReadonlyMap<string, readonly TaskLag[]>, window: BoardWindow, today: string,
): ScenarioMetrics {
    const board = buildCrewBoard(crews, assignments, lagsByProject, window, today);
    const cost = new Map(crews.map(c => [c.id, c.dailyCost]));

    const byProject = new Map<string, BoardAssignment[]>();
    for (const a of assignments) {
        const list = byProject.get(a.projectId);
        if (list === undefined) byProject.set(a.projectId, [a]);
        else list.push(a);
    }
    const projects = [...byProject.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)).map(([projectId, list]): ProjectOutcome => {
        let finish: number | null = null;
        let crewDays = 0;
        let labourCost: number | null = 0;
        for (const a of list) {
            const s = serial(a.start);
            const e = serial(a.end);
            if (s === null || e === null || e < s) continue;
            finish = finish === null ? e : Math.max(finish, e);
            const days = e - s + 1;
            crewDays += days;
            const c = cost.get(a.crewId);
            labourCost = labourCost === null || c === undefined || c === null ? null : labourCost + days * c;
        }
        return { projectId, finish: finish === null ? null : serialToIso(finish), crewDays, labourCost };
    });

    let idleValue = 0;
    let idleValuePartial = false;
    for (const r of board.rows) {
        const c = cost.get(r.crew.id);
        if (c === undefined || c === null) { if (r.metrics.idleDays > 0) idleValuePartial = true; continue; }
        idleValue += r.metrics.idleDays * c;
    }

    return {
        projects,
        conflicts: board.totals.conflicts,
        crossProjectConflicts: board.conflicts.filter(c => !c.sameProject).length,
        idleCrewDays: board.totals.idleCrewDays,
        waitCrewDays: board.totals.waitCrewDays,
        idleValue,
        idleValuePartial,
        averageUtilisation: board.totals.averageUtilisation,
    };
}

/** After − before. Projects listed only when their finish or labour cost changed. */
export function compareScenarios(before: ScenarioMetrics, after: ScenarioMetrics): ScenarioDelta {
    const ids = [...new Set([...before.projects, ...after.projects].map(p => p.projectId))].sort();
    const b = new Map(before.projects.map(p => [p.projectId, p]));
    const a = new Map(after.projects.map(p => [p.projectId, p]));
    const projects: ProjectDelta[] = [];
    let daysSaved = 0;
    let daysLost = 0;
    let labourCost: number | null = 0;
    for (const id of ids) {
        const x = b.get(id);
        const y = a.get(id);
        const fb = x?.finish ?? null;
        const fa = y?.finish ?? null;
        const sb = fb === null ? null : isoToSerial(fb);
        const sa = fa === null ? null : isoToSerial(fa);
        const days = sb === null || sa === null ? 0 : sa - sb;
        const cb = x?.labourCost ?? null;
        const ca = y?.labourCost ?? null;
        const cost = cb === null || ca === null ? null : ca - cb;
        labourCost = labourCost === null || cost === null ? null : labourCost + cost;
        if (days < 0) daysSaved -= days;
        if (days > 0) daysLost += days;
        if (days !== 0 || fb !== fa || (cost !== null && cost !== 0) || (cost === null && cb !== ca)) {
            projects.push({ projectId: id, finishBefore: fb, finishAfter: fa, days, labourCost: cost });
        }
    }
    return {
        projects, daysSaved, daysLost,
        conflicts: after.conflicts - before.conflicts,
        crossProjectConflicts: after.crossProjectConflicts - before.crossProjectConflicts,
        idleCrewDays: after.idleCrewDays - before.idleCrewDays,
        idleValue: after.idleValue - before.idleValue,
        labourCost,
    };
}

/** Apply `moves` and compare the board before and after over `window`. */
export function whatIf<A extends BoardAssignment>(
    crews: readonly ScenarioCrew[], assignments: readonly A[], lagsByProject: ReadonlyMap<string, readonly TaskLag[]>,
    moves: readonly Move[], window: BoardWindow, today: string, options: MovesOptions<A> = {},
): WhatIf<A> {
    const result = applyMoves(assignments, moves, lagsByProject, options);
    const before = scenarioMetrics(crews, assignments, lagsByProject, window, today);
    const after = scenarioMetrics(crews, result.assignments, lagsByProject, window, today);
    return { result, before, after, delta: compareScenarios(before, after) };
}
