// ─── "ยืนยันและไปขั้นตอนถัดไป": complete the step only when nothing required is missing (pure) ───
import type { LevelMark, MissingValue } from '@/domain/journey';

/**
 * What the primary button of a step does:
 * - `complete`: nothing required is missing → mark the step done and go on;
 * - `blocked`: something required is missing → stay, list it and highlight it (the step is not marked);
 * - `move`: the step is already decided (done or not in this project) → just go on. A done step that became
 *   incomplete later stays done (it only shows a quiet note); it is never un-marked here.
 */
export type ConfirmOutcome =
    | { kind: 'complete' }
    | { kind: 'move' }
    | { kind: 'blocked'; missing: readonly MissingValue[] };

export function confirmOutcome(mark: LevelMark | undefined, missing: readonly MissingValue[]): ConfirmOutcome {
    if (mark !== undefined) return { kind: 'move' };
    return missing.length === 0 ? { kind: 'complete' } : { kind: 'blocked', missing };
}

/** Number of required values a step already marked done now lacks (0 = nothing to say). */
export function incompleteDoneCount(mark: LevelMark | undefined, missing: readonly MissingValue[]): number {
    return mark === 'done' ? missing.length : 0;
}
