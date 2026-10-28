// ─── Which planned tasks must finish before another can start (site order, W3) ───
// The 32 S-Curve tasks ("1.1" … "8.6") in the order of the construction-flow PDF (docs/rebuild/CONSTRUCTION_FLOW.md
// §1): one main line with four groups that run side by side (A: stairs beside the slabs and columns; B: brickwork and
// conduit beside the roof; C: ceiling, floor tiles, bathroom tiles and wall finish; D: electrical fittings, sanitary
// and misc). A task may start the day after every task before it has ended and its wait (task-lags.ts) has passed.
// Used by the what-if comparison and the suggestions of the crew board only: the S-Curve dates stay as typed (Excel).
import type { TaskLag } from '../../shared/contract/workforce';
import { effectiveTaskLag } from './task-lags';

export const TASK_AFTER: Readonly<Record<string, readonly string[]>> = {
    '1.1': [],
    '1.2': ['1.1'],
    '1.3': ['1.2'],
    '1.4': ['1.3'],
    '1.5': ['1.4'],
    '1.6': ['1.5'],
    '1.7': ['1.6'],
    '2.1': ['1.7'],
    '2.2': ['2.1'],
    '2.3': ['2.2'],
    '2.4': ['2.3'],
    '2.5': ['1.7'], // A: stairs beside the slabs and columns
    '3.1': ['2.4', '2.5'],
    '3.2': ['3.1'],
    '3.3': ['3.2'],
    '4.1': ['3.1'], // B: brickwork beside the roof
    '4.2': ['3.1'], // conduit laid with the brickwork
    '5.1': ['3.3', '4.1'],
    '5.2': ['3.3', '4.2'], // wiring pulled with the plaster
    '6.1': ['5.1'], // C
    '6.2': ['5.1'],
    '6.3': ['5.1'],
    '6.4': ['5.1'],
    '6.5': ['6.1', '6.2', '6.3', '6.4'],
    '7.1': ['6.5'],
    '7.2': ['7.1'],
    '8.1': ['7.2'], // D
    '8.2': ['7.2'],
    '8.3': ['7.2'],
    '8.4': ['8.1', '8.2', '8.3'],
    '8.5': ['8.4'],
    '8.6': ['8.5'],
};

/** The tasks that must end before `taskId` starts ([] for the first task or an unknown id). */
export function taskAfter(taskId: string): readonly string[] {
    return Object.hasOwn(TASK_AFTER, taskId) ? (TASK_AFTER[taskId] ?? []) : [];
}

/**
 * The nearest tasks before `taskId` that the project has work on (`present`): a task the project skips (no crew on it,
 * e.g. no piles) passes its own predecessors on, so 1.5 ฐานราก waits for 1.3 วางผัง when 1.4 เสาเข็ม has no crew.
 */
export function presentPredecessors(taskId: string, present: ReadonlySet<string>): string[] {
    const out = new Set<string>();
    const seen = new Set<string>();
    const walk = (id: string) => {
        for (const p of taskAfter(id)) {
            if (seen.has(p)) continue;
            seen.add(p);
            if (present.has(p)) out.add(p);
            else walk(p);
        }
    };
    walk(taskId);
    return [...out].sort();
}

/** The tasks that list `taskId` directly before them. */
export function taskSuccessors(taskId: string): string[] {
    return Object.keys(TASK_AFTER).filter(id => taskAfter(id).includes(taskId));
}

/** Days a task waits after `taskId` before the next can start (the project's override, else the default). */
export function lagAfter(taskId: string, overrides: readonly TaskLag[]): number {
    return Math.max(0, effectiveTaskLag(taskId, overrides).days);
}
