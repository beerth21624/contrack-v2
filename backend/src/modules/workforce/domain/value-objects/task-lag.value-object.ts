// ─── Waiting windows after planned tasks (W2, ช่วงรอ): a project's overrides of the default waits ───
// Only the overrides are stored; the defaults live in the client (src/domain/workforce/task-lags.ts) and the server never
// applies them. Validated like the contract's schemas (the domain never trusts the edge).
import { MAX_TASK_LAG_DAYS } from '@contrack/contract';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';
import { planTaskId } from './plan-day.value-object';
import { optionalText } from './workforce-fields';

/** At most this many overrides per project (the contract's `.max(64)`; a plan has about 45 tasks). */
export const MAX_TASK_LAGS = 64;
export const TASK_LAG_NOTE_MAX = 200;

export interface TaskLag {
    taskId: string;
    /** Days the work waits after the task (0 … MAX_TASK_LAG_DAYS). */
    days: number;
    /** Why (trimmed; blank → null). */
    note: string | null;
}

export interface TaskLagInput {
    taskId: string;
    days: number;
    note?: string | null;
}

/** Plan task ids in numeric order: "1.9" < "1.10" < "2.1". */
export function compareTaskIds(a: string, b: string): number {
    const [aMajor = 0, aMinor = 0] = a.split('.').map(Number);
    const [bMajor = 0, bMinor = 0] = b.split('.').map(Number);
    return aMajor - bMajor || aMinor - bMinor;
}

export const sortTaskLags = (lags: readonly TaskLag[]): TaskLag[] =>
    [...lags].sort((a, b) => compareTaskIds(a.taskId, b.taskId));

export function taskLagDays(raw: number): Result<number, DomainError> {
    if (!Number.isInteger(raw) || raw < 0 || raw > MAX_TASK_LAG_DAYS) {
        return err(DomainError.validation(`A wait is a whole number of days from 0 to ${MAX_TASK_LAG_DAYS}`));
    }
    return ok(raw);
}

/**
 * A project's whole set of overrides: every task id a plan task id, at most one override per task, days in range,
 * notes trimmed (blank → null). Returned in task order.
 */
export function taskLagSet(raw: readonly TaskLagInput[]): Result<TaskLag[], DomainError> {
    if (raw.length > MAX_TASK_LAGS) return err(DomainError.validation(`A project has at most ${MAX_TASK_LAGS} waits`));
    const seen = new Set<string>();
    const lags: TaskLag[] = [];
    for (const item of raw) {
        const taskId = planTaskId(item.taskId);
        if (!taskId.ok) return taskId;
        if (seen.has(taskId.value)) return err(DomainError.validation(`Task "${taskId.value}" has more than one wait`));
        seen.add(taskId.value);
        const days = taskLagDays(item.days);
        if (!days.ok) return days;
        const note = optionalText(item.note, TASK_LAG_NOTE_MAX, 'note');
        if (!note.ok) return note;
        lags.push({ taskId: taskId.value, days: days.value, note: note.value });
    }
    return ok(sortTaskLags(lags));
}
