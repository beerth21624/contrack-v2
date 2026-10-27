// ─── Crew names per planned task, for the ปฏิทินงาน (screen and print) ───
// Built from a project's crew assignments: each task's crews with their own date ranges, so a calendar day shows only
// the crews on that task that day. An empty map (guest project, module off, nothing assigned) changes nothing.
import { byDates, daySpan, type AssignmentSpan } from './assignments';

export interface TaskCrewSpan {
    crewId: string;
    name: string;
    start: string;
    end: string;
}

/** Task id → its crews, in date order. Tasks without a crew are absent. */
export type TaskCrewMap = ReadonlyMap<string, readonly TaskCrewSpan[]>;

export const NO_TASK_CREWS: TaskCrewMap = new Map();

/**
 * The project's assignments grouped by task, each with the crew's name (`crewName(crewId)`; a crew the caller does not
 * know, e.g. archived, gets `unknownName`). Assignments with invalid dates are left out.
 */
export function buildTaskCrewMap(
    assignments: readonly AssignmentSpan[], crewName: (crewId: string) => string | undefined, unknownName: string,
): TaskCrewMap {
    const out = new Map<string, TaskCrewSpan[]>();
    for (const a of [...assignments].sort(byDates)) {
        if (daySpan(a.start, a.end) === null) continue;
        const list = out.get(a.taskId) ?? [];
        list.push({ crewId: a.crewId, name: crewName(a.crewId) ?? unknownName, start: a.start, end: a.end });
        out.set(a.taskId, list);
    }
    return out;
}

const unique = (names: string[]) => [...new Set(names)];

/** Names of the crews on `taskId` on day `iso` (each name once, in date order). */
export function crewNamesOnDay(map: TaskCrewMap, taskId: string, iso: string): string[] {
    return unique((map.get(taskId) ?? []).filter(c => c.start <= iso && iso <= c.end).map(c => c.name));
}

/** Names of the crews on `taskId` that share a day with [from, to] (every crew of the task when no range is given). */
export function crewNamesInRange(map: TaskCrewMap, taskId: string, from?: string, to?: string): string[] {
    return unique((map.get(taskId) ?? [])
        .filter(c => (to === undefined || c.start <= to) && (from === undefined || c.end >= from))
        .map(c => c.name));
}

/** "ทีมช่างสมชาย, ทีมไฟฟ้าพงษ์" ('' when none). */
export const crewNamesText = (names: readonly string[]) => names.join(', ');
